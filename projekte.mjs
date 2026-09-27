// Gemeinsamer Ort der Videoprojekte und Prüfsummen-Cache (Gesamtauftrag Tempo, 27.09.2026).
//
// Werkzeugcode wird in eigenen Arbeitsordnern (git worktree) geändert, Videoprojekte bleiben im projects/ des
// Hauptordners. HAUPT zeigt deshalb immer auf den Hauptordner, auch wenn dieses Skript in einem Arbeitsordner liegt.
//
// schritt(): Ein Schritt speichert die Prüfsummen seiner Eingaben in logs/cache.json und überspringt sich, wenn sie
// gleich sind und seine Ausgaben unverändert vorliegen. Die Zeit landet wie bisher in logs/zeiten.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const HAUPT = (() => {
  const g = path.join(ROOT, '.git');
  try {
    if (fs.statSync(g).isFile()) {
      const dir = fs.readFileSync(g, 'utf8').match(/gitdir:\s*(.+)/)[1].trim();
      const i = dir.lastIndexOf(`${path.sep}.git${path.sep}worktrees${path.sep}`);
      if (i > 0) return dir.slice(0, i);
    }
  } catch {}
  return ROOT;
})();
export const PROJEKTE = path.join(HAUPT, 'projects');
// Rechnerweite Zwischenablage für Dinge, die nicht ins Repo gehören (Prüfsummen, übersetzte Hilfsprogramme, Render-Sperre).
export const CACHE = path.join(os.homedir(), 'Library/Caches/abi-video-toolchain');

const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export function schreibeJson(f, v) { const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(v, null, 2) + '\n'); fs.renameSync(t, f); }

export function projektOrdner(wert) {
  if (!wert) throw Error('Bitte den Projektordner angeben.');
  let p = path.resolve(wert);
  if (!fs.existsSync(p) && !wert.includes(path.sep)) p = path.join(PROJEKTE, wert);
  p = fs.realpathSync(p);
  const erlaubt = [PROJEKTE, path.join(ROOT, 'projects')].filter(fs.existsSync).map(x => fs.realpathSync(x) + path.sep);
  if (!erlaubt.some(b => p.startsWith(b)) || !fs.existsSync(path.join(p, 'workflow.json'))) throw Error(`Bitte einen Projektordner aus ${PROJEKTE} verwenden.`);
  return p;
}

// ---------- Prüfsummen ----------
// SHA-256 je Datei, gemerkt nach Pfad, Größe, Änderungszeit und Inode: Ein 2-GB-Rohvideo wird nur einmal gelesen.
const MEMO = path.join(CACHE, 'pruefsummen.json');
let memo = null;
function memoLaden() { if (!memo) { try { memo = J(MEMO); } catch { memo = {}; } } return memo; }
export function pruefsumme(datei) {
  const real = fs.realpathSync(datei), st = fs.statSync(real), sig = `${st.size}:${Math.round(st.mtimeMs)}:${st.ino}`;
  const m = memoLaden();
  if (m[real]?.sig === sig) return m[real].sha256;
  const h = crypto.createHash('sha256'), fd = fs.openSync(real, 'r'), buf = Buffer.alloc(8 << 20);
  let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  const sha256 = h.digest('hex');
  // Frisch lesen und zusammenführen: Andere Sitzungen schreiben dieselbe Datei.
  fs.mkdirSync(CACHE, { recursive: true });
  let frisch = {}; try { frisch = J(MEMO); } catch {}
  memo = Object.assign(frisch, { [real]: { sig, sha256 } });
  schreibeJson(MEMO, memo);
  return sha256;
}
const signatur = f => { const st = fs.statSync(f); return `${st.size}:${Math.round(st.mtimeMs)}`; };
export const hash = x => crypto.createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex');

