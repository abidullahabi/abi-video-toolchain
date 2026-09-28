import json,pathlib,subprocess,datetime
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';meta=json.load(open(p/'workflow.json'));plan=json.load(open(w/'candidate-v2-plan.json'));plan['version']=3
relax=[47+8/30,51+10/30,82+7/30,127+20/30,165+25/30,243+17/30];changed=[]
for x in plan['removalsWithinBlocks']:
 if any(abs(x['start']-a)<.0001 for a in relax):
  old=x['start'];x['start']+=1/30;x['reason']+=' One extra source frame retained before cut to protect preceding word decay and calibrate the measured AAC pause signature. No additional speech removal.';x['sourceRemainingNonSpeech']=x['sourceGap']['end']-x['sourceGap']['start']-(x['end']-x['start']);changed.append({'previousStart':old,'newStart':x['start'],'end':x['end']})
assert len(changed)==6
keep=[]
for block in plan['blocks']:
 cursor=block['start']
 for x in plan['removalsWithinBlocks']:
  if x['start']>=block['start'] and x['end']<=block['end']:keep.append([cursor,x['start']]);cursor=x['end']
 keep.append([cursor,block['end']])
plan['keepIntervals']=keep;plan['duration']=sum(b-a for a,b in keep);plan['createdAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();plan['calibrationChanges']=changed
(w/'candidate-v3-plan.json').write_text(json.dumps(plan,indent=2,ensure_ascii=False)+'\n')
f=[];labels=[]
for i,(a,b)in enumerate(keep):f.append(f'[0:a:0]atrim=start={a:.9f}:end={b:.9f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={b-a-.005:.9f}:d=0.005[a{i}]');labels.append(f'[a{i}]')
f.append(''.join(labels)+f'concat=n={len(keep)}:v=0:a=1[aout]');(w/'candidate-v3-audio-filter.txt').write_text(';\n'.join(f))
ff=str(r/'tools/bin/ffmpeg')
subprocess.run([ff,'-v','error','-n','-threads','2','-i',meta['source'],'-filter_complex_threads','1','-filter_complex_script',str(w/'candidate-v3-audio-filter.txt'),'-map','[aout]','-vn','-c:a','pcm_s24le','-ar','48000','-ac','1','-map_metadata','-1',str(w/'candidate-v3.wav')],check=True)
subprocess.run([ff,'-v','error','-n','-i',str(w/'candidate-v3.wav'),'-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-map_metadata','-1',str(w/'candidate-v3-aac.m4a')],check=True)
for tag,file in [('pcm','candidate-v3.wav'),('aac','candidate-v3-aac.m4a')]:
 wav=w/f'candidate-v3-{tag}-silero.wav';subprocess.run([ff,'-v','error','-n','-i',str(w/file),'-ar','16000','-ac','1','-c:a','pcm_s16le',str(wav)],check=True)
 a=subprocess.run([str(r/'tools/bin/silero-probabilities'),str(r/'tools/models/ggml-silero-v6.2.0.bin'),str(wav)],capture_output=True,text=True,check=True);(w/f'candidate-v3-{tag}-probabilities.json').write_text(a.stdout)
node="""import fs from 'node:fs';import {nonSpeechCandidates} from './silero-review.mjs';const dir=process.argv[1];let results={};for(const name of ['pcm','aac']){let a=nonSpeechCandidates(JSON.parse(fs.readFileSync(dir+'/candidate-v3-'+name+'-probabilities.json','utf8')));let inner=a.candidates.filter(g=>g.start>.2&&g.end<a.duration-.2);let ms=inner.map(g=>Math.round(g.duration*1000)).sort((a,b)=>a-b);let median=ms.length%2?ms[(ms.length-1)/2]:(ms[ms.length/2-1]+ms[ms.length/2])/2;let target=ms.filter(x=>x>=64&&x<=96).length;results[name]={...a,innerCount:inner.length,innerMilliseconds:ms,medianMs:median,target64to96Count:target,target64to96Share:target/ms.length,over160ms:inner.filter(x=>x.duration>.1600001),pass:median===96&&target/ms.length>=.6&&inner.every(x=>x.duration<=.1600001)};}fs.writeFileSync(dir+'/candidate-v3-signature.json',JSON.stringify(results,null,2)+'\\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{count:v.innerCount,median:v.medianMs,share:v.target64to96Share,over160:v.over160ms.length,pass:v.pass}]))));"""
a=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',node,str(w)],cwd=r,capture_output=True,text=True,check=True);print(a.stdout);print({'duration':plan['duration']})
