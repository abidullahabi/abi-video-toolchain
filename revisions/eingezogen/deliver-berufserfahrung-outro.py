from pathlib import Path
import hashlib,json,shutil,os
r=Path(__file__).resolve().parent.parent
info=json.loads((r/'revisions/berufserfahrung-outro-current.json').read_text())
p=Path(info['project']);b=Path(info['baseline']);backup=Path(info['backup']);werki=Path(info['reference'])
root=Path('/Users/abi/Desktop/Social Media/Content_Videos')
def read(q):return json.loads(q.read_text())
def write(q,v):q.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def sha(q):
 h=hashlib.sha256()
 with q.open('rb') as f:
  for block in iter(lambda:f.read(8*1024*1024),b''):h.update(block)
 return h.hexdigest()
m=read(p/'workflow.json');report=read(p/'review/final-export-check.json');rev=read(p/'review/revision-check.json')
assert m['status']=='complete' and not read(p/'review/layout-check.json')['errors']
assert report['fullyDecoded'] and report['vmafMeanVsRenderedMaster']>95
assert rev['unchangedExceptOutro'] and rev['visualReview']['passed']
new=Path(m['latestExport']);newhash=sha(new);assert newhash==report['sha256']
oldhash='392ca3f8ad8b5d914428f1003098240e6093766b0419d57f3b2cfefa73698c13'
filename='2026-09-15 - Berufserfahrung.mp4';edited=root/'02_Bearbeitete_Videos'/filename;posting=root/'03_Bereit_zum_Posten'/filename
oldedited=edited.with_name('2026-09-15 - Berufserfahrung - Vorversion V2.mp4');oldposting=backup/'Berufserfahrung_previous_upload_V2.mp4'
assert not oldedited.exists() and not oldposting.exists()
assert sha(edited)==sha(posting)==oldhash
assert (root/'CONTENT_WORKFLOW.md').read_bytes()==(backup/'CONTENT_WORKFLOW_v1.5.md').read_bytes(),'MD wurde zwischenzeitlich verändert'
posted={str(q):sha(q) for q in (root/'04_Gepostet').glob('*.mp4')}
werki_file=root/'03_Bereit_zum_Posten/Datum offen - Werki vs. Prakti.mp4'
werki_hash='aa25ee81e489d276755464376969ce194deb8fd3c1ea36d2f800aab6f5d479bd'
assert sha(werki_file)==werki_hash
shutil.copy2(posting,oldposting);assert sha(oldposting)==oldhash
staged=[]
for dest in [edited,posting]:
 temp=dest.with_name('.'+dest.stem+' - staged V3.mp4');assert not temp.exists()
 shutil.copy2(new,temp);assert sha(temp)==newhash;staged.append((temp,dest))
os.replace(edited,oldedited)
for temp,dest in staged:os.replace(temp,dest)
assert sha(edited)==sha(posting)==newhash
shutil.copyfile(backup/'CONTENT_WORKFLOW.md',root/'CONTENT_WORKFLOW.md')
for f in ['AGENTS.md','README.md']:shutil.copyfile(backup/('updated-'+f),r/f)
m.update(deliveryCopy=str(edited),deliverySha256=newhash,postingCopy=str(posting),postingCopySha256=newhash,postingPackageStatus='ready_to_post',socialOutroVersion='abi-social-outro-v1',visualReview=rev['visualReview'])
write(p/'workflow.json',m)
old=read(b/'workflow.json');old.update(supersededBy=str(p),deliveryCopy=str(oldedited),postingCopy=str(oldposting),postingPackageStatus='superseded_by_social_outro_v3');write(b/'workflow.json',old)
current=[]
for project,file in [(p,posting),(werki,werki_file)]:
 plan=read(project/'theme-plan.json');meta=read(project/'workflow.json');q=read(project/'review/final-export-check.json')
 assert plan['socialOutroVersion']=='abi-social-outro-v1'
 assert plan['outroGroup']['simultaneousProfiles'] and plan['outroGroup']['profileCount']==4
 assert sha(file)==q['sha256'] and not read(project/'review/layout-check.json')['errors']
 assert plan['socialCtas'][0]['profiles']==read(werki/'theme-plan.json')['socialCtas'][0]['profiles']
 current.append({'file':str(file),'project':str(project),'sha256':sha(file),'duration':q['duration'],'outroStart':plan['outroGroup']['start'],'allFourProfilesTogether':True,'fullyDecoded':q['fullyDecoded']})
assert {q.name for q in (root/'03_Bereit_zum_Posten').glob('*.mp4')}=={posting.name,werki_file.name}
assert all(sha(Path(q))==h for q,h in posted.items())
result={'currentPostingVideos':current,'previousVersionPreserved':[str(oldedited),str(oldposting)],'postedVideosUnchanged':posted,'workflowVersion':'1.6','workflowSha256':sha(root/'CONTENT_WORKFLOW.md')}
write(backup/'delivery-verification.json',result);write(r/'revisions/pending-social-outro-current.json',result)
print(json.dumps(result,ensure_ascii=False,indent=2))
