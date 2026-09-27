// Standardvorlage für DESIGN.md 2.2 „Klar mit Kante" (27.09.2026), HyperFrames + GSAP.
// Maßgeblich ist allein DESIGN.md im Drive-Ordner Content_Creation/Anleitung; die Abschnittsnummern stehen am Code.
// Kurven und Zeiten wie in der abgenommenen Animationsvorschau referenz/design-2.2/animationen/index.html.
// Werte, die DESIGN.md offenlässt und die der Referenz entnommen sind, sind mit „Referenz" markiert.
//
//   layoutDesign22(input, ctx) → Plan mit gemessenen Größen und Positionen (Fehler in ctx.errors)
//   makeDesign22Composition(plan) → index.html
//   groupCaptions22(words, measure), planZooms22(...) für assemble-full-video.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// 3: Farben. 4: Schriften.
export const C = { ink: '#111111', white: '#FFFFFF', off: '#F6F1E9', blue: '#5EAAEE', pink: '#FF8AC2', card: '#F8F9FB', cardText: '#16181C', cardMuted: '#7A7E86', cardBed: '#DEE1E7' };
export const FONTS = { archivo: 'templates/fonts/Archivo[wdth,wght].ttf', gochi: 'templates/fonts/GochiHand-Regular.ttf' };
// 16: Farbkorrektur A, in einem Durchgang aus der Originalaufnahme (beim Bau von media.mp4, nicht in der Komposition).
export const FARBKORREKTUR_A = { eq: 'eq=gamma=0.96:saturation=1.12:brightness=-0.015', colorbalance: 'colorbalance=rm=0.03:gm=0.005:bm=-0.03:rh=0.01:bh=-0.02', curves: "curves=all='0/0 0.5/0.49 1/0.95'" };
// 15: Kurven.
export const EASE = { out: [0.22, 1, 0.36, 1], back: [0.34, 1.56, 0.64, 1] };
const EMOJI = /(\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*️?)/gu;

// ---------- Messen (4: alle Breiten mit den Originaldateien) ----------
export function makeMeasure(root = ROOT) {
  for (const f of Object.values(FONTS)) if (!fs.existsSync(path.join(root, f))) throw Error(`Schrift fehlt: ${f} (DESIGN.md 4: keine Ersatzschrift)`);
  const archivo = fontkit.openSync(path.join(root, FONTS.archivo)), gochi = fontkit.openSync(path.join(root, FONTS.gochi)), cache = {};
  const face = (w, wd) => cache[w + '/' + wd] ??= archivo.getVariation({ wght: w, wdth: wd });
  const adv = (font, t) => font.layout(t).glyphs.reduce((s, g) => s + g.advanceWidth, 0) / font.unitsPerEm;
  // 3: Emojis so groß wie der umgebende Text; Apple-Emoji ist etwa 1,25 em breit.
  const A = (t, size, w = 800, wd = 100, ws = 0) => { const e = (t.match(EMOJI) || []).length; const r = t.replace(EMOJI, ''); return adv(face(w, wd), r) * size + e * 1.25 * size + ws * (t.split(' ').length - 1); };
  const G = (t, size) => adv(gochi, t) * size;
  return { A, G };
}
const upper = s => s.replace(/[^\p{Extended_Pictographic}\p{Regional_Indicator}]+/gu, m => m.toLocaleUpperCase('de-DE'));
const r2 = x => Math.round(x * 100) / 100;

// ---------- 7: Untertitel ----------
// Archivo 800 64 px, einzeilig, höchstens 780 px (Kontur 6 px eingerechnet), Zielwert drei Wörter, nach Satzzeichen neue Gruppe.
export function groupCaptions22(words, { A }, duration) {
  const W = t => A(t, 64, 800) + 12, n = words.length, cost = Array(n + 1).fill(Infinity), pick = Array(n); cost[n] = 0;
  const weak = /^(der|die|das|ein|eine|einen|einem|einer|den|dem|des|für|zum|zur|im|in|auf|vor|von|und|oder|mit|zu|an|am|bei|aus|nach)$/i;
  for (let i = n - 1; i >= 0; i--) for (let k = 1; k <= 3 && i + k <= n; k++) {
    const sl = words.slice(i, i + k);
    if (W(sl.map(w => w.text).join(' ')) > 780) break;
    if (sl.some((w, j) => j && (/[.,!?:;…–]$/.test(sl[j - 1].text) || w.start - sl[j - 1].end > 0.34))) break;
    const d = sl.at(-1).end - sl[0].start;
    let c = cost[i + k] + { 1: 2.6, 2: 0.9, 3: 0 }[k];
    if (weak.test(sl.at(-1).text) && i + k < n) c += 1.8;
    if (d < 0.45) c += 2; if (d > 2.2) c += (d - 2.2) * 2;
    if (c < cost[i]) { cost[i] = c; pick[i] = k; }
  }
  if (!isFinite(cost[0])) throw Error('Untertitel: ein Wort ist einzeilig breiter als 780 px.');
  const out = [];
  for (let i = 0; i < n; i += pick[i]) {
    const sl = words.slice(i, i + pick[i]);
    const end = Math.min(words[i + sl.length]?.start ?? duration, sl.at(-1).end + 0.07);
    out.push({ start: sl[0].start, end: Math.round(end * 1000) / 1000, words: sl.map(({ text, start, end }) => ({ text, start, end })), width: Math.round(W(sl.map(w => w.text).join(' '))) });
  }
  return out;
}

// ---------- 15: Zoomfahrten ----------
// 105–107 %, 2–4 s, etwa alle 5–10 s, linear, Rücksprung an Schnittpunkten oder Themenübergängen, nicht in engen Nahaufnahmen,
// nicht zugleich mit einem Stoßzoom (Schlagwort) oder während die Videoebene verdeckt ist (Grafik).
export function planZooms22({ resets, blocked, faceWidth, closeFrom, duration }) {
  const zooms = []; let last = -99, k = 0;
  const pts = [...new Set(resets)].filter(t => t > 2 && t < duration).sort((a, b) => a - b);
  for (const r of pts) {
    const prev = pts.filter(x => x < r - 0.05).at(-1) ?? 0, len = Math.min(4, r - prev - 0.2);
    if (len < 2) continue;
    const start = r2(r - len), end = r2(r);
    if (start - last < 5 || blocked.some(([a, b]) => start < b && end > a)) continue;
    let close = false; for (let t = start; t <= end; t += 0.5) if (faceWidth(t) > closeFrom) close = true;
    if (close) continue;
    zooms.push({ start, end, scale: [1.06, 1.05, 1.07][k++ % 3] }); last = start;
  }
  return zooms;
}

