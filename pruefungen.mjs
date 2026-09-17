// Zwei Schutzprüfungen aus der Nachbesprechung vom 16.09.2026.
//
//   node pruefungen.mjs kollision "<Quelldatei>"
//   node pruefungen.mjs auslieferung "<Projektordner>"
//
// Beide sind bewusst eigenständig aufrufbar und lesen nur JSON-Dateien. Eine
// andere KI kann dasselbe mit Bordmitteln nachbilden; dieses Skript ist die
// Bequemlichkeit, nicht die Voraussetzung.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJEKTE = path.join(ROOT, 'projects');
const FRIST_STUNDEN = 6;

const lies = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const zeit = s => { const t = Date.parse(s ?? ''); return Number.isNaN(t) ? null : t; };

// Punkt 3: Kollisionen zwischen parallelen Sitzungen sichtbar machen.
// Geschlüsselt auf die Quelle, nicht auf die Sitzung — zwei KIs an zwei
// verschiedenen Videos sehen einander nie.
export function kollision(quelle) {
  const ziel = fs.existsSync(quelle) ? fs.realpathSync(path.resolve(quelle)) : path.resolve(quelle);
  const jetzt = Date.now();
  const treffer = [];
  for (const name of fs.readdirSync(PROJEKTE)) {
    const m = lies(path.join(PROJEKTE, name, 'workflow.json'));
    if (!m?.source) continue;
    const gleich = fs.existsSync(m.source) && fs.existsSync(ziel)
      ? fs.realpathSync(m.source) === ziel
      : path.resolve(m.source) === ziel;
    if (!gleich) continue;
    const b = m.bearbeitung ?? {};
    const begonnen = zeit(b.begonnen) ?? zeit(m.createdAt) ?? zeit(m.created);
    const laufend = b.status ? b.status === 'in_arbeit' : m.status !== 'complete';
    const frisch = begonnen !== null && (jetzt - begonnen) < FRIST_STUNDEN * 3600e3;
    if (laufend && frisch) treffer.push({ projekt: name, agent: b.agent ?? 'unbekannt', aufgabe: b.aufgabe ?? '—', begonnen: b.begonnen ?? m.createdAt ?? m.created });
  }
  return treffer;
}

const sha = datei => { const h = crypto.createHash('sha256'); h.update(fs.readFileSync(datei)); return h.digest('hex'); };

const exporteVon = projekt => {
  const ordner = path.join(projekt, 'exports');
  if (!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner).filter(f => f.endsWith('.mp4'))
    .map(f => ({ name: f, pfad: path.join(ordner, f), zeit: fs.statSync(path.join(ordner, f)).mtimeMs }))
    .sort((a, b) => b.zeit - a.zeit);
};

// Punkt 7: Ein Zeiger statt vier. Vier Felder zeigten auf fast dasselbe und
// liefen auseinander — am 16.09.2026 zeigten zwei davon auf eine Datei, die es
// nicht mehr gab. Dieses Feld wird beim Export geschrieben und trägt die
// Pruefsumme mit, damit es nicht stillschweigend veralten kann.
export function aktuellSetzen(projekt) {
  const p = path.resolve(projekt);
  const datei = path.join(p, 'workflow.json');
  if (!fs.existsSync(datei)) throw Error('workflow.json fehlt: ' + p);
  const e = exporteVon(p)[0];
  if (!e) throw Error('Kein Export vorhanden, es gibt nichts zu zeigen.');
  const m = JSON.parse(fs.readFileSync(datei, 'utf8'));
  m.aktuell = { datei: e.pfad, sha256: sha(e.pfad), bytes: fs.statSync(e.pfad).size, erzeugt: new Date(e.zeit).toISOString(), gesetztAm: new Date().toISOString() };
  fs.writeFileSync(datei, JSON.stringify(m, null, 2) + '\n');
  return m.aktuell;
}

