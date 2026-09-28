import json,pathlib,math,datetime,subprocess,re
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';fps=30
meta=json.load(open(p/'workflow.json'));vad=json.load(open(p/'review/silero-probabilities.json'))
probs=vad['probabilities'];hop=vad['hopSamples']/vad['sampleRate'];duration=vad['sampleCount']/vad['sampleRate'];gaps=[];st=None
for i,prob in enumerate(probs):
 t=i*hop
 if prob<.55 and st is None:st=t
 elif prob>=.7 and st is not None:
  if t-st>=.064-1e-8:gaps.append({'start':st,'end':t})
  st=None
if st is not None and duration-st>=.064:gaps.append({'start':st,'end':duration})
# Whole word DTW anchor spans, with provenance, not asserted phoneme boundaries.
files=[(p/'review/check-29-58-turbo.json',29),(p/'review/check-120-154-turbo.json',120),(p/'review/check-218-247-turbo.json',218)]
files += [(w/'recognition'/(c['name']+'.json'),c['start']) for c in json.load(open(w/'recognition/chunks.json'))]
words=[]
for file,offset in files:
 d=json.load(open(file));current=None
 for t in [t for s in d['transcription'] for t in s['tokens'] if t['id']<50257 and t.get('t_dtw',-1)>=0]:
  txt=t['text'];anchor=offset+t['t_dtw']/100
  if not re.search(r'\w',txt):continue
  if txt.startswith(' ') or current is None:
   if current:words.append(current)
   current={'text':txt.strip(),'start':anchor,'end':anchor,'source':file.name}
  else:current['text']+=txt;current['end']=anchor
 if current:words.append(current)
blocks=[('einordnung',43.2,65.9666666667),('persoenliche_beobachtung',73.4333333333,87.5333333333),('scrum_name',91.1333333333,95.0666666667),('scrum_einsatz',98.9666666667,103.9),('sap',122.0333333333,136.8333333333),('ki_anthropic',156.8666666667,179.3333333333),('abschluss',239.5,245.5)]
changes=[];retain=[];keep=[]
for bi,(bid,a,b) in enumerate(blocks):
 cuts=[]
 for gi,g in enumerate(gaps):
  if g['start']<=a or g['end']>=b or g['end']-g['start']<.15:continue
  # VAD estimate already excludes speech; finite safety margins and DTW anchors protect quiet starts/ends.
  start=g['start']+.022;end=g['end']-.027
  protected=[x for x in words if x['end']+.055>start and x['start']-.055<end]
  if protected:
   spans=[(start,end)]
   for x in protected:
    nxt=[]
    for c,d in spans:
     lo,hi=x['start']-.055,x['end']+.055
     if hi<=c or lo>=d:nxt.append((c,d))
     else:
      if lo>c:nxt.append((c,lo))
      if hi<d:nxt.append((hi,d))
    spans=nxt
   if not spans:retain.append({'gap':g,'block':bid,'reason':'DTW word anchor span covers the VAD gap; retained pending acoustic check','words':protected});continue
   start,end=max(spans,key=lambda x:x[1]-x[0])
  start=math.ceil((start-1e-7)*fps)/fps;end=math.floor((end+1e-7)*fps)/fps
  if end-start<.0333333:retain.append({'gap':g,'block':bid,'reason':'No useful word-protected removal after frame alignment','words':protected});continue
  cut={'start':start,'end':end,'type':'silence','reason':f'{bid}: Silero non-speech core, DTW anchors protected, aligned to 30fps.','sourceGap':g,'protectedWords':protected,'sourceRemainingNonSpeech':g['end']-g['start']-(end-start)}
  cuts.append(cut);changes.append(cut)
 cursor=a
 for cut in cuts:
  keep.append([cursor,cut['start']]);cursor=cut['end']
 keep.append([cursor,b])
selection={'version':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fps':fps,'speed':1,'blocks':[{'id':n,'start':a,'end':b}for n,a,b in blocks],'keepIntervals':keep,'removalsWithinBlocks':changes,'retainedCandidates':retain,'duration':sum(b-a for a,b in keep),'limitations':['DTW anchors and VAD boundaries are estimates, not listening or phonetic ground truth.','No qualitative auditory review possible in this session.']}
(w/'candidate-v1-plan.json').write_text(json.dumps(selection,indent=2,ensure_ascii=False)+'\n');(w/'word-anchors.json').write_text(json.dumps(words,indent=2,ensure_ascii=False)+'\n')
fil=[];labels=[]
for i,(a,b) in enumerate(keep):
 fil.append(f'[0:a:0]atrim=start={a:.9f}:end={b:.9f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={b-a-.005:.9f}:d=0.005[a{i}]');labels.append(f'[a{i}]')
fil.append(''.join(labels)+f'concat=n={len(keep)}:v=0:a=1[aout]');(w/'candidate-v1-audio-filter.txt').write_text(';\n'.join(fil))
with open(w/'logs/candidate-v1-audio.log','w')as log:
 subprocess.run([str(r/'tools/bin/ffmpeg'),'-hide_banner','-loglevel','error','-n','-threads','2','-i',meta['source'],'-filter_complex_threads','1','-filter_complex_script',str(w/'candidate-v1-audio-filter.txt'),'-map','[aout]','-vn','-c:a','pcm_s24le','-ar','48000','-ac','1','-map_metadata','-1',str(w/'candidate-v1.wav')],stdout=log,stderr=subprocess.STDOUT,check=True)
subprocess.run([str(r/'tools/bin/ffmpeg'),'-hide_banner','-loglevel','error','-n','-i',str(w/'candidate-v1.wav'),'-ar','16000','-ac','1','-c:a','pcm_s16le',str(w/'candidate-v1-asr.wav')],check=True)
raw=subprocess.run([str(r/'tools/bin/silero-probabilities'),str(r/'tools/models/ggml-silero-v6.2.0.bin'),str(w/'candidate-v1-asr.wav')],capture_output=True,text=True,check=True);(w/'candidate-v1-silero-probabilities.json').write_text(raw.stdout);(w/'logs/candidate-v1-silero.log').write_text(raw.stderr)
print(json.dumps({'candidate':str(w/'candidate-v1.wav'),'duration':selection['duration'],'keptIntervals':len(keep),'pauseRemovals':len(changes),'retainedCandidates':retain},ensure_ascii=False,indent=2))
