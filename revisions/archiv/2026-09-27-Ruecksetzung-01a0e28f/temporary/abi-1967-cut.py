from pathlib import Path
from datetime import datetime,timezone
import json,math,subprocess,sys,wave,hashlib
import numpy as np
R=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
P=R/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';Q=P/'review';F=R/'tools/bin/ffmpeg'
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
blocks=[('hook',11.8,23.95,'Wenn du Student bist ... Anschluss noch zu gewinnen.'),('anthropic-intro',30,34.50,'Das erste Zertifikat ... komplette Schulung von Anthropic.'),('anthropic-fit',46.05,51.55,'Ist natuerlich auch stark auf Claude ausgerichtet ... sehr guter Einstieg.'),('anthropic-name',74.4,77.5,'AI Fluency, Frameworks and Foundations. War ziemlich geil.'),('anthropic-content',83.33,88.65,'Du lernst da auch wirklich was ... selber machen solltest, zum Beispiel.'),('andrew-intro',138.37,143.95,'Das zweite Zertifikat ... technischen Grenzen ... fuer dich gedacht.'),('andrew-name',148.67,154.4,'Das Zertifikat heisst Gen AI for Everyone von Andrew Ng oder so heisst er.'),('andrew-content',158.69,162.2,'Da siehst du ... wie Sprachmodelle trainiert werden.'),('andrew-limits',167.36,169.02,'Was sie koennen und was sie auch nicht koennen.'),('google-intro',211.3,218,'Wenn du AI vor allem im Berufsalltag nutzen willst ... geeignet.'),('google-name',225.06,228.83,'Google AI Professional Certificate.'),('google-content',250.48,254.57,'Hier wird gezeigt ... Daten auswertest, Texte schreibst ... Basics.'),('outro',306.54,316.54,'Es ist noch nicht zu spaet ... Kommentar oder DM ... Folgen nicht vergessen.')]
# All boundaries share the explicit 30-fps output timebase. This is recorded as a source-to-CFR conversion.
blocks=[dict(id=i,start=math.floor(a*30+1e-8)/30,end=math.ceil(b*30-1e-8)/30,textBasis=t) for i,a,b,t in blocks]
if not (Q/'selection-locked.json').exists():save(Q/'selection-locked.json',{'status':'locked_for_pause_calibration','approvedBy':'User ok passt on proposed storyline; source block boundaries independently resolved by targeted DTW','createdAt':datetime.now(timezone.utc).isoformat(),'speed':1,'blocks':blocks,'notes':['Third complete Google name take 225-229 s recovered by isolated transcription. Earlier two attempts excluded.','Anthropic complete third explanatory take 83.3-88.7 s selected.','No user-requested new spoken statements. Current factual caveats remain documented.','Times approximate phonetic boundaries; no actual auditory review available.']})
else:blocks=json.loads((Q/'selection-locked.json').read_text())['blocks']
v=json.loads((Q/'silero-probabilities.json').read_text());s=None;gaps=[]
for n,pr in enumerate(v['probabilities']):
 t=n*.032
 if pr<.55 and s is None:s=t
 elif pr>=.7 and s is not None:
  if t-s>=.063:gaps.append([s,t])
  s=None
anchors=[]
for f in Q.glob('*check-*-turbo.json'):
 try:offset=int(f.stem.split('-')[1]);d=json.loads(f.read_text())
 except:continue
 for seg in d.get('transcription',[]):
  for tok in seg.get('tokens',[]):
   if tok.get('t_dtw',-1)>=0 and any(c.isalnum() for c in tok['text']):anchors.append((offset+tok['t_dtw']/100,tok['text']))
rem=[]
for b in blocks:
 for a,z in gaps:
  if a<b['start'] or z>b['end'] or z-a<.17:continue
  cs=math.ceil((a+.035)*30-1e-8)/30;ce=math.floor((z-.045)*30+1e-8)/30
  overlap=[(round(t,3),w) for t,w in anchors if cs-.018<=t<=ce+.018]
  if ce-cs<.025 or overlap:continue
  rem.append({'start':cs,'end':ce,'type':'silence','block':b['id'],'vadGap':[a,z],'reason':'Reviewed non-speech between retained words, DTW anchors outside removal. Source edge protection retained; residual determined individually by 30fps boundary grid.','sourceResidualMs':round((z-a-ce+cs)*1000,2)})
