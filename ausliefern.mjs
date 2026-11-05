// Ein Auslieferungsschritt für alle Videos.
//
//   node ausliefern.mjs "<Projektordner>" "<Videotitel>" --datum 2026-09-17
//
// Ersetzt sechs Einmalskripte in revisions/, die alle dasselbe taten — Bericht
// prüfen, Prüfsumme vergleichen, Kopie anlegen, Projektstand nachführen — und
// die alle auf den längst verschwundenen Pfad Desktop/Social Media/Content_Videos
// zeigten. Jede Korrektur hatte ein eigenes Skript bekommen, statt dass es
// einen Schritt mit Parametern gab.
//
// Nichts wird überschrieben und nichts gelöscht. Existiert das Ziel bereits,
// bricht der Schritt ab und nennt beide Prüfsummen.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { auslieferung } from './pruefungen.mjs';

// ABI_ABLAGE nur für Tests (Probelauf gegen einen Ersatzordner), sonst immer die Drive-Ablage.
const ABLAGE = process.env.ABI_ABLAGE ?? '/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

export function ausliefernNach(projekt, titel, datum, { ziel = '03_Bereit_zum_Posten' } = {}) {
  const p = path.resolve(projekt);
  const m = JSON.parse(fs.readFileSync(path.join(p, 'workflow.json'), 'utf8'));

  // 1. Welche Datei überhaupt? Das Zeigerfeld aus Punkt 7, ersatzweise latestExport.
  const quelle = m.aktuell?.datei ?? m.latestExport;
  if (!quelle) throw Error('Weder aktuell noch latestExport gesetzt. Erst exportieren.');
  if (!fs.existsSync(quelle)) throw Error(`Zeigt ins Leere: ${quelle}\nFeld aktuell oder latestExport ist veraltet.`);

  // 2. Auslieferungssperre aus Punkt 5, inklusive Prüfsummenabgleich.
  const frei = auslieferung(p, quelle);
  if (!frei.ok) throw Error('Auslieferung gesperrt: ' + frei.grund);

  // 3. Exportbericht gegenlesen: vollständig decodiert, VMAF über 95, Prüfsumme stimmt.
  const berichtDatei = path.join(p, 'review/final-export-check.json');
  if (!fs.existsSync(berichtDatei)) throw Error('review/final-export-check.json fehlt. Erst finalize-buffer-video.py laufen lassen.');
  const b = JSON.parse(fs.readFileSync(berichtDatei, 'utf8'));
  const istSha = sha(quelle);
  if (!b.fullyDecoded) throw Error('Exportbericht meldet die Datei als nicht vollständig decodiert.');
  if (!(b.vmafMeanVsRenderedMaster > 95)) throw Error(`VMAF ${b.vmafMeanVsRenderedMaster} liegt nicht über 95.`);
  if (b.sha256 !== istSha) throw Error(`Die Datei wurde nach dem Exportbericht verändert.\n  Bericht: ${b.sha256}\n  jetzt:   ${istSha}`);

  // 4. Ziel bestimmen und niemals ungeprüft überschreiben.
  const name = `${datum} - ${titel}.mp4`;
  const zielDatei = path.join(ABLAGE, ziel, name);
  if (fs.existsSync(zielDatei)) {
    const vorhanden = sha(zielDatei);
    if (vorhanden === istSha) return { schon_da: true, datei: zielDatei, sha256: istSha };
    throw Error(`Zieldatei existiert mit anderem Inhalt — nicht überschrieben.\n  dort:  ${vorhanden}\n  hier:  ${istSha}\n  ${zielDatei}`);
  }

  // 5. Erst in eine Nebendatei, dann umbenennen. Ein Abbruch hinterlässt so keine halbe Datei.
  fs.mkdirSync(path.dirname(zielDatei), { recursive: true });
  const temp = zielDatei + '.unfertig';
  fs.copyFileSync(quelle, temp);
  if (sha(temp) !== istSha) { fs.unlinkSync(temp); throw Error('Die Kopie stimmt nicht mit der Quelle überein. Nichts abgelegt.'); }
  fs.renameSync(temp, zielDatei);

  // 6. Projektstand nachführen und Umzug protokollieren.
  m.postingFile = zielDatei;
  m.postingSha256 = istSha;
  m.postingDate = datum;
  fs.writeFileSync(path.join(p, 'workflow.json'), JSON.stringify(m, null, 2) + '\n');

  const protokoll = path.join(ABLAGE, 'Archiv/ZUORDNUNGSPROTOKOLL.md');
  const zeile = `| \`${path.relative(path.dirname(p), quelle)}\` | \`${ziel}/${name}\` | Auslieferung aus ${path.basename(p)} | \`${istSha.slice(0, 16)}…\` |\n`;
  if (fs.existsSync(protokoll)) fs.appendFileSync(protokoll, zeile);

  return { datei: zielDatei, sha256: istSha, aus: path.basename(quelle), vmaf: b.vmafMeanVsRenderedMaster, befunde: frei.befunde, abgenommen: frei.abgenommen };
}

