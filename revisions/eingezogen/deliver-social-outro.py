from pathlib import Path
import json,hashlib,shutil,os,datetime
r=Path.cwd();state=json.loads((r/'revisions/social-outro-current.json').read_text());p=Path(state['project']);b=Path(state['backup']);root=Path('/Users/abi/Desktop/Social Media/Content_Videos');sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
m=json.loads((p/'workflow.json').read_text());report=json.loads((p/'review/final-export-check.json').read_text());out=Path(m['latestExport']);prev=Path(m['revisionOf']);oldm=json.loads((prev/'workflow.json').read_text())
assert report['fullyDecoded'] and report['vmafMeanVsRenderedMaster']>95 and sha(out)==report['sha256']
assert not json.loads((p/'review/layout-check.json').read_text())['errors']
assert sha(root/'CONTENT_WORKFLOW.md')==sha(b/'CONTENT_WORKFLOW.before-outro.md'),'Workflow seit Vorbereitung geändert'
posting=root/'03_Bereit_zum_Posten/Datum offen - Werki vs. Prakti.mp4';edited=root/'02_Bearbeitete_Videos/Datum offen - Werki vs. Prakti.mp4';archive=root/'02_Bearbeitete_Videos/Datum offen - Werki vs. Prakti - Vorversion V4.mp4';oldposting=b/'Werki_previous_upload_V4.mp4'
assert not archive.exists() and not oldposting.exists()
assert sha(posting)==sha(edited)==oldm['deliverySha256']
# Prepare and verify both new copies before replacing the current delivery.
temps=[]
for dest in [posting,edited]:
 temp=dest.with_name('.'+dest.name+'.new');assert not temp.exists()
 with out.open('rb') as src,temp.open('xb') as dst:shutil.copyfileobj(src,dst,8*1024*1024)
 assert sha(temp)==report['sha256'];temps.append(temp)
shutil.move(edited,archive);shutil.move(posting,oldposting)
for temp,dest in zip(temps,[posting,edited]):os.rename(temp,dest);assert sha(dest)==report['sha256']
for source,target in [('CONTENT_WORKFLOW.updated.md',root/'CONTENT_WORKFLOW.md'),('AGENTS.md.updated',r/'AGENTS.md'),('README.md.updated',r/'README.md')]:
 data=(b/source).read_bytes();target.write_bytes(data);assert target.read_bytes()==data
m.update(latestExport=str(out),postingCopy=str(posting),deliveryCopy=str(edited),deliverySha256=report['sha256'],deliveryVerified=True,status='complete',publicationStatus='ready_to_post',postingDate=None,postingDateStatus='awaiting_user',socialOutroVersion='abi-social-outro-v1',deliveryProfile='H.264 1080x1920p30 SDR/BT.709, 12 Mbit/s Videoziel, AAC-LC 120 kbit/s, faststart',revisionLabel='V5: Alle vier Profile gleichzeitig im einheitlichen Outro')
(p/'workflow.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
# Keep the previous project's delivery references on its preserved version.
oldm['postingCopy']=str(oldposting);oldm['deliveryCopy']=str(archive);oldm['supersededBy']=str(p);(prev/'workflow.json').write_text(json.dumps(oldm,ensure_ascii=False,indent=2)+'\n')
summary=dict(posting=str(posting),edited=str(edited),sha256=report['sha256'],workflowVersion='1.5',previousVersionPreserved=str(archive),simultaneousProfiles=True,postingDateForWerki='open',verified=True,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(b/'delivery-verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