// ---------- Layout ----------
// ctx: { measure, heads(a,b) → [{x,y,w,h}], errors, notes, duration, followers }
export function layoutDesign22(input, ctx) {
  const { A, G } = ctx.measure, errors = ctx.errors, notes = ctx.notes, heads = ctx.heads;
  const hits = (b, a, e) => heads(a, e).filter(h => b.x < h.x + h.w && b.x + b.w > h.x && b.y < h.y + h.h && b.y + b.h > h.y);
  // 6: H1 so groß wie möglich, höchstens 160 px, Zeile inkl. Kontur ≤ 864 px; unter 90 px zwei Zeilen gleich groß.
  const h1Fit = text => {
    const t = upper(text), size = l => Math.min(160, Math.floor((864 - 16) / A(l, 1, 900, 125)));
    if (size(t) >= 90) return { lines: [t], fontSize: size(t) };
    let best = null; const w = t.split(' ');
    for (let i = 1; i < w.length; i++) { const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')]; const s = Math.min(...l.map(size)); if (!best || s > best.fontSize) best = { lines: l, fontSize: s }; }
    if (!best) errors.push(`H1 passt nicht in 864 px: ${text} (Trennung an Silbengrenze im Plan angeben)`);
    return best;
  };
  const h1H = h => h.lines.length * h.fontSize * 1.02;
  const h2Chk = (id, lines) => { if (lines.length > 2) errors.push(`H2 ${id}: mehr als zwei Zeilen`); for (const l of lines) if (A(l, 58, 800) + 56 > 780) errors.push(`H2 ${id} breiter als 780 px: ${l}`); };
  const h2H = lines => lines.length * 58 * 1.12 + 22;

  // 5: Einstieg
  const e = input.einstieg, eh1 = h1Fit(e.h1);
  const einstieg = { h1: eh1, end: e.end };
  if (e.h2?.length) { h2Chk('einstieg', e.h2); einstieg.h2 = { lines: e.h2, top: Math.round(250 + h1H(eh1) + 24) }; }

  // 8: Kapitel. Gruppenhöhe = Zahl 140 px (Zeilenhöhe 1). Mit Pillen Oberkante 270, sonst 300.
  const KAP_H = 140;
  const kapitel = (input.kapitel || []).map(k => {
    const w = (k.nummer ? G(k.nummer, 140) + 14 + 28 : 0) + A(k.titel, 64, 900, 100, 6) + 12;
    if (w > 864) errors.push(`Kapitel ${k.id} breiter als 864 px (${Math.round(w)}): ${k.nummer || ''} ${k.titel}`);
    const pills = (input.pillen || []).some(p => p.kapitel === k.id);
    // Unterkante der Kapitelgruppe = Layoutbox der Gruppe (Zahl mit Zeilenhöhe 1); die Drehung −4° ist nur Darstellung.
    return { id: k.id, nummer: k.nummer || null, titel: k.titel, start: k.start, end: k.end, top: pills ? 270 : 300, height: k.nummer ? KAP_H : Math.round(64 * 1.1) };
  });
  for (let i = 1; i < kapitel.length; i++) if (kapitel[i].start < kapitel[i - 1].end - 1e-6) errors.push(`Kapitel überlappen: ${kapitel[i - 1].id} / ${kapitel[i].id}`);
  const kapById = id => kapitel.find(k => k.id === id);

  const h1 = (input.h1 || []).map(h => ({ id: h.id, ...h1Fit(h.text), start: h.start, end: h.end }));

  // 9: Pillen. Höhe je Pille: Ring 3 + Rand 5 + 8 + 54 × 1,1 + 10 + Rand 5 + Ring 3 (Zeilenhöhe 1,1: Referenz).
  const PILL = 5 + 8 + 54 * 1.1 + 10 + 5, ROW = 5 + 8 + 42 * 1.1 + 10 + 5, OFFS = [[-44, -2], [40, 1.5], [-16, -1]];
  const pillen = (input.pillen || []).map(p => {
    const k = kapById(p.kapitel); if (!k) { errors.push(`Pillen ${p.id}: Kapitel ${p.kapitel} fehlt`); return null; }
    if (p.items.length > 3) errors.push(`Pillen ${p.id}: mehr als drei`);
    const top = k.top + k.height + 34, end = p.end ?? k.end, start = p.items[0].at, num = p.nummeriert !== false;
    // Sichtbare Breite: Ring 3 + Rand 5 + Innenabstand 12 links / 32 rechts (DESIGN.md 9) + Text; die Textkontur liegt im Innenabstand.
    const sw = it => 3 + 5 + 12 + (num ? 56 : 26) + 14 + A(it.text, 54, 800) + 32 + 5 + 3; // Abstand Punkt–Text 14 px: Referenz
    // Nebeneinander (Nahaufnahme) laut DESIGN.md 9 ohne Punkt. Plan-Option punkt: true (Abdullahs Wunsch 27.09.2026) setzt ihn
    // proportional zur 42-px-Schrift (Faktor 42/54): Kreis 44 px mit Nummer 37 px bzw. 20 px ohne Nummer, Abstand 11 px.
    const rowDot = p.punkt ? (num ? 44 : 20) + 11 : 0;
    const rw = it => 3 + 5 + 12 + rowDot + A(it.text, 42, 800) + 32 + 5 + 3;
    const sb = p.items.map((it, i) => { const w = sw(it); return { x: 540 + OFFS[i][0] - w / 2, y: top + i * (PILL + 20) - 3, w, h: PILL + 6 }; });
    const total = p.items.reduce((s, it) => s + rw(it), 0) + 16 * (p.items.length - 1), rb = { x: 540 - total / 2, y: top - 3, w: total, h: ROW + 6 };
    const stackHits = sb.flatMap((b, i) => hits(b, p.items[i].at, end));
    const wish = { untereinander: 'stack', nebeneinander: 'row' }[p.anordnung];
    const layout = wish || (stackHits.length ? 'row' : 'stack');
    if (layout === 'stack') { if (stackHits.length) errors.push(`Pillen ${p.id} untereinander verdecken Kopf/Kappe (${stackHits.length} Stichproben)`); sb.forEach((b, i) => { if (b.x < 108 || b.x + b.w > 972) errors.push(`Pille ${p.id}-${i} außerhalb x 108–972`); }); }
    else { if (total > 864) errors.push(`Pillen ${p.id} nebeneinander ${Math.round(total)} px > 864`); const rh = hits(rb, start, end); if (rh.length) errors.push(`Pillen ${p.id} nebeneinander verdecken Kopf/Kappe (Kopf ab y ${Math.round(Math.min(...rh.map(h => h.y)))})`); }
    if (!wish && layout === 'row') notes.push(`Pillen ${p.id}: nebeneinander (Nahaufnahme, DESIGN.md 9)`);
    const bottom = layout === 'stack' ? top + p.items.length * PILL + (p.items.length - 1) * 20 : top + ROW;
    return { id: p.id, kapitel: k.id, numbered: num, rowDot: !!p.punkt, layout, top: Math.round(top), bottom: Math.round(bottom), start, end, items: p.items.map((it, i) => ({ text: it.text, at: it.at, dx: OFFS[i][0], rot: OFFS[i][1] })) };
  }).filter(Boolean);

  // 6 und 8: H2. Unter Einstieg/H1 24 px unter der H1, allein y = 250, während eines Kapitels 24 px unter der Kapitelgruppe.
  // 8: H2 und Pillen nie gleichzeitig unter einem Kapitel; kommen Pillen, blendet die H2 vorher aus.
  const h2 = (input.h2 || []).map(h => {
    h2Chk(h.id, h.lines);
    let top = 250, end = h.end;
    const u = h.unter || 'allein';
    if (u.startsWith('kapitel:')) {
      const k = kapById(u.slice(8)); top = k.top + k.height + 24;
      const p = pillen.find(p => p.kapitel === k.id && p.end > h.start && p.start < h.end);
      if (p && h.ausnahme) { top = p.bottom + 24; notes.push(`H2 ${h.id} steht als abgenommene Ausnahme unter den Pillen ${p.id}: ${h.ausnahme}`); }
      else if (p) { if (p.start <= h.start) errors.push(`H2 ${h.id} während Pillen ${p.id}`); else { end = r2(Math.min(end, p.start - 0.02)); notes.push(`H2 ${h.id} endet vor Pillen ${p.id} (${end} s)`); } }
    } else if (u.startsWith('h1:')) top = 250 + h1H(h1.find(x => x.id === u.slice(3))) + 24;
    else if (kapitel.some(k => k.start < h.end && k.end > h.start)) errors.push(`H2 ${h.id} „allein" bei y 250, während ein Kapitel läuft`);
    const w = Math.max(...h.lines.map(l => A(l, 58, 800))) + 56, hb = hits({ x: 540 - w / 2, y: top, w, h: h2H(h.lines) }, h.start, end);
    if (hb.length) ctx.warnings.push(`H2 ${h.id} berührt Kopf/Kappe (${hb.length} Stichproben)`);
    return { id: h.id, lines: h.lines, start: h.start, end, top: Math.round(top), ...(h.ausnahme ? { ausnahme: h.ausnahme } : {}) };
  });

  // 9: Akronym. Gochi Hand 230 px, Abstand 64, Drehungen −4/+3/−2, Oberkante 240; Pille 18 px darunter, 46 px, −2°.
  const akronyme = (input.akronyme || []).map(a => {
    const lw = a.buchstaben.reduce((s, b) => s + G(b.b, 230) + 16, 0) + 64 * (a.buchstaben.length - 1);
    if (lw > 864) errors.push(`Akronym ${a.id} breiter als 864 px`);
    const pillTop = Math.round(240 + 230 * 0.95 + 18);
    for (const b of a.buchstaben) { const t = `${b.wort} · ${b.erklaerung}`; if (3 + 5 + 12 + A(t, 46, 800) + 32 + 5 + 3 > 864) errors.push(`Akronym-Pille zu breit: ${t}`); }
    return { id: a.id, start: a.start, end: a.end, pillTop, letters: a.buchstaben.map((b, i) => ({ b: b.b, text: `${b.wort} · ${b.erklaerung}`, at: b.at, rot: [-4, 3, -2][i % 3] })) };
  });

  // 10: Schlagwort 120–160 px, ≤ 864 px inkl. Kontur 9, Standzeit 0,8–1,3 s, höchstens zweimal.
  const schlagworte = (input.schlagworte || []).map(s => {
    const t = upper(s.wort), size = Math.min(160, Math.floor((864 - 18) / A(t, 1, 900, 125)));
    if (size < 120) errors.push(`Schlagwort zu lang für 120 px: ${t}`);
    const d = s.end - s.start; if (d < 0.8 - 1e-6 || d > 1.3 + 1e-6) errors.push(`Schlagwort ${s.id}: Standzeit ${d.toFixed(2)} s`);
    return { id: s.id, text: t, fontSize: size, width: Math.round(A(t, size, 900, 125)), start: s.start, end: s.end };
  });
  if (schlagworte.length > 2) errors.push('Schlagwort höchstens zweimal pro Video (DESIGN.md 1)');

  // 11: Grafik mit Green Screen.
  const grafiken = (input.grafiken || []).map(g => chart22(g, { A, errors }));

  // 12: Randnotiz.
  const kapBottom = t => { const k = kapitel.find(k => k.start <= t && t < k.end); const x = h1.find(k => k.start <= t && t < k.end); return k ? k.top + k.height : x ? 250 + h1H(x) : t < einstieg.end ? 250 + h1H(eh1) : 250; };
  const randnotizen = (input.randnotizen || []).map(n => note22(n, { A, G, heads, errors, top0: kapBottom(n.start + 0.01) }));

  // 13: Lebensbalken 700 × 26, zentriert, Oberkante 370; Beschriftung 40 px über dem Abschnitt.
  const lebensbalken = (input.lebensbalken || []).map(b => ({ id: b.id, start: b.start, end: b.end, segments: b.abschnitte.map(s => { const w = A(s.beschriftung, 40, 800) + 10, mid = (s.von + s.bis) / 2 * 700; return { from: s.von, to: s.bis, label: s.beschriftung, at: s.at, labelLeft: Math.round(Math.max(0, Math.min(700 - w, mid - w / 2))) }; }) }));

  // 14: Logo ersetzt die H1 an der H1-Position; eine H2 bleibt stehen.
  const logos = (input.logos || []).map(l => ({ id: l.id, src: l.datei, start: l.start, end: l.end, height: l.hoehe, width: l.breite }));
  // 14: Sprechblase nur bei Aufforderung zu Kommentar oder DM; im Outro y = 345, sonst 300. Dauer 4,25 s.
  const sprechblasen = (input.sprechblasen || []).map((b, i) => ({ id: 'bubble-' + i, text: b.text, start: b.start, top: Math.abs(b.start - input.outroStart) < 2 || b.start >= input.outroStart ? 345 : 300 }));
  for (const b of sprechblasen) if (A(b.text, 36, 800) + 40 + 8 > 620) errors.push('Sprechblase breiter als 620 px');

  // Ausblenden: 10 Schlagwort blendet H1, H2 und Randnotiz aus; Kapitel und Pillen ebenfalls, weil das Wort an ihrer Stelle steht
  // (in der abgenommenen Branding-Probe so umgesetzt). Grafik: Karte bei y 270 ersetzt alle oberen Textebenen.
  // 14 Logo: H1 blendet 0,1 s vorher aus und 0,1 s danach wieder ein.
  const ausblenden = [], oben = [...kapitel, ...h1, ...h2, ...pillen, ...randnotizen, ...lebensbalken, ...akronyme];
  for (const w of [...schlagworte, ...grafiken]) for (const x of oben) if (x.start < w.end && x.end > w.start) ausblenden.push({ sel: '#' + x.id, from: Math.max(x.start, w.start), to: x.end > w.end + 0.25 ? w.end : null });
  const logoH1 = [];
  for (const l of logos) for (const x of [...h1, ...kapitel]) if (x.start < l.end && x.end > l.start) logoH1.push({ sel: '#' + x.id + ' > span', out: l.start - 0.1, in: l.end + 0.1 });

  return { designVersion: '2.2', duration: ctx.duration, einstieg, kapitel, h1, h2, pillen, akronyme, schlagworte, grafiken, randnotizen, lebensbalken, logos, sprechblasen, ausblenden, logoH1, outro: { start: input.outroStart, end: ctx.duration, followers: ctx.followers } };
}

// 11: Karte x 150, y 270, Breite 780, Rand 6, Radius 24, Schatten 12, Innenabstand 26/34/22, Titel 34 px, Abstand Titel–Diagramm 12 (Referenz).
function chart22(g, { A, errors }) {
  const c = g.karte, W = 700, plotH = c.hoehe ?? 300, axisY = plotH - 40;
  const height = Math.round(6 + 26 + 34 * 1.2 + 12 + plotH + 22 + 6);
  if (270 + height + 12 > 900) errors.push(`Grafik ${g.id}: Karte samt Schatten bis y ${270 + height + 12} (rechts ab x 930 unter y 900 gesperrt)`);
  if (A(c.titel, 34, 800) > W) errors.push(`Grafik ${g.id}: Titel breiter als 700 px`);
  const x0 = 40, x1 = 660, X = x => x0 + (x - c.xMin) / (c.xMax - c.xMin) * (x1 - x0), Y = y => axisY - y / c.yMax * (axisY - 25);
  const pts = a => a.map(([x, y], i) => `${i ? 'L' : 'M'} ${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join(' ');
  const ticks = c.ticks.map(t => { const w = A(String(t.text), 24, 700); if (X(t.x) - w / 2 < 0 || X(t.x) + w / 2 > W) errors.push(`Grafik ${g.id}: Achsenbeschriftung „${t.text}" ragt aus der Karte`); return `<text x="${X(t.x).toFixed(1)}" y="${axisY + 34}" text-anchor="middle">${esc(t.text)}</text>`; }).join('');
  const legend = (c.legende || []).map((l, i) => { const y = 30 + 44 * i; return (l.art === 'haupt' ? `<line x1="${x0}" y1="${y}" x2="${x0 + 44}" y2="${y}" stroke="${C.ink}" stroke-width="15" stroke-linecap="round"/><line x1="${x0}" y1="${y}" x2="${x0 + 44}" y2="${y}" stroke="${C.blue}" stroke-width="9" stroke-linecap="round"/>` : `<line x1="${x0}" y1="${y}" x2="${x0 + 44}" y2="${y}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 12"/>`) + `<text x="${x0 + 62}" y="${y + 9}">${esc(l.text)}</text>`; }).join('');
  const labels = (c.beschriftungen || []).map((l, i) => { const w = A(l.text, 24, 700), x = X(l.x) + (l.dx || 0); const left = l.anker === 'end' ? x - w : l.anker === 'middle' ? x - w / 2 : x; if (left < 0 || left + w > W) errors.push(`Grafik ${g.id}: Beschriftung „${l.text}" ragt aus der Karte`); return `<text id="${g.id}-b${i}" x="${x.toFixed(1)}" y="${(Y(l.y) + (l.dy || 0)).toFixed(1)}" text-anchor="${l.anker || 'start'}">${esc(l.text)}</text>`; }).join('');
  const hx = X(c.hervorhebung.x), hy = Y(c.hervorhebung.y);
  // Handgezeichneter Kreis um den wichtigen Punkt (Form wie in der Referenz, auf den Punkt verschoben).
  const circle = `M ${hx - 32} ${hy + 25} C ${hx - 46} ${hy - 3} ${hx - 20} ${hy - 29} ${hx + 6} ${hy - 27} C ${hx + 34} ${hy - 25} ${hx + 46} ${hy + 3} ${hx + 34} ${hy + 25} C ${hx + 22} ${hy + 45} ${hx - 12} ${hy + 43} ${hx - 26} ${hy + 27} C ${hx - 34} ${hy + 17} ${hx - 28} ${hy + 1} ${hx - 14} ${hy - 7}`;
  const svg = `<svg width="${W}" height="${plotH}" viewBox="0 0 ${W} ${plotH}" overflow="visible" style="display:block">
<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="${C.ink}" stroke-width="4"/>${ticks}
<path class="cmp-line" d="${pts(c.vergleich)}" fill="none" stroke="${C.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 12"/>
<path class="main-line" d="${pts(c.haupt)}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
<path class="main-line" d="${pts(c.haupt)}" pathLength="1" fill="none" stroke="${C.blue}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
<path class="hl-circle" d="${circle}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
${legend}${labels}</svg>`;
  // 15: Karte Pop 0,35 s; Linie ab 0,3 s nach der Karte (Referenz) in 1,0 s; Vergleichslinie zugleich 0,30 s; Kreis danach 0,30 s.
  const drawAt = g.zeichnenAb ?? r2(g.start + 0.3);
  return { id: g.id, start: g.start, end: g.end, drawAt, cmpAt: g.vergleichAb ?? drawAt, circleAt: g.kreisAb ?? r2(drawAt + 1), title: c.titel, height, svg, person: g.person, labels: (c.beschriftungen || []).map((l, i) => ({ id: `${g.id}-b${i}`, at: l.at })).filter(l => l.at != null) };
}

// 12: Randnotiz. Archivo 800 46 px, Zeilenhöhe 1,3, Kontur 4, Wortabstand +4; Durchstreichen Pink 5 auf Tinte 11, Mitte 54 %,
// 8 px Überstand; alt zu neu 22 px; Zahlen der neuen Zeile Gochi Hand 58 px Blau Kontur 5; Oberkante ≥ 60 px unter der Überschrift, Regel 430.
function note22(n, { A, G, heads, errors, top0 }) {
  const LH = 46 * 1.3;
  const lines = n.zeilen.map((l, j) => {
    const neu = l.streichenAb == null && n.zeilen.slice(0, j).some(x => x.streichenAb != null);
    const parts = neu ? l.text.split(/([+−-]?\d+(?:[.,]\d+)?\s?%?)/) : [l.text];
    const width = parts.reduce((s, p, i) => s + (i % 2 ? G(p, 58) + 10 : A(p, 46, 800, 100, 4) + 8), 0);
    const html = parts.map((p, i) => i % 2 ? `<span class="note-num">${esc(p)}</span>` : escEmoji(p)).join('');
    return { text: l.text, at: l.at, html, width, strikeAt: l.streichenAb ?? null, gapBefore: neu && !n.zeilen[j - 1]?.neu && n.zeilen[j - 1]?.streichenAb != null ? 22 : 0 };
  });
  const width = Math.max(...lines.map(l => l.width)), height = lines.reduce((s, l) => s + LH + l.gapBefore, 0);
  const top = Math.max(430, top0 + 60), hs = heads(n.start, n.end);
  const hl = Math.min(...hs.map(h => h.x)), hr = Math.max(...hs.map(h => h.x + h.w));
  const side = n.seite && n.seite !== 'auto' ? n.seite : (hl - 118 >= 962 - hr ? 'links' : 'rechts');
  const left = side === 'links' ? 108 + 8 : Math.round(Math.min(972 - 8 - width, hr + 30));
  const box = { x: left - 8, y: top, w: width + 16, h: height };
  if (hs.some(h => box.x < h.x + h.w && box.x + box.w > h.x && box.y < h.y + h.h && box.y + box.h > h.y)) errors.push(`Randnotiz ${n.id} (${side}) über Gesicht/Kappe`);
  if (top + height > 1280) errors.push(`Randnotiz ${n.id} reicht bis y ${Math.round(top + height)}`);
  return { id: n.id, start: n.start, end: n.end, left, top, side, lines };
}

// ---------- HTML ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 3: Emojis als Apple-Emoji, eigene Farben, ohne Kontur, so groß wie der umgebende Text.
const escEmoji = s => esc(s).replace(EMOJI, m => `<span class="emoji">${m}</span>`);
const stroke = w => `-webkit-text-stroke:${2 * w}px ${C.ink};paint-order:stroke fill`; // 4: sichtbare Außenbreite w

// opts.vorschau: halbe Auflösung (540 × 960) nur für die Sichtung; der Inhalt wird unverändert mit zoom 0,5 gesetzt.
export function makeDesign22Composition(plan, opts = {}) {
  const { duration, einstieg: e, kapitel = [], h1 = [], h2 = [], pillen = [], akronyme = [], schlagworte = [], grafiken = [], randnotizen = [], lebensbalken = [], logos = [], sprechblasen = [], captions = [], outro } = plan;
  if (!outro || !Number.isInteger(outro.followers) || outro.followers < 0) throw Error('Followerstand fehlt (DESIGN.md 14: follower-source.json).');
  for (const z of plan.zooms || []) if (!(z.scale >= 1.05 && z.scale <= 1.07 && z.end - z.start >= 2 - 1e-6 && z.end - z.start <= 4 + 1e-6)) throw Error('Zoom außerhalb DESIGN.md 15: ' + JSON.stringify(z));
  const clip = (id, a, b, track, kind, extra = '') => `id="${id}" class="clip" data-start="${a}" data-duration="${+(b - a).toFixed(4)}" data-track-index="${track}" data-kind="${kind}"${extra}`;
  const lines = arr => arr.map(l => `<span class="ln">${escEmoji(l)}</span>`).join('');
  const html = [];
  // Grafik: Hintergrund (Off-White + Seigaiha), Karte, Person (eigene Alpha-Ebene) — unter den oberen Texten und Untertiteln.
  const seig = `<svg width="1080" height="1920" style="position:absolute;inset:0"><defs><pattern id="seigaiha" width="80" height="40" patternUnits="userSpaceOnUse"><g fill="${C.off}" stroke="${C.ink}" stroke-width="2.5">${[[40, 0], [0, 20], [80, 20], [40, 40]].map(([x, y]) => [40, 31, 22, 13, 5].map(r => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')).join('')}</g></pattern></defs><rect width="1080" height="1920" fill="${C.off}"/><rect width="1080" height="1920" fill="url(#seigaiha)" opacity="0.12"/></svg>`;
  for (const g of grafiken) html.push(`<div ${clip(g.id + '-bg', g.start, g.end, 10, 'gs-bg')} style="inset:0">${seig}</div>`,
    `<div ${clip(g.id, g.start, g.end, 11, 'grafik')} style="left:150px;top:270px;width:780px;height:${g.height}px"><div class="card"><div class="card-title">${escEmoji(g.title)}</div>${g.svg}</div></div>`,
    ...(g.person ? [] : []), g.person ? `<video id="${g.id}-person" class="clip" src="${g.person}" data-start="${g.start}" data-duration="${+(g.end - g.start).toFixed(4)}" data-track-index="12" data-volume="0" muted playsinline style="position:absolute;inset:0;width:1080px;height:1920px"></video>` : '');
  const top = [];
  top.push(`<div ${clip('einstieg-h1', 0, e.end, 2, 'h1', ' data-einstieg="1"')} style="top:250px;font-size:${e.h1.fontSize}px;opacity:1"><span class="h1" style="visibility:visible">${lines(e.h1.lines)}</span></div>`);
  if (e.h2) top.push(`<div ${clip('einstieg-h2', 0, e.end + 0.06, 3, 'h2', ' data-einstieg="1"')} style="top:${e.h2.top}px;opacity:1"><span class="h2" style="visibility:visible">${lines(e.h2.lines)}</span></div>`);
  for (const k of kapitel) top.push(`<div ${clip(k.id, k.start, k.end, 4, 'kapitel')} style="top:${k.top}px"><span class="kap">${k.nummer ? `<span class="kap-numw" id="${k.id}-num"><span class="kap-num">${esc(k.nummer)}</span></span>` : ''}<span class="kap-title" id="${k.id}-title">${escEmoji(k.titel)}</span></span></div>`);
  for (const h of h1) top.push(`<div ${clip(h.id, h.start, h.end, 2, 'h1')} style="top:250px;font-size:${h.fontSize}px"><span class="h1">${lines(h.lines)}</span></div>`);
  for (const h of h2) top.push(`<div ${clip(h.id, h.start, h.end, 3, 'h2')} style="top:${h.top}px"><span class="h2">${lines(h.lines)}</span></div>`);
  for (const p of pillen) top.push(`<div ${clip(p.id, p.start, p.end, 5, 'pillen', ` data-layout="${p.layout}"`)} style="top:${p.top}px">${p.items.map((it, i) => `<span class="pill-pop" id="${p.id}-${i}"><span class="pill${p.layout === 'row' ? ' pill-row' : ''}" style="${p.layout === 'stack' ? `transform:translateX(${it.dx}px) rotate(${it.rot}deg)` : ''}">${p.layout === 'row' && !p.rowDot ? '' : p.numbered ? `<span class="pill-dot"><span class="pill-no">${i + 1}</span></span>` : '<span class="pill-dot pill-dot-s"></span>'}<span class="pill-text">${escEmoji(it.text)}</span></span></span>`).join('')}</div>`);
  for (const a of akronyme) top.push(`<div ${clip(a.id, a.start, a.end, 6, 'akronym')} style="top:240px"><div class="ak-row">${a.letters.map((l, i) => `<span class="ak-pop" id="${a.id}-p${i}"><span class="ak-letter" id="${a.id}-l${i}" style="transform:rotate(${l.rot}deg)">${esc(l.b)}</span></span>`).join('')}</div><div class="ak-pills" style="top:${a.pillTop - 240}px">${a.letters.map((l, i) => `<span class="ak-pill-pop" id="${a.id}-q${i}"><span class="pill ak-pill"><span class="pill-text">${escEmoji(l.text)}</span></span></span>`).join('')}</div></div>`);
  for (const n of randnotizen) top.push(`<div ${clip(n.id, n.start, n.end, 7, 'randnotiz')} style="left:${n.left}px;top:${n.top}px">${n.lines.map((l, j) => `<div class="note-line" id="${n.id}-l${j}" style="margin-top:${l.gapBefore}px">${l.html}${l.strikeAt != null ? `<svg class="note-strike" id="${n.id}-s${j}" height="20" style="left:-8px;top:calc(54% - 10px);width:calc(100% + 16px)" overflow="visible" preserveAspectRatio="none"><path pathLength="1" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path pathLength="1" fill="none" stroke="${C.pink}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/></svg>` : ''}</div>`).join('')}</div>`);
  for (const b of lebensbalken) top.push(`<div ${clip(b.id, b.start, b.end, 9, 'balken')} style="left:190px;top:${370 - 58}px;width:700px;height:${58 + 26}px">${b.segments.map((s, i) => `<span class="bal-label" id="${b.id}-l${i}" style="left:${s.labelLeft}px">${escEmoji(s.label)}</span>`).join('')}<div class="bal-bed">${b.segments.map((s, i) => `<div class="bal-fill" id="${b.id}-f${i}" style="left:${s.from * 700}px;width:${(s.to - s.from) * 700}px"></div>`).join('')}</div></div>`);
  for (const l of logos) top.push(`<div ${clip(l.id, l.start, l.end, 13, 'logo')} style="top:250px"><img class="logo" src="${esc(l.src)}" style="height:${l.height}px${l.width ? `;width:${l.width}px` : ''}" alt=""></div>`);
  for (const s of schlagworte) top.push(`<div ${clip(s.id, s.start, s.end, 8, 'schlagwort')} style="top:330px"><span class="sw-pop"><span class="sw"><span class="sw-word" style="font-size:${s.fontSize}px">${esc(s.text)}</span><svg class="sw-lines" viewBox="0 0 700 70" preserveAspectRatio="none" style="width:${s.width}px;height:70px" overflow="visible">${[['M 14 30 C 150 12, 300 40, 450 22 S 640 30, 688 16', 22, 12], ['M 60 54 C 210 40, 380 62, 560 46 S 650 50, 672 46', 20, 10]].map(([d, wi, wp], j) => `<path id="${s.id}-u${j}i" d="${d}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="${wi}" stroke-linecap="round" vector-effect="non-scaling-stroke" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path id="${s.id}-u${j}p" d="${d}" pathLength="1" fill="none" stroke="${C.pink}" stroke-width="${wp}" stroke-linecap="round" vector-effect="non-scaling-stroke" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>`).join('')}</svg></span></span></div>`);
  const caps = captions.map((c, i) => `<div ${clip('cap-' + i, c.start, c.end, 20, 'caption')} style="top:1280px"><span class="cap-line">${c.words.map((w, j) => `<span id="w-${i}-${j}">${escEmoji(w.text)}</span>`).join(' ')}</span></div>`).join('');
  const bubbles = sprechblasen.map(b => `<div ${clip(b.id, b.start, b.start + 4.25, 22, 'bubble')} style="left:90px;top:${b.top}px"><div class="grp" id="${b.id}-grp"><div class="msg-pop" id="${b.id}-msg"><div class="msg">${escEmoji(b.text)}</div></div><div class="ind-slide" id="${b.id}-slide"><div class="ind-pop" id="${b.id}-ind"><div class="ind">${[0, 1, 2].map(k => `<i id="${b.id}-d${k}"></i>`).join('')}</div></div></div></div></div>`).join('');
  const profiles = [['youtube', '@itsabidullahabi'], ['tiktok', '@abidullahabi'], ['instagram', '@abidullahabi'], ['linkedin', 'Abdullah Bachtari']];
  const outroHtml = `<div ${clip('follow', outro.start, outro.end, 21, 'follow')} style="top:250px"><span class="follow">Folgen nicht vergessen</span></div>
<div ${clip('outro-card', outro.start, outro.end, 21, 'outro-card')} style="left:90px;top:${1660 - 237}px;width:700px;height:237px"><div class="oc"><div class="oc-head"><span class="oc-count">${Array.from({ length: 43 }, (_, i) => `<span id="cnt-${i}" class="cnt">0</span>`).join('')}</span><span class="oc-goal">Ziel 10.000</span></div><div class="oc-bed"><div id="oc-fill" class="oc-fill"></div></div><div class="oc-grid">${profiles.map(([p, n]) => `<div class="oc-p" data-platform="${p}"><span class="oc-icon"><img src="assets/tile-${p}.png" width="34" height="34" alt="${p}"></span><span class="oc-handle">${esc(n)}</span></div>`).join('')}</div></div></div>`;

  const css = `
@font-face{font-family:"ABI Archivo";src:url("assets/fonts/Archivo[wdth,wght].ttf") format("truetype");font-weight:100 900;font-stretch:62% 125%;font-style:normal;font-display:block}
@font-face{font-family:"ABI Gochi";src:url("assets/fonts/GochiHand-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:"Apple Color Emoji";src:local("Apple Color Emoji")}
*{box-sizing:border-box}html,body{margin:0;background:${C.ink}}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;color:${C.white};font-family:"ABI Archivo";font-synthesis:none}
#footage{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;transform-origin:42% 28%}
.clip[data-kind]{position:absolute}
.clip[data-kind]>*{visibility:hidden}
[data-kind=h1],[data-kind=h2],[data-kind=kapitel],[data-kind=schlagwort],[data-kind=caption],[data-kind=follow],[data-kind=logo],[data-kind=akronym]{line-height:0}
[data-kind]>span,[data-kind]>img{vertical-align:top}
#top{position:absolute;inset:0;clip-path:polygon(90px 250px,1024px 250px,1024px 900px,930px 900px,930px 1660px,90px 1660px)}
#root .emoji{font-family:"Apple Color Emoji"!important;-webkit-text-stroke:0;paint-order:normal;font-size:1em;line-height:1;font-weight:400;font-stretch:100%;color:initial}
[data-kind=h1],[data-kind=h2],[data-kind=kapitel],[data-kind=pillen],[data-kind=akronym],[data-kind=schlagwort],[data-kind=caption],[data-kind=follow],[data-kind=logo]{left:0;width:1080px;text-align:center}
.h1{display:inline-block;font-weight:900;font-stretch:125%;text-transform:uppercase;line-height:1.02;white-space:nowrap;${stroke(8)}}.h1 .ln,.h2 .ln{display:block}
.h2{display:inline-block;background:${C.blue};font-weight:800;font-size:58px;line-height:1.12;padding:8px 28px 14px;border-radius:12px;transform:rotate(-2deg);white-space:nowrap}
.kap{display:inline-flex;align-items:center;gap:28px;white-space:nowrap}
.kap-numw{display:inline-block}.kap-num{display:inline-block;font-family:"ABI Gochi";font-size:140px;line-height:1;color:${C.blue};${stroke(7)};transform:rotate(-4deg)}
.kap-title{display:inline-block;font-weight:900;font-size:64px;line-height:1.1;word-spacing:6px;${stroke(6)}}
[data-kind=pillen]{display:flex;flex-direction:column;align-items:center;gap:20px}[data-kind=pillen][data-layout=row]{flex-direction:row;justify-content:center;gap:16px}
.pill-pop{display:inline-block}
.pill{display:inline-flex;align-items:center;gap:14px;padding:8px 32px 10px 12px;border:5px solid ${C.white};border-radius:999px;box-shadow:0 0 0 3px ${C.ink},inset 0 0 0 3px ${C.ink};white-space:nowrap}
.pill-dot{width:56px;height:56px;flex:0 0 56px;border-radius:50%;background:${C.blue};border:3px solid ${C.ink};display:inline-flex;align-items:center;justify-content:center}.pill-dot-s{width:26px;height:26px;flex-basis:26px}
.pill-no{font-family:"ABI Gochi";font-size:48px;line-height:1;color:${C.ink}}
.pill-text{font-weight:800;font-size:54px;line-height:1.1;${stroke(5)}}.pill-row .pill-text{font-size:42px}
.pill-row{gap:11px}.pill-row .pill-dot{width:44px;height:44px;flex-basis:44px}.pill-row .pill-dot-s{width:20px;height:20px;flex-basis:20px}.pill-row .pill-no{font-size:37px}.ak-pill .pill-text{font-size:46px}
.ak-row{display:flex;justify-content:center;align-items:flex-end;gap:64px}.ak-letter{display:inline-block;font-family:"ABI Gochi";font-size:230px;line-height:.95;${stroke(8)}}
.ak-pills{position:absolute;left:0;width:1080px;display:grid;justify-items:center}.ak-pill-pop{grid-area:1/1;display:inline-block;opacity:0}.ak-pill{transform:rotate(-2deg)}
.sw-pop{display:inline-block}.sw{display:inline-flex;flex-direction:column;align-items:center;transform:rotate(-3deg)}
.sw-word{font-weight:900;font-stretch:125%;text-transform:uppercase;line-height:1.02;white-space:nowrap;${stroke(9)}}.sw-lines{display:block;margin-top:-6px}
[data-kind=randnotiz]{font-weight:800;font-size:46px;line-height:1.3;word-spacing:4px;${stroke(4)};text-align:left}
.note-line{position:relative;width:max-content;white-space:nowrap}.note-strike{position:absolute}
.note-num{font-family:"ABI Gochi";font-size:58px;line-height:1;color:${C.blue};${stroke(5)};margin-right:10px}
.bal-bed{position:absolute;left:0;top:58px;width:700px;height:26px;border-radius:13px;background:${C.off};box-shadow:0 0 0 3px ${C.ink};overflow:hidden}
.bal-fill{position:absolute;top:0;height:100%;background:${C.blue};transform-origin:0 50%;transform:scaleX(0)}
.bal-label{position:absolute;top:0;font-weight:800;font-size:40px;line-height:1.2;${stroke(5)};white-space:nowrap}
.logo{display:inline-block}
[data-kind=grafik]{transform-origin:50% 50%}
.card{width:780px;height:100%;padding:26px 34px 22px;background:${C.white};border:6px solid ${C.ink};border-radius:24px;box-shadow:12px 12px 0 ${C.ink};color:${C.ink};display:flex;flex-direction:column;gap:12px}
.card-title{font-weight:800;font-size:34px;line-height:1.2;white-space:nowrap}
.card text{font-family:"ABI Archivo";font-weight:700;font-size:24px;fill:${C.ink}}
.cap-line{display:inline-block;font-weight:800;font-size:64px;line-height:1.12;white-space:nowrap;${stroke(6)}}.cap-line>span{color:${C.white}}
.follow{display:inline-block;font-weight:800;font-size:50px;line-height:1.15;white-space:nowrap;${stroke(5)}}
[data-kind=outro-card]{transform-origin:0 100%}
.oc{width:700px;height:237px;padding:22px;background:${C.card};border-radius:20px;display:flex;flex-direction:column;color:${C.cardText};font-weight:700}
.oc-head{display:flex;justify-content:space-between;align-items:baseline}.oc-count{position:relative;display:block;width:200px;height:36px;font-size:36px;line-height:1;font-variant-numeric:tabular-nums}.cnt{position:absolute;left:0;top:0;visibility:hidden}.cnt:first-child{visibility:inherit}
.oc-goal{font-size:26px;line-height:1;color:${C.cardMuted}}
.oc-bed{position:relative;margin-top:12px;height:19px;border-radius:10px;background:${C.cardBed};overflow:hidden}.oc-fill{position:absolute;inset:0;border-radius:10px;background:${C.blue};transform-origin:0 50%;transform:scaleX(0)}
.oc-grid{margin-top:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));row-gap:13px;column-gap:16px}.oc-p{display:flex;align-items:center;gap:12px;font-size:25px;line-height:1;white-space:nowrap}
.oc-icon{width:34px;height:34px;flex:0 0 34px;border-radius:7px;overflow:hidden}.oc-icon img{display:block;width:34px;height:34px}
.grp{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.msg-pop,.ind-pop{transform-origin:0 100%}
.msg{max-width:620px;padding:12px 20px 14px;border-radius:22px 22px 22px 6px;background:${C.blue};border:4px solid ${C.ink};box-shadow:6px 6px 0 ${C.ink};font-weight:800;font-size:36px;line-height:1.2;white-space:nowrap}
.ind{display:flex;gap:9px;align-items:center;padding:16px 20px;border-radius:22px 22px 22px 6px;background:${C.white};border:4px solid ${C.ink};box-shadow:6px 6px 0 ${C.ink}}
.ind i{width:12px;height:12px;border-radius:50%;background:${C.ink};display:block}.ind i:nth-child(2){opacity:.55}.ind i:nth-child(3){opacity:.3}
`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(plan.title || 'Video')}</title><style>${css}</style><script src="vendor/gsap.min.js"></script></head><body>
<main id="root" data-composition-id="root" data-width="${opts.vorschau ? 540 : 1080}" data-height="${opts.vorschau ? 960 : 1920}" data-fps="30" data-duration="${duration}"${opts.vorschau ? ' style="zoom:.5"' : ''}>
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
<audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
${html.join('\n')}
<div id="top">${top.join('\n')}</div>
${caps}
${outroHtml}
${bubbles}
</main><script>${timeline22(plan)}</script></body></html>`;
}

function timeline22(plan) {
  const D = { e: plan.einstieg, k: plan.kapitel || [], h1: plan.h1 || [], h2: plan.h2 || [], p: plan.pillen || [], a: plan.akronyme || [], s: plan.schlagworte || [], g: plan.grafiken || [], n: plan.randnotizen || [], b: plan.lebensbalken || [], l: plan.logos || [], sb: plan.sprechblasen || [], c: plan.captions || [], z: plan.zooms || [], o: plan.outro, hide: plan.ausblenden || [], logoH1: plan.logoH1 || [] };
  return `
function bezier(x1,y1,x2,y2){const f=(s,a,b)=>3*(1-s)*(1-s)*s*a+3*(1-s)*s*s*b+s*s*s;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(f(m,x1,x2)<x)lo=m;else hi=m;}return f((lo+hi)/2,y1,y2);};}
const OUT=bezier(${EASE.out}),BACK=bezier(${EASE.back}),LIN='none',D=${JSON.stringify(D)};
const tl=gsap.timeline({paused:true});tl.to({},{duration:${plan.duration}});
// Sichtbarkeit am Inhalt des Clips; den Clip selbst verwaltet HyperFrames.
const show=(s,a,b)=>{const c=s+' > *';tl.set(c,{visibility:'visible'},a);tl.set(c,{visibility:'hidden'},b);};
const out=(s,end)=>tl.to(s,{opacity:0,y:-8,duration:.18,ease:LIN},end-.18);           // 15: Ausblenden 0,18 s, Linear, 8 px nach oben
const up=(s,at,dy=14)=>{tl.set(s,{opacity:0,y:dy},0);tl.fromTo(s,{opacity:0,y:dy},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},at);};
const pop=(s,at,from,dur)=>{tl.set(s,{opacity:0,scale:from},0);tl.set(s,{opacity:1},at);tl.fromTo(s,{scale:from},{scale:1,duration:dur,ease:BACK,immediateRender:false},at);};
const wipe=(s,at,dur,m)=>{tl.set(s,{clipPath:'inset(-'+m+'px 100% -'+m+'px -'+m+'px)'},0);tl.fromTo(s,{clipPath:'inset(-'+m+'px 100% -'+m+'px -'+m+'px)'},{clipPath:'inset(-'+m+'px -'+m+'px -'+m+'px -'+m+'px)',duration:dur,ease:OUT,immediateRender:false},at);};
// Zeichnen über das SVG-Attribut: GSAP rundet die CSS-Eigenschaft strokeDashoffset auf ganze Pixel, bei pathLength 1
// sprang jede Linie dadurch von unsichtbar auf fertig (Fast 30, 27.09.2026: Durchstreichen und ETF-Linie „zu schnell“).
const draw=(s,at,dur)=>tl.to(s,{attr:{'stroke-dashoffset':0},duration:dur,ease:OUT},at);
// 5: Einstieg steht ab dem ersten Bild; H1 blendet aus, H2 0,06 s später.
show('#einstieg-h1',0,D.e.end);out('#einstieg-h1',D.e.end);if(D.e.h2){show('#einstieg-h2',0,D.e.end+.06);out('#einstieg-h2',D.e.end+.06);}
// 15: H1 im Video Stoß 112 → 100 %, 0,22 s (Referenz h1in: zugleich Deckkraft 0 → 1).
for(const h of D.h1){show('#'+h.id,h.start,h.end);tl.set('#'+h.id+' .h1',{opacity:0,scale:1.12},0);tl.fromTo('#'+h.id+' .h1',{opacity:0,scale:1.12},{opacity:1,scale:1,duration:.22,ease:OUT,immediateRender:false},h.start);out('#'+h.id,h.end);}
// 15: H2 wischt in 0,28 s von links auf; 0,06 s nach einer gleichzeitig beginnenden H1.
for(const h of D.h2){const at=h.start+(D.h1.some(x=>Math.abs(x.start-h.start)<.01)?.06:0);show('#'+h.id,h.start,h.end);wipe('#'+h.id+' .h2',at,.28,20);out('#'+h.id,h.end);}
// 15: Kapitel. Zahl schreibt sich von links (Maske) 0,40 s, Titel ab 0,35 s von unten 0,22 s.
for(const k of D.k){show('#'+k.id,k.start,k.end);if(k.nummer)wipe('#'+k.id+'-num',k.start,.4,40);up('#'+k.id+'-title',k.start+(k.nummer?.35:0));out('#'+k.id,k.end);}
// 15: Pillen einzeln am Wort, Pop 80 → 100 %, 0,30 s, Abfedern; bleiben bis Kapitelende.
for(const p of D.p){show('#'+p.id,p.start,p.end);p.items.forEach((it,i)=>pop('#'+p.id+'-'+i,it.at,.8,.3));out('#'+p.id,p.end);}
// 15: Akronym. Buchstaben Pop 55 → 100 %, 0,30 s, je 0,08 s versetzt; aktiver Buchstabe hart blau; neue Pille Pop 0,30 s, alte vorher 0,10 s aus.
for(const a of D.a){show('#'+a.id,a.start,a.end);a.letters.forEach((l,i)=>{pop('#'+a.id+'-p'+i,a.start+.08*i,.55,.3);const next=a.letters[i+1];tl.set('#'+a.id+'-l'+i,{color:'${C.blue}'},l.at);if(next)tl.set('#'+a.id+'-l'+i,{color:'${C.white}'},next.at);
 const q='#'+a.id+'-q'+i;tl.set(q,{opacity:0,scale:.8},0);tl.set(q,{opacity:1},l.at);tl.fromTo(q,{scale:.8},{scale:1,duration:.3,ease:BACK,immediateRender:false},l.at);if(next)tl.to(q,{opacity:0,duration:.1,ease:LIN},next.at-.1);});out('#'+a.id,a.end);}
