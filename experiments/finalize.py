from pathlib import Path
import subprocess,json,hashlib,sys,array,math
root=Path(__file__).resolve().parent.parent
key=sys.argv[1];p=Path((root/f'experiments/project-{key}.txt').read_text().strip())
m=json.loads((p/'workflow.json').read_text());plan=json.loads((p/'experiment-plan.json').read_text());qa=json.loads((p/'review/experiment-layout-check.json').read_text())
assert not qa['errors']
ff=str(root/'tools/bin/ffmpeg');probe=str(root/'tools/bin/ffprobe')
name={'werki':'Werki_Praktikum','consulting':'Consulting','berufserfahrung':'Berufserfahrung'}[key]
master=p/'exports/Experiment_Master.mp4';assert master.exists()
out=p/'exports'/f'{name}_EXPERIMENT.mp4';dry=p/'exports'/f'{name}_EXPERIMENT_ohne_Musik.mp4'
assert not out.exists() and not dry.exists()
def run(args):return subprocess.run(args,check=True)
def sha(f):
 h=hashlib.sha256()
 with open(f,'rb') as src:
  for b in iter(lambda:src.read(8*1024*1024),b''):h.update(b)
 return h.hexdigest()
assert sha(m['source'])==m['sourceSha256']
print('Final export: '+key,flush=True)
run([ff,'-v','error','-n','-i',str(master),'-i',str(p/'assets/mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-threads','4','-b:v','12M','-maxrate','14M','-bufsize','28M','-profile:v','high','-level:v','4.1','-g','60','-bf','2','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','120k','-ar','48000','-ac','2','-map_metadata','-1','-movflags','+faststart',str(out)])
run([ff,'-v','error','-n','-i',str(out),'-i',str(p/'assets/mix-no-music.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','120k','-ar','48000','-ac','2','-map_metadata','-1','-movflags','+faststart',str(dry)])
def samples(f):
 data=subprocess.check_output([ff,'-v','error','-i',str(f),'-vn','-ac','1','-ar','8000','-c:a','pcm_s16le','-f','s16le','-']);a=array.array('h');a.frombytes(data);return a
def alignment(f,src):
 original=samples(src);encoded=samples(f);checks=[]
 for sec in [1,max(1,plan['duration']/2-2.5),plan['duration']-6]:
  start=int(sec*8000);x=original[start:start+40000];n=len(x);mx=sum(x)/n;varx=sum(v*v for v in x)-n*mx*mx;scores=[]
  for lag in range(-8,9):
   y=encoded[start+lag:start+lag+n]
   if len(y)!=n:continue
   my=sum(y)/n;vary=sum(v*v for v in y)-n*my*my
   scores.append(((sum(a*b for a,b in zip(x,y))-n*mx*my)/math.sqrt(varx*vary),lag))
  score,lag=max(scores);assert score>.97 and abs(lag)<=1,(sec,score,lag)
  checks.append({'startSeconds':sec,'durationSeconds':5,'bestLagMilliseconds':lag/8,'correlation':score})
 return checks
reports=[]
for file,source_audio in [(out,p/'assets/mix.wav'),(dry,p/'assets/mix-no-music.wav')]:
 info=json.loads(subprocess.check_output([probe,'-v','error','-show_streams','-show_format','-of','json',str(file)]));v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio')
 assert (v['width'],v['height'],v['avg_frame_rate'],v['codec_name'],v['pix_fmt'])==(1080,1920,'30/1','h264','yuv420p')
 assert all(v.get(k)=='bt709' for k in ['color_space','color_transfer','color_primaries'])
 assert int(v['bit_rate'])<25000000 and int(a['bit_rate'])<=128000 and file.stat().st_size<300000000
 assert a['codec_name']=='aac' and a['profile']=='LC'
 assert abs(float(info['format']['duration'])-plan['duration'])<.05
 assert int(v['nb_frames'])==round(plan['duration']*30)
 run([ff,'-v','error','-xerror','-i',str(file),'-f','null','-'])
 checks=alignment(file,source_audio)
 loud=subprocess.run([ff,'-v','info','-i',str(file),'-vn','-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
 loud=json.loads(loud[loud.rfind('{'):]);assert float(loud['input_tp'])<-.7 and -18<float(loud['input_i'])<-14
 reports.append({'file':str(file),'duration':float(info['format']['duration']),'frames':int(v['nb_frames']),'sizeBytes':file.stat().st_size,'videoBitrate':int(v['bit_rate']),'audioBitrate':int(a['bit_rate']),'sha256':sha(file),'fullyDecoded':True,'audioAlignment':checks,'audioLoudness':loud})
 print(file.name+': format, full decode, audio sync and loudness passed',flush=True)
vmaf_file=p/'review/experiment-vmaf.json'
run([ff,'-v','error','-i',str(out),'-i',str(master),'-lavfi',f'libvmaf=n_threads=4:n_subsample=10:log_fmt=json:log_path={vmaf_file}','-an','-f','null','-'])
vmaf=json.loads(vmaf_file.read_text())['pooled_metrics']['vmaf']['mean'];assert vmaf>95,(key,vmaf)
report={'exports':reports,'videoProfile':'H264 High 4.1, 1080x1920p30, SDR BT709, 12M target, 14M VBV, AAC-LC 120k, 48kHz, faststart','vmafMeanVsRenderedMaster':vmaf,'vmafFrameSubsample':10,'originalSourceUnchanged':True,'captionMaxWords':max(len(c['words']) for c in plan['captions']),'layoutErrors':0,'musicSource':'Locally synthesized original instrumental. No sampled commercial recordings.','scope':'Experimental alternatives. Existing posting files and Notion status untouched.'}
(p/'review/experiment-final-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
m.update(status='experiment_complete',latestExport=str(out),alternateNoMusic=str(dry),renderedExport=str(master))
(p/'workflow.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'key':key,'vmaf':vmaf,'duration':plan['duration'],'exports':[x['file'] for x in reports]}),flush=True)
