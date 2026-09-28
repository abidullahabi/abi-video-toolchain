// Speicher freigeben, sobald ein Video ausgeliefert und eingeplant ist.
//
//   node aufraeumen.mjs "<Gestaltungsprojekt>" ["<Schnittprojekt>" ...]
//   node aufraeumen.mjs --stand
//   node aufraeumen.mjs --zurueck "<Unterordner in ~/Löschbar>" [Filter]
//
// Jedes Projekt kopiert die Aufnahme und rendert mehrere Fassungen. Nach der
// Einplanung liegen Postingdatei und Rohvideo in Google Drive, das lokale
// Video- und Tonmaterial wird nur noch für Korrekturen vor der Veröffentlichung
// gebraucht. Dieser Schritt verschiebt es nach ~/Löschbar/JJJJ-MM-TT - Videotitel, einen Ordner
// je Video mit Manifest und INFO.json, und schreibt ~/Löschbar/INHALT.md neu. ~/Löschbar ist der
// einzige Löschordner, alles darin ist sofort löschbar (28.09.2026). Gelöscht wird nichts: Abdullah leert ihn.
//
// Kleine Dateien (Pläne, Skripte, Transkripte, Prüfberichte) bleiben im Projekt.
// Referenzprojekte aus CONTENT_WORKFLOW.md Abschnitt 12 werden nie angefasst.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const LOESCHBAR = process.env.LOESCHBAR_DIR ?? path.join(os.homedir(), 'Löschbar');
const MEDIEN = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.wav', '.pcm', '.aac', '.m4a', '.mp3']);
const REFERENZ = new Set([
  'Schnitttest-v2-07s-2026-09-13T13-10-58-274Z',
  'Komplettvideo-Blau-2026-09-13T13-51-40-665Z',
  'Video-1-1x-2026-09-13T14-20-46-781Z',
]);

function sha(datei) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(datei, 'r');
  const buf = Buffer.alloc(8 << 20);
  let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
}

const gb = b => (b / 1e9).toFixed(2).replace('.', ',') + ' GB';

function medienIn(projekt) {
  const out = [];
  (function lauf(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (e.name !== 'node_modules') lauf(p); continue; }
      if (MEDIEN.has(path.extname(e.name).toLowerCase())) out.push(p);
    }
  })(projekt);
  return out;
}