// ---------- Zeitmessung ----------
export async function zeit(project, schritt, fn) {
  const file = path.join(project, 'logs/zeiten.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const t0 = Date.now(), start = new Date(t0).toISOString();
  let ok = false;
  try { const r = await fn(); ok = true; return r; }
  finally {
    const log = fs.existsSync(file) ? J(file) : [];
    log.push({ schritt, start, ende: new Date().toISOString(), sekunden: Math.round((Date.now() - t0) / 100) / 10, ok });
    schreibeJson(file, log);
  }
}

// ---------- Schritt mit Prüfsummen ----------
// eingaben: Dateien (absolut oder relativ zum Projekt), werte: alles andere, was das Ergebnis bestimmt,
// ausgaben: Dateien, die der Schritt erzeugt. Fehlt eine Ausgabe oder wurde sie verändert, rechnet der Schritt neu.
export async function schritt(project, name, { eingaben = [], werte = {}, ausgaben = [] }, fn, { erzwingen = false } = {}) {
  const abs = f => path.isAbsolute(f) ? f : path.join(project, f);
  const fehlt = eingaben.filter(f => !fs.existsSync(abs(f)));
  if (fehlt.length) throw Error(`${name}: Eingabe fehlt: ${fehlt.join(', ')}`);
  const schluessel = hash({ eingaben: eingaben.map(f => [path.isAbsolute(f) ? 'abs' : f, pruefsumme(abs(f))]), werte });
  const cacheDatei = path.join(project, 'logs/cache.json');
  fs.mkdirSync(path.dirname(cacheDatei), { recursive: true });
  const cache = fs.existsSync(cacheDatei) ? J(cacheDatei) : {};
  const alt = cache[name];
  const unveraendert = !erzwingen && alt?.schluessel === schluessel && ausgaben.every(f => fs.existsSync(abs(f)) && alt.ausgaben?.[f] === signatur(abs(f)));
  if (unveraendert) {
    await zeit(project, `${name} (unverändert, übersprungen)`, () => {});
    return { uebersprungen: true, ergebnis: alt.ergebnis };
  }
  const ergebnis = await zeit(project, name, fn);
  const neu = fs.existsSync(cacheDatei) ? J(cacheDatei) : {};
  neu[name] = { schluessel, ausgaben: Object.fromEntries(ausgaben.filter(f => fs.existsSync(abs(f))).map(f => [f, signatur(abs(f))])), ergebnis: ergebnis ?? null, am: new Date().toISOString() };
  schreibeJson(cacheDatei, neu);
  return { uebersprungen: false, ergebnis };
}

// ---------- Rechenlast anderer Sitzungen und Render-Sperre ----------
// Render-Sperre rechnerweit (Gesamtauftrag Tempo, Phase 4): immer nur ein Render gleichzeitig, über alle Sitzungen und
// Arbeitsordner. Ein Verzeichnis entsteht atomar; darin steht, wer rendert. Stirbt der Prozess, gilt die Sperre als frei.
// Zusätzlich zählen Render älterer Werkzeugstände ohne Sperre (hyperframes render im Prozessbaum einer anderen Sitzung).
import { execFileSync } from 'node:child_process';
const SPERRE = path.join(CACHE, 'render-sperre');
const lebt = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
export function fremdeRender() {
  let ps = '';
  try { ps = execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], { encoding: 'utf8', maxBuffer: 1 << 24 }); } catch { return []; }
  const zeilen = ps.split('\n').map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], cmd: m[3] }));
  const eltern = new Map(zeilen.map(z => [z.pid, z.ppid]));
  const eigen = pid => { for (let p = pid, i = 0; p > 1 && i < 50; p = eltern.get(p), i++) if (p === process.pid) return true; return false; };
  const schwer = /^\S*(node|python3?)\S*\s+\S*(hyperframes(\.mjs)?\s+render|finalize-buffer-video\.py|green-screen-maske\.py)\b/;
  return zeilen.filter(z => schwer.test(z.cmd) && !eigen(z.pid)).map(z => ({ pid: z.pid, befehl: z.cmd.slice(0, 160) }));
}
export function sperreStand() {
  try { const i = J(path.join(SPERRE, 'info.json')); return lebt(i.pid) ? i : { ...i, verwaist: true }; } catch { return fs.existsSync(SPERRE) ? { unbekannt: true } : null; }
}
export async function mitRenderSperre(project, zweck, fn, { warteSekunden = 5 } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  let gemeldet = 0;
  for (;;) {
    const fremd = fremdeRender();
    if (!fremd.length) {
      try {
        fs.mkdirSync(SPERRE);
        schreibeJson(path.join(SPERRE, 'info.json'), { pid: process.pid, projekt: path.basename(project), zweck, seit: new Date().toISOString() });
        break;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const i = sperreStand();
        if (i?.verwaist || (i?.unbekannt && Date.now() - fs.statSync(SPERRE).mtimeMs > 60e3)) { fs.rmSync(SPERRE, { recursive: true, force: true }); continue; }
        if (Date.now() - gemeldet > 60e3) { console.log(`Render-Sperre: warte auf ${i?.projekt ?? '?'} (${i?.zweck ?? '?'}, seit ${i?.seit ?? '?'})`); gemeldet = Date.now(); }
      }
    } else if (Date.now() - gemeldet > 60e3) { console.log(`Render-Sperre: warte, eine andere Sitzung rendert (${fremd.map(f => f.befehl.split(' ').slice(0, 4).join(' ')).join('; ')})`); gemeldet = Date.now(); }
    await new Promise(r => setTimeout(r, warteSekunden * 1000));
  }
  try { return await fn(); }
  finally { try { if (J(path.join(SPERRE, 'info.json')).pid === process.pid) fs.rmSync(SPERRE, { recursive: true, force: true }); } catch {} }
}
