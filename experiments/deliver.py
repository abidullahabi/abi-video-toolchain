from pathlib import Path
import shutil,hashlib,json
root=Path(__file__).resolve().parent.parent
source=root/'experiments/Schnitt-Experiment-2026-09-13'
dest=Path('/Users/abi/Desktop/Social Media/Content_Videos/02_Bearbeitete_Videos/Experimente/2026-09-13_Schnitt-Experiment')
assert (source/'Vergleich.html').exists() and len(list(source.glob('*.mp4')))==7
for key in ['werki','berufserfahrung','consulting']:
 p=Path((root/f'experiments/project-{key}.txt').read_text().strip());m=json.loads((p/'workflow.json').read_text());assert m['status']=='experiment_complete'
assert not dest.exists(),'Delivery folder already exists; do not overwrite.'
shutil.copytree(source,dest)
files=[]
for f in source.rglob('*'):
 if not f.is_file():continue
 d=dest/f.relative_to(source);assert hashlib.sha256(f.read_bytes()).digest()==hashlib.sha256(d.read_bytes()).digest();files.append(str(d))
(root/'experiments/delivery.json').write_text(json.dumps({'directory':str(dest),'files':files,'copiesVerified':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'directory':str(dest),'files':len(files),'copiesVerified':True}),flush=True)
