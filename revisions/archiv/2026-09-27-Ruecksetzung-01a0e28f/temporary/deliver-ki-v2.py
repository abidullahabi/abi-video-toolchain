from pathlib import Path
import json,hashlib,shutil,os
from datetime import datetime,timezone
R=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
P=R/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';Q=P/'review/revision-v2'
D=Path('/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation')
expected='3469ada63f5a6111898ed980d90f16cd8bf2e02081f715035cfa135c1e874bc2'
now=datetime.now(timezone.utc).isoformat()
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8*1024*1024),b''):h.update(b)
 return h.hexdigest()
def save_new(path,value):
 with path.open('x') as f:json.dump(value,f,ensure_ascii=False,indent=2);f.write('\n')
def update_json(path,value):
 tmp=path.with_name(path.name+'.v2-tmp')
 with tmp.open('x') as f:json.dump(value,f,ensure_ascii=False,indent=2);f.write('\n')
 tmp.replace(path)
plan=json.loads((Q/'keep-v2.json').read_text());qa=json.loads((Q/'independent-qa/technical-report.json').read_text());meta=json.loads((P/'workflow.json').read_text())
assert qa['technicalChecksAllPassed'] and all(qa['checks'].values())
out=P/'exports/KI-Einstieg-Schnitt-v2.mp4';assert digest(out)==expected
assert (Q/'visual-qa/bildpruefung-v2.md').is_file()
assert (Q/'actual-export-asr.txt').is_file()
assert 'Gen AI for Everyone' in (Q/'actual-export-asr.txt').read_text()
assert 'oder so heißt' not in (Q/'actual-export-asr.txt').read_text()
assert 'Google AI Professional' not in (Q/'actual-export-asr.txt').read_text()
orig=Path(meta['originalSource']);copy=Path(meta['source']);assert orig.stat().st_ino!=copy.stat().st_ino
assert digest(orig)==digest(copy)==meta['sourceSha256']
# The team has fully read these exact current files, including changed versions.
expected_guidelines={
 'Anleitung/CONTENT_WORKFLOW.md':'13b267997f5fc32ce2906f8d38a93a548a4ba9fce1ae76c8892cfc41c5f55101',
 'Anleitung/CONTENT_SCRIPT_WORKFLOW.md':'67cbaaa6c845d22041fd3f1de7413bff9f0d10f5c6002bf3c6497bc207e408a4',
 'Anleitung/DESIGN.md':'8cbc93eb1bb00d9f836c0a01cf10ef507ecdc9578fd7aecd75ab808bbede6908',
 'Anleitung/Belege/TESTPROTOKOLL.md':'30542b24fb069367347a03190bc8a58e69e9696e01a41950168faa39749a1f9e',
 'Anleitung/Belege/ENTSCHEIDUNGEN.md':'c32b891c8cbf40cb97230d115243fc10d2636650342a380e7085eebca55d857d'}
guidelines=[]
for rel,h in expected_guidelines.items():
 path=D/rel;assert digest(path)==h,f'Guideline changed since complete reading: {rel}'
 guidelines.append({'path':str(path),'sha256':h,'lines':len(path.read_text().splitlines()),'readScope':'complete','readBy':'root, with latest parallel changes fully re-read by workflow_pruefung','verifiedAt':now})
