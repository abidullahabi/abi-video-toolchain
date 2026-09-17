from pathlib import Path
import json, hashlib, os

root = Path(__file__).resolve().parent.parent
desktop = Path('/Users/abi/Desktop/Social Media/Content_Videos')
jobs = json.loads((root / 'revisions/handle-correction-current.json').read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
records = []
for job in jobs:
    project = Path(job['project'])
    metadata = json.loads((project / 'workflow.json').read_text())
    post = json.loads((project / 'review/zernio-scheduled.json').read_text())
    source = Path(metadata['postingCopy'])
    target = desktop / '04_Gepostet' / f"{job['date']} - {job['name']}.mp4"
    assert post['status'] == 'scheduled'
    assert post['scheduledFor'] == job['date'] + 'T17:00:00.000Z'
    assert sorted((p['platform'], p['accountId']['username']) for p in post['platforms']) == [('instagram', 'abidullahabi'), ('tiktok', 'abidullahabi')]
    assert post['metadata']['sourceSha256'] == metadata['deliverySha256'] == sha(source)
    assert post['content'] == metadata['postingDescription']
    assert len(post['mediaItems']) == 1 and post['mediaItems'][0]['type'] == 'video'
    assert not target.exists()
    os.rename(source, target)
    assert sha(target) == metadata['deliverySha256'] and not source.exists()
    metadata.update(postingCopy=str(target), archiveCopy=str(target), publicationStatus='scheduled', zernioPostId=post['_id'], scheduledFor=job['date']+'T19:00:00+02:00', postingPackageStatus='scheduled', archiveBasis='Ausdrücklicher Nutzerauftrag: nach Einplanung nach 04_Gepostet verschieben. Kein Beleg einer tatsächlichen Veröffentlichung.')
    (project / 'workflow.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n')
    records.append(dict(video=job['name'], file=str(target), status='scheduled', scheduledFor=metadata['scheduledFor'], postId=post['_id'], sha256=metadata['deliverySha256']))

workflow = desktop / 'CONTENT_WORKFLOW.md'
text = workflow.read_text()
lines = text.splitlines()
for i,line in enumerate(lines):
    if line.startswith('Version 1.6'):
        lines[i]='Version 1.7 · Stand 14.09.2026 · Profilnamen korrigiert und zwei Abendtermine über Zernio eingeplant'
    for job, record in zip(jobs, records):
        if line.startswith('| '+job['name']+' |'):
            date='.'.join(reversed(job['date'].split('-')))
            lines[i]=f"| {job['name']} | {date}, 19:00 Uhr | Über Zernio für Instagram und TikTok eingeplant, noch nicht veröffentlicht. `04_Gepostet/{Path(record['file']).name}` auf ausdrücklichen Nutzerwunsch bereits nach Einplanung. Notion bleibt Ready to Post. Zernio-ID `{record['postId']}`. |"
text='\n'.join(lines)+'\n'
anchor='## 4. Wie das Referenzvideo entstanden ist'
note='### Aktueller Postingauftrag vom 14.09.2026\n\nAbdullah hat die Korrektur der Instagram- und TikTok-Handles auf **@abidullahabi** ausdrücklich bestätigt. Beide tatsächlichen Upload-Exporte wurden korrigiert, visuell geprüft und über Zernio mit den unveränderten finalen Notion-Beschreibungen eingeplant. Für diesen Auftrag ist die Verschiebung nach `04_Gepostet` bereits nach erfolgreicher Einplanung ausdrücklich gewünscht. Die Ordnerzuordnung belegt daher bei diesen beiden Dateien keine tatsächliche Veröffentlichung. Status erst nach bestätigtem Plattform-Erfolg auf POSTED setzen. Die fehlerhaften Fassungen sind aus den aktiven Bearbeitungs- und Postingdateien entfernt und intern als `superseded-do-not-post` erhalten.\n\n'
assert anchor in text and '### Aktueller Postingauftrag vom 14.09.2026' not in text
workflow.write_text(text.replace(anchor,note+anchor,1))
(root / 'revisions/handle-correction-scheduled-delivery.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(records,ensure_ascii=False,indent=2))
