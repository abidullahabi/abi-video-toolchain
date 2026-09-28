import pathlib,json,subprocess,hashlib,array,math,datetime
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';meta=json.load(open(p/'workflow.json'));out=pathlib.Path(meta['latestExport']);ff=r/'tools/bin/ffmpeg';fp=r/'tools/bin/ffprobe';duration=meta['cutDuration']
assert out.name=='Consulting-Zertifikate-Rohschnitt-v3.mp4'
subprocess.run([str(ff),'-v','error','-n','-threads','2','-i',str(out),'-map','0:a:0','-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',str(w/'export-v3-aac-silero.wav')],check=True)
v=subprocess.run([str(r/'tools/bin/silero-probabilities'),str(r/'tools/models/ggml-silero-v6.2.0.bin'),str(w/'export-v3-aac-silero.wav')],capture_output=True,text=True,check=True);(w/'export-v3-aac-probabilities.json').write_text(v.stdout);(w/'logs/export-v3-aac-silero.log').write_text(v.stderr)
# Canonical workflow function. Ignore only leading/trailing candidates within0.2s, report separately.
node="""import fs from 'node:fs';import {nonSpeechCandidates} from './silero-review.mjs';const dir=process.argv[1];let results={};for(const[name,file]of [['pcm','candidate-v4-pcm-probabilities.json'],['aac','export-v3-aac-probabilities.json']]){let a=nonSpeechCandidates(JSON.parse(fs.readFileSync(dir+'/'+file,'utf8')));let inner=a.candidates.filter(g=>g.start>.2&&g.end<a.duration-.2);let edges=a.candidates.filter(g=>!inner.includes(g));let ms=inner.map(g=>Math.round(g.duration*1000)).sort((a,b)=>a-b);let median=ms.length%2?ms[(ms.length-1)/2]:(ms[ms.length/2-1]+ms[ms.length/2])/2;let target=ms.filter(x=>x>=64&&x<=96).length;results[name]={...a,innerCount:inner.length,excludedEdgeCandidates:edges,innerMilliseconds:ms,medianMs:median,target64to96Count:target,target64to96Share:target/ms.length,over160ms:inner.filter(x=>x.duration>.1600001),pass:median===96&&target/ms.length>=.6&&inner.every(x=>x.duration<=.1600001)};}fs.writeFileSync(dir+'/pause-signature-final-v3.json',JSON.stringify(results,null,2)+'\\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{count:v.innerCount,median:v.medianMs,share:v.target64to96Share,over160:v.over160ms.length,pass:v.pass}]))));"""
s=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',node,str(w)],cwd=r,capture_output=True,text=True,check=True);print(s.stdout)
def decode(path):
 x=array.array('f');x.frombytes(subprocess.check_output([str(ff),'-v','error','-threads','2','-i',str(path),'-map','0:a:0','-vn','-ar','48000','-ac','1','-f','f32le','-']));return x
pcm=decode(w/'candidate-v4.wav');aac=decode(out);samples=[]
for sec in [1,30,70]:
 start=int(sec*48000);ix=range(start,start+24000,16);dot=sum(pcm[i]*aac[i] for i in ix);xx=sum(pcm[i]*pcm[i]for i in ix);yy=sum(aac[i]*aac[i]for i in ix);corr=dot/math.sqrt(xx*yy)
 best=(None,-1)
 for lag in range(-48,49,4):
  dot=sum(pcm[i]*aac[i+lag]for i in ix);yy2=sum(aac[i+lag]*aac[i+lag]for i in ix);c=dot/math.sqrt(xx*yy2)
  if c>best[1]:best=(lag,c)
 samples.append({'cutTimeStart':sec,'seconds':.5,'zeroLagCorrelation':corr,'bestLagSamplesAt4SampleResolution':best[0],'bestCorrelation':best[1]})
peak=max(abs(x)for x in aac);rms=math.sqrt(sum(x*x for x in aac)/len(aac))
frames=json.loads(subprocess.check_output([str(fp),'-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(out)]))['frames'];pts=[float(x['best_effort_timestamp_time'])for x in frames];maxerr=max(abs(t-i/30)for i,t in enumerate(pts));sourcehash=hashlib.sha256(pathlib.Path(meta['source']).read_bytes()).hexdigest();sourceunchanged=sourcehash=='c7e7d36812879d5c0cf8ee9ae712294a23362c300b2cc81913865c35429e0632'
report={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':str(out),'sourceUnchanged':sourceunchanged,'sourceSha256':sourcehash,'speed':1,'durationSeconds':duration,'videoFrameCount':len(pts),'maximumFrameTimestampErrorSeconds':maxerr,'pcmSamples':len(pcm),'aacDecodedSamples':len(aac),'aacPeakDbFS':20*math.log10(peak),'aacRmsDbFS':20*math.log10(rms),'aacAlignmentSamples':samples,'sourcePcmPreservationFile':'pcm-preservation-check-v4.json','pauseSignatureFile':'pause-signature-final-v3.json','completeDecoding':'passed in render-rough-cut-v3.py','fullCutASR':'recognition/candidate-v4-full.txt','asrContentReview':'All six selected meaning blocks and qualifying statements represented. Transcript differences are not treated as evidence of edits. The omitted second das in ASR lies at original134.26 inside untouched132.1–135.3 interval. No source phonemes changed inside kept segments except5ms boundary fades.','hearingPerformed':False,'qualitativeApproval':False,'limitations':['No auditory input supported, therefore no listening approval for word endings, jump cuts or natural pacing.','ASR, DTW and VAD are model estimates. Technical agreement does not prove all syllables are intact.','SAP assertions retained under explicit user direction, together with personal framing and Finance qualifier.']}
assert sourceunchanged
assert all(v['pass'] for v in json.load(open(w/'pause-signature-final-v3.json')).values())
assert len(pts)==2205 and maxerr<.000001
assert all(x['bestLagSamplesAt4SampleResolution']==0 and x['zeroLagCorrelation']>.995 for x in samples)
payloads=[]
for media in [w/'candidate-v4-aac.m4a',out]:
 payloads.append(hashlib.sha256(subprocess.check_output([str(ff),'-v','error','-i',str(media),'-map','0:a:0','-c:a','copy','-f','adts','-'])).hexdigest())
assert payloads[0]==payloads[1]
report['aacPayloadBitIdenticalToMeasuredFile']=True;report['aacPayloadSha256']=payloads[0]
tail=subprocess.check_output([str(ff),'-v','error','-threads','2','-ss',str(duration-1),'-i',str(out),'-map','0:v:0','-vf','scale=90:160','-an','-f','framemd5','-'],text=True);(w/'final-v3-tail-framemd5.txt').write_text(tail);hashes=[line.rsplit(',',1)[-1].strip()for line in tail.splitlines()if line and not line.startswith('#')];report['tailSecondFrameCount']=len(hashes);report['tailSecondUniqueFrameHashes']=len(set(hashes));assert len(hashes)==30 and len(set(hashes))==30
(w/'final-checks-v3.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
subprocess.run([str(ff),'-v','error','-n','-threads','2','-i',str(out),'-vf','fps=1/5,scale=180:320,tile=5x3','-frames:v','1','-update','1',str(w/'export-contact-sheet-v3.jpg')],check=True)
print(json.dumps({k:report[k]for k in ['sourceUnchanged','durationSeconds','videoFrameCount','maximumFrameTimestampErrorSeconds','aacPeakDbFS','aacAlignmentSamples']},indent=2))
