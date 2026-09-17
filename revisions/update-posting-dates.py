from pathlib import Path
import json,hashlib,shutil,datetime
r=Path.cwd();state=json.loads((r/'revisions/social-outro-current.json').read_text());b=Path(state['backup']);root=Path('/Users/abi/Desktop/Social Media/Content_Videos')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
facts={'Karrierebereiche':('2026-09-13','posted'),'Consulting erklärt':('2026-09-14','posted'),'Berufserfahrung':('2026-09-15','planned')};moves=[]
for title,(date,status) in facts.items():
 for d in ['02_Bearbeitete_Videos','04_Gepostet']:
  for f in (root/d).glob('Datum offen - '+title+'*'):
   targetdir=root/('03_Bereit_zum_Posten' if d=='04_Gepostet' and status=='planned' else d)
   target=targetdir/f.name.replace('Datum offen',date,1);assert not target.exists(),target
   moves.append(dict(source=str(f),target=str(target),sha256=sha(f)))
assert len(moves)==12,len(moves)
plan=dict(status='prepared',basis='Explizite Nutzerkorrektur am 14.09.2026: Karrierebereiche gestern, Consulting heute Morgen, Berufserfahrung noch nicht und voraussichtlich morgen.',timezone='Europe/Berlin',facts={k:dict(date=d,status=s) for k,(d,s) in facts.items()},moves=moves)
(b/'date-moves.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
for x in moves:
 shutil.move(x['source'],x['target']);assert sha(x['target'])==x['sha256'];x['verified']=True
files=list((r/'projects').glob('*/workflow.json'))+list((r/'experiments').rglob('Vergleich.html'))+list((root/'02_Bearbeitete_Videos/Experimente').rglob('Vergleich.html'))+[root/'CONTENT_WORKFLOW.md',r/'AGENTS.md',r/'README.md']
changed=[]
for f in files:
 old=f.read_text();new=old
 for x in moves:
  a=Path(x['source']);d=Path(x['target']);new=new.replace(str(a),str(d)).replace(a.as_uri(),d.as_uri()).replace(str(a.relative_to(root)),str(d.relative_to(root)))
 if f==root/'CONTENT_WORKFLOW.md':
  new=new.replace('Die anderen Videos sind laut Abdullah bereits veröffentlicht und werden durch diesen Auftrag nicht erneut bearbeitet.','Karrierebereiche und Consulting sind laut der korrigierten Rückmeldung vom 14.09.2026 bereits veröffentlicht. Berufserfahrung ist noch nicht veröffentlicht und für den 15.09.2026 geplant. Die Veröffentlichungsdaten stehen in Abschnitt 3b.')
  new=new.replace('Die Rückmeldung nennt kein eindeutiges Veröffentlichungsdatum oder einen Beitragslink für die einzelnen Videos. Diese Angaben nicht erfinden.','Die frühere Rückmeldung nannte zunächst keine eindeutigen Daten. Die später ausdrücklich genannten Postingtage stehen in Abschnitt 3b. Ein konkreter Beitragslink liegt weiterhin nicht vor.')
  marker='## 4. Wie das Referenzvideo entstanden ist'
  new=new.replace(marker,'''## 3b. Bestätigte Postingdaten und korrigierter Status

Stand der ausdrücklichen Nutzerkorrektur vom 14.09.2026, Europe/Berlin:

| Video | Datum | Status und Ablage |
|---|---|---|
| Karrierebereiche | 13.09.2026 | Tatsächlich veröffentlicht, `04_Gepostet/2026-09-13 - Karrierebereiche.mp4`. |
| Consulting erklärt | 14.09.2026, morgens | Tatsächlich veröffentlicht, `04_Gepostet/2026-09-14 - Consulting erklärt.mp4`. Keine genaue Uhrzeit genannt. |
| Berufserfahrung | Voraussichtlich 15.09.2026 | Noch nicht veröffentlicht. `03_Bereit_zum_Posten/2026-09-15 - Berufserfahrung.mp4`. Notion bleibt Ready to Post. |
| Werki vs. Prakti | Noch offen | Aktuelle Fassung in `03_Bereit_zum_Posten/Datum offen - Werki vs. Prakti.mp4`. |

Berufserfahrung lag nach einer zu weit gefassten Interpretation der früheren Posting-Rückmeldung irrtümlich unter `04_Gepostet`. Das ist korrigiert. Eine voraussichtliche Veröffentlichung ist eine Planung. Nicht automatisch am Folgetag nach `04_Gepostet` verschieben oder als POSTED markieren.

'''+marker)
 if new!=old:
  backup=b/'date-reference-backups'/(hashlib.sha256(str(f).encode()).hexdigest()[:12]+'-'+f.name);backup.parent.mkdir(exist_ok=True);backup.write_text(old);f.write_text(new);changed.append(str(f))
canonical=[('Consulting-SafeZone-2026-09-13T17-15-44Z','Consulting erklärt','3aa8cb917b3b8001b269e8938b387a36'),('Berufserfahrung-SafeZone-2026-09-13T17-15-44Z','Berufserfahrung','3d88cb917b3b807ca13df47d16310e5a'),('Video-1-1x-2026-09-13T14-20-46-781Z','Karrierebereiche','3bf8cb917b3b8081814bdd24243fd05b')]
for name,title,id in canonical:
 f=r/'projects'/name/'workflow.json';m=json.loads(f.read_text());date,status=facts[title];m.update(publicationStatus=status,postingDate=date,postingDateStatus='confirmed' if status=='posted' else 'planned',notionPage='https://app.notion.com/p/'+id,notionStatus='🚀 POSTED' if status=='posted' else '💺 Ready to Post',postingDateBasis='Nutzerkorrektur vom 14.09.2026')
 target=root/('04_Gepostet' if status=='posted' else '03_Bereit_zum_Posten')/(date+' - '+title+'.mp4');assert target.is_file()
 if status=='posted':m['postedCopy']=str(target);m['postedAt']=date;m.pop('postingCopy',None)
 else:m['postingCopy']=str(target);m.pop('postedCopy',None);m.pop('postedAt',None)
 f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
plan.update(status='applied_and_verified',updatedReferenceFiles=changed,appliedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());(b/'date-moves.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');print(json.dumps(dict(moves=len(moves),verified=True,referenceUpdates=len(changed)),indent=2))
