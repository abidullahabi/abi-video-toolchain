// Baut aus plan-input-klar.json (Elementplanung ohne Maße) die theme-plan.json und index.html nach DESIGN.md 2.0.
// Misst mit den Originalschriften (assets/Archivo.ttf, assets/GochiHand-Regular.ttf, Abschnitt 4: keine Ersatzschrift).
// Aufruf im Werkzeugordner: node projects/Fast-30-Design2-2026-09-27/build-plan-klar.mjs [plan-input-klar.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { makeKlarComposition } from './theme-composition-klar.mjs';
import { buildChart } from './chart-klar.mjs';
import { buildNote } from './note-klar.mjs';

const project = path.dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(fs.readFileSync(path.join(project, f)));
const input = read(process.argv[2] || 'plan-input-klar.json');
const meta = read('workflow.json');
const faces = read('review/source-faces.json');
const cuts = read('review/cut-points.json').cuts.map(c => c.time);
const followers = read('follower-source.json');
const duration = meta.cutDuration;
const errors = [], annahmen = [...(input.annahmen || [])];
const r2 = x => Math.round(x * 100) / 100;

// Abschnitt 4: Archivo variabel (wght, wdth), Gochi Hand. Breiten mit fontkit an den Originaldateien.
for (const f of ['assets/Archivo.ttf', 'assets/GochiHand-Regular.ttf']) if (!fs.existsSync(path.join(project, f))) throw Error('Schrift fehlt: ' + f + ' (DESIGN.md 4: keine Ersatzschrift).');
const archivo = fontkit.openSync(path.join(project, 'assets/Archivo.ttf'));
const gochi = fontkit.openSync(path.join(project, 'assets/GochiHand-Regular.ttf'));
const inst = {};
const face = (w, wd = 100) => inst[w + '/' + wd] ??= archivo.getVariation({ wght: w, wdth: wd });
const adv = (font, text) => font.layout(text).glyphs.reduce((s, g) => s + g.advanceWidth, 0) / font.unitsPerEm;
const A = (text, size, w = 800, wd = 100, wordSpacing = 0) => adv(face(w, wd), text) * size + wordSpacing * (text.split(' ').length - 1);
const G = (text, size) => adv(gochi, text) * size;
const upper = s => s.toLocaleUpperCase('de-DE');

// Gesichter: Kopf mit Kappe = Gesicht nach oben um 0,5 Gesichtshöhen, seitlich um 12 % erweitert (wie bisherige Prüfung).
const heads = (a, b) => faces.filter(f => f.time >= a - 0.25 && f.time <= b + 0.25).flatMap(f => f.faces.map(q => ({ t: f.time, x: q.x - 0.12 * q.width, y: q.y - 0.5 * q.height, w: 1.24 * q.width, h: 1.5 * q.height, fw: q.width })));
const hits = (box, a, b) => heads(a, b).filter(h => box.x < h.x + h.w && box.x + box.w > h.x && box.y < h.y + h.h && box.y + box.h > h.y);

// 5/6: H1 so groß wie möglich, höchstens 160 px, Zeile inkl. Kontur ≤ 864 px. Unter 90 px einzeilig → zwei Zeilen gleich groß.
function h1Fit(text) {
  const t = upper(text);
  const one = Math.min(160, Math.floor((864 - 16) / A(t, 1, 900, 125)));
  if (one >= 90) return { lines: [t], fontSize: one };
  const words = t.split(' '); let best = null;
  for (let i = 1; i < words.length; i++) { const l = [words.slice(0, i).join(' '), words.slice(i).join(' ')]; const s = Math.min(160, ...l.map(x => Math.floor((864 - 16) / A(x, 1, 900, 125)))); if (!best || s > best.fontSize) best = { lines: l, fontSize: s }; }
  if (!best) errors.push('H1 passt nicht: ' + text);
  return best;
}
const h1Height = h => h.lines.length * h.fontSize * 1.02;
// 6: H2 Archivo 800 58 px, Fläche ≤ 780 px (Text ≤ 724 px), höchstens zwei Zeilen, Höhe = Zeilen × 58 × 1,12 + 22.
const h2Check = (id, lines) => { if (lines.length > 2) errors.push(`H2 ${id}: mehr als zwei Zeilen`); for (const l of lines) { const w = A(l, 58, 800) + 56; if (w > 780) errors.push(`H2 ${id} zu breit (${Math.round(w)} px): ${l}`); } };
const h2Height = lines => lines.length * 58 * 1.12 + 22;

