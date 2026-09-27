// Baut aus plan-input.json (Themenplan ohne Maße) die theme-plan.json nach DESIGN.md 1.12,
// erzeugt Untertitel über die gemeinsame assemble-full-video.mjs und schreibt index.html mit der
// Fast-30-Komposition. Aufruf im Werkzeugordner: node projects/Fast-30-Gestaltung-2026-09-26/build-plan.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { assembleFullVideo } from '../../assemble-full-video.mjs';
import { makeFast30Composition } from './theme-composition-fast30.mjs';

const project = path.dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(fs.readFileSync(path.join(project, f)));
const inputFile = process.argv[2] || 'plan-input.json';
const htmlName = process.argv[3] || 'index.html';
const input = read(inputFile);
const meta = read('workflow.json');
const faces = read('review/source-faces.json');
const font = fontkit.openSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const EMOJI = /(\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
// Apple-Emojis sind etwa 1,25 em breit (plus 0,08 em Abstand); Arial kennt sie nicht, daher getrennt gerechnet.
const measure = (t, size) => { const emo = (t.match(EMOJI) || []).length; const rest = t.replace(EMOJI, '');
  return font.layout(rest).positions.reduce((s, p) => s + p.xAdvance, 0) / font.unitsPerEm * size + emo * 1.75 * size; };
const H1_HEIGHT = { 72: 112, 66: 105, 60: 98, 56: 93 };
const errors = [];

// H1: erste Stufe 72 → 66 → 60 → 56, bei der der Text höchstens 736 px breit ist (DESIGN.md 4).
const sections = input.sections.map(s => {
  const fontSize = [72, 66, 60, 56].find(size => measure(s.text, size) <= 736);
  if (!fontSize) errors.push(`H1 zu breit: ${s.text}`);
  return { ...s, fontSize, boxWidth: Math.ceil(measure(s.text, fontSize) + 44) };
});
const h1At = t => sections.find(s => s.start <= t && t < s.end);

// H2: Oberkante 20 px unter der H1-Fläche; max. 560 px je Zeile, höchstens zwei Zeilen (DESIGN.md 5).
const overlays = input.overlays.map(o => {
  const lines = o.parts ? [o.parts.map(q => q.text).join(' · ')] : o.lines;
  const h1 = h1At(o.start + 0.01);
  if (!h1 || h1.end < o.end - 0.001) errors.push(`H2 ${o.id} liegt nicht vollständig unter einer H1`);
  const flagWidth = o.flag ? 57 : 0;
  lines.forEach((l, j) => { const w = measure(l, 46) + (j === lines.length - 1 ? flagWidth : 0); if (w > 560) errors.push(`H2 zu breit (${Math.round(w)} px): ${l}`); });
  if (lines.length > 2) errors.push(`H2 mehr als zwei Zeilen: ${o.id}`);
  return { ...o, lines, kind: 'support', fontSize: 46, top: 250 + H1_HEIGHT[h1?.fontSize ?? 72] + 20 };
});

// Randnotiz: linksbündig neben dem Kopf (DESIGN.md 9a). Seite aus der Planung, Lage aus den Gesichtern.
const notes = input.notes.map(n => {
  const lines = n.lines.map(l => ({ ...l, text: l.text }));
  // Reserve rechts: 5 px; bei durchgestrichenen Zeilen 11 px, weil die Linie 4 px übersteht und 2 px Kontur hat (DESIGN.md 1 und 9a).
  const width = Math.max(...lines.map(l => measure(l.text, 46) + (l.strikeAt != null ? 11 : 5)));
  const strikePad = lines.some(l => l.strikeAt != null) ? 6 : 0;
  const window = faces.filter(f => f.time >= n.start - 0.5 && f.time <= n.end + 0.5).flatMap(f => f.faces);
  const pad = 30;
  const faceRight = Math.max(...window.map(f => f.x + 1.12 * f.width));
  const faceLeft = Math.min(...window.map(f => f.x - 0.12 * f.width));
  const h2 = overlays.filter(o => o.start < n.end && o.end > n.start);
  const top = h2.length ? Math.max(390, ...h2.map(o => o.top + o.lines.length * 53 + 60)) : 390;
  const height = lines.length * 53 + lines.reduce((s, l) => s + (l.gapBefore || 0), 0);
  let left;
  if (n.side === 'links') left = 90 + strikePad; else left = Math.min(930 - width, Math.max(590, Math.round(faceRight + pad)));
  const noteRight = left + width;
  if (n.side === 'links' && noteRight > faceLeft - 10) errors.push(`Notiz ${n.id} links: ${Math.round(width)} px breit, Kopf ab x ${Math.round(faceLeft)}`);
  if (n.side !== 'links' && left < faceRight - 5) errors.push(`Notiz ${n.id} rechts überdeckt den Kopf (Kopf bis x ${Math.round(faceRight)}, Notiz ab ${left})`);
  if (top + height > 1270) errors.push(`Notiz ${n.id} reicht bis y ${top + height}`);
  return { id: n.id, start: n.start, end: n.end, left, top, lines };
});

// Großes Wort: größte Stufe, bei der Text + Innenabstand in 780 px passt, auch beim Überschwingen des
// Aufploppens (Abfedern, Spitze Skalierung 1,044, Ursprung oben Mitte; DESIGN.md 1: auch während einer Animation).
const bigwords = input.bigwords.map(b => {
  const fontSize = [170, 150, 136, 124, 112, 100, 90].find(size => (measure(b.text, size) + 52) * 1.045 <= 780);
  if (!fontSize) errors.push(`Großes Wort zu breit: ${b.text}`);
  return { ...b, fontSize };
});

// Spar-Grafik (Abdullah 26.09.2026): monatliche Rate, Rendite p. a. (effektiv), Laufzeit; Kurve normiert auf den Endwert.
const charts = (input.charts || []).map(c => {
  const i = (1 + c.rate) ** (1 / 12) - 1, months = c.years * 12; let v = 0; const vals = [0];
  for (let k = 0; k < months; k++) { v = v * (1 + i) + c.monthly; vals.push(v); }
  const end = vals.at(-1), paid = c.monthly * months, scale = Math.max(end, paid);
  const curve = vals.map((x, k) => [k / months, x / scale]).filter((_, k) => k % 2 === 0 || k === months);
  const fmt = x => Math.round(x).toLocaleString('de-DE') + ' €';
  const nSteps = Math.round((c.drawEnd - c.drawStart) * 10);
  const steps = Array.from({ length: nSteps + 1 }, (_, s) => fmt(vals[Math.round(s / nSteps * months)]));
  steps[nSteps] = c.finalLabel || steps[nSteps];
  const width = 560, plotHeight = 200, top = c.top ?? 382, bottom = top + 44 + 14 + plotHeight + 44;
  if (measure(c.title, 38) > width) errors.push(`Grafik-Titel zu breit: ${c.title}`);
  const heads = faces.filter(f => f.time >= c.start - 0.5 && f.time <= c.end + 0.5).flatMap(f => f.faces).map(f => f.y - 0.5 * f.height);
  if (bottom > Math.min(...heads) - 8) errors.push(`Grafik ${c.id} reicht bis y ${bottom}, Kopf ab ${Math.round(Math.min(...heads))}`);
  return { ...c, width, plotHeight, top, curve, steps, paidTo: paid / scale, endValue: Math.round(end), paidValue: paid };
});
const zooms = input.zooms.map(z => ({ ...z, origin: '42% 28%' }));
// DESIGN.md 7: In sehr nahen Einstellungen darf die Untertitelzeile tiefer sitzen (Ende oberhalb y 1660).
// Wo das Kinn (Gesichtsunterkante) unter y 1270 reicht, rückt die Zeile 14 px unter das Kinn; im Outro höchstens bis 1331 (Karte ab 1423).
const captionPlacementRanges = [];
for (const f of faces) {
  const bottom = Math.max(...f.faces.map(x => x.y + x.height));
  if (bottom <= 1270) continue;
  const start = Math.max(0, f.time - 0.5), end = Math.min(meta.cutDuration, f.time + 0.5);
  const limit = end > input.outroStart ? 1331 : 1568;
  const top = Math.min(limit, Math.ceil(bottom + 14));
  const last = captionPlacementRanges.at(-1);
  if (last && start <= last.end) { last.end = end; last.top = Math.max(last.top, top); } else captionPlacementRanges.push({ start, end, top });
}
const duration = meta.cutDuration;
const outro = { start: input.outroStart, end: duration, followers: meta.followers.value, target: 10000, followersSource: meta.followers.source };
if (sections.at(-1).end !== outro.start) errors.push('Letzte H1 endet nicht mit dem Outro');
if (errors.length) { console.error(errors.join('\n')); if (!process.env.LENIENT) process.exit(1); }

const plan = {
  designVersion: '1.12', title: 'Fast 30', duration, h1Background: '#1668b5', captionAccent: '#5eb3f5', captionFontSize: 56,
  captionTop: 1280, captionMaxWords: 4, captionMaxWidth: 620, sections, overlays, notes, bigwords, bars: [], charts, zooms,
  zoomBasis: 'Langsame Fahrten nach DESIGN.md 11 (1,03–1,055), Rücksprung an Abdullahs Schnitten (review/cut-points.json); Punch-Zooms zu großen Wörtern wie im Video „Angst vor Arbeiten“ vom 26.09.2026.',
  neueElemente: 'H1-Morph bei lückenlosen Wechseln, H2-Aufzählung mit aktivem Punkt (parts), Flagge in H2 (flag); Probe für Abdullah, noch nicht in DESIGN.md. Großes Wort und Punch-Zoom aus „Angst vor Arbeiten“ (26.09.2026).',
  logos: [], bubbles: [], outro, captions: [], captionPlacementRanges,
  captionPlacementBasis: 'DESIGN.md 7, nahe Einstellungen: Zeile 14 px unter der Gesichtsunterkante aus review/source-faces.json',
};
fs.writeFileSync(path.join(project, 'theme-plan.json'), JSON.stringify(plan, null, 2) + '\n');
assembleFullVideo(project); // Untertitel, Wortzeiten, SRT, Breitenprüfung; schreibt index.html (Standardvorlage)
const assembled = read('theme-plan.json');
fs.writeFileSync(path.join(project, htmlName), makeFast30Composition(assembled));
console.log(JSON.stringify({ charts: charts.map(c => [c.id, c.endValue, c.paidValue, c.top]), h1: sections.length, h2: overlays.length, notes: notes.map(n => [n.id, n.left, n.top]), bigwords: bigwords.map(b => [b.text, b.fontSize]), zooms: zooms.length, captions: assembled.captions.length }));
