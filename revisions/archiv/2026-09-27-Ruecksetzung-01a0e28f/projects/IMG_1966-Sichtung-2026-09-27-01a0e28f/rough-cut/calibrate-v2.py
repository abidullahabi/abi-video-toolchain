import json,pathlib,subprocess,datetime
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';meta=json.load(open(p/'workflow.json'));plan=json.load(open(w/'candidate-v1-plan.json'));plan['version']=2
for x in plan['removalsWithinBlocks']:
 if x['sourceGap']['start']>243 and x['sourceGap']['start']<244:
  x['start']=243+17/30;x['end']=244+20/30;x['reason']='Abschluss: conflicting long-chunk DTW replaced by focused turbo anchors (ansonsten243.06-243.38), corroborated by PCM word decay ending ca243.44 and Silero non-speech243.52-244.704. Removal starts243.5667 and ends244.6667, preserving following speech onsetca244.68. Small model syllable anchor243.62 falls into near-digital silence and is not treated as ground truth.';x['protectedWords']=[];x['sourceRemainingNonSpeech']=x['sourceGap']['end']-x['sourceGap']['start']-(x['end']-x['start'])
keep=[]
for block in plan['blocks']:
 cursor=block['start']
 for x in plan['removalsWithinBlocks']:
  if x['start']>=block['start'] and x['end']<=block['end']:
   keep.append([cursor,x['start']]);cursor=x['end']
 keep.append([cursor,block['end']])
plan['keepIntervals']=keep;plan['duration']=sum(b-a for a,b in keep);plan['createdAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();plan['anchorCorrection']={'previous':'ansonsten DTW finaltoken244.50','refinedTurbo':'ansonsten243.06-243.38','small':'final token243.62, inconsistent with near-digital-silence PCM','sourceVAD':[243.52,244.704],'pcm':'word decay around243.40-243.44, following speech onsetca244.68','qualityLimit':'Combined technical evidence, no hearing performed'}
(w/'candidate-v2-plan.json').write_text(json.dumps(plan,indent=2,ensure_ascii=False)+'\n')
f=[];labels=[]
for i,(a,b)in enumerate(keep):
 f.append(f'[0:a:0]atrim=start={a:.9f}:end={b:.9f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={b-a-.005:.9f}:d=0.005[a{i}]');labels.append(f'[a{i}]')
f.append(''.join(labels)+f'concat=n={len(keep)}:v=0:a=1[aout]');(w/'candidate-v2-audio-filter.txt').write_text(';\n'.join(f))
with open(w/'logs/candidate-v2-audio.log','w')as log:subprocess.run([str(r/'tools/bin/ffmpeg'),'-hide_banner','-loglevel','error','-n','-threads','2','-i',meta['source'],'-filter_complex_threads','1','-filter_complex_script',str(w/'candidate-v2-audio-filter.txt'),'-map','[aout]','-vn','-c:a','pcm_s24le','-ar','48000','-ac','1','-map_metadata','-1',str(w/'candidate-v2.wav')],stdout=log,stderr=subprocess.STDOUT,check=True)
subprocess.run([str(r/'tools/bin/ffmpeg'),'-v','error','-n','-i',str(w/'candidate-v2.wav'),'-ar','16000','-ac','1','-c:a','pcm_s16le',str(w/'candidate-v2-asr.wav')],check=True)
raw=subprocess.run([str(r/'tools/bin/silero-probabilities'),str(r/'tools/models/ggml-silero-v6.2.0.bin'),str(w/'candidate-v2-asr.wav')],capture_output=True,text=True,check=True);(w/'candidate-v2-silero-probabilities.json').write_text(raw.stdout);(w/'logs/candidate-v2-silero.log').write_text(raw.stderr)
print(json.dumps({'duration':plan['duration'],'keepIntervals':len(keep)}))