review={
 'export':str(out),'sha256':expected,'version':'KI-V2','status':'raw_cut_for_user_review','scope':'Only approved cut corrections. No graphics, music, captions, speed change or publishing.','auditoryReviewPerformed':False,'qualitativeFinalApproval':False,
 'approvalBasis':'User ok following staged KI-V2 correction plan. Quality and fluent speech have priority over duration. Whole Google name may be omitted if no clean complete take established.',
 'evidence':{'selection':'keep-v2.json','pcm':'pcm-checks.json','actualExportTechnical':'independent-qa/technical-report.json','actualExportAutomaticTranscript':'actual-export-asr.txt','visual':'visual-qa/bildpruefung-v2.md'},
 'selfCheckAgainstPriorFailures':[
  {'priorFailure':'Bad takes were frozen and later counted as preserved words.','correction':'Selection re-evaluated before new plan. Removed Andrew attribution/aside and all selected Google name attempts. No word-count quality claim.'},
  {'priorFailure':'Whole ASR collapsed repeated starts into a clean-looking transcript.','correction':'Existing short local recognition and unmapped Google speech block reviewed. Whole Google name omitted rather than stitched from uncertain fragments.'},
  {'priorFailure':'VAD-only cuts reached quiet speech or uncertain quiet sound.','correction':'Added onset frames at167.3667 and211.3667, restored100ms source308.9667–309.0667, retained more lead into schreib by starting313.8.'},
  {'priorFailure':'Metric optimization displaced quality and final gesture.','correction':'No fixed-duration or hard pause-median gate. Two measured192ms gaps retained. Final31frames are natural movement and held smile/thumb pose.'},
  {'priorFailure':'Frame uniqueness was treated as proof of a finished gesture.','correction':'Direct V1/V2 ending image sequences reviewed. V2 holds visible smile/thumb at57.5–57.9667. No continuous-motion or listening review claimed.'}],
 'textReview':{'intendedRemovalsAbsent':True,'titleRecognizedComplete':True,'unexpectedTextLossFound':False,'remainingAsrVariation':'Dir versus Hier wird gezeigt at44.92 occurs in unchanged source250.5–254.4667. Recognition variation is not a demonstrated edit error. Voll versus user-confirmed Folgen also existed in V1.'},
 'rootVisualReview':{'viewed':['visual-qa/v1-last2s-overview.jpg','visual-qa/v2-last2s-overview.jpg','visual-qa/changed-seams-01.jpg','visual-qa/changed-seams-02.jpg','visual-qa/changed-seams-03.jpg','visual-qa/changed-seams-04.jpg','visual-qa/v2-last2s-full-05.jpg'],'findings':['Held smile and thumb visible at end.','Take, gaze and hand changes remain at32.3,33.7,38.7333,44.8667,53.0667. No black or unrelated frames seen in these samples.','First32.3s source/frame selection retained, prepared PCM byte-identical.'],'independentReview':'visual-qa/bildpruefung-v2.md','independentScope':'104 V2 and60 V1 still frames including all12 changed joins and every final60frame from each export.','continuousPlaybackReviewed':False},
 'openListeningChecks':[{'timeSeconds':33.7,'issue':'Everyone/von phonetic separation. Isolated and whole-export ASR recognize Everyone, but adjacent low-level phonetics cannot be certified without listening.'},{'timeSeconds':54.5,'issue':'schreib onset and CTA joins after restored lead-in.'},{'timeSeconds':56.2333333333,'issue':'Folgen nicht vergessen. ASR spelling voll is inconsistent with user-confirmed intended speech. No synthetic replacement.'}],
 'originalIntegrity':{'unchanged':True,'sha256':meta['sourceSha256'],'bytes':orig.stat().st_size,'independentWorkingCopy':True,'originalUsedForMediaProcessing':False,'checkedAt':now},
 'technicalProfile':'1080x1920 CFR30 H264 CRF18, native48k mono AAC192k review file. Not a posting-profile delivery.',
 'designChecklistStatus':'Not applicable at current raw-cut stage. Design not started.','nextStep':'User reviews this concrete raw cut before any design stage.','createdAt':now}
# Preserve prior active plan files before pointing the project to V2.
for name in ['cuts.json','timeline-map.json']:
 old=P/name;bak=Q/(name.replace('.json','')+'-before-v2.json')
 if old.exists() and not bak.exists():shutil.copy2(old,bak)
# Copy into the review folder without overwriting any existing video.
dest=D/'02_Bearbeitete_Videos/Datum offen - KI-Einstieg - Schnitt v2.mp4'
if dest.exists():assert digest(dest)==expected
else:
 tmp=dest.with_name('.'+dest.name+'.part')
 assert not tmp.exists()
 with out.open('rb') as src,tmp.open('xb') as dst:shutil.copyfileobj(src,dst,8*1024*1024)
 assert digest(tmp)==expected
 tmp.rename(dest)
assert digest(dest)==expected
# Keep the superseded review version in the archive, never delete it.
v1=D/'02_Bearbeitete_Videos/Datum offen - KI-Einstieg - Schnitt v1.mp4'
v1archive=D/'Archiv/Vorversionen/Datum offen - KI-Einstieg - Schnitt v1.mp4'
v1sha='a3cf7037d4c2a38eb4e1783f96c02fe646bab46c97a21eea2fb7781782784322'
if v1.exists():
 assert digest(v1)==v1sha and not v1archive.exists()
 v1.rename(v1archive)
