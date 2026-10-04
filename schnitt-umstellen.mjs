// schnitt-umstellen: Pläne nach einer Schnitt- oder Tempoänderung auf die neue Fassung umrechnen (Vorbild: umstellen.py,
// kurzpruefungen-neu.py und anker.mjs aus „Bücher die so gut sind wie Therapie“, 04.10.2026).
//
// Ablauf: Voraussetzungen prüfen (vorbereiten lief mit der neuen schnitt.json und dem Tempo), Pläne sichern, design-plan.json und
// caption-edit-plan.json umrechnen (schnitt/umstellen.py), word-review-turbo neu erkennen (schnitt/kurzpruefungen-neu.py),
// danach Ankerliste und Wortprüfung (readTimedWords). schnitt/vorher.json hält fest, wozu die Pläne passen: Ein zweiter
// Aufruf rechnet nichts doppelt um; fehlte media.mp4, holt er nur die Kurzprüfungen nach.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { py, vorbereitetMit, schreibeVorher } from './schnitt.mjs';
import { pruefsumme, zeit } from './projekte.mjs';
import { readTimedWords } from './assemble-full-video.mjs';

const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const komma = (v, n = 1) => Number(v).toFixed(n).replace('.', ',');
const OUTRO_ANIMATION = 1.85;   // wie schnitt/anker.mjs im Vorbild: Standzeit = Dauer − outroStart − 1,85 s

