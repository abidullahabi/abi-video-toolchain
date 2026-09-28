from pathlib import Path
import json,wave,hashlib,subprocess,shutil
from datetime import datetime, timezone
import numpy as np
R=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
P=R/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';Q=P/'review/revision-v2'
Q.mkdir(parents=True,exist_ok=True)
def save(path,data):
 assert not path.exists(),f'Preserving existing file {path}'
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
old=json.loads((P/'review/keep-v3.json').read_text())
meta=json.loads((P/'workflow.json').read_text())
assert Path(meta['source']).resolve()==(P/'sources/IMG_1967.MOV').resolve()
assert Path(meta['source']).stat().st_ino != Path(meta['originalSource']).stat().st_ino
assert meta['sourceCopy']['copyVerified'] and meta['sourceHandling']['policy']=='working_copy_only'
ks=old['intervals'][:13]+[
[150.8,152.2,'andrew-name'],
[158.73333333333333,162.16666666666666,'andrew-content'],
[167.36666666666667,168.96666666666667,'andrew-limits'],
[211.36666666666667,213.46666666666667,'google-intro'],
[213.53333333333333,214.4,'google-intro'],
[214.63333333333333,216.03333333333333,'google-intro'],
[216.23333333333332,218.0,'google-intro'],
[250.5,254.46666666666667,'google-content'],
[306.6,310.8333333333333,'outro'],
[311.93333333333334,313.3666666666667,'outro'],
[313.8,315.53333333333336,'outro'],
[315.8333333333333,317.6,'outro']]
intervals=[];timeline=[];cursor=0
for a,b,label in ks:
 start,end=round(a*30),round(b*30)
 assert abs(a-start/30)<1e-8 and abs(b-end/30)<1e-8 and end>start
 a,b=start/30,end/30
 intervals.append([a,b,label])
 timeline.append({'sourceStart':a,'sourceEnd':b,'sourceStartFrame':start,'sourceEndFrameExclusive':end,'outputStart':cursor/30,'outputEnd':(cursor+end-start)/30,'outputStartFrame':cursor,'outputEndFrameExclusive':cursor+end-start,'block':label})
 cursor+=end-start
assert sum(round((b-a)*30) for a,b,_ in intervals[:13])==969
assert all(round(a*30)==round(c*30) and round(b*30)==round(d*30) for (a,b,_),(c,d,_) in zip(intervals[:13],old['intervals'][:13]))
changes=[
{'source':[148.66666666666666,154.4],'action':'Replace with 150.8–152.2, complete title candidate. Remove certificate prefix and uncertain attribution/aside.','evidence':'Prior targeted ASR/DTW plus isolated exact title recognition: Gen. AI for everyone.','limitation':'No listening. Everyone/von adjacent phonetic boundary at152.2 remains specifically open for listening review.'},
{'source':[167.4,168.96666666666667],'action':'Add one frame of lead-in at167.3667 to protect low-level onset.'},
{'source':[211.4,218.0],'action':'Add one frame of lead-in at211.3667. Existing internal Google introduction pauses unchanged.'},
{'source':[225.03333333333333,228.8],'action':'Remove entire selected Google name line including isolated unassigned speech at226.176–226.304. Do not splice syllables. Course introduction and content retained.','authorization':'User approved whole name omission if no clean complete take established.'},
{'source':[308.96666666666664,309.06666666666666],'action':'Restore removed100ms because quiet sound remains and cannot be classified as disposable silence.'},
{'source':[313.3666666666667,313.8666666666667],'action':'Removal now ends313.8. Retain extra66.667ms leading into schreib.'},
{'source':[316.56666666666666,317.6],'action':'Append1033.333ms of natural footage through held smile and thumb pose. Not freeze. Stop before release.'}]
plan={'version':'KI-Einstieg Schnitt v2','createdAt':datetime.now(timezone.utc).isoformat(),'approvedScope':'User approved correction plan with ok. Raw cut only, preserve beginning, remove faulty name attempts, protect speech edges and final gesture.','source':meta['source'],'sourceSha256':meta['sourceSha256'],'basePlan':'review/keep-v3.json','speed':1,'fps':30,'sampleRate':48000,'channels':1,'audioEdgeFadeMs':5,'duration':cursor/30,'frameCount':cursor,'sampleCount':cursor*1600,'intervals':intervals,'timeline':timeline,'changes':changes,'preservedPrefixSeconds':32.3,'targetDuration':None,'pauseMetricUsedAsHardGate':False,'auditoryReviewPerformed':False,'openListeningChecks':['Andrew title at32.3s: complete Everyone and no clipped von residue.','Changed word lead-ins, CTA schreib and Folgen.','Overall prosody and natural joins.'],'designStarted':False,'qualitativeFinalApproval':False}
save(Q/'keep-v2.json',plan)
save(Q/'workflow-before-v2.json',meta)
with wave.open(str(P/'review/source48k-s16.wav'),'rb') as src:
 assert src.getnchannels()==1 and src.getframerate()==48000 and src.getsampwidth()==2
 audio=np.frombuffer(src.readframes(src.getnframes()),dtype='<i2').astype(np.float64)
parts=[]
for a,b,label in intervals:
 x=audio[round(a*48000):round(b*48000)].copy()
 fade=min(240,len(x)//2)
 x[:fade]*=np.arange(fade)/fade
 x[-fade:]*=np.arange(fade-1,-1,-1)/fade
 parts.append(np.clip(np.rint(x),-32768,32767).astype('<i2'))
raw=np.concatenate(parts)
assert len(raw)==plan['sampleCount']
with wave.open(str(P/'review/calibration-v3.wav'),'rb') as src:
 oldraw=np.frombuffer(src.readframes(src.getnframes()),dtype='<i2')
prefix=round(32.3*48000)
assert np.array_equal(raw[:prefix],oldraw[:prefix])
with wave.open(str(Q/'cut-audio.wav'),'wb') as dst:
 dst.setnchannels(1);dst.setsampwidth(2);dst.setframerate(48000);dst.writeframes(raw.tobytes())
save(Q/'pcm-checks.json',{'sampleCount':len(raw),'duration':len(raw)/48000,'prefixSampleCount':prefix,'first32_3SecondsBitIdenticalToV1PCM':True,'prefixSha256':hashlib.sha256(raw[:prefix].tobytes()).hexdigest(),'sourceIntervalsMatchVideo':True,'speed':1,'fadesMs':5,'hearingPerformed':False})
for name in ['title48.wav','title16.wav','title-asr.json','title-asr.txt','title-asr.log']:
 src=Path('/private/tmp/ki-v2-title-check')/name
 if src.exists():shutil.copy2(src,Q/name)
shutil.copy2(__file__,Q/'build-ki-v2.py')
sel='+'.join(f'gte(n,{round(a*30)})*lt(n,{round(b*30)})' for a,b,_ in intervals)
(Q/'video-filter.txt').write_text(f"[0:v:0]fps=30,select='{sel}',setpts=N/(30*TB),scale=1080:1920:flags=lanczos,setsar=1[vout]\n")
save(Q/'timeline-map-v2.json',{'source':meta['source'],'speed':1,'intervals':timeline})
print(json.dumps({'duration':plan['duration'],'frames':cursor,'intervals':len(intervals),'prefixPCMUnchanged':True,'plan':str(Q/'keep-v2.json')},ensure_ascii=False))
