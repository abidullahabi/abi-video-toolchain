from pathlib import Path
import subprocess,json,hashlib,math,sys,array,datetime
p=Path(sys.argv[1]).resolve();name=sys.argv[2];root=p.parent.parent
ff=str(root/'tools/bin/ffmpeg');probe=str(root/'tools/bin/ffprobe')
m=json.loads((p/'workflow.json').read_text());plan=json.loads((p/'theme-plan.json').read_text())
master=Path(m['latestExport']);source=p/'media.mp4'
# Versionskennung _v1, _v2, ... nach Abdullahs Festlegung vom 16.09.2026.
# Ersetzt das frühere feste '_FINAL_V2_Buffer': 22 von 28 Exporten trugen FINAL
# im Namen, die ausgelieferte war daran nicht von den überholten zu unterscheiden.
(p/'exports').mkdir(parents=True,exist_ok=True)
vorhanden=[int(f.stem.rsplit('_v',1)[-1]) for f in (p/'exports').glob(name+'_v*.mp4') if f.stem.rsplit('_v',1)[-1].isdigit()]
out=p/'exports'/f'{name}_v{max(vorhanden+[0])+1}.mp4'
assert not out.exists(),'Zieldatei existiert bereits.'
source_duration=float(subprocess.check_output([probe,'-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(source)]))
assert abs(source_duration-plan['duration'])<.1,'Dieses Hilfsskript setzt unveränderten Schnitt und unverändertes Tempo voraus. Für Tempo- oder Schnittänderungen die bereits synchronisierte Tonspur verwenden.'
# HyperFrames kodiert seinen Master (MP4 wie ProRes) mit der BT.601-Matrix, kennzeichnet MP4 aber als BT.709
# (gemessen 26.09.2026 an der H1-Flaeche #1668b5). Mit masterColorMatrix "bt601" wird echt nach BT.709 umgerechnet.
conv='scale=in_color_matrix=bt601:in_range=tv:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1' if m.get('masterColorMatrix')=='bt601' else None
# Ziel 12 Mbit/s, aber nie über die 300-MB-Grenze des Zernio-Wegs (Abschnitt 10): bei langen Videos automatisch knapper
# (Fast 30, 202 s: 12 Mbit/s ergaben 308 MB). 3 % Reserve für Container und Ratenschwankung, Ton 120 kbit/s.
vb=min(12000,int((300e6*0.97*8/plan['duration']-120e3)/1000))
args=[ff,'-v','error','-n','-i',str(master),'-i',str(source),'-map','0:v:0','-map','1:a:0']+(['-vf',conv] if conv else [])+['-c:v','libx264','-preset','slow','-threads','4','-b:v',f'{vb}k','-maxrate','14M','-bufsize','28M','-profile:v','high','-level:v','4.1','-g','60','-bf','2','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','120k','-ar','48000','-ac','2','-map_metadata','-1','-movflags','+faststart',str(out)]
subprocess.run(args,check=True)
info=json.loads(subprocess.check_output([probe,'-v','error','-show_streams','-show_format','-of','json',str(out)]));v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'],v['codec_name'],v['pix_fmt'])==(1080,1920,'30/1','h264','yuv420p')
assert all(v.get(k)=='bt709' for k in ['color_space','color_transfer','color_primaries'])
assert int(v['bit_rate'])<25000000 and int(a['bit_rate'])<=128000 and out.stat().st_size<300000000
assert a['codec_name']=='aac' and a['profile']=='LC'
assert abs(float(info['format']['duration'])-plan['duration'])<.1
subprocess.run([ff,'-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
print('Buffer-Profil und vollständige Datei geprüft.',flush=True)
vmaf_file=p/'review/buffer-vmaf.json'
subprocess.run([ff,'-v','error','-i',str(out),'-i',str(master),'-lavfi',(f'[1:v]{conv}[ref];[0:v][ref]' if conv else '')+f'libvmaf=n_threads=4:n_subsample=10:log_fmt=json:log_path={vmaf_file}','-an','-f','null','-'],check=True)
vmaf=json.loads(vmaf_file.read_text())['pooled_metrics']['vmaf']['mean'];assert vmaf>95,(name,vmaf)
def samples(f):
 data=subprocess.check_output([ff,'-v','error','-i',str(f),'-vn','-ac','1','-ar','8000','-c:a','pcm_s16le','-f','s16le','-']);a=array.array('h');a.frombytes(data);return a
original=samples(source);encoded=samples(out);checks=[]
for sec in [1,max(1,plan['duration']/2-2.5),plan['duration']-6]:
 start=int(sec*8000);x=original[start:start+40000];n=len(x);mx=sum(x)/n;varx=sum(v*v for v in x)-n*mx*mx
 scores=[]
 for lag in range(-8,9):
  y=encoded[start+lag:start+lag+n]
  if len(y)!=n:continue
  my=sum(y)/n;vary=sum(v*v for v in y)-n*my*my
  score=(sum(a*b for a,b in zip(x,y))-n*mx*my)/math.sqrt(varx*vary)
  scores.append((score,lag))
 score,lag=max(scores);assert score>.97 and abs(lag)<=1,(sec,score,lag)
 checks.append({'startSeconds':sec,'durationSeconds':5,'bestLagMilliseconds':lag/8,'correlation':score})
sha=hashlib.sha256()
with out.open('rb') as f:
 for chunk in iter(lambda:f.read(8*1024*1024),b''):sha.update(chunk)
report={'file':str(out),'renderedMaster':str(master),'duration':float(info['format']['duration']),'width':1080,'height':1920,'fps':30,'frames':int(v['nb_frames']),'videoBitrate':int(v['bit_rate']),'audioBitrate':int(a['bit_rate']),'sizeBytes':out.stat().st_size,'vmafMeanVsRenderedMaster':vmaf,'vmafEveryNthFrame':10,'fullyDecoded':True,'audioAlignmentChecks':checks,'audioHandling':'Original audio re-encoded once as AAC-LC at 120 kbit/s and 48 kHz, without tempo or level changes.','captionMaxWords':max(len(c['words']) for c in plan['captions']),'sha256':sha.hexdigest(),'bufferProfilePassed':True}
(p/'review/final-export-check.json').write_text(json.dumps(report,indent=2)+'\n')
jetzt=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
# Ein Zeiger statt vier (Nachbesprechung Punkt 7). Traegt die Pruefsumme mit,
# damit er nicht stillschweigend veralten kann.
m.update(latestExport=str(out),renderedExport=str(master),status='complete',audioHandling=report['audioHandling'],deliveryProfile=f'Zernio/Buffer: H264, 1080x1920p30, BT709, {vb}k video target (max. 12M, 300-MB-Grenze) / 14M VBV, AAC-LC 120k, faststart',layoutVersion='tiktok-safe-v1',
         aktuell={'datei':str(out),'sha256':report['sha256'],'bytes':report['sizeBytes'],'erzeugt':jetzt,'gesetztAm':jetzt})
(p/'workflow.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['file','duration','sizeBytes','videoBitrate','audioBitrate','vmafMeanVsRenderedMaster','audioAlignmentChecks']},indent=2),flush=True)