function lies(p) {
  const f = path.join(p, 'workflow.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

export function aufraeumen(projekte) {
  const [haupt, ...weitere] = projekte.map(p => path.resolve(p));
  for (const p of [haupt, ...weitere]) {
    if (REFERENZ.has(path.basename(p)) || lies(p)?.referenz) throw Error(`Referenzprojekt, bleibt unverändert: ${p}`);
  }
  const m = lies(haupt);
  if (!m) throw Error(`Keine workflow.json in ${haupt}`);

  // Erst wenn die Postingdatei nachweislich in Drive liegt, ist das lokale Material entbehrlich.
  // Testprojekte (workflow.json „testmodus“, etwa Messläufe) werden nie ausgeliefert; ihr Material ist sofort entbehrlich.
  const warnungen = [];
  if (!m.testmodus) {
    if (!m.postingFile || !fs.existsSync(m.postingFile)) throw Error('postingFile fehlt oder zeigt ins Leere. Erst ausliefern und einplanen.');
    if (!m.postingSha256 || sha(m.postingFile) !== m.postingSha256) throw Error('Postingdatei in Drive stimmt nicht mit postingSha256 überein. Nicht aufräumen.');
    if (!m.sourceArchived || !fs.existsSync(m.sourceArchived)) warnungen.push('Rohvideo ist nicht als sourceArchived in Drive belegt. Quellkopien im Projekt sind dann womöglich die einzige Kopie, bitte prüfen.');
  }

  // Ein Löschordner (Abdullahs Festlegung 28.09.2026): Unterordner „JJJJ-MM-TT - Videotitel“, ohne Frist, sofort löschbar.
  const datum = m.testmodus ? new Date().toISOString().slice(0, 10) : (m.postingDate ?? new Date().toISOString().slice(0, 10));
  const heute = new Date().toISOString().slice(0, 10);
  const titel = (m.title ?? path.basename(haupt)).replace(/[/:]/g, '-');
  const ziel = path.join(LOESCHBAR, `${datum} - ${titel}`);
  fs.mkdirSync(ziel, { recursive: true });
  if (fs.statSync(ziel).dev !== fs.statSync(haupt).dev) throw Error('~/Löschbar liegt auf einem anderen Laufwerk. Verschieben würde kopieren statt Platz freizugeben.');

  const manifestDatei = path.join(ziel, 'MANIFEST.json');
  const manifest = fs.existsSync(manifestDatei) ? JSON.parse(fs.readFileSync(manifestDatei, 'utf8')) : [];
  let summe = 0, anzahl = 0;
  for (const p of [haupt, ...weitere]) {
    let proProjekt = 0;
    for (const datei of medienIn(p)) {
      if (datei === m.postingFile) continue;
      const rel = path.join(path.basename(p), path.relative(p, datei));
      const nach = path.join(ziel, rel);
      if (fs.existsSync(nach)) throw Error(`Ziel belegt, nichts überschrieben: ${nach}`);
      const st = fs.statSync(datei);
      const pruef = sha(datei);
      fs.mkdirSync(path.dirname(nach), { recursive: true });
      fs.renameSync(datei, nach);
      if (fs.statSync(nach).size !== st.size) throw Error(`Größe nach Verschieben falsch: ${nach}`);
      manifest.push({ original: datei, ziel: nach, bytes: st.size, sha256: pruef, am: heute });
      summe += st.size; proProjekt += st.size; anzahl++;
    }
    const pm = lies(p);
    if (pm) {
      pm.videomaterialVerschoben = { am: heute, nach: ziel, bytes: proProjekt, zurueck: `node aufraeumen.mjs --zurueck "${path.basename(ziel)}" "${path.basename(p)}"` };
      fs.writeFileSync(path.join(p, 'workflow.json'), JSON.stringify(pm, null, 2));
    }
  }
  fs.writeFileSync(manifestDatei, JSON.stringify(manifest, null, 1));
  const info = { was: `Video- und Tonmaterial aus ${[haupt, ...weitere].map(p => path.basename(p)).join(', ')}`, datum: heute,
    warum: m.testmodus ? 'Testprojekt, nie ausgeliefert; Plan in Git.' : 'Postingdatei per SHA-256 in Drive bestätigt, Rohvideo im Archiv, Plan in Git: jede Fassung lässt sich neu bauen.' };
  fs.writeFileSync(path.join(ziel, 'INFO.json'), JSON.stringify(info, null, 1) + '\n');
  fs.writeFileSync(path.join(ziel, 'MANIFEST.tsv'),
    'MB\tOriginal\tSHA-256\n' + manifest.map(e => `${(e.bytes / 1e6).toFixed(1)}\t${e.original}\t${e.sha256}`).join('\n') + '\n');
  inhaltSchreiben();
  console.log(`${anzahl} Dateien, ${gb(summe)} nach ${ziel}, sofort löschbar`);
  if (m.postingFile) console.log(`Postingdatei in Drive: ${m.postingFile}`);
  for (const w of warnungen) console.log('Achtung: ' + w);
  return { dateien: anzahl, bytes: summe, gb: gb(summe), ziel, sofortLoeschbar: true, warnungen };
}

// ~/Löschbar/INHALT.md: Summe, der Satz „Alles in diesem Ordner ist sofort löschbar.“ und je Unterordner was, Größe, Datum,
// warum löschbar. Größe aus MANIFEST.json, sonst mit du gemessen; Beschreibung aus INFO.json.
function duBytes(p) { try { return +execFileSync('du', ['-sk', p], { encoding: 'utf8' }).split(/\s/)[0] * 1024; } catch { return 0; } }
export function inhaltSchreiben() {
  if (!fs.existsSync(LOESCHBAR)) return '~/Löschbar existiert nicht.';
  const zeilen = [];
  let gesamt = 0;
  for (const d of fs.readdirSync(LOESCHBAR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) {
    const dir = path.join(LOESCHBAR, d), mf = path.join(dir, 'MANIFEST.json'), inf = path.join(dir, 'INFO.json');
    let bytes;
    if (fs.existsSync(mf)) { try { const e = JSON.parse(fs.readFileSync(mf, 'utf8')); bytes = Array.isArray(e) ? e.filter(x => fs.existsSync(x.ziel)).reduce((s, x) => s + (x.bytes || 0), 0) : duBytes(dir); } catch { bytes = duBytes(dir); } }
    else bytes = duBytes(dir);
    const info = fs.existsSync(inf) ? JSON.parse(fs.readFileSync(inf, 'utf8')) : {};
    gesamt += bytes;
    zeilen.push(`| ${d} | ${info.was ?? '–'} | ${gb(bytes)} | ${info.datum ?? d.slice(0, 10)} | ${info.warum ?? '–'} |`);
  }
  const text = `# Löschbar\n\n**Summe: ${gb(gesamt)}** (Stand ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})\n\nAlles in diesem Ordner ist sofort löschbar.\n\n| Unterordner | Was | Größe | Datum | Warum löschbar |\n|---|---|---|---|---|\n${zeilen.join('\n')}\n\nZurückholen (Videomaterial mit MANIFEST.json): \`node aufraeumen.mjs --zurueck "<Unterordner>"\`\n`;
  fs.writeFileSync(path.join(LOESCHBAR, 'INHALT.md'), text);
  return text;
}

function stand() { console.log(inhaltSchreiben()); }

function zurueck(unterordner, filter = '') {
  const f = path.join(LOESCHBAR, unterordner, 'MANIFEST.json');
  let n = 0;
  for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    if (!e.original.includes(filter) || !fs.existsSync(e.ziel)) continue;
    if (fs.existsSync(e.original)) { console.log('übersprungen, am alten Ort liegt schon etwas: ' + e.original); continue; }
    fs.mkdirSync(path.dirname(e.original), { recursive: true });
    fs.renameSync(e.ziel, e.original); n++;
  }
  inhaltSchreiben();
  console.log(`${n} Dateien zurückgeholt`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  if (a[0] === '--stand') stand();
  else if (a[0] === '--zurueck') zurueck(a[1], a[2]);
  else if (a.length) aufraeumen(a);
  else console.log('node aufraeumen.mjs "<Gestaltungsprojekt>" ["<Schnittprojekt>" ...] | --stand | --zurueck "<Unterordner>" [Filter]');
}