export async function schnittUmstellen(P) {
  const meta = J(path.join(P, 'workflow.json')), tempo = Number(meta.tempo ?? 1);
  const vf = path.join(P, 'schnitt/vorher.json');
  for (const f of ['schnitt.json', 'schnitt/vorher.json', 'design-plan.json']) if (!fs.existsSync(path.join(P, f))) throw Error(`${f} fehlt. schnitt-umstellen rechnet bestehende Pläne von schnitt/vorher.json (von schnitt-plan gesichert) auf die neue schnitt.json um.`);
  if (!vorbereitetMit(P, tempo)) throw Error(`Erst node workflow.mjs vorbereiten "${P}": Wörter und media.mp4 müssen zur jetzigen schnitt.json und zu Tempo ${komma(tempo)} passen.`);
  const v = J(vf), sha = pruefsumme(path.join(P, 'schnitt.json'));
  if (v.sha256 === sha && Number(v.tempo) === tempo) { console.log('Nichts umzurechnen: Die Pläne passen schon zu dieser schnitt.json und diesem Tempo (schnitt/vorher.json).'); return anker(P); }
  const offen = v.offen?.sha256 === sha && Number(v.offen?.tempo) === tempo ? v.offen : null;
  if (v.offen && !offen) throw Error(`Die Pläne wurden am ${v.offen.am} schon auf eine andere Fassung umgerechnet, deren Kurzprüfungen noch fehlen; seitdem hat sich schnitt.json oder das Tempo wieder geändert. Nicht automatisch weiterrechnen: Sicherung in schnitt/umstellen-sicherung-* ansehen und Abdullah fragen.`);
  return zeit(P, 'schnitt-umstellen', () => {
    console.log(`Umrechnen: Planstand vom ${v.gesichert} (Tempo ${komma(v.tempo)}) → jetzige schnitt.json (Tempo ${komma(tempo)})`);
    if (!offen) {
      // Sicherung der Pläne vor dem Schreiben (wiederherstellbar, nichts wird gelöscht)
      const sich = path.join(P, 'schnitt', `umstellen-sicherung-${new Date().toISOString().replace(/[:.]/g, '-')}`);
      fs.mkdirSync(sich, { recursive: true });
      for (const f of ['design-plan.json', 'caption-edit-plan.json', 'word-review-turbo/chunks.json', 'schnitt/vorher.json']) if (fs.existsSync(path.join(P, f))) fs.copyFileSync(path.join(P, f), path.join(sich, f.replace(/\//g, '__')));
      console.log(`Pläne gesichert: ${path.relative(P, sich)}`);
      py('umstellen.py', [P, '--schreiben'], { ausgabe: 'zeigen' });
      fs.writeFileSync(vf, JSON.stringify({ ...v, offen: { sha256: sha, tempo, plaene: true, am: new Date().toISOString() } }, null, 1) + '\n');
    } else console.log('Pläne sind schon umgerechnet (schnitt/vorher.json „offen“), es fehlen nur die Kurzprüfungen.');
    // Kurzprüfungen (word-review-turbo) neu erkennen; ohne media.mp4 sauber auslassen und melden.
    let kurz = 'keine Kurzprüfungen im Projekt';
    if (fs.existsSync(path.join(P, 'word-review-turbo/chunks.json'))) {
      if (!fs.existsSync(path.join(P, 'media.mp4'))) kurz = 'AUSGELASSEN: media.mp4 fehlt, word-review-turbo nicht neu erkannt. Nach vorbereiten schnitt-umstellen erneut aufrufen (die Pläne werden nicht doppelt umgerechnet).';
      else { py('kurzpruefungen-neu.py', [P], { ausgabe: 'zeigen' }); kurz = 'word-review-turbo neu erkannt'; }
    }
    console.log(kurz);
    if (!kurz.startsWith('AUSGELASSEN')) schreibeVorher(P, J(path.join(P, 'schnitt.json')).behalten, tempo, { vorbereitet: true, umgestelltVon: { gesichert: v.gesichert, tempo: v.tempo, sha256: v.sha256 } });
    const a = anker(P);
    return { kurzpruefungen: kurz, ...a };
  });
}

// Wörter (Zeit der Vorlage) an einer Planzeit: die ersten vier ab t − 60 ms.
function woerterAn(w, t) { const i = w.findIndex(x => x.start >= t - 0.06); return i < 0 ? '(nach dem letzten Wort)' : w.slice(i, i + 4).map(x => `${x.text}@${x.start.toFixed(2)}`).join(' '); }

// readTimedWords mit Einzeldiagnose: Schlägt es fehl, jede Ersetzung und jede Korrektur einzeln in einer Kopie prüfen.
export function wortPruefung(P) {
  try { const r = readTimedWords(P); return { ok: true, woerter: r.timed, korrekturen: r.corrections.length }; }
  catch (fehler) {
    const plan = J(path.join(P, 'caption-edit-plan.json')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wortpruefung-'));
    for (const d of ['word-alignment-turbo', 'word-review-turbo', 'word-review']) if (fs.existsSync(path.join(P, d))) fs.symlinkSync(path.join(P, d), path.join(tmp, d));
    const probe = p => { fs.writeFileSync(path.join(tmp, 'caption-edit-plan.json'), JSON.stringify(p)); try { return { woerter: readTimedWords(tmp).timed }; } catch (e) { return { fehler: e.message }; } };
    const einzeln = [], rr = [], cc = [];
    (plan.reviewReplacements || []).forEach((r, i) => { const m = probe({ ...plan, corrections: [], reviewReplacements: [r] }).fehler; if (m) einzeln.push(`Ersetzung ${i} (Teil ${r.index}, ${r.from}–${r.to}): ${m}`); else rr.push(r); });
    (plan.corrections || []).forEach((c, i) => { const m = probe({ ...plan, reviewReplacements: rr, corrections: [c] }).fehler; if (m) einzeln.push(`Korrektur ${i} „${c.before}“ → „${c.after}“ (${c.from}–${c.to}): ${m}`); else cc.push(c); });
    // Für die Ankerliste: Wörter ohne die fehlerhaften Einträge (nur Anzeige, der Plan bleibt unverändert)
    const ohne = probe({ ...plan, reviewReplacements: rr, corrections: cc });
    fs.rmSync(tmp, { recursive: true, force: true });
    return { ok: false, fehler: fehler.message, einzeln, woerter: ohne.woerter || null };
  }
}

// Ankerliste wie schnitt/anker.mjs im Vorbild: Welche Wörter stehen an den Einsatzzeiten? Kapitel überlappen? Outro-Standzeit.
export function anker(P) {
  const d = J(path.join(P, 'design-plan.json')), dauer = J(path.join(P, 'workflow.json')).cutDuration;
  const wp = wortPruefung(P);
  if (!wp.ok) {
    console.log(`Wortprüfung (readTimedWords): FEHLER – ${wp.fehler}`);
    for (const z of wp.einzeln) console.log(`  ${z}`);
    console.log(wp.woerter ? 'Ankerliste mit den Wörtern ohne diese Einträge (Plan unverändert; die Einträge muss der Planer berichtigen):' : 'Ankerliste ohne Wörter (erst die Fehler beheben).');
  } else console.log(`Wortprüfung (readTimedWords): in Ordnung, ${wp.woerter.length} Wörter, ${wp.korrekturen} Korrekturen eindeutig.`);
  const w = wp.woerter || [], um = t => wp.woerter ? woerterAn(w, t) : '';
  const zeilen = [`Dauer ${dauer}`];
  if (d.einstieg?.end != null) zeilen.push(`Einstieg bis ${d.einstieg.end} → ${um(d.einstieg.end)}`);
  for (const b of d.lebensbalken || []) { zeilen.push(`Balken ${b.start} ${b.end}`); for (const s of b.abschnitte || []) zeilen.push(`   ${s.beschriftung} ${s.at} → ${um(s.at)}`); }
  const ueberlappt = [], offen = [];
  // Gemeldet wird, was am 04.10.2026 nach dem Straffen von Hand berichtigt werden musste: nicht mehr eindeutige Wortkorrekturen,
  // zu kurz stehende große Buchcover, Kapitel ohne Lücke und eine Outro-Standzeit außerhalb 4–5 s. (Eine Prüfung „mitten im Satz“
  // wurde verworfen: Untertitel haben oft keine Satzzeichen, und Kapitel beginnen bewusst am Titel mitten im Satz.)
  (d.kapitel || []).forEach((k, i) => {
    const n = d.kapitel[i + 1], nah = n && n.start - k.end < 0.2;
    if (nah) { ueberlappt.push(k.id); offen.push(`${k.id}: endet weniger als 0,2 s vor ${n.id} oder überlappt`); }
    zeilen.push(`${k.id} ${k.start} → ${um(k.start)} | Ende ${k.end}${nah ? ' ÜBERLAPPT/ZU NAH' : ''} | Länge ${(k.end - k.start).toFixed(1)}`);
    if (k.buch) {
      const gross = k.buch.grossBis - k.start;
      if (gross < 2) offen.push(`${k.id}: Buchcover nur ${gross.toFixed(2)} s groß (Abis abgenommener Stand: etwa 2,2–2,6 s, während der Titel gesagt wird)`);
      zeilen.push(`   groß bis ${k.buch.grossBis} (${gross.toFixed(2)} s) → ${um(k.buch.grossBis)}${k.buch.autorAb != null ? ` | Autor ab ${k.buch.autorAb} → ${um(k.buch.autorAb)}` : ''}`);
    }
  });
  for (const p of d.pillen || []) { zeilen.push(`Pillen bis ${p.end}`); for (const it of p.items || []) zeilen.push(`   ${it.text} ${it.at} → ${um(it.at)}`); }
  let standzeit = null;
  if (d.outroStart != null) {
    standzeit = Math.round((dauer - d.outroStart - OUTRO_ANIMATION) * 100) / 100; zeilen.push(`Outro ${d.outroStart} → ${um(d.outroStart)} Standzeit ${standzeit.toFixed(2)}`);
    if (standzeit < 4 - 1e-6 || standzeit > 5 + 1e-6) offen.push(`Outro: Standzeit ${standzeit.toFixed(2)} s (DESIGN.md 15: 4–5 s) – outroStart an einen Satzanfang verschieben`);
  }
  if (!wp.ok) offen.unshift(...wp.einzeln.map(z => `Wortprüfung: ${z}`));
  console.log(zeilen.join('\n'));
  if (offen.length) { console.log(`\nOFFEN (${offen.length}) – der Planer prüft und berichtigt diese Stellen von Hand:`); for (const o of offen) console.log(`  - ${o}`); process.exitCode = 2; }
  else console.log('\nKeine offenen Stellen.');
  return { wortpruefung: wp.ok ? 'ok' : wp.einzeln, ueberlappt, outroStandzeit: standzeit, offen };
}