// Einstieg
const e1 = h1Fit(input.einstieg.h1);
const einstieg = { h1: e1, end: input.einstieg.end };
if (input.einstieg.h2?.length) { h2Check('einstieg', input.einstieg.h2); einstieg.h2 = { lines: input.einstieg.h2, top: Math.round(250 + h1Height(e1) + 24) }; }

// 8: Kapitel. Gruppe ≤ 864 px. Höhe der Gruppe = Zahl 140 px (Zeilenhöhe 1).
const KAP_H = 140;
const kapitel = input.kapitel.map(k => {
  const w = G(k.nummer, 140) + 14 + 28 + A(k.titel, 64, 900, 100, 6) + 12;
  if (w > 864) errors.push(`Kapitel ${k.id} zu breit (${Math.round(w)} px): ${k.nummer} ${k.titel}`);
  const withPills = (input.pillen || []).some(p => p.kapitel === k.id);
  return { id: k.id, nummer: k.nummer, titel: k.titel, start: k.start, end: k.end, top: withPills ? 270 : 300, width: Math.round(w) };
});
for (let i = 1; i < kapitel.length; i++) if (kapitel[i].start < kapitel[i - 1].end - 1e-6) errors.push(`Kapitel überlappen: ${kapitel[i - 1].id}/${kapitel[i].id}`);
const kapAt = t => kapitel.find(k => k.start <= t && t < k.end);

const h1Video = (input.h1Video || []).map(h => ({ id: h.id, ...h1Fit(h.text), start: h.start, end: h.end }));

// 9: Pillen. Höhe je Pille 5 + 8 + 60,48 + 10 + 5 = 88,5 px (Stapel) bzw. 5 + 8 + 47,04 + 10 + 5 = 75 px (Reihe).
const PILL_H = 5 + 8 + 54 * 1.12 + 10 + 5, ROW_H = 5 + 8 + 42 * 1.12 + 10 + 5;
const OFFS = [[-44, -2], [40, 1.5], [-16, -1]];
const pillen = (input.pillen || []).map(p => {
  const k = kapitel.find(x => x.id === p.kapitel);
  if (!k) { errors.push(`Pillen ${p.id} ohne Kapitel`); return null; }
  if (p.items.length > 3) errors.push(`Pillen ${p.id}: mehr als drei`);
  const top = k.top + KAP_H + 34, end = p.end ?? k.end, start = p.items[0].at;
  const stackW = it => 3 + 5 + 12 + (p.numbered ? 56 : 26) + 12 + A(it.text, 54, 800) + 10 + 32 + 5 + 3;
  const rowW = it => 3 + 5 + 32 + A(it.text, 42, 800) + 10 + 32 + 5 + 3;
  const stackBoxes = p.items.map((it, i) => { const w = stackW(it); return { x: 540 + OFFS[i][0] - w / 2, y: top + i * (PILL_H + 20), w, h: PILL_H + 6 }; });
  const rowTotal = p.items.reduce((s, it) => s + rowW(it), 0) + 16 * (p.items.length - 1);
  const rowBox = { x: 540 - rowTotal / 2, y: top, w: rowTotal, h: ROW_H + 6 };
  const stackHits = stackBoxes.flatMap((b, i) => hits(b, p.items[i].at, end));
  let layout = p.layout === 'auto' || !p.layout ? (stackHits.length ? 'row' : 'stack') : p.layout;
  if (layout === 'stack') { if (stackHits.length) errors.push(`Pillen ${p.id} übereinander verdecken den Kopf (${stackHits.length} Stichproben)`); stackBoxes.forEach((b, i) => { if (b.x < 108 || b.x + b.w > 972) errors.push(`Pille ${p.id}-${i} außerhalb 108–972`); }); }
  else { if (rowTotal > 864) errors.push(`Pillen ${p.id} nebeneinander ${Math.round(rowTotal)} px > 864`); const rh = hits(rowBox, start, end); if (rh.length) errors.push(`Pillen ${p.id} nebeneinander verdecken den Kopf (${rh.length} Stichproben, Kopf ab y ${Math.round(Math.min(...rh.map(h => h.y)))})`); }
  if (layout !== p.layout && p.layout !== 'auto') annahmen.push(`Pillen ${p.id}: ${layout}`);
  return { id: p.id, kapitel: p.kapitel, numbered: !!p.numbered, layout, top: Math.round(top), start, end, items: p.items.map((it, i) => ({ text: it.text, at: it.at, dx: OFFS[i][0], rot: OFFS[i][1] })), bottom: Math.round(layout === 'stack' ? top + p.items.length * PILL_H + (p.items.length - 1) * 20 : top + ROW_H) };
}).filter(Boolean);

