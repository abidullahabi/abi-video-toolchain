from pathlib import Path
from datetime import datetime,timezone
import json,shutil,subprocess,sys
root=Path(__file__).resolve().parent.parent
key=sys.argv[1] if len(sys.argv)>1 else 'consulting'
original=Path(json.loads((root/'projects/batch-safezone-2026-09-13.json').read_text())[key])
om=json.loads((original/'workflow.json').read_text())
p=root/'projects'/(key.title()+'-Experiment-'+datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ'));p.mkdir()
for folder in ['assets','exports','review','logs']: (p/folder).mkdir()
shutil.copytree(original/'vendor',p/'vendor')
keep={'consulting':[[108,244],[308,532],[619,1186],[1246,1567],[1660,3072]],'werki':[[0,45],[153,228],[290,390],[448,803],[906,1085],[1209,1603],[1630,1657]],'berufserfahrung':[[0,186],[345,646],[677,1293],[1349,1447],[1491,2346],[2403,2514]]}[key];timeline=[];at=0
for a,b in keep:
 timeline.append({'sourceStart':a/30,'sourceEnd':b/30,'start':at/30,'end':(at+b-a)/30,'firstSourceFrame':a,'lastSourceFrameExclusive':b});at+=b-a
m={'source':om['source'],'sourceSha256':om['sourceSha256'],'key':key,'originalDuration':om['originalDuration'],'cutDuration':at/30,'removedSeconds':om['originalDuration']-at/30,'mode':'creative-experiment','status':'building','referenceProject':str(original),'baseline':om['postingCopy'],'approval':'User explicitly authorizes an open creative editing experiment including cuts, animation, graphics, music and sounds. Experiment only, no promotion to posting or established style.','keepIntervals':timeline,'editorialChanges':['Start with the three concrete viewer questions','Remove repeated introduction to the answer','Remove the A-to-Z bridge before the concrete examples','Remove the extra announcement of the bank example','Remove the repeated arrival of the consultant before the actual work steps'],'speechSpeed':1.0}
m['editorialChanges']={'consulting':m['editorialChanges'],'werki':['Direct one-question opening','Focus the typical internship explanation without the three-to-six-month maximum and semester aside','Remove the five-year example, tax aside and spoken LinkedIn reference','Keep the core comparison, takeover caveat, recommendation and CTA'],'berufserfahrung':['Remove repeated lead-in about starting early','Tighten repeated assurances and time-investment reminder','Remove the duplicated zero-skills phrase','Keep four tips, personal Excel example, networking approach and frustration context']}[key]
(p/'workflow.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(root/f'experiments/project-{key}.txt').write_text(str(p))
words=json.loads((original/'word-timing.json').read_text());mapped=[]
for w in words:
 center=(w['start']+w['end'])/2
 for span in timeline:
  if span['sourceStart']<=center<span['sourceEnd']:
   start=max(w['start'],span['sourceStart'])-span['sourceStart']+span['start'];end=min(w['end'],span['sourceEnd'])-span['sourceStart']+span['start']
   mapped.append({'text':w['text'],'start':round(start,6),'end':round(end,6),'sourceStart':w['start'],'sourceEnd':w['end']});break
(p/'word-timing.json').write_text(json.dumps(mapped,ensure_ascii=False,indent=2)+'\n');(p/'captions-reviewed.txt').write_text(' '.join(w['text'] for w in mapped)+'\n')
faces=json.loads((original/'review/source-faces.json').read_text());mf=[]
for sample in faces:
 for span in timeline:
  if span['sourceStart']<=sample['time']<span['sourceEnd']:
   mf.append({**sample,'time':round(sample['time']-span['sourceStart']+span['start'],6)});break
(p/'review/source-faces.json').write_text(json.dumps(mf,indent=2)+'\n')
filters=[];labels=[]
for i,s in enumerate(timeline):
 d=s['end']-s['start'];filters.append(f"[0:a]atrim=start={s['sourceStart']}:end={s['sourceEnd']},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={d-.005}:d=0.005[a{i}]");labels.append(f'[a{i}]')
filters.append(''.join(labels)+f'concat=n={len(timeline)}:v=0:a=1[voice]')
(p/'audio-cut-filter.txt').write_text(';\n'.join(filters))
ff=str(root/'tools/bin/ffmpeg');subprocess.run([ff,'-v','error','-n','-i',m['source'],'-filter_complex_script',str(p/'audio-cut-filter.txt'),'-map','[voice]','-c:a','pcm_s24le','-ar','48000',str(p/'assets/voice-original.wav')],check=True)
selection='+'.join(f'gte(n,{a})*lt(n,{b})' for a,b in keep)
subprocess.run([ff,'-v','error','-n','-i',m['source'],'-vf',f"select='{selection}',setpts=N/(30*TB)",'-an','-c:v','libx264','-preset','fast','-crf','16','-threads','4','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',str(p/'media.mp4')],check=True)
print(json.dumps({'project':str(p),'duration':at/30,'frames':at,'words':len(mapped),'removedSeconds':m['removedSeconds']},indent=2),flush=True)