// ---------- Auslieferung in einem Rutsch (Gesamtauftrag Tempo, Phase 6, 28.09.2026) ----------
// Stufe 1 nach Abdullahs OK:  node ausliefern.mjs "<P>" "<Titel>" --datum JJJJ-MM-TT [--zeit 19:00] --token <upload-token>
//   Drive-Ablage mit Prüfsumme (03_Bereit_zum_Posten), Zernio-Upload (Presign, Längenprobe), Einplanungsauftrag
//   review/zernio-post.json. Das Token kommt aus media_generate_upload_link (MCP, 1 h gültig).
// Dazwischen (KI, MCP): call_tool posts_create_post mit dem Auftrag, erst dry_run, dann echt; bei Abbruch erst posts_list.
//   Ein Befehl ohne diesen Schritt ginge nur mit einem Zernio-API-Schlüssel (Abdullahs Entscheidung).
// Stufe 2:  node ausliefern.mjs "<P>" --post-id <id>
//   Post-ID festhalten, Datei nach 04_Gepostet, Rohvideo nach Archiv/Rohvideos, Medien nach ~/Löschbar, bearbeitung
//   fertig, git add/commit/push des Projekts. Notion bleibt ein Agentenschritt direkt danach.
const KONTEN = [{ platform: 'instagram', accountId: '6aa6efd7726ebfe037e60dd5' }, { platform: 'tiktok', accountId: '6aa6efb9726ebfe037e60cc6' }];
const berlin = (datum, zeit) => { const s = new Date(`${datum}T${zeit}:00Z`).toLocaleString('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' }); const m = s.match(/GMT([+-]\d{2}):?(\d{2})?/); return `${datum}T${zeit}:00${m ? `${m[1]}:${m[2] || '00'}` : '+00:00'}`; };
const lies = p => JSON.parse(fs.readFileSync(path.join(p, 'workflow.json'), 'utf8'));
const schreib = (p, m) => fs.writeFileSync(path.join(p, 'workflow.json'), JSON.stringify(m, null, 2) + '\n');
const protokolliere = (von, nach, grund, s) => { const f = path.join(ABLAGE, 'Archiv/ZUORDNUNGSPROTOKOLL.md'); if (fs.existsSync(f)) fs.appendFileSync(f, `| \`${von}\` | \`${nach}\` | ${grund} | \`${s.slice(0, 16)}…\` |\n`); };
// Verschieben innerhalb der Drive-Ablage (Umbenennen), mit Prüfsumme vorher und Größe/Inode nachher.
function verschiebe(von, nach, erwarteteSha) {
  if (fs.existsSync(nach)) throw Error(`Ziel existiert, nichts überschrieben: ${nach}`);
  const st = fs.statSync(von), s = erwarteteSha ?? sha(von);
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.renameSync(von, nach);
  const st2 = fs.statSync(nach);
  if (st2.size !== st.size) throw Error(`Größe nach dem Verschieben falsch: ${nach}`);
  return s;
}