// 15: Randnotiz. Zeile am Wort 14 px von unten 0,22 s; Durchstreichen 0,28 s von links, jede weitere Zeile 0,10 s später.
function strikePaths(){document.querySelectorAll('.note-strike').forEach(svg=>{const w=svg.getBoundingClientRect().width||svg.parentElement.offsetWidth+16;svg.setAttribute('viewBox','0 0 '+w+' 20');const d='M 2 12 C '+(w*.22).toFixed(1)+' 7, '+(w*.48).toFixed(1)+' 14, '+(w*.72).toFixed(1)+' 9 S '+(w*.94).toFixed(1)+' 11, '+(w-2).toFixed(1)+' 7';svg.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));});}
strikePaths();if(document.fonts)document.fonts.ready.then(strikePaths);
for(const n of D.n){show('#'+n.id,n.start,n.end);let k=0;n.lines.forEach((l,j)=>{up('#'+n.id+'-l'+j,l.at);if(l.strikeAt!=null)draw('#'+n.id+'-s'+j+' path',l.strikeAt+.1*k++,.28);});out('#'+n.id,n.end);}
// 15: Lebensbalken. Abschnitt füllt sich in 1,0 s; Beschriftung wie Randnotiz-Zeile.
for(const b of D.b){show('#'+b.id,b.start,b.end);up('#'+b.id+' .bal-bed',b.start);b.segments.forEach((s,i)=>{up('#'+b.id+'-l'+i,s.at);tl.to('#'+b.id+'-f'+i,{scaleX:1,duration:1,ease:OUT},s.at);});out('#'+b.id,b.end);}
// 15: Logo. Wischblende von links 0,28 s, Ausblenden 0,22 s in gleicher Richtung; H1/Kapitel 0,1 s vorher aus, 0,1 s danach wieder an.
for(const l of D.l){show('#'+l.id,l.start,l.end);wipe('#'+l.id+' .logo',l.start,.28,0);tl.to('#'+l.id+' .logo',{clipPath:'inset(0px 0px 0px 100%)',duration:.22,ease:LIN},l.end-.22);}
for(const x of D.logoH1){tl.to(x.sel,{opacity:0,duration:.1,ease:LIN},x.out);tl.to(x.sel,{opacity:1,duration:.1,ease:LIN},x.in);}
// 10: Schlagwort. Stoßzoom hart auf 112 % (Ursprung 42/28), Wort Pop 55 → 100 % 0,30 s; Striche ab 0,25 s, je 0,25 s, der zweite 0,15 s später (Referenz).
for(const s of D.s){show('#'+s.id,s.start,s.end);pop('#'+s.id+' .sw-pop',s.start,.55,.3);draw(['#'+s.id+'-u0i','#'+s.id+'-u0p'],s.start+.25,.25);draw(['#'+s.id+'-u1i','#'+s.id+'-u1p'],s.start+.4,.25);tl.set('#footage',{scale:1.12},s.start);tl.set('#footage',{scale:1},s.end);out('#'+s.id,s.end);}
// Ausblenden anderer oberer Ebenen während Schlagwort und Grafik (über die Sichtbarkeit, Deckkraft-Animationen bleiben unberührt).
for(const h of D.hide){tl.set(h.sel+' > *',{visibility:'hidden'},h.from);if(h.to!=null)tl.set(h.sel+' > *',{visibility:'visible'},h.to);}
// 15: Grafik. Karte Pop 90 → 100 % 0,35 s; Hauptlinie 1,0 s; Vergleichslinie blendet 0,30 s ein; Kreis danach 0,30 s.
for(const g of D.g){show('#'+g.id+'-bg',g.start,g.end);show('#'+g.id,g.start,g.end);pop('#'+g.id,g.start,.9,.35);draw('#'+g.id+' .main-line',g.drawAt,1);tl.set('#'+g.id+' .cmp-line',{opacity:0},0);tl.to('#'+g.id+' .cmp-line',{opacity:1,duration:.3,ease:OUT},g.cmpAt);draw('#'+g.id+' .hl-circle',g.circleAt,.3);for(const x of g.labels){tl.set('#'+x.id,{opacity:0},0);tl.to('#'+x.id,{opacity:1,duration:.22,ease:OUT},x.at);}}
// 7: Untertitel hart; genau ein Wort blau; das letzte bleibt blau, bis die nächste Gruppe beginnt.
D.c.forEach((c,i)=>{show('#cap-'+i,c.start,c.end);c.words.forEach((w,j)=>{const on=j?w.start:c.start,off=j<c.words.length-1?c.words[j+1].start:c.end;tl.set('#w-'+i+'-'+j,{color:'${C.blue}'},on);tl.set('#w-'+i+'-'+j,{color:'${C.white}'},off);});});
// 15: Zoomfahrten, nur Videoebene, linear, harter Rücksprung.
for(const z of D.z){tl.set('#footage',{scale:1},z.start);tl.to('#footage',{scale:z.scale,duration:z.end-z.start,ease:LIN},z.start);tl.set('#footage',{scale:1},z.end);}
// 15: Sprechblase, 4,25 s. Tippen ploppt auf (0,25 s, 70 → 100 %), Punkte laufen (Zyklus 0,9 s, 35 → 100 %), Nachricht ab 1,75 s
// (0,80 s, 82 → 103 → 100 %, Deckkraft 60 → 100 %), Anzeige rutscht 0,35 s nach unten, beide ab 4,00 s in 0,25 s aus (10 px nach oben).
for(const b of D.sb){const s=b.start;show('#'+b.id,s,s+4.25);tl.set('#'+b.id+'-ind',{opacity:0,scale:.7},0);tl.set('#'+b.id+'-ind',{opacity:1},s);tl.fromTo('#'+b.id+'-ind',{scale:.7},{scale:1,duration:.25,ease:BACK,immediateRender:false},s);
 const msgH=document.getElementById(b.id+'-msg').offsetHeight+14;tl.set('#'+b.id+'-slide',{y:-msgH},0);tl.to('#'+b.id+'-slide',{y:0,duration:.35,ease:OUT},s+1.75);
 for(let k=0;k<3;k++){tl.set('#'+b.id+'-d'+k,{opacity:.35},s);for(let t=s+.25+k*.3;t<s+4;t+=.9){tl.to('#'+b.id+'-d'+k,{opacity:1,duration:.45,ease:'sine.inOut'},t);tl.to('#'+b.id+'-d'+k,{opacity:.35,duration:.45,ease:'sine.inOut'},t+.45);}}
 tl.set('#'+b.id+'-msg',{opacity:0,scale:.82},0);tl.set('#'+b.id+'-msg',{opacity:.6},s+1.75);tl.to('#'+b.id+'-msg',{opacity:1,duration:.8,ease:BACK},s+1.75);tl.fromTo('#'+b.id+'-msg',{scale:.82},{scale:1.03,duration:.48,ease:BACK,immediateRender:false},s+1.75);tl.to('#'+b.id+'-msg',{scale:1,duration:.32,ease:BACK},s+2.23);
 tl.to('#'+b.id+'-grp',{opacity:0,y:-10,duration:.25,ease:LIN},s+4);}
// 15: Outro. Folgen 0,22 s von unten; Karte ab 0,15 s Pop 88 → 100 % 0,45 s (Ursprung unten links); Balken und Zähler ab 0,45 s 1,40 s synchron.
{const o=D.o;show('#follow',o.start,o.end);show('#outro-card',o.start,o.end);up('#follow .follow',o.start);pop('#outro-card',o.start+.15,.88,.45);
 for(let i=0;i<=42;i++){const f=OUT(i/42),at=o.start+.45+1.4*i/42;document.getElementById('cnt-'+i).textContent=(i===42?o.followers:Math.round(o.followers*f)).toLocaleString('de-DE');tl.set('#cnt-'+i,{visibility:'visible'},at);if(i)tl.set('#cnt-'+(i-1),{visibility:'hidden'},at);tl.set('#oc-fill',{scaleX:Math.min(1,o.followers/10000)*f},at);}}
window.__timelines={root:tl};
`;
}
