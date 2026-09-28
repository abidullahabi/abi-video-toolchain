from pathlib import Path
import json,subprocess,hashlib,statistics,re,difflib
from datetime import datetime,timezone
R=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow');P=R/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';Q=P/'review';F=R/'tools/bin/ffmpeg';FP=R/'tools/bin/ffprobe';meta=json.loads((P/'workflow.json').read_text());plan=json.loads((Q/'keep-v3.json').read_text());ks=plan['intervals'];audio=Q/'calibration-v3.wav'
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
analysis=R/'analysis/Silero-calibration-v3-2026-09-27T11-47-44-038Z/speech-boundaries.json';d=json.loads(analysis.read_text());g=[x for x in d['candidates'] if x['start']>0 and x['end']<d['duration']-1e-6];ds=[round(x['duration']*1000,3) for x in g];stats={'medianMs':statistics.median(ds),'fraction64to96':sum(63.99<=n<=96.01 for n in ds)/len(ds),'count':len(ds),'over160':[x for x in g if x['duration']>.16001]};print('PCM CHECK',stats,flush=True);assert stats['medianMs']==96 and stats['fraction64to96']>=.6 and not stats['over160']
save(Q/'pcm-signature-final.json',{'sourceAnalysis':str(analysis),**stats,'auditoryReviewPerformed':False,'scope':'Silero metric only, no claim of natural perceived pacing'})
sel='+'.join(f'gte(n,{round(a*30)})*lt(n,{round(b*30)})' for a,b,_ in ks)
filters=f"[0:v:0]fps=30,select='{sel}',setpts=N/(30*TB),scale=1080:1920:flags=lanczos,setsar=1[vout]"
(P/'video-filter-v1.txt').write_text(filters+'\n');out=P/'exports/KI-Einstieg-Schnitt-v1.mp4';out.parent.mkdir(exist_ok=True)
args=[str(F),'-hide_banner','-loglevel','warning','-n','-threads','2','-i',meta['source'],'-i',str(audio),'-filter_complex_threads','2','-filter_complex_script',str(P/'video-filter-v1.txt'),'-map','[vout]','-map','1:a:0','-c:v','libx264','-threads:v','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-map_metadata','-1','-movflags','+faststart',str(out)]
save(Q/'render-command-v1.json',{'argv':args,'fpsConversion':'Source near30fps with max0.915ms deviation from mean frame times to CFR30. Same source boundaries on30fps grid, output frame count must match interval sum.','speed':1,'audio':'Original48kMono extracted losslessly toPCM16 and selected with5ms edge fades. No normalization/music.'})
with (P/'logs/video-v1.log').open('w') as log:subprocess.run(args,stdout=log,stderr=log,check=True)
probe=json.loads(subprocess.check_output([str(FP),'-v','error','-show_streams','-show_format','-of','json',str(out)]));save(Q/'export-probe-v1.json',probe);v=next(x for x in probe['streams'] if x['codec_type']=='video');a=next(x for x in probe['streams'] if x['codec_type']=='audio');expected=sum(round((b-a)*30) for a,b,_ in ks)
assert(v['width'],v['height'])==(1080,1920);assert int(v['nb_frames'])==expected,(v['nb_frames'],expected);assert abs(float(v['duration'])-plan['duration'])<.001;assert a['sample_rate']=='48000' and a['channels']==1
with (P/'logs/decode-v1.log').open('w') as log:subprocess.run([str(F),'-v','error','-xerror','-threads','2','-i',str(out),'-f','null','-'],stdout=log,stderr=log,check=True)
sha=hashlib.sha256(out.read_bytes()).hexdigest();meta.update({'mode':'cut-only','status':'rendered_pending_export_qa','editsAuthorizedThisStage':True,'selectionFrozen':True,'sourceSelectionFile':'review/selection-locked.json','speed':1,'latestExport':str(out),'cutDuration':float(probe['format']['duration']),'removedSeconds':321.575-plan['duration'],'keepIntervals':[[x,y] for x,y,_ in ks],'exportSha256':sha,'qualitativeFinalApproval':False,'auditoryReviewPerformed':False});meta['bearbeitung']['status']='qa_laeuft';save(P/'workflow.json',meta)
rem=[];cursor=0
for start,end,bid in ks:
 if start>cursor:
  matching=[x for x in plan['pauseRemovals'] if abs(x['start']-cursor)<.001 and abs(x['end']-start)<.001]
  rem.append({'start':cursor,'end':start,'type':'silence' if matching else 'editorial','reason':matching[0]['reason'] if matching else 'Genehmigte Auswahl, verworfene Anlaeufe, Aussagen oder quellinterne Randschutzkorrektur. Siehe Auswahl und Kalibrierungsbericht.'})
 cursor=end
if cursor<321.575:rem.append({'start':cursor,'end':321.575,'type':'editorial','reason':'Nachlauf nach abgeschlossenem Folgeaufruf'})
save(P/'cuts.json',{'speed':1,'sourceDuration':321.575,'removals':rem,'selectionSha256':hashlib.sha256((Q/'selection-locked.json').read_bytes()).hexdigest()});save(P/'timeline-map.json',{'source':meta['source'],'speed':1,'intervals':plan['timeline']})
print(json.dumps({'export':str(out),'duration':meta['cutDuration'],'frames':expected,'sha256':sha}),flush=True)