// Einplanung über die Zernio-API mit dem Schlüssel aus dem Schlüsselbund (seit 28.09.2026). Ein Zeitpunkt in der
// Vergangenheit würde sofort veröffentlichen (Zernio-Doku) und wird deshalb abgelehnt. Die Anfrage-ID steht vor dem
// Senden im Projekt; eine Wiederholung liefert denselben Beitrag statt eines Doppelposts.
async function einplanen(p, text, publicUrl, datum, zeit, { probe = false } = {}) {
  const { zernioApi } = await import('./zernio-upload.mjs');
  const wann = new Date(berlin(datum, zeit));
  if (!(wann - Date.now() > 10 * 60e3)) throw Error(`Termin ${datum} ${zeit} liegt nicht mindestens 10 min in der Zukunft; Zernio würde sofort veröffentlichen. Nicht eingeplant.`);
  const body = { content: text, mediaItems: [{ type: 'video', url: publicUrl }], platforms: KONTEN, scheduledFor: `${datum}T${zeit}:00`, timezone: 'Europe/Berlin' };
  const v = await zernioApi('/tools/validate/post', { method: 'POST', body });
  const fehler = v.data?.errors ?? [];
  if (!v.ok || fehler.length) throw Error(`Zernio-Prüfung: ${v.status} ${JSON.stringify(fehler.length ? fehler : v.data).slice(0, 400)}`);
  if (probe) return { probe: true, pruefung: 'bestanden', hinweise: v.data?.warnings ?? [], geplantFuer: berlin(datum, zeit) };
  let m = lies(p);
  const requestId = m.zernio?.requestId ?? crypto.randomUUID();
  m.zernio = { ...(m.zernio || {}), requestId, geplantFuer: berlin(datum, zeit) }; schreib(p, m);
  const r = await zernioApi('/posts', { method: 'POST', body, headers: { 'x-request-id': requestId } });
  const post = r.data?.post ?? r.data?.existingPost;
  if (r.status === 409) throw Error('Zernio meldet 409: gleicher Inhalt an dieselben Konten in den letzten 24 h. Nicht doppelt eingeplant; Beitrag in Zernio prüfen.');
  if (!r.ok || !post?._id) throw Error(`Einplanung fehlgeschlagen (${r.status}): ${JSON.stringify(r.data).slice(0, 400)}`);
  const g = await zernioApi(`/posts/${post._id}`);
  const status = g.data?.post?.status ?? post.status;
  if (status !== 'scheduled') throw Error(`Beitrag ${post._id} hat Status „${status}“ statt „scheduled“. Sofort in Zernio prüfen.`);
  return { postId: post._id, status, scheduledFor: g.data?.post?.scheduledFor ?? post.scheduledFor, wiederholung: !!r.data?.existingPost };
}