// Punkt 5: Keine Auslieferung ohne sauberen, aktuellen Prüfbericht.
// Wird eine konkrete Datei mitgegeben, muss sie bitgleich zu einem Export
// dieses Projekts sein. Genau dieser Handgriff hat am 16.09.2026 verhindert,
// dass ein veraltetes Zeigerfeld auf die falsche Fassung führt.
export function auslieferung(projekt, datei) {
  const p = path.resolve(projekt);
  const plan = path.join(p, 'theme-plan.json');
  if (!fs.existsSync(plan)) return { ok: false, grund: 'Kein Gestaltungsprojekt: theme-plan.json fehlt. Ausgeliefert wird nur aus einem Gestaltungsprojekt.' };

  const berichtDatei = path.join(p, 'review/layout-check.json');
  if (!fs.existsSync(berichtDatei)) return { ok: false, grund: 'Prüfbericht fehlt: review/layout-check.json wurde nie erzeugt. Erst check-theme-layout.mjs laufen lassen.' };
  const bericht = lies(berichtDatei);
  if (!bericht) return { ok: false, grund: 'Prüfbericht ist unlesbar.' };

  const blockierend = bericht.blocking ?? (bericht.errors?.length ?? 0);
  if (blockierend !== 0) return { ok: false, grund: `Prüfbericht meldet ${blockierend} blockierende Abweichungen. Beheben oder als Waiver begründen.` };

  // Der Bericht entsteht vor dem Rendern und kann deshalb nie juenger als der
  // Export sein. Massgeblich ist, dass er juenger ist als das, was er prueft:
  // der Gestaltungsplan und die daraus gebaute Seite. Wird danach noch am Plan
  // gedreht, belegt der Bericht eine frühere Fassung.
  const berichtZeit = fs.statSync(berichtDatei).mtimeMs;
  for (const datei of ['theme-plan.json', 'index.html']) {
    const f = path.join(p, datei);
    if (!fs.existsSync(f)) continue;
    if (fs.statSync(f).mtimeMs > berichtZeit + 1000) {
      return { ok: false, grund: `${datei} wurde nach dem Prüfbericht geändert. Der Bericht belegt eine frühere Fassung. Prüfung wiederholen.` };
    }
  }

  const exporte = exporteVon(p);
  if (!exporte.length) return { ok: false, grund: 'Keine Exportdatei vorhanden.' };
  const juengster = exporte[0];

  const waiver = lies(path.join(p, 'review/layout-waivers.json')) ?? {};
  const ohneBegruendung = Object.entries(waiver).filter(([, v]) => !v?.grund || !v?.entscheidung).map(([k]) => k);
  if (ohneBegruendung.length) return { ok: false, grund: `Waiver ohne Grund oder benannte Entscheidung: ${ohneBegruendung.join(', ')}. Eine Ausnahme ohne Entscheidung ist ein übergangener Befund.` };

  // Prüfsummenabgleich: gehört die auszuliefernde Datei überhaupt zu diesem Projekt?
  let herkunft;
  if (datei) {
    if (!fs.existsSync(datei)) return { ok: false, grund: `Auszuliefernde Datei nicht gefunden: ${datei}` };
    const s = sha(datei);
    const treffer = exporte.find(e => sha(e.pfad) === s);
    if (!treffer) {
      return { ok: false, grund: `Die Datei ist zu keinem Export dieses Projekts bitgleich (SHA ${s.slice(0, 16)}…). Entweder gehört sie zu einem anderen Projekt, oder sie wurde nach dem Export verändert.` };
    }
    herkunft = { export: treffer.name, sha256: s };
  }

  return { ok: true, befunde: bericht.errors?.length ?? 0, abgenommen: bericht.waived?.count ?? 0, export: juengster.name, waiverArten: Object.keys(waiver), ...(herkunft ? { herkunft } : {}) };
}

if (process.argv[1]?.endsWith('pruefungen.mjs')) {
  const [, , befehl, ziel] = process.argv;
  if (befehl === 'kollision') {
    if (!ziel) { console.error('Aufruf: node pruefungen.mjs kollision "<Quelldatei>"'); process.exit(2); }
    const t = kollision(ziel);
    if (!t.length) { console.log('Keine laufende Bearbeitung derselben Quelle gefunden.'); process.exit(0); }
    console.log(`Achtung: ${t.length} Projekt(e) mit derselben Quelle in den letzten ${FRIST_STUNDEN} Stunden:\n`);
    for (const x of t) console.log(`  ${x.projekt}\n    Agent:   ${x.agent}\n    Aufgabe: ${x.aufgabe}\n    seit:    ${x.begonnen}\n`);
    console.log('Arbeitet eine andere Sitzung daran? Vor dem Weiterbauen mit Abdullah klären.');
    process.exit(0);
  } else if (befehl === 'auslieferung') {
    if (!ziel) { console.error('Aufruf: node pruefungen.mjs auslieferung "<Projektordner>" ["<auszuliefernde Datei>"]'); process.exit(2); }
    const r = auslieferung(ziel, process.argv[4]);
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) { console.error('\nAuslieferung gesperrt: ' + r.grund); process.exit(1); }
    console.log('\nAuslieferung freigegeben.');
  } else if (befehl === 'aktuell') {
    if (!ziel) { console.error('Aufruf: node pruefungen.mjs aktuell "<Projektordner>"'); process.exit(2); }
    console.log(JSON.stringify(aktuellSetzen(ziel), null, 2));
  } else {
    console.error('Verwendung:\n  node pruefungen.mjs kollision    "<Quelldatei>"\n  node pruefungen.mjs auslieferung "<Projektordner>" ["<Datei>"]\n  node pruefungen.mjs aktuell      "<Projektordner>"');
    process.exit(2);
  }
}