assert v1archive.is_file() and digest(v1archive)==v1sha
log=D/'Archiv/ZUORDNUNGSPROTOKOLL.md'
section='## KI-Einstieg, Schnittrevision V2, 27.09.2026'
if section not in log.read_text():
 with log.open('a') as f:
  f.write('\n\n'+section+'\n\n| von | nach | Grund | SHA-256 |\n|---|---|---|---|\n')
  f.write('| `'+str(v1.relative_to(D))+'` | `'+str(v1archive.relative_to(D))+'` | Vorversion nach freigegebener Schnittkorrektur archiviert. Weiter als Vergleich erhalten. Originalaufnahme unverändert. | `'+v1sha+'` |\n')
  f.write('| `'+str(out)+'` | `'+str(dest.relative_to(D))+'` | Geprüfte Rohschnittkopie V2 zur Nutzerabnahme. Noch keine qualitative Tonfreigabe und kein Posting. | `'+expected+'` |\n')
review['reviewCopy']={'path':str(dest),'sha256':expected,'copyVerified':True}
review['previousReviewVersion']={'path':str(v1archive),'sha256':v1sha,'preserved':True}
save_new(Q/'revision-review.json',review)
rem=[];last=0;prev=None
for a,b,label in plan['intervals']:
 if a>last:
  typ='silence' if prev==label else 'editorial'
  reason='Beibehaltene quellinterne Pausenkürzung mit individuellen Sprachrändern.' if typ=='silence' else 'Freigegebene Auswahl ganzer Inhaltsblöcke und Entfernung verworfener Anläufe. Details review/revision-v2/keep-v2.json.'
  rem.append({'start':last,'end':a,'type':typ,'reason':reason})
 last=b;prev=label
if last<321.575:rem.append({'start':last,'end':321.575,'type':'editorial','reason':'Ende nach gehaltener Lächeln/Daumen-Pose, vor Auflösen und Ablenkung.'})
update_json(P/'cuts.json',{'speed':1,'sourceDuration':321.575,'removals':rem,'selectionFile':'review/revision-v2/keep-v2.json','selectionSha256':digest(Q/'keep-v2.json')})
update_json(P/'timeline-map.json',{'source':meta['source'],'speed':1,'intervals':plan['timeline']})
meta.update({'status':'cut_exported_for_review','mode':'cut-only','updatedAt':now,'guidelinesRead':guidelines,'selectionFrozen':True,'sourceSelectionFile':'review/revision-v2/keep-v2.json','cutAudio':'review/revision-v2/cut-audio.wav','proposedCutDuration':58.0,'cutDuration':58.0,'removedSeconds':321.575-58,'keepIntervals':[[a,b] for a,b,_ in plan['intervals']],'latestExport':str(out),'exportSha256':expected,'technicalChecksPassed':True,'visualSamplingCompleted':True,'postingReady':False,'auditoryReviewPerformed':False,'qualitativeFinalApproval':False,'finalTechnicalQA':'review/revision-v2/independent-qa/technical-report.json','finalVisualEvidence':'review/revision-v2/visual-qa/','finalVisualQA':'review/revision-v2/revision-review.json','reviewReport':'review/revision-v2/revision-review.json','revisionRecognition':{'file':'review/revision-v2/actual-export-asr.json','status':'automatic_text_checked_not_listened','source':'actual encoded AAC'},'aktuell':{'datei':str(out),'sha256':expected,'bytes':out.stat().st_size,'erzeugt':now,'status':'raw_cut_awaiting_user_review'},'roughCutReviewCopy':{'path':str(dest),'sha256':expected,'copyVerified':True,'status':'awaiting_user_cut_review','postingReady':False,'createdAt':now},'qualitativeReview':{'status':'open','auditoryReviewPerformed':False,'visualScope':'Changed joins and ending sampled as still sequences. Root viewed seven contact sheets. Independent image review stored in revision-v2/visual-qa. No continuous playback claim.','userCutApprovalPending':True,'specificOpenListeningChecks':review['openListeningChecks']},'originalIntegrityAfterExport':review['originalIntegrity']})
meta['bearbeitung']={'agent':'Codex 01a0e28f','aufgabe':'Freigegebene KI-V2-Schnittkorrektur umgesetzt. Technische und bildgestützte Prüfung dokumentiert. Wartet auf Nutzerabnahme vor Gestaltung.','begonnen':plan['createdAt'],'status':'rohschnitt_zur_abnahme'}
meta.setdefault('previousReviewVersions',[]).append(review['previousReviewVersion'])
update_json(P/'workflow.json',meta)
shutil.copy2(__file__,Q/'deliver-ki-v2.py')
assert digest(dest)==digest(out)==meta['aktuell']['sha256']
assert json.loads((P/'workflow.json').read_text())['roughCutReviewCopy']['path']==str(dest)
print(json.dumps({'reviewCopy':str(dest),'sha256':expected,'duration':58.0,'v1Archive':str(v1archive),'originalUnchanged':True,'workflowUpdated':True,'postingReady':False},ensure_ascii=False))