export async function stufe1(projekt, titel, datum, { zeit = '19:00', token, probe = false, abschluss = true }) {
  const p = path.resolve(projekt), m = lies(p);
  const beschreibung = path.join(p, 'beschreibung.txt');
  if (!fs.existsSync(beschreibung)) throw Error('beschreibung.txt fehlt (Beschreibung aus dem Freigabepaket, höchstens 5 Hashtags, einer #abidullahabi).');
  const text = fs.readFileSync(beschreibung, 'utf8').trim(), tags = text.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (tags.length > 5 || !tags.includes('#abidullahabi')) throw Error(`Beschreibung: ${tags.length} Hashtags, #abidullahabi ${tags.includes('#abidullahabi') ? 'vorhanden' : 'fehlt'} (CONTENT_WORKFLOW 11).`);
  const { zernioSchluessel } = await import('./zernio-upload.mjs');
  const schluessel = !token && zernioSchluessel();
  if (probe) {
    if (!schluessel) throw Error('Probe braucht den API-Schlüssel im Schlüsselbund (zernio-api-key).');
    return { probe: await einplanen(p, text, 'https://media.zernio.com/temp/probe.mp4', datum, zeit, { probe: true }) };
  }
  const r = { ablage: ausliefernNach(p, titel, datum) };
  if (schluessel) {
    // Ein Befehl: Upload mit Schlüssel, Einplanung, Prüfung des Status, dann Abschluss (Stufe 2).
    const { uploadToZernio } = await import('./zernio-upload.mjs');
    const up = await uploadToZernio(r.ablage.datei, null);
    if (up.sha256 !== r.ablage.sha256) throw Error('Hochgeladene Datei ist nicht die abgelegte (Prüfsumme).');
    r.upload = { publicUrl: up.publicUrl, bytes: up.bytes, sha256: up.sha256 };
    const m2 = lies(p); m2.zernio = { ...(m2.zernio || {}), upload: { publicUrl: up.publicUrl, sha256: up.sha256, am: new Date().toISOString() } }; schreib(p, m2);
    r.einplanung = await einplanen(p, text, up.publicUrl, datum, zeit);
    if (abschluss) r.abschluss = await stufe2(p, r.einplanung.postId);
    return r;
  }
  if (token) {
    const { uploadToZernio } = await import('./zernio-upload.mjs');
    const up = await uploadToZernio(r.ablage.datei, token);
    if (up.sha256 !== r.ablage.sha256) throw Error('Hochgeladene Datei ist nicht die abgelegte (Prüfsumme).');
    r.upload = up;
    const auftrag = { werkzeug: 'posts_create_post', erst: 'mit dry_run: true prüfen, dann ohne', argumente: { content: text, media_items: [{ url: up.publicUrl, type: 'video' }], platforms: KONTEN, scheduled_for: berlin(datum, zeit), timezone: 'Europe/Berlin' } };
    fs.writeFileSync(path.join(p, 'review/zernio-post.json'), JSON.stringify(auftrag, null, 2) + '\n');
    const m2 = lies(p); m2.zernio = { ...(m2.zernio || {}), upload: { publicUrl: up.publicUrl, sha256: up.sha256, am: new Date().toISOString() }, geplantFuer: auftrag.argumente.scheduled_for }; schreib(p, m2);
    r.einplanung = { auftrag: path.join(p, 'review/zernio-post.json'), geplantFuer: auftrag.argumente.scheduled_for, danach: `node ausliefern.mjs "${p}" --post-id <id>` };
  }
  return r;
}

