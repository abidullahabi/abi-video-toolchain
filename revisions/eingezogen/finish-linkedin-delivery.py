from pathlib import Path
import json,hashlib,shutil,datetime
r=Path.cwd(); state=json.loads((r/'revisions/linkedin-current.json').read_text());p=Path(state['project']);b=Path(state['backup']);root=Path('/Users/abi/Desktop/Social Media/Content_Videos')
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
read=lambda f:json.loads(Path(f).read_text())
def write(f,v):Path(f).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
report=read(p/'review/final-export-check.json');m=read(p/'workflow.json');export=Path(m['latestExport'])
assert report['fullyDecoded'] and report['vmafMeanVsRenderedMaster']>95
assert report['sha256']==sha(export)
assert not read(p/'review/layout-check.json')['errors']
plan=read(b/'file-moves.json')
# Check the complete plan before any existing file is moved.
for x in plan['moves']:
 s=Path(x['source']);t=Path(x['target']);assert s.is_file() and sha(s)==x['sha256'],str(s)
 assert not t.exists(),str(t)
authority=root/'CONTENT_WORKFLOW.md';assert sha(authority)==sha(b/'CONTENT_WORKFLOW.md'),'Workflow changed since backup'
label='Datum offen - Werki vs. Prakti'
posting=root/'03_Bereit_zum_Posten'/(label+'.mp4');edited=root/'02_Bearbeitete_Videos'/(label+'.mp4')
for target in [posting,edited]:
 assert not target.exists(),str(target)
 with export.open('rb') as src,target.open('xb') as dst:shutil.copyfileobj(src,dst,8*1024*1024)
 assert sha(target)==report['sha256']
# Preserve the previous posting file and all intermediate media.
for x in plan['moves']:
 s=Path(x['source']);t=Path(x['target']);t.parent.mkdir(parents=True,exist_ok=True);shutil.move(s,t)
 assert sha(t)==x['sha256'];x['verified']=True
# Remove only empty former video directories. Leave unrelated archive contents alone.
removed=[]
for d in sorted({Path(x['source']).parent for x in plan['moves']},key=lambda x:len(x.parts),reverse=True):
 if d.parent==root:continue
 if d.exists() and not any(d.iterdir()):d.rmdir();removed.append(str(d))
# Rewrite current file references. Historical render reports remain historical.
path_map={x['source']:x['target'] for x in plan['moves']}
for x in plan['moves']:
 if '03_Bereit_zum_Posten/2026-09-13_Werki-Praktikum/' in x['source']:
  baseline=Path(m['baselineExport']);assert baseline.is_file();path_map[x['source']]=str(baseline)
links=[]
files=list((r/'projects').glob('*/workflow.json'))+list((r/'experiments').rglob('Vergleich.html'))+list((root/'02_Bearbeitete_Videos/Experimente').rglob('Vergleich.html'))
for f in files:
 if f==p/'workflow.json':continue
 old=f.read_text();new=old
 for a,d in path_map.items():new=new.replace(a,d).replace(Path(a).as_uri(),Path(d).as_uri())
 if old!=new:
  dest=b/'link-backups'/(hashlib.sha256(str(f).encode()).hexdigest()[:12]+'-'+f.name);dest.parent.mkdir(exist_ok=True);dest.write_text(old);f.write_text(new);links.append(str(f))
# Apply already prepared documentation to its authoritative location and local guides.
for src,dest in [('CONTENT_WORKFLOW.updated.md',authority),('AGENTS.md.updated.md',r/'AGENTS.md'),('README.md.updated.md',r/'README.md')]:
 data=(b/src).read_bytes();dest.write_bytes(data);assert dest.read_bytes()==data
plan.update(status='applied_and_verified',appliedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),removedEmptyFolders=removed,updatedReferenceFiles=links)
write(b/'file-moves.json',plan)
m.update(latestExport=str(export),postingCopy=str(posting),deliveryCopy=str(edited),postingDate=None,postingDateStatus='awaiting_user',deliverySha256=report['sha256'],deliveryProfile='H.264 1080x1920p30 SDR/BT.709, 12 Mbit/s Videoziel, AAC-LC 120 kbit/s, faststart',revisionLabel='V4: Titel ab 0:00 und LinkedIn-Abschluss',status='complete',deliveryVerified=True)
write(p/'workflow.json',m)
write(b/'delivery-check.json',dict(postingCopy=str(posting),editedCopy=str(edited),sha256=report['sha256'],workflowVersion='1.4',postingDatesPending=True,moveCount=len(plan['moves']),verified=True))
print(json.dumps(dict(posting=str(posting),edited=str(edited),moves=len(plan['moves']),updatedReferenceFiles=len(links),removedEmptyFolders=len(removed),docs='1.4 saved and verified'),ensure_ascii=False,indent=2))