// H2 im Video: unter Einstieg/H1 24 px unter der H1; allein y = 250; unter Kapitel (Annahme, DESIGN.md regelt das nicht) 24 px unter der Kapitelgruppe.
const h2 = (input.h2 || []).map(h => {
  h2Check(h.id, h.lines);
  let top = 250;
  if (h.unter?.startsWith('kapitel:')) { const k = kapitel.find(x => x.id === h.unter.slice(8)); top = k.top + KAP_H + 24; const p = pillen.find(p => p.kapitel === k.id && p.start < h.end && p.end > h.start); if (p) errors.push(`H2 ${h.id} und Pillen ${p.id} zugleich unter Kapitel ${k.id} (drei Textebenen)`); }
  else if (h.unter?.startsWith('h1Video:')) { const x = h1Video.find(v => v.id === h.unter.slice(8)); top = 250 + h1Height(x) + 24; }
  else if (kapAt(h.start + 0.01) && h.unter === 'allein') errors.push(`H2 ${h.id} allein bei y 250, aber Kapitel läuft`);
  const w = Math.max(...h.lines.map(l => A(l, 58, 800))) + 56, box = { x: 540 - w / 2, y: top, w, h: h2Height(h.lines) };
  const hh = hits(box, h.start, h.end); if (hh.length) errors.push(`H2 ${h.id} verdeckt Kopf/Kappe (${hh.length} Stichproben, Kopf ab y ${Math.round(Math.min(...hh.map(q => q.y)))}, H2 bis y ${Math.round(top + box.h)})`);
  return { id: h.id, lines: h.lines, start: h.start, end: h.end, top: Math.round(top) };
});

// 10: Schlagwort 120–160 px, ≤ 864 px inkl. Kontur 9 px. Unterstreichung „fast so breit wie das Wort": 92 %.
const hand = (w, y, seed) => { const a = [0.6, -1.4, 1.1, -0.7][seed % 4]; return `M 0 ${y + a} C ${w * 0.3} ${y - 3 + a} ${w * 0.62} ${y + 4 - a} ${w} ${y - 1}`; };
const schlagworte = (input.schlagworte || []).map((s, i) => {
  const t = upper(s.wort), size = Math.min(160, Math.floor((864 - 18) / A(t, 1, 900, 125)));
  if (size < 120) errors.push(`Schlagwort zu lang: ${t} (${size} px)`);
  const d = s.end - s.start; if (d < 0.8 - 1e-6 || d > 1.3 + 1e-6) errors.push(`Schlagwort ${s.id}: Standzeit ${d.toFixed(2)} s außerhalb 0,8–1,3 s`);
  const lw = Math.round(A(t, size, 900, 125) * 0.92);
  return { id: s.id, text: t, fontSize: size, start: s.start, end: s.end, lineWidth: lw, paths: [hand(lw, 14, i), hand(lw * 0.96, 40, i + 1)] };
});

