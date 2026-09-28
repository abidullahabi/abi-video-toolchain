import pathlib,json,subprocess,hashlib,wave,array,math,statistics,datetime
P=pathlib.Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow/projects/IMG_1968-Sichtung-2026-09-27-01a0e28f')
B=P.parent.parent;R=P/'review';V=P/'exports/DreiFragen-Schnitt-v1.mp4';FF=str(B/'tools/bin/ffmpeg');FP=str(B/'tools/bin/ffprobe')
def run(a,log=None):
 if log:
  with open(log,'w') as f:subprocess.run(a,stdout=f,stderr=f,check=True)
 else:return subprocess.check_output(a,text=True)
def save(n,d):(R/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
info=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',str(V)]));save('export-probe-v1.json',info)
run([FF,'-v','error','-xerror','-threads','2','-i',str(V),'-map','0:v:0','-map','0:a:0','-f','null','-'],P/'logs/export-decode-v1.log')
audio=R/'export-audio-v1-16k.wav'
run([FF,'-v','error','-n','-i',str(V),'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',str(audio)])
probs=json.loads(run([str(B/'tools/bin/silero-probabilities'),str(B/'tools/models/ggml-silero-v6.2.0.bin'),str(audio)]));save('export-probabilities-v1.json',probs)
start=None;gaps=[];duration=probs['sampleCount']/probs['sampleRate'];hop=probs['hopSamples']/probs['sampleRate']
for i,v in enumerate(probs['probabilities']):
 t=i*hop
 if v<.55 and start is None:start=t
 elif v>=.7 and start is not None:
  if t-start+1e-9>=.064:gaps.append({'start':start,'end':t,'duration':t-start})
  start=None
if start is not None and duration-start+1e-9>=.064:gaps.append({'start':start,'end':duration,'duration':duration-start})
inner=[g for g in gaps if g['start']>0 and g['end']<duration-1e-6];ds=[round(g['duration']*1000,3) for g in inner]
stats={'duration':duration,'count':len(ds),'medianMs':statistics.median(ds),'fraction64to96':sum(63.99<=d<=96.01 for d in ds)/len(ds),'over160':[g for g in inner if g['duration']>.160001],'gaps':gaps,'auditoryReviewPerformed':False}
save('export-pause-check-v1.json',stats)
def readwav(f):
 with wave.open(str(f),'rb') as w:return array.array('h',w.readframes(w.getnframes()))
x=readwav(R/'cut-audio-v1-silero.wav');y=readwav(audio);checks=[]
for secs in [1,26,51]:
 a=int(secs*16000);idx=list(range(a,a+8000,8));xx=[x[i] for i in idx];norm=math.sqrt(sum(z*z for z in xx));c=[]
 for lag in range(-160,161):
  yy=[y[i+lag] for i in idx];score=sum(u*v for u,v in zip(xx,yy))/(norm*math.sqrt(sum(z*z for z in yy)))
  c.append((score,lag))
 best=max(c);checks.append({'windowStartSeconds':secs,'windowDurationSeconds':.5,'bestLagSamples16k':best[1],'bestLagMs':best[1]/16,'correlation':best[0]})
pts=json.loads(run([FP,'-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time','-of','json',str(V)]));tt=sorted(float(q['pts_time']) for q in pts['packets']);dd=[b-a for a,b in zip(tt,tt[1:])]
run([FF,'-v','error','-n','-threads','2','-i',str(V),'-vf',"select='eq(n,0)+eq(n,300)+eq(n,600)+eq(n,900)+eq(n,1200)+eq(n,1500)',scale=216:384,tile=3x2",'-frames:v','1',str(R/'cut-contact-sheet-v1.png')])
source=pathlib.Path(json.loads((P/'workflow.json').read_text())['source']);sourcehash=hashlib.sha256(source.read_bytes()).hexdigest() if source.exists() else None
sha=hashlib.sha256(V.read_bytes()).hexdigest();video=next(s for s in info['streams'] if s['codec_type']=='video');au=next(s for s in info['streams'] if s['codec_type']=='audio')
report={'file':str(V),'sha256':sha,'bytes':V.stat().st_size,'duration':float(info['format']['duration']),'sourceSha256Unchanged':sourcehash=='c695465533a1a2eb1b0754b3049654a6b5fe3d9409c170da67a42fe7d76636e9','fullDecodeExitCode':0,'speed':1,'width':video['width'],'height':video['height'],'videoCodec':video['codec_name'],'fps':video['avg_frame_rate'],'pixelFormat':video['pix_fmt'],'colors':{k:video.get(k) for k in ['color_range','color_space','color_transfer','color_primaries']},'audio':{k:au.get(k) for k in ['codec_name','sample_rate','channels','duration']},'frameTiming':{'packetCount':len(tt),'minDelta':min(dd),'maxDelta':max(dd),'constant30FpsWithin1Microsecond':all(abs(d-1/30)<1.1e-6 for d in dd)},'cutAudioTransferComparison':checks,'transferCheckLimitation':'Correlation and zero added lag compare encoded export with selected PCM. They do not validate source speech, natural edits or human listening quality.','exportPauseCheck':{k:v for k,v in stats.items() if k!='gaps'},'visualContactSheet':'review/cut-contact-sheet-v1.png','visualReviewPerformed':False,'auditoryReviewPerformed':False,'postingReady':False,'userCutApprovalPending':True,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
save('export-qa-v1.json',report)
print(json.dumps(report,ensure_ascii=False))
