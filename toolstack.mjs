#!/usr/bin/env node
// Toolstack-Prüfung (28.10.2026): Was ist installiert, was gibt es neu, ist etwas abgestürzt?
//
//   node toolstack.mjs pruefen          # Bericht auf Deutsch
//   node toolstack.mjs pruefen --json   # dasselbe maschinenlesbar (für die wöchentliche Automatisierung)
//
// Liest nur. Herkunft, Build und Prüfsummen der installierten Werkzeuge stehen in toolstack.json;
// wie ein Update getestet und eingespielt wird, steht dort unter "verfahren".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'toolstack.json'), 'utf8'));
const CRASHES = path.join(os.homedir(), 'Library/Logs/DiagnosticReports');
const CRASH_TAGE = 14;
const WARNWOERTER = /security|vulnerab|cve-|breaking|deprecat|crash|abort/i;

const nummern = v => (String(v).match(/\d+(\.\d+)*/)?.[0] ?? '0').split('.').map(Number);
function neuer(a, b) { // ist a neuer als b?
  const x = nummern(a), y = nummern(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

async function holeJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'abi-video-toolchain', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function installiert(w) {
  if (w.npm) return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', w.npm, 'package.json'), 'utf8')).version;
  const r = spawnSync(path.join(ROOT, w.pfad), w.versionArgs, { encoding: 'utf8' });
  return (`${r.stdout}\n${r.stderr}`.match(new RegExp(w.versionMuster))?.[1]) ?? 'unbekannt';
}

function pruefsumme(datei) {
  try { return createHash('sha256').update(fs.readFileSync(path.join(ROOT, datei))).digest('hex'); } catch { return null; }
}

// Releases zwischen installiert und neuester Version, mit Warnwörtern aus den Release Notes.
async function releases(repo, seit) {
  const liste = await holeJson(`https://api.github.com/repos/${repo}/releases?per_page=100`);
  return liste.filter(r => !r.prerelease && !r.draft && neuer(r.tag_name, seit))
    .map(r => ({ version: r.tag_name, datum: r.published_at?.slice(0, 10), warnungen: [...new Set((r.body ?? '').split('\n').filter(z => WARNWOERTER.test(z)).map(z => z.trim().slice(0, 200)))].slice(0, 5) }));
}

function abstuerze(programme, seit = 0) {
  if (!fs.existsSync(CRASHES)) return [];
  const grenze = Math.max(Date.now() - CRASH_TAGE * 864e5, seit);
  return fs.readdirSync(CRASHES)
    .filter(f => programme.some(p => f.startsWith(`${p}-`) || f.startsWith(`${p}_`)))
    .filter(f => fs.statSync(path.join(CRASHES, f)).mtimeMs > grenze)
    .sort();
}

async function pruefen() {
  const ergebnis = { geprueft: new Date().toISOString(), werkzeuge: [] };
  for (const [name, w] of Object.entries(STACK.werkzeuge)) {
    const e = { name, installiert: installiert(w), basis: w.basis, quelle: w.quelle };
    try {
      const vergleich = w.basis ?? e.installiert;
      if (w.npm) e.neueste = (await holeJson(`https://registry.npmjs.org/${w.npm}/latest`)).version;
      else e.neueste = (await holeJson(`https://api.github.com/repos/${w.github}/releases/latest`)).tag_name;
      e.update = neuer(e.neueste, vergleich);
      if (e.update && w.releaseNotes) {
        e.zwischen = await releases(w.releaseNotes, vergleich);
        e.anzahlReleases = e.zwischen.length;
      }
    } catch (err) { e.fehler = err.message; }
    // Nur zur Info (z. B. ffmpeg-Hauptversion), darf die Prüfung nicht scheitern lassen.
    if (w.upstream) try { e.upstream = (await holeJson(w.upstream.url))[w.upstream.feld]; } catch (err) { e.upstream = `nicht erreichbar (${err.cause?.code ?? err.message})`; }
    if (w.sha256 && w.pfad) e.pruefsummeOk = pruefsumme(w.pfad) === w.sha256;
    // Nur Abstürze seit dem Einbau der jetzigen Version zählen.
    const eingebaut = w.pfad ? fs.statSync(path.join(ROOT, w.pfad)).mtimeMs : 0;
    e.abstuerze = abstuerze(w.prozesse ?? [], eingebaut);
    e.risiko = w.risiko;
    ergebnis.werkzeuge.push(e);
  }
  return ergebnis;
}

function bericht(e) {
  const z = [`Toolstack-Prüfung ${e.geprueft.slice(0, 16).replace('T', ' ')} (UTC)`, ''];
  for (const w of e.werkzeuge) {
    const stand = w.fehler ? `Prüfung fehlgeschlagen: ${w.fehler}`
      : w.update ? `UPDATE verfügbar: ${w.neueste}${w.anzahlReleases ? ` (${w.anzahlReleases} Releases)` : ''}` : 'aktuell';
    z.push(`${w.name}: installiert ${w.installiert}${w.basis ? ` (Basis ${w.basis})` : ''} – ${stand}`);
    if (w.upstream) z.push(`  Upstream: ${w.upstream}`);
    if (w.pruefsummeOk === false) z.push('  ACHTUNG: Prüfsumme weicht von toolstack.json ab (Binary wurde ausgetauscht).');
    for (const r of w.zwischen ?? []) for (const h of r.warnungen) z.push(`  ${r.version}: ${h}`);
    if (w.abstuerze.length) z.push(`  ${w.abstuerze.length} Absturzbericht(e) in ${CRASH_TAGE} Tagen: ${w.abstuerze.join(', ')}`);
    z.push(`  Risiko beim Update: ${w.risiko}`);
  }
  return z.join('\n');
}

const [befehl, ...rest] = process.argv.slice(2);
if (befehl !== 'pruefen') { console.error('Aufruf: node toolstack.mjs pruefen [--json]'); process.exit(2); }
const e = await pruefen();
console.log(rest.includes('--json') ? JSON.stringify(e, null, 2) : bericht(e));