// 11: Grafik mit Green Screen — Karte und SVG aus plan-input (grafiken[].chart), Rechenweg in grafik-rechnung.json.
const grafiken = (input.grafiken || []).map(g => buildChart(g, { A, errors }));

// 12: Randnotiz (nur Vorher/Nachher).
const randnotizen = (input.randnotizen || []).map(n => buildNote(n, { A, G, heads, errors, h1Bottom: t => { const k = kapAt(t); return k ? k.top + KAP_H : 250; } }));

// Ausblenden: während Schlagwort H1/H2/Randnotiz (DESIGN.md 10) und — Annahme — Kapitel und Pillen, weil das Schlagwort
// an derselben Stelle steht (y 330); während der Grafik alle oberen Textebenen, weil die Karte bei y 270 steht.
const ausblenden = [];
const tops = [...kapitel, ...h2, ...pillen, ...randnotizen, ...h1Video];
for (const w of [...schlagworte, ...grafiken]) for (const x of tops) if (x.start < w.end && x.end > w.start) {
  const to = x.end > w.end + 0.25 ? w.end : null;
  ausblenden.push({ sel: '#' + x.id, from: Math.max(x.start, w.start), to, grund: w.id });
}

// 7: Untertitel. Archivo 800 64 px, einzeilig ≤ 780 px (Kontur eingerechnet), Ziel drei Wörter, nach Satzzeichen neue Gruppe.
const timed = read('word-timing.json'); // geprüfte Wortzeiten inkl. Korrekturen/Abmilderungen aus v4 (caption-edit-plan.json)
const capW = t => A(t, 64, 800) + 12;
function group(ws) {
  const n = ws.length, cost = Array(n + 1).fill(Infinity), pick = Array(n); cost[n] = 0;
  const weak = /^(der|die|das|ein|eine|einen|einem|einer|den|dem|des|für|zum|zur|im|in|auf|vor|von|und|oder|mit|zu|an|am|bei|aus|nach)$/i;
  for (let i = n - 1; i >= 0; i--) for (let k = 1; k <= 3 && i + k <= n; k++) {
    const sl = ws.slice(i, i + k), text = sl.map(w => w.text).join(' ');
    if (capW(text) > 780) break;
    if (sl.some((w, j) => j && (/[.,!?:;…–]$/.test(sl[j - 1].text) || w.start - sl[j - 1].end > 0.34))) break;
    const d = sl.at(-1).end - sl[0].start;
    let c = cost[i + k] + { 1: 2.6, 2: 0.9, 3: 0 }[k];
    if (weak.test(sl.at(-1).text) && i + k < n) c += 1.8;
    if (d < 0.45) c += 2; if (d > 2.2) c += (d - 2.2) * 2;
    if (c < cost[i]) { cost[i] = c; pick[i] = k; }
  }
  if (!isFinite(cost[0])) throw Error('Untertitel: ein Wort ist einzeilig zu breit.');
  const out = [];
  for (let i = 0; i < n; i += pick[i]) { const sl = ws.slice(i, i + pick[i]); const end = Math.min(ws[i + sl.length]?.start ?? duration, sl.at(-1).end + 0.07); out.push({ start: sl[0].start, end: r2(end) > sl[0].start ? Math.round(end * 1000) / 1000 : sl.at(-1).end, words: sl.map(({ text, start, end }) => ({ text, start, end })) }); }
  return out;
}
const captions = group(timed);
for (const c of captions) { const w = capW(c.words.map(x => x.text).join(' ')); if (w > 780.5) errors.push('Untertitel zu breit: ' + c.words.map(x => x.text).join(' ')); }