rem.append({'start':213.4666666667,'end':213.5333333333,'type':'silence','block':'google-intro','vadGap':[213.44,213.60],'reason':'Complete words willst and ist bracket this pause in isolated DTW; preserve both phonetic margins.','sourceResidualMs':93.333})
rem.append({'start':315.5333333333,'end':315.8333333333,'type':'silence','block':'outro','vadGap':[315.488,315.872],'reason':'Isolated outro-tail DTW places complete ansonsten at314.98-315.34. Earlier full-block final syllable315.70 was alignment error. Cut starts after word release and retains lead into Folgen. See outro-tail-recognition.json.','sourceResidualMs':84.0})
rem.sort(key=lambda x:x['start'])
if not (Q/'pause-initial.json').exists():save(Q/'pause-initial.json',{'method':'Silero hysteresis0.70/0.55 plus targeted DTW anchors, not dB calibration','removals':rem})
# Calibration deltas, if present, change only pause removals, never source block content.
overrides=Q/'pause-overrides.json'
if overrides.exists():
 ov=json.loads(overrides.read_text())
 for x in rem:
  key=f"{x['vadGap'][0]:.3f}"
  if key in ov:
   x.update(ov[key]);x['calibrated']=True
for item in rem:
 item['sourceResidualMs']=round((item['vadGap'][1]-item['vadGap'][0]-item['end']+item['start'])*1000,3)
keeps=[]
for b in blocks:
 cursor=b['start']
 for x in [r for r in rem if r['block']==b['id']]:
  keeps.append([cursor,x['start'],b['id']]);cursor=x['end']
 keeps.append([cursor,b['end'],b['id']])
edgefile=Q/'block-edge-overrides.json'
if edgefile.exists():
 ov=json.loads(edgefile.read_text())
 for k,v in ov.items():
  inds=[i for i,x in enumerate(keeps) if x[2]==k]
  if 'start' in v:keeps[inds[0]][0]=v['start']
  if 'end' in v:keeps[inds[-1]][1]=v['end']
assert all(0<=a<b<=321.575 for a,b,_ in keeps)
source=json.loads((P/'workflow.json').read_text())['source']; pcm=Q/'source48k-s16.wav'
if not pcm.exists():subprocess.run([str(F),'-v','error','-n','-i',source,'-vn','-ac','1','-ar','48000','-c:a','pcm_s16le',str(pcm)],check=True)
with wave.open(str(pcm),'rb') as w:assert w.getframerate()==48000; audio=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float64)
def makeaudio(intervals,name):
 parts=[];tl=[];pos=0
 for a,b,bid in intervals:
  ia=round(a*48000);ib=round(b*48000);x=audio[ia:ib].copy();fade=min(240,len(x)//2);x[:fade]*=np.arange(fade)/fade;x[-fade:]*=np.arange(fade-1,-1,-1)/fade
  parts.append(np.clip(np.rint(x),-32768,32767).astype('<i2'));tl.append({'sourceStart':a,'sourceEnd':b,'outputStart':pos/48000,'outputEnd':(pos+len(x))/48000,'block':bid});pos+=len(x)
 out=Q/name
 with wave.open(str(out),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(np.concatenate(parts).tobytes())
 return out,tl
iteration=int(sys.argv[1]) if len(sys.argv)>1 else 1
out,timeline=makeaudio(keeps,f'calibration-v{iteration}.wav')
if not (Q/'selected-before-pauses.wav').exists():makeaudio([[b['start'],b['end'],b['id']] for b in blocks],'selected-before-pauses.wav')
save(Q/f'keep-v{iteration}.json',{'intervals':keeps,'duration':timeline[-1]['outputEnd'],'timeline':timeline,'pauseRemovals':rem})
print(json.dumps({'output':str(out),'duration':timeline[-1]['outputEnd'],'intervals':len(keeps),'removals':len(rem),'selectionDuration':sum(b['end']-b['start'] for b in blocks)}))