export async function stufe2(projekt, postId, { commit = true } = {}) {
  const p = path.resolve(projekt); let m = lies(p);
  if (!m.postingFile || !fs.existsSync(m.postingFile)) throw Error('Stufe 1 fehlt: postingFile nicht gesetzt oder nicht vorhanden.');
  const r = {};
  m.zernio = { ...(m.zernio || {}), postId, eingeplantAm: new Date().toISOString() }; schreib(p, m);
  // Abdullahs Festlegung (16.09.2026): nach der Einplanung nach 04_Gepostet. Seit 05.11.2026 steht Notion dann auf POSTED.
  if (m.postingFile.includes(`${path.sep}03_Bereit_zum_Posten${path.sep}`)) {
    const nach = path.join(ABLAGE, '04_Gepostet', path.basename(m.postingFile));
    verschiebe(m.postingFile, nach, m.postingSha256);
    protokolliere(path.relative(ABLAGE, m.postingFile), path.relative(ABLAGE, nach), `eingeplant, Zernio ${postId}`, m.postingSha256);
    m = lies(p); m.postingFile = nach; schreib(p, m);
  }
  r.postingFile = m.postingFile;
  // Rohvideo ins Archiv, wenn es noch in 01_Rohvideos liegt.
  if (m.source && m.source.startsWith(path.join(ABLAGE, '01_Rohvideos') + path.sep) && fs.existsSync(m.source)) {
    const { pruefsumme } = await import('./projekte.mjs');
    const s = pruefsumme(m.source);
    if (m.sourceSha256 && s !== m.sourceSha256) throw Error('Rohvideo weicht von sourceSha256 ab, nicht verschoben.');
    const nach = path.join(ABLAGE, 'Archiv/Rohvideos', `${m.postingDate} - ${m.title} - Rohvideo${path.extname(m.source)}`);
    verschiebe(m.source, nach, s);
    protokolliere(path.relative(ABLAGE, m.source), path.relative(ABLAGE, nach), 'Rohvideo archiviert', s);
    m = lies(p); m.sourceArchived = nach; m.source = nach; schreib(p, m);
  }
  r.sourceArchived = m.sourceArchived ?? null;
  // Lokales Videomaterial nach ~/Löschbar (nichts löschen, Manifest mit Rückholweg).
  const { aufraeumen } = await import('./aufraeumen.mjs');
  r.loeschbar = aufraeumen([p]);
  r.loeschbarHinweis = `${r.loeschbar.gb} nach ~/Löschbar/${path.basename(r.loeschbar.ziel)}, sofort löschbar`;
  m = lies(p); m.bearbeitung = { ...(m.bearbeitung || {}), status: 'fertig', beendet: new Date().toISOString() }; schreib(p, m);
  if (commit) {
    const { HAUPT } = await import('./projekte.mjs');
    const rel = path.relative(HAUPT, p);
    const git = (...a) => execFileSync('git', ['-C', HAUPT, ...a], { encoding: 'utf8' });
    git('add', '--', rel);   // nur dieses Projekt; .gitignore lässt nur Pläne, Wortdaten und Berichte durch
    r.commit = git('commit', '-m', `${m.title}: ausgeliefert und eingeplant (Zernio ${postId})`, '--', rel).split('\n')[0];
    try { git('push', '-q'); r.push = 'ok'; } catch (e) { r.push = 'fehlgeschlagen: ' + e.message.split('\n')[0]; }
  }
  return r;
}

if (process.argv[1]?.endsWith('ausliefern.mjs')) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const [, , projekt, titel] = process.argv;
  const datum = arg('--datum'), postId = arg('--post-id');
  const ziel = arg('--ziel') ?? '03_Bereit_zum_Posten';
  try {
    if (projekt && postId) console.log(JSON.stringify(await stufe2(projekt, postId, { commit: !process.argv.includes('--ohne-commit') }), null, 2));
    else if (projekt && titel && datum && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      if (process.argv.includes('--nur-ablage')) console.log(JSON.stringify(ausliefernNach(projekt, titel, datum, { ziel }), null, 2));
      else console.log(JSON.stringify(await stufe1(projekt, titel, datum, { zeit: arg('--zeit') ?? '19:00', token: arg('--token'), probe: process.argv.includes('--probe'), abschluss: !process.argv.includes('--ohne-abschluss') }), null, 2));
    } else {
      console.error('Aufruf:\n  node ausliefern.mjs "<Projekt>" "<Titel>" --datum JJJJ-MM-TT [--zeit 19:00]            (mit API-Schlüssel: alles in einem Befehl)\n  node ausliefern.mjs "<Projekt>" "<Titel>" --datum JJJJ-MM-TT --probe                   (nur prüfen: Schlüssel, Termin, Inhalt)\n  node ausliefern.mjs "<Projekt>" "<Titel>" --datum JJJJ-MM-TT [--zeit 19:00] --token <upload-token>\n  node ausliefern.mjs "<Projekt>" --post-id <id> [--ohne-commit]\n  node ausliefern.mjs "<Projekt>" "<Titel>" --datum JJJJ-MM-TT --nur-ablage [--ziel 04_Gepostet]');
      process.exit(2);
    }
  } catch (e) { console.error(e.message); process.exit(1); }
}