// 15: Zoomfahrten 105–107 %, 2–4 s, etwa alle 5–10 s, linear, Rücksprung an Schnitten/Themenübergängen,
// nicht in engen Nahaufnahmen, nicht während Schlagwort (Stoßzoom), Grafik (Video verdeckt) oder Outro-Aufbau.
const resets = [...new Set([...cuts, ...kapitel.map(k => k.start), ...h1Video.map(h => h.start)])].filter(t => t > 2 && t < duration).sort((a, b) => a - b);
const faceW = t => { const f = faces.reduce((b, x) => Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b); return Math.max(0, ...f.faces.map(q => q.width)); };
const CLOSE = input.nahaufnahmeAbBreite ?? 420;
const blocked = [...schlagworte.map(s => [s.start - 0.3, s.end + 0.3]), ...grafiken.map(g => [g.start, g.end]), [input.outroStart, duration], ...(input.zoomSperren || [])];
const zooms = []; let last = -99, flip = 0;
for (const r of resets) {
  const prev = resets.filter(x => x < r - 0.05).at(-1) ?? 0;
  const len = Math.min(4, r - prev - 0.2); if (len < 2) continue;
  const start = r2(r - len), end = r2(r);
  if (start - last < 5) continue;
  if (blocked.some(([a, b]) => start < b && end > a)) continue;
  let close = false; for (let t = start; t <= end; t += 0.5) if (faceW(t) > CLOSE) close = true; if (close) continue;
  zooms.push({ start, end, scale: [1.06, 1.05, 1.07][flip++ % 3] }); last = start;
}

const outro = { start: input.outroStart, end: duration, followers: followers.wert };
if (outro.end - outro.start < 1.85 + 4 - 1e-6) errors.push(`Outro ${r2(outro.end - outro.start)} s < 1,85 s + 4 s Standzeit`);
if (outro.end - outro.start > 1.85 + 5 + 1e-6) annahmen.push(`Outro dauert ${r2(outro.end - outro.start)} s, Standzeit damit ${r2(outro.end - outro.start - 1.85)} s (DESIGN.md 15: 4–5 s); das Ende ist Abdullahs Buch-Zuklappen.`);

if (errors.length) { console.error(errors.join('\n')); if (!process.env.LENIENT) process.exit(1); }
const plan = { designVersion: '2.0', title: meta.title, duration, einstieg, kapitel, h1Video, h2, pillen, schlagworte, grafiken, randnotizen, balken: [], captions, zooms, outro, ausblenden, annahmen };
fs.writeFileSync(path.join(project, 'theme-plan.json'), JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(project, 'captions.srt'), captions.map((c, i) => { const s = t => new Date(Math.round(t * 1000)).toISOString().slice(11, 23).replace('.', ','); return `${i + 1}\n${s(c.start)} --> ${s(c.end)}\n${c.words.map(w => w.text).join(' ')}\n`; }).join('\n'));
fs.writeFileSync(path.join(project, 'index.html'), makeKlarComposition(plan));
console.log(JSON.stringify({ einstieg: [e1.lines, e1.fontSize, einstieg.h2?.top], kapitel: kapitel.map(k => [k.id, k.width]), pillen: pillen.map(p => [p.id, p.layout, p.top, p.bottom]), h2: h2.map(h => [h.id, h.top]), schlagworte: schlagworte.map(s => [s.text, s.fontSize]), grafiken: grafiken.map(g => [g.id, g.height]), captions: captions.length, maxCap: Math.round(Math.max(...captions.map(c => capW(c.words.map(x => x.text).join(' '))))), zooms: zooms.length, ausblenden: ausblenden.length, fehler: errors.length }, null, 1));
