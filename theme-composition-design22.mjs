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
  // Oberste Tintenkante einer Zeile (Umlautpunkte, Akzente) relativ zur Zeilenoberkante bei Zeilenhöhe lh.
  const inkTop = (t, size, lh, w = 900, wd = 125) => { const f = face(w, wd), u = f.unitsPerEm; let y = 0; for (const g of f.layout(t.replace(EMOJI, '')).glyphs) y = Math.max(y, g.bbox.maxY);
    return (lh * size - (f.ascent - f.descent) / u * size) / 2 + f.ascent / u * size - y / u * size; };
  return { A, G, inkTop };
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

// 15: Höchster Maßstab beim Pop des Schlagworts (55 → 100 %, Abfedern): 0,55 + 0,45 · max y(Kurve) ≈ 1,045, mit Reserve für die Drehung −3°.
const SW_UEBERSCHWINGEN = 1.06;

// ---------- Layout ----------
// ctx: { measure, heads(a,b) → [{x,y,w,h}], errors, notes, duration, followers }
export function layoutDesign22(input, ctx) {
  const { A, G, inkTop } = ctx.measure, errors = ctx.errors, notes = ctx.notes, heads = ctx.heads;
  const hits = (b, a, e) => heads(a, e).filter(h => b.x < h.x + h.w && b.x + b.w > h.x && b.y < h.y + h.h && b.y + b.h > h.y);
  // 6: H1 so groß wie möglich, höchstens 160 px, Zeile inkl. Kontur ≤ 864 px; unter 90 px zwei Zeilen gleich groß.
  // H1 im Video startet mit einem Stoß von 112 % (DESIGN.md 15): dann auch im ersten Bild ≤ 864 px, also für 112 % bemessen.
  const h1Fit = (text, stoss = 1) => {
    const t = upper(text), size = l => Math.min(160, Math.floor((864 - 16) / stoss / A(l, 1, 900, 125)));
    if (size(t) >= 90) return { lines: [t], fontSize: size(t) };
    let best = null; const w = t.split(' ');
    for (let i = 1; i < w.length; i++) { const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')]; const s = Math.min(...l.map(size)); if (!best || s > best.fontSize) best = { lines: l, fontSize: s }; }
    if (!best) errors.push(`H1 passt nicht in 864 px: ${text} (Trennung an Silbengrenze im Plan angeben)`);
    return best;
  };
  const h1H = h => h.lines.length * h.fontSize * 1.02;
  // DESIGN.md 2/5/6: Oberkante 250 ist die sichtbare Kante. Ragen Umlautpunkte samt Kontur (8 px) der ersten Zeile über die Zeilenbox
  // (z. B. „BÜCHER“ bei 100 px: 12 px über y = 250, Designprüfung 04.10.2026), rückt die H1 um diesen Betrag nach unten
  // (bei der H1 im Video für den Stoß von 112 %). Ohne Überstand bleibt alles wie bisher (kein Feld, bytegleiche Komposition).
  const versatz = (h, stoss = 1) => { if (!inkTop) return 0; const d = 8 - inkTop(h.lines[0], h.fontSize, 1.02); return d > 0 ? Math.ceil(d * stoss) + 1 : 0; };
  const mitVersatz = (h, stoss) => { const v = versatz(h, stoss); return v ? { ...h, versatz: v } : h; };
  const h2Chk = (id, lines) => { if (lines.length > 2) errors.push(`H2 ${id}: mehr als zwei Zeilen`); for (const l of lines) if (A(l, 58, 800) + 56 > 780) errors.push(`H2 ${id} breiter als 780 px: ${l}`); };
  const h2H = lines => lines.length * 58 * 1.12 + 22;

  // 5: Einstieg
  const e = input.einstieg, eh1 = mitVersatz(h1Fit(e.h1));
  const einstieg = { h1: eh1, end: e.end };
  if (e.h2?.length) { h2Chk('einstieg', e.h2); einstieg.h2 = { lines: e.h2, top: Math.round(250 + (eh1.versatz || 0) + h1H(eh1) + 24) }; }
  // Plan-Option einstieg.logo {datei, hoehe, breite, karte} (Abdullahs Wunsch 12.10.2026, HHU Rating: „Rating HHU, aber wirklich
  // das Logo rein“): Logo neben der Einstiegs-H2 in einer Reihe (Abstand 24 px), die Reihe als Gruppe auf x = 540. Ohne H2 steht
  // es 24 px unter der H1. karte: true setzt es auf eine weiße Fläche mit Rand und hartem Schatten wie die Sprechblase
  // (Rand Tinte 4, Radius 12, Schatten 6, Innenabstand 6/12), damit ein farbiges Logo auf unruhigem Hintergrund lesbar bleibt.
  if (e.logo) {
    const l = e.logo, kw = l.karte ? 2 * (12 + 4) : 0, kh = l.karte ? 2 * (6 + 4) : 0;
    if (!l.datei?.startsWith('assets/') || /\s/.test(l.datei)) errors.push(`Einstiegslogo: datei muss unter assets/ liegen und darf keine Leerzeichen enthalten: ${l.datei}`);
    const boxW = l.breite + kw, boxH = l.hoehe + kh, h2w = einstieg.h2 ? Math.max(...e.h2.map(t => A(t, 58, 800))) + 56 : 0;
    const rowW = (einstieg.h2 ? h2w + 24 : 0) + boxW + (l.karte ? 6 : 0);
    if (rowW > 864) errors.push(`Einstieg: H2 und Logo zusammen breiter als 864 px (${Math.round(rowW)})`);
    const rowTop = einstieg.h2 ? einstieg.h2.top : Math.round(250 + (eh1.versatz || 0) + h1H(eh1) + 24);
    const rowH = Math.max(einstieg.h2 ? h2H(e.h2) : 0, boxH);
    const dy = einstieg.h2 ? Math.round((h2H(e.h2) - boxH) / 2) : 0;
    const hb = hits({ x: 540 - rowW / 2, y: rowTop, w: rowW, h: rowH + (l.karte ? 6 : 0) }, 0, e.end);
    if (hb.length) ctx.warnings.push(`Einstiegslogo berührt Kopf/Kappe (${hb.length} Stichproben)`);
    einstieg.logo = { src: l.datei, height: l.hoehe, width: l.breite, karte: !!l.karte, top: rowTop, dy };
  }

  // 8: Kapitel. Gruppenhöhe = Zahl 140 px (Zeilenhöhe 1). Mit Pillen Oberkante 270, sonst 300.
  const KAP_H = 140;
  const kapitel = (input.kapitel || []).map(k => {
    if (k.buch) return buch22(k, { A, G, errors, notes, warnings: ctx.warnings, hits });
    const w = (k.nummer ? G(k.nummer, 140) + 14 + 28 : 0) + A(k.titel, 64, 900, 100, 6) + 12;
    if (w > 864) errors.push(`Kapitel ${k.id} breiter als 864 px (${Math.round(w)}): ${k.nummer || ''} ${k.titel}`);
    const pills = (input.pillen || []).some(p => p.kapitel === k.id);
    // Unterkante der Kapitelgruppe = Layoutbox der Gruppe (Zahl mit Zeilenhöhe 1); die Drehung −4° ist nur Darstellung.
    return { id: k.id, nummer: k.nummer || null, titel: k.titel, start: k.start, end: k.end, top: pills ? 270 : 300, height: k.nummer ? KAP_H : Math.round(64 * 1.1) };
  });
  for (let i = 1; i < kapitel.length; i++) if (kapitel[i].start < kapitel[i - 1].end - 1e-6) errors.push(`Kapitel überlappen: ${kapitel[i - 1].id} / ${kapitel[i].id}`);
  const kapById = id => kapitel.find(k => k.id === id);

  // 17 (Test, Abi 19.10.2026): Selbstkommentar im Vlog. Gestalt wie die H1 (Archivo 900, 125 %, Großbuchstaben, Weiß mit Tintenkontur),
  // aber in H2-Größe 58 px und Kontur 5 px; höchstens zwei Zeilen (zeilen im Plan), jede Zeile samt Kontur ≤ 864 px.
  const h1 = (input.h1 || []).map(h => {
    if (!h.groesse) return { id: h.id, ...mitVersatz(h1Fit(h.text, 1.12), 1.12), start: h.start, end: h.end };
    const lines = (h.zeilen || [h.text]).map(upper);
    if (lines.length > 2) errors.push(`Kommentar ${h.id}: höchstens zwei Zeilen`);
    for (const l of lines) if (A(l, h.groesse, 900, 125) * 1.12 + 10 > 864) errors.push(`Kommentar ${h.id} breiter als 864 px: ${l}`);
    return { id: h.id, lines, fontSize: h.groesse, klein: true, start: h.start, end: h.end };
  });

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
    } else if (u.startsWith('h1:')) { const x = h1.find(x => x.id === u.slice(3)); top = 250 + (x.versatz || 0) + h1H(x) + 24; }
    else if (kapitel.some(k => k.start < h.end && k.end > h.start)) errors.push(`H2 ${h.id} „allein" bei y 250, während ein Kapitel läuft`);
    const w = Math.max(...h.lines.map(l => A(l, 58, 800))) + 56;
    // H2 allein bei y = 250: Die Drehung um −2° hebt die linke Ecke um (w/2)·sin 2° an; sonst ragte sie in die gesperrte
    // Zone über y = 250 (DESIGN.md 20.3, Befund der Prüfung). Die gedrehte Fläche beginnt deshalb genau bei 250.
    if (u === 'allein') top = 250 + Math.ceil((w / 2) * Math.sin(Math.PI / 90) + (h2H(h.lines) / 2) * (1 - Math.cos(Math.PI / 90)));
    const hb = hits({ x: 540 - w / 2, y: top, w, h: h2H(h.lines) }, h.start, end);
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
    // Pop 55 → 100 % mit Abfedern schwingt auf etwa 104,5 % über (Kurve 0,34/1,56/0,64/1); DESIGN.md 2 gilt auch während der Animation.
    // Seit 12.10.2026 deshalb für den Höchststand bemessen (Befund HHU Rating: „NORMAL“ 893 px breit und links bei x 87).
    const t = upper(s.wort), size = Math.min(160, Math.floor((864 - 18) / SW_UEBERSCHWINGEN / A(t, 1, 900, 125)));
    if (size < 120) errors.push(`Schlagwort zu lang für 120 px: ${t}`);
    const d = s.end - s.start; if (d < 0.8 - 1e-6 || d > 1.3 + 1e-6) errors.push(`Schlagwort ${s.id}: Standzeit ${d.toFixed(2)} s`);
    return { id: s.id, text: t, fontSize: size, width: Math.round(A(t, size, 900, 125)), start: s.start, end: s.end };
  });
  if (schlagworte.length > 2) errors.push('Schlagwort höchstens zweimal pro Video (DESIGN.md 1)');

  // 11: Grafik mit Green Screen.
  const grafiken = (input.grafiken || []).map(g => g.karte?.art === 'bewertung' ? bewertung22(g, { A, errors }) : chart22(g, { A, errors }));
  // Grafik ohne Green Screen (hintergrund: false, ohne person): Karte über dem Kamerabild, darf Kopf und Kappe nicht berühren.
  for (const g of grafiken.filter(g => g.ohneHintergrund && !g.person)) { const hb = hits({ x: 150, y: 270, w: 792, h: g.height + 12 }, g.start, g.end); if (hb.length) errors.push(`Grafik ${g.id} ohne Green Screen verdeckt Kopf/Kappe (Kopf ab y ${Math.round(Math.min(...hb.map(h => h.y)))}): Karte kürzen oder person setzen`); }

  // 12: Randnotiz.
  const kapBottom = t => { const k = kapitel.find(k => k.start <= t && t < k.end); const x = h1.find(k => k.start <= t && t < k.end); return k ? k.top + k.height : x ? 250 + (x.versatz || 0) + h1H(x) : t < einstieg.end ? 250 + (eh1.versatz || 0) + h1H(eh1) : 250; };
  const randnotizen = (input.randnotizen || []).map(n => note22(n, { A, G, heads, errors, top0: kapBottom(n.start + 0.01) }));

  // 13: Lebensbalken 700 × 26, zentriert, Oberkante 370; Beschriftung 40 px über dem Abschnitt.
  const lebensbalken = (input.lebensbalken || []).map(b => ({ id: b.id, start: b.start, end: b.end, segments: b.abschnitte.map(s => { const w = A(s.beschriftung, 40, 800) + 10, mid = (s.von + s.bis) / 2 * 700; return { from: s.von, to: s.bis, label: s.beschriftung, at: s.at, labelLeft: Math.round(Math.max(0, Math.min(700 - w, mid - w / 2))) }; }), ...(b.trenner ? { trenner: true } : {}) }));

  // 14: Logo ersetzt die H1 an der H1-Position; eine H2 bleibt stehen.
  // 14: Logo-Einblendung. Standard: allein an der H1-Position und ersetzt die H1. Option `unter: "kapitel:<id>"` (Abdullahs Wunsch
  // 27.09.2026): unter der Kapitelgruppe (24 px), die Überschrift bleibt stehen; `dateien` stellt mehrere Logos nebeneinander (Abstand 32 px).
  const LOGO_GAP = 32;
  const logos = (input.logos || []).map(l => {
    const files = (l.dateien || [{ datei: l.datei, hoehe: l.hoehe, breite: l.breite }]).map(f => ({ src: f.datei, height: f.hoehe, width: f.breite }));
    let top = 250, unter = null;
    if (l.unter?.startsWith('kapitel:')) { const k = kapById(l.unter.slice(8)); if (!k) errors.push(`Logo ${l.id}: Kapitel fehlt`); else { top = k.top + k.height + 24; unter = k.id; } }
    const w = files.reduce((s, f) => s + (f.width || 0), 0) + LOGO_GAP * (files.length - 1);
    if (w > 864) errors.push(`Logos ${l.id} breiter als 864 px (${w})`);
    const hb = hits({ x: 540 - w / 2, y: top, w, h: Math.max(...files.map(f => f.height)) }, l.start, l.end);
    if (hb.length) ctx.warnings.push(`Logos ${l.id} berühren Kopf/Kappe (${hb.length} Stichproben)`);
    return { id: l.id, files, top: Math.round(top), unter, start: l.start, end: l.end };
  });
  // 14: Sprechblase nur bei Aufforderung zu Kommentar oder DM; im Outro y = 345, sonst 300. Dauer 4,25 s.
  const sprechblasen = (input.sprechblasen || []).map((b, i) => ({ id: 'bubble-' + i, text: b.text, start: b.start, top: Math.abs(b.start - input.outroStart) < 2 || b.start >= input.outroStart ? 345 : 300 }));
  for (const b of sprechblasen) if (A(b.text, 36, 800) + 40 + 8 > 620) errors.push('Sprechblase breiter als 620 px');

  // 17 (Test): B-Roll-Fotokarten in der oberen Zone, auch über dem Gesicht. Nicht während des Einstiegs (er ist das Vorschaubild).
  const bilder = (input.bilder || []).map(b => bilder22(b, { errors, notes, hits }));
  // 17 (Test, Abi 19.10.2026): Tagesplan-Karte statt Lebensbalken für einen Tagesablauf mit Uhrzeiten.
  const tagesplaene = (input.tagesplaene || []).map(t => tagesplan22(t, { A, G, errors, notes, hits }));
  for (let i = 1; i < bilder.length; i++) if (bilder[i].start < bilder[i - 1].end - 1e-6) errors.push(`Bilder überlappen: ${bilder[i - 1].id} / ${bilder[i].id}`);
  for (const b of bilder) if (b.start < einstieg.end + 0.06) errors.push(`Bilder ${b.id} beginnen vor dem Ende des Einstiegs (${einstieg.end} s)`);

  // 17 Buchcover: Während der großen Phase (bis grossBis + 0,5 s) reicht das Cover bis y 882. Pillen, H2, Logo und Randnotiz unter
  // dem Kapitel lägen darunter (Befund Code-Prüfung): erst nach der Verkleinerung erlaubt.
  for (const k of kapitel.filter(k => k.buch)) {
    const frei = k.buch.grossBis + 0.5, ueber = x => x.start < frei && x.end > k.start;
    for (const p of pillen.filter(p => p.kapitel === k.id && p.start < frei)) errors.push(`Pillen ${p.id} beginnen während das Cover von ${k.id} groß steht (erst ab ${r2(frei)} s)`);
    for (const h of h2.filter(h => (input.h2 || []).find(x => x.id === h.id)?.unter === 'kapitel:' + k.id && h.start < frei)) errors.push(`H2 ${h.id} unter ${k.id} beginnt während das Cover groß steht (erst ab ${r2(frei)} s)`);
    for (const l of logos.filter(l => l.unter === k.id && l.start < frei)) errors.push(`Logo ${l.id} unter ${k.id} beginnt während das Cover groß steht (erst ab ${r2(frei)} s)`);
    for (const n of randnotizen.filter(ueber)) errors.push(`Randnotiz ${n.id} läuft, während das Cover von ${k.id} groß steht`);
  }
  // Ausblenden: 10 Schlagwort blendet H1, H2 und Randnotiz aus; Kapitel und Pillen ebenfalls, weil das Wort an ihrer Stelle steht
  // (in der abgenommenen Branding-Probe so umgesetzt). Grafik und B-Roll-Karte (17) ersetzen alle oberen Textebenen.
  // 14 Logo: H1 blendet 0,1 s vorher aus und 0,1 s danach wieder ein.
  const ausblenden = [], oben = [...kapitel, ...h1, ...h2, ...pillen, ...randnotizen, ...lebensbalken, ...akronyme];
  for (const w of [...schlagworte, ...grafiken, ...bilder, ...tagesplaene]) for (const x of oben) if (x.start < w.end && x.end > w.start) ausblenden.push({ sel: '#' + x.id, from: Math.max(x.start, w.start), to: x.end > w.end + 0.25 ? w.end : null });
  const logoH1 = [];
  for (const l of logos.filter(l => !l.unter)) for (const x of [...h1, ...kapitel]) if (x.start < l.end && x.end > l.start) logoH1.push({ sel: '#' + x.id + ' > span', out: l.start - 0.1, in: l.end + 0.1 });

  return { designVersion: '2.2', duration: ctx.duration, einstieg, kapitel, h1, h2, pillen, akronyme, schlagworte, grafiken, randnotizen, lebensbalken, logos, sprechblasen, ...(bilder.length ? { bilder } : {}), ...(tagesplaene.length ? { tagesplaene } : {}), ausblenden, logoH1, outro: { start: input.outroStart, end: ctx.duration, followers: ctx.followers } };
}

// 17 (In Erprobung, Testauftrag Abdullah 19.10.2026, Vlog „Geschäftsreise Wiesbaden“): B-Roll-Fotokarten.
// Eigene Fotos als Karte in der oberen Zone (Rand 6 und harter Schatten 12 wie 11), Hochformat 3 : 4, 600 × 800 px, Oberkante 300,
// auf x = 540 zentriert; darf über dem Gesicht stehen, Untertitel laufen weiter. Eine Gruppe steht höchstens 3 s (DESIGN.md 17)
// und zeigt 1–3 Fotos, die nacheinander auf den Stapel fallen (je leicht versetzt und gedreht wie die Pillen). Optional ein Ort
// als blaue Marke (H2-Fläche, 40 px, −2°) über der Unterkante der Karte; es steht immer nur die Marke des obersten Fotos.
// Plan: bilder[] = { id, start, end, fotos: [{ datei (unter assets/), at, fokus? (object-position, z. B. "50% 40%"), ort? }] }.
const BILD = { w: 600, h: 800, top: 300, ortTop: 300 + 800 - 34, lagen: [[0, 0, -3], [24, 14, 2.5], [-18, -10, -1.5]] };
function bilder22(b, { errors, notes, hits }) {
  if (b.anordnung === 'collage') return collage22(b, { errors, notes, hits });
  const d = b.end - b.start, fotos = b.fotos || [];
  if (d > 3 + 1e-6) errors.push(`Bilder ${b.id}: ${d.toFixed(2)} s am Stück (DESIGN.md 17: höchstens 3 s)`);
  if (!fotos.length || fotos.length > 3) errors.push(`Bilder ${b.id}: 1 bis 3 Fotos je Gruppe`);
  fotos.forEach((f, i) => {
    if (!f.datei?.startsWith('assets/') || /\s/.test(f.datei)) errors.push(`Bilder ${b.id}: datei muss unter assets/ liegen und darf keine Leerzeichen enthalten (Abschnitts-Cache): ${f.datei}`);
    const next = fotos[i + 1]?.at ?? b.end;
    if (i === 0 && Math.abs(f.at - b.start) > 1e-6) errors.push(`Bilder ${b.id}: das erste Foto beginnt mit der Gruppe`);
    if (next - f.at < 0.6 - 1e-6) errors.push(`Bilder ${b.id}-${i}: steht nur ${(next - f.at).toFixed(2)} s (mindestens 0,6 s)`);
    if (f.fokus && !/^\d{1,3}% \d{1,3}%$/.test(f.fokus)) errors.push(`Bilder ${b.id}-${i}: fokus als „x% y%“ angeben`);
  });
  if (hits({ x: 540 - BILD.w / 2, y: BILD.top, w: BILD.w, h: BILD.h }, b.start, b.end).length) notes.push(`Bilder ${b.id} stehen über dem Kopf (DESIGN.md 17 erlaubt „über dem Gesicht“, höchstens 3 s)`);
  return { id: b.id, start: b.start, end: b.end, fotos: fotos.map((f, i) => ({ src: f.datei, at: f.at, fokus: f.fokus || '50% 50%', ort: f.ort || null, dx: BILD.lagen[i][0], dy: BILD.lagen[i][1], rot: BILD.lagen[i][2] })) };
}

// 17 (Test, Abi 19.10.2026: „alle auf einmal, nebeneinander, wie eine kleine Collage“): bilder[].anordnung = "collage".
// 2–6 Fotos gleichzeitig im Raster (3 Spalten), Karten 232 × 310 mit Rand 5 und Schatten 8, leicht gedreht; sie ploppen
// nacheinander auf (je 0,15 s versetzt). Raster auf x = 540 zentriert, Oberkante 300; die Orts-Marke steht unter dem Raster.
const COLL = { w: 232, h: 310, gap: 20, top: 300, rot: [-2.5, 1.5, -1, 2, -1.5, 2.5] };
function collage22(b, { errors, notes, hits }) {
  // Option raster: { spalten, breite } (Abi 19.10.2026: Bilder größer, damit man sie erkennt), Höhe im Verhältnis 3 : 4.
  const sp = b.raster?.spalten || 3, cw = b.raster?.breite || COLL.w, ch = Math.round(cw * 4 / 3);
  const d = b.end - b.start, fotos = b.fotos || [], n = fotos.length, spalten = Math.min(sp, n), zeilen = Math.ceil(n / sp);
  if (d > 3 + 1e-6) errors.push(`Collage ${b.id}: ${d.toFixed(2)} s am Stück (DESIGN.md 17: höchstens 3 s)`);
  if (n < 2 || n > 6) errors.push(`Collage ${b.id}: 2 bis 6 Fotos`);
  for (const f of fotos) if (!f.datei?.startsWith('assets/') || /\s/.test(f.datei)) errors.push(`Collage ${b.id}: datei unter assets/ ohne Leerzeichen: ${f.datei}`);
  const breite = spalten * cw + (spalten - 1) * COLL.gap, links = 540 - breite / 2, hoehe = zeilen * ch + (zeilen - 1) * COLL.gap;
  // Unterkante samt Schatten 8 und Fallbewegung 70 px (BILD_TL) muss über den Untertiteln (1280) bleiben (Befund Build V6, 19.10.2026).
  if (COLL.top + hoehe + 8 + 70 > 1270) errors.push(`Collage ${b.id}: reicht beim Einfallen bis y ${COLL.top + hoehe + 78} (Untertitel ab 1280)`);
  if (hits({ x: links, y: COLL.top, w: breite, h: hoehe }, b.start, b.end).length) notes.push(`Collage ${b.id} steht über dem Kopf (DESIGN.md 17 erlaubt „über dem Gesicht“, höchstens 3 s)`);
  return { id: b.id, start: b.start, end: b.end, collage: true, kw: cw, kh: ch, ortTop: COLL.top + hoehe - 26, fotos: fotos.map((f, i) => {
    const z = Math.floor(i / sp), inZeile = Math.min(sp, n - z * sp), lz = 540 - (inZeile * cw + (inZeile - 1) * COLL.gap) / 2;
    return { src: f.datei, at: b.start + 0.15 * i, fokus: f.fokus || '50% 50%', ort: i === n - 1 ? (b.ort || null) : null, x: Math.round(lz + (i % sp) * (cw + COLL.gap)), y: COLL.top + z * (ch + COLL.gap), rot: COLL.rot[i] };
  }) };
}

// 17 (Test, Abi 19.10.2026): Tagesplan-Karte. Karte wie 11 (Weiß, Rand 6, Radius 24, Schatten 12), x = 150, Oberkante 270, 780 breit.
// Titel Archivo 800 40 px Tinte; je Zeile Uhrzeit/Dauer in Gochi Hand 58 px Blau mit Tintenkontur 2, daneben Archivo 800 48 px Tinte.
// Zeilen erscheinen am gesprochenen Wort (14 px von unten, 0,22 s). Plan: tagesplaene[] = { id, start, end, titel, zeilen: [{ zeit, text, at }] }.
const PLAN = { top: 270, w: 780, pad: [26, 34, 24], titel: 40, zeile: 66, zeitW: 180, text: 48, zeit: 58 };
function tagesplan22(t, { A, G, errors, notes, hits }) {
  const z = t.zeilen || [];
  if (!z.length || z.length > 6) errors.push(`Tagesplan ${t.id}: 1 bis 6 Zeilen`);
  for (const r of z) { const w = PLAN.pad[1] * 2 + PLAN.zeitW + A(r.text, PLAN.text, 800); if (w > PLAN.w) errors.push(`Tagesplan ${t.id}: Zeile zu breit (${Math.round(w)} px): ${r.text}`); if (r.at < t.start || r.at >= t.end) errors.push(`Tagesplan ${t.id}: Zeile außerhalb der Karte: ${r.text}`); }
  const h = PLAN.pad[0] + Math.round(PLAN.titel * 1.2) + 10 + z.length * PLAN.zeile + PLAN.pad[2];
  if (PLAN.top + h + 12 > 900) errors.push(`Tagesplan ${t.id}: reicht bis y ${PLAN.top + h + 12} (obere Zone bis 900)`);
  if (hits({ x: 150, y: PLAN.top, w: PLAN.w, h }, t.start, t.end).length) notes.push(`Tagesplan ${t.id} berührt den Kopf`);
  return { id: t.id, start: t.start, end: t.end, titel: t.titel, height: h, zeilen: z.map(r => ({ zeit: r.zeit || '', text: r.text, at: r.at })) };
}

// 17 (In Erprobung, Testauftrag Abdullah 04.10.2026, Video „Bücher die so gut sind wie Therapie“): Kapitel mit Buchcover.
// Beim Kapitelbeginn steht das Cover groß als B-Roll-Karte in der oberen Zone (Rand und Schatten wie 11, höchstens 3 s),
// dann verkleinert es sich animiert nach links, rechts daneben erscheinen Nummer und Titel, darunter der deutsche Titel (🇩🇪)
// und der Autor in der H2-Fläche. Gruppe auf x = 540 zentriert, Oberkante 270, höchstens 840 px breit (gedrehtes Cover samt Rand bleibt rechts von x = 108).
// Plan: kapitel[].buch = { datei, breite, hoehe (Pixel der Bilddatei), autor, deutsch, grossBis?, autorAb? }.
// CSS des Buchcovers, nur eingefügt, wenn ein Kapitel ein Cover hat.
const BUCH_CSS = () => `.kap-buch{gap:${BUCH.luecke}px;text-align:left}.buch-slot{display:inline-block;flex:0 0 auto}
.buch-col{display:inline-flex;flex-direction:column;align-items:flex-start}.buch-row{display:inline-flex;align-items:center;gap:18px}
.buch-num{font-size:${BUCH.zahl}px}.buch-title{display:inline-block;font-weight:900;font-size:${BUCH.titel}px;line-height:1.05;word-spacing:6px;${stroke(6)}}.buch-title .ln{display:block}
.buch-de .ln{display:block}.buch-de{display:inline-block;margin-top:10px;font-weight:800;font-size:${BUCH.de}px;line-height:1.2;white-space:nowrap;${stroke(4)}}
.buch-autor{display:inline-block;margin-top:16px;background:${C.blue};font-weight:800;font-size:${BUCH.autor}px;line-height:1.12;padding:6px 22px 10px;border-radius:10px;transform:rotate(-2deg);white-space:nowrap}
.buch-cw{position:absolute;display:block;transform-origin:0 0}.buch-cover{display:block;width:100%;height:100%;object-fit:cover;border-radius:6px;box-shadow:0 0 0 4px ${C.ink},8px 8px 0 4px ${C.ink};transform:rotate(-3deg)}`;
const BUCH = { klein: 250, gross: 600, top: 270, luecke: 28, maxW: 840, zahl: 110, titel: 60, de: 40, autor: 44 };
function buch22(k, { A, G, errors, notes, warnings, hits }) {
  const b = k.buch, r = b.breite / b.hoehe;
  if (b.datei && (!b.datei.startsWith('assets/') || /\s/.test(b.datei))) errors.push(`Kapitel ${k.id}: buch.datei muss unter assets/ liegen und darf keine Leerzeichen enthalten (Abschnitts-Cache): ${b.datei}`);
  if (!b.datei || !(r > 0)) { errors.push(`Kapitel ${k.id}: buch.datei, buch.breite und buch.hoehe fehlen`); return { id: k.id, nummer: k.nummer || null, titel: k.titel, start: k.start, end: k.end, top: BUCH.top, height: BUCH.klein }; }
  const sw = Math.round(BUCH.klein * r), bw = Math.round(BUCH.gross * r);
  // Breiten wie im Browser (Layoutbreite), rechts Kontur bzw. Drehung als Zuschlag. Die Spaltenbreite wird im HTML ausdrücklich
  // gesetzt, damit die Gruppe im Browser genau so breit ist wie hier gerechnet und das kleine Cover genau im Platzhalter landet.
  const zahlW = k.nummer ? G(k.nummer, BUCH.zahl) + 18 : 0;
  const rowW = l => zahlW + Math.max(...l.map(x => A(x, BUCH.titel, 900, 100, 6))) + 6;
  const colMax = BUCH.maxW - sw - BUCH.luecke;
  let lines = [k.titel];
  if (rowW(lines) > colMax) {
    const w = k.titel.split(' '); let best = null;
    for (let i = 1; i < w.length; i++) { const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')], m = rowW(l); if (!best || m < best.m) best = { l, m }; }
    const nachDoppelpunkt = w.findIndex(x => x.endsWith(':')) + 1;   // „Bonus: / The Prophet“ statt „Bonus: The / Prophet“
    if (nachDoppelpunkt > 0 && nachDoppelpunkt < w.length) { const l = [w.slice(0, nachDoppelpunkt).join(' '), w.slice(nachDoppelpunkt).join(' ')]; if (rowW(l) <= colMax) best = { l, m: rowW(l) }; }
    if (best) lines = best.l;
  }
  // Deutscher Titel mit 🇩🇪; zu lang für eine Zeile → zwei Zeilen an der ausgewogensten Wortgrenze (Flagge vorn).
  let deLines = b.deutsch ? ['🇩🇪 ' + b.deutsch] : [];
  const deMax = l => Math.max(...l.map(x => A(x, BUCH.de, 800) + 4));
  if (deLines.length && deMax(deLines) > colMax) {
    const w = deLines[0].split(' '); let best = null;
    for (let i = 2; i < w.length; i++) { const l = [w.slice(0, i).join(' '), w.slice(i).join(' ')], m = deMax(l); if (!best || m < best.m) best = { l, m }; }
    if (best) deLines = best.l;
  }
  const de = deLines.length ? deLines : null;
  const titleW = rowW(lines), deW = de ? deMax(de) : 0, autorW = b.autor ? A(b.autor, BUCH.autor, 800) + 44 + 4 : 0;
  if (titleW > colMax) errors.push(`Kapitel ${k.id}: Titel neben dem Cover breiter als ${Math.round(colMax)} px (${Math.round(titleW)}): ${k.titel}`);
  if (deW > colMax) errors.push(`Kapitel ${k.id}: deutscher Titel breiter als ${Math.round(colMax)} px: ${b.deutsch}`);
  if (autorW > colMax) errors.push(`Kapitel ${k.id}: Autor breiter als ${Math.round(colMax)} px: ${b.autor}`);
  const colW = Math.ceil(Math.max(titleW, deW, autorW));
  const groupW = sw + BUCH.luecke + colW;
  const rowH = Math.max(k.nummer ? BUCH.zahl : 0, lines.length * BUCH.titel * 1.05);
  const colH = rowH + (de ? 10 + de.length * BUCH.de * 1.2 : 0) + (b.autor ? 16 + BUCH.autor * 1.12 + 16 : 0);
  const height = Math.round(Math.max(BUCH.klein, colH)), left = (1080 - groupW) / 2;
  const small = { left, top: Math.round((height - BUCH.klein) / 2), w: sw, h: BUCH.klein };
  const big = { left: Math.round(540 - bw / 2), top: 0, w: bw, h: BUCH.gross };
  if (BUCH.top + BUCH.gross + 12 > 900 || bw + 12 > 864) errors.push(`Kapitel ${k.id}: großes Cover passt nicht in die obere Zone`);
  const grossBis = r2(b.grossBis ?? k.start + 2.4);
  if (grossBis - k.start > 3 + 1e-6) errors.push(`Kapitel ${k.id}: Cover groß ${(grossBis - k.start).toFixed(2)} s (DESIGN.md 17: höchstens 3 s am Stück)`);
  if (grossBis - k.start < 0.8) errors.push(`Kapitel ${k.id}: Cover groß nur ${(grossBis - k.start).toFixed(2)} s`);
  const titleAt = r2(grossBis + 0.3), deAt = r2(titleAt + 0.1), autorAt = r2(Math.max(grossBis + 0.5, b.autorAb ?? 0));
  if (autorAt > k.end - 0.5) errors.push(`Kapitel ${k.id}: Autor erscheint erst kurz vor Kapitelende`);
  const gb = { x: big.left, y: BUCH.top, w: bw + 12, h: BUCH.gross + 12 };
  if (hits(gb, k.start, grossBis).length) notes.push(`Kapitel ${k.id}: großes Cover liegt über dem Kopf (DESIGN.md 17 erlaubt „über dem Gesicht“, höchstens 3 s)`);
  const hk = hits({ x: left, y: BUCH.top, w: groupW, h: height }, grossBis + 0.5, k.end);
  if (hk.length) warnings.push(`Kapitel ${k.id} mit Cover berührt Kopf/Kappe (${hk.length} Stichproben)`);
  return { id: k.id, nummer: k.nummer || null, titel: k.titel, start: k.start, end: k.end, top: BUCH.top, height,
    buch: { src: b.datei, lines, de, autor: b.autor || null, small, big, groupW, colW, grossBis, titleAt, deAt, autorAt } };
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

// Bewertungskarte (Plan-Option karte.art "bewertung", Abdullahs Wunsch 12.10.2026, Video HHU Rating): je Zeile Beschriftung, Spur
// und Wert. Formen aus DESIGN.md 11: die volle Skala als Vergleichslinie (Tinte 6, gepunktet), der Wert als Hauptlinie (Blau 9 auf
// Tinte 15, runde Enden), Gesamtzeile unter einer Linie (Tinte 4) mit handgezeichnetem Kreis um den Wert. Karte, Zeiten und Kurven
// wie die Liniengrafik; titel ist hier optional (ohne Titel ist die Karte 53 px kürzer). zeilen[].notiz: kleine Zeile darunter.
// zeilen[].at: die Zeile erscheint erst am gesprochenen Wort (14 px von unten, 0,22 s) und zeichnet ihre Linie 0,1 s danach in 1,0 s.
// hintergrund: false lässt Off-White und Seigaiha weg (Karte über dem Kamerabild, ohne person darf sie den Kopf nicht berühren).
// Zeilenmaße so knapp, dass sieben Zeilen samt Notiz ohne Titel über dem Kopf bleiben (HHU Rating: Karte bis y 620, Kopf ab 634).
const BW = { zeile: 34, schrift: 26, notiz: 18, notizH: 20, gesamt: 42, gesamtSchrift: 32, trenner: 12, spalte: 16 };
function bewertung22(g, { A, errors }) {
  const c = g.karte, max = c.skala ?? 5, W = 700, rows = c.zeilen || [], ges = c.gesamt;
  const fmt = v => String(v).replace('.', ',') + '/' + max;
  const labW = Math.ceil(Math.max(...rows.map(r => A(r.text, BW.schrift, 800)), ges ? A(ges.text, BW.gesamtSchrift, 800) : 0)) + 4;
  const valW = Math.ceil(Math.max(...rows.map(r => A(fmt(r.wert), BW.schrift, 800)), ges ? A(fmt(ges.wert), BW.gesamtSchrift, 800) : 0)) + 4;
  const T = W - labW - valW - 2 * BW.spalte;
  if (T < 200) errors.push(`Grafik ${g.id}: Spur nur ${Math.round(T)} px breit (Beschriftungen kürzen)`);
  for (const r of [...rows, ...(ges ? [ges] : [])]) if (!(r.wert >= 0 && r.wert <= max)) errors.push(`Grafik ${g.id}: Wert ${r.wert} außerhalb 0–${max}`);
  for (const r of rows) if (r.notiz && A(r.notiz, BW.notiz, 700) > W) errors.push(`Grafik ${g.id}: Notiz breiter als 700 px: ${r.notiz}`);
  if (c.titel && A(c.titel, 34, 800) > W) errors.push(`Grafik ${g.id}: Titel breiter als 700 px`);
  const spur = (v, cls = 'main-line') => { const x0 = 9, x1 = T - 9, xv = Math.max(x0 + 0.01, x0 + (x1 - x0) * v / max).toFixed(1);
    return `<svg class="bw-track" width="${T}" height="30" viewBox="0 0 ${T} 30" overflow="visible"><path class="cmp-line" d="M ${x0} 15 L ${x1} 15" fill="none" stroke="${C.ink}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 12"/>`
      + [[C.ink, 15], [C.blue, 9]].map(([s, w]) => `<path class="${cls}" d="M ${x0} 15 L ${xv} 15" pathLength="1" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>`).join('') + '</svg>'; };
  const zeile = (r, h, cls = '', id = '') => `<div class="bw-row${cls}"${id ? ` id="${id}"` : ''} style="height:${h}px"><span class="bw-lab" style="width:${labW}px">${escEmoji(r.text)}</span>${spur(r.wert, id ? 'late-line' : 'main-line')}<span class="bw-val" style="width:${valW}px">${esc(fmt(r.wert))}${cls ? kreis : ''}</span></div>`;
  // Handgezeichneter Kreis wie bei der Liniengrafik, auf die Breite des Werts gezogen.
  const sx = (valW / 2 + 18) / 42, sy = 0.82, P = (x, y) => `${(x * sx).toFixed(1)} ${(y * sy).toFixed(1)}`;
  const kreis = `<svg class="bw-kreis" width="2" height="2" viewBox="-1 -1 2 2" overflow="visible"><path class="hl-circle" d="M ${P(-32, 25)} C ${P(-46, -3)} ${P(-20, -29)} ${P(6, -27)} C ${P(34, -25)} ${P(46, 3)} ${P(34, 25)} C ${P(22, 45)} ${P(-12, 43)} ${P(-26, 27)} C ${P(-34, 17)} ${P(-28, 1)} ${P(-14, -7)}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/></svg>`;
  const html = `<div class="bw">${rows.map((r, i) => zeile(r, BW.zeile, '', r.at != null ? `${g.id}-z${i}` : '') + (r.notiz ? `<div class="bw-notiz" style="height:${BW.notizH}px;padding-left:${labW + BW.spalte}px">${escEmoji(r.notiz)}</div>` : '')).join('')}${ges ? `<div class="bw-sep"></div>${zeile(ges, BW.gesamt, ' bw-ges')}` : ''}</div>`;
  const inhalt = rows.length * BW.zeile + rows.filter(r => r.notiz).length * BW.notizH + (ges ? BW.trenner + BW.gesamt : 0);
  const height = Math.round(6 + 26 + (c.titel ? 34 * 1.2 + 12 : 0) + inhalt + 22 + 6);
  if (270 + height + 12 > 900) errors.push(`Grafik ${g.id}: Karte samt Schatten bis y ${270 + height + 12} (rechts ab x 930 unter y 900 gesperrt)`);
  const drawAt = g.zeichnenAb ?? r2(g.start + 0.3);
  return { id: g.id, start: g.start, end: g.end, drawAt, cmpAt: g.vergleichAb ?? drawAt, circleAt: g.kreisAb ?? r2(drawAt + 1), title: c.titel || null, height, svg: html, person: g.person, labels: [], spaet: rows.map((r, i) => r.at != null ? { id: `${g.id}-z${i}`, at: r.at } : null).filter(Boolean), ...(g.hintergrund === false ? { ohneHintergrund: true } : {}) };
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
  // opts.abschnitt {t0, dauer} (Tempo Phase 4): Komposition nur für diesen Zeitbereich. Clips werden auf den Abschnitt
  // verschoben und beschnitten, Videos über data-media-start versetzt; die Zeitleiste bleibt absolut (siehe timeline22).
  const T0 = opts.abschnitt?.t0 ?? 0, LEN = opts.abschnitt?.dauer ?? duration;
  const lage = (a, b) => { if (!opts.abschnitt) return [a, +(b - a).toFixed(4)]; const x = Math.max(0, a - T0), y = Math.min(LEN, b - T0); return y - x < 0.0005 ? [LEN, 0.001] : [+x.toFixed(4), +(y - x).toFixed(4)]; };   // außerhalb: hinter dem Abschnittsende, nie aktiv
  const clip = (id, a, b, track, kind, extra = '') => { const [x, d] = lage(a, b); return `id="${id}" class="clip" data-start="${x}" data-duration="${d}" data-track-index="${track}" data-kind="${kind}"${extra}`; };
  const mediaStart = a => a < T0 ? ` data-media-start="${+(T0 - a).toFixed(4)}"` : '';
  const lines = arr => arr.map(l => `<span class="ln">${escEmoji(l)}</span>`).join('');
  const html = [];
  // Grafik: Hintergrund (Off-White + Seigaiha), Karte, Person (eigene Alpha-Ebene) — unter den oberen Texten und Untertiteln.
  const seig = `<svg width="1080" height="1920" style="position:absolute;inset:0"><defs><pattern id="seigaiha" width="80" height="40" patternUnits="userSpaceOnUse"><g fill="${C.off}" stroke="${C.ink}" stroke-width="2.5">${[[40, 0], [0, 20], [80, 20], [40, 40]].map(([x, y]) => [40, 31, 22, 13, 5].map(r => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')).join('')}</g></pattern></defs><rect width="1080" height="1920" fill="${C.off}"/><rect width="1080" height="1920" fill="url(#seigaiha)" opacity="0.12"/></svg>`;
  for (const g of grafiken) html.push(g.ohneHintergrund ? '' : `<div ${clip(g.id + '-bg', g.start, g.end, 10, 'gs-bg')} style="inset:0">${seig}</div>`,
    `<div ${clip(g.id, g.start, g.end, 11, 'grafik')} style="left:150px;top:270px;width:780px;height:${g.height}px"><div class="card">${g.title ? `<div class="card-title">${escEmoji(g.title)}</div>` : ''}${g.svg}</div></div>`,
    ...(g.person ? [] : []), g.person ? `<video id="${g.id}-person" class="clip" src="${g.person}" data-start="${lage(g.start, g.end)[0]}" data-duration="${lage(g.start, g.end)[1]}"${mediaStart(g.start)} data-track-index="12" data-volume="0" muted playsinline style="position:absolute;inset:0;width:1080px;height:1920px"></video>` : '');
  const top = [];
  top.push(`<div ${clip('einstieg-h1', 0, e.end, 2, 'h1', ' data-einstieg="1"')} style="top:${250 + (e.h1.versatz || 0)}px;font-size:${e.h1.fontSize}px;opacity:1"><span class="h1" style="visibility:visible">${lines(e.h1.lines)}</span></div>`);
  // Einstiegslogo neben der H2 (gleiches Element, blendet mit ihr aus) oder allein unter der H1.
  const eLogo = l => `<span class="e-logo${l.karte ? ' e-logo-karte' : ''}" style="visibility:visible;margin-top:${l.dy}px"><img src="${esc(l.src)}" style="height:${l.height}px;width:${l.width}px" alt=""></span>`;
  if (e.h2) top.push(`<div ${clip('einstieg-h2', 0, e.end + 0.06, 3, 'h2', ' data-einstieg="1"')} style="top:${e.h2.top}px;opacity:1"><span class="h2" style="visibility:visible">${lines(e.h2.lines)}</span>${e.logo ? eLogo(e.logo) : ''}</div>`);
  else if (e.logo) top.push(`<div ${clip('einstieg-h2', 0, e.end + 0.06, 3, 'h2', ' data-einstieg="1"')} style="top:${e.logo.top}px;opacity:1">${eLogo(e.logo)}</div>`);
  // 17: Kapitel mit Buchcover. Platzhalter in der Gruppe hält den Platz des kleinen Covers; das Cover selbst steht absolut und
  // wandert vom großen in den kleinen Zustand.
  const buchHtml = k => { const b = k.buch; return `<div ${clip(k.id, k.start, k.end, 4, 'kapitel', ' data-buch="1"')} style="top:${k.top}px;height:${k.height}px"><span class="kap kap-buch"><span class="buch-slot" style="width:${b.small.w}px;height:${k.height}px"></span><span class="buch-col" style="width:${b.colW}px"><span class="buch-row" id="${k.id}-title">${k.nummer ? `<span class="kap-num buch-num">${esc(k.nummer)}</span>` : ''}<span class="buch-title">${lines(b.lines)}</span></span>${b.de ? `<span class="buch-de" id="${k.id}-de">${(Array.isArray(b.de) ? b.de : [b.de]).map(l => `<span class="ln">${escEmoji(l)}</span>`).join('')}</span>` : ''}${b.autor ? `<span class="buch-autor" id="${k.id}-autor">${escEmoji(b.autor)}</span>` : ''}</span></span><span class="buch-cw" id="${k.id}-cw" style="left:${b.small.left}px;top:${b.small.top}px;width:${b.small.w}px;height:${b.small.h}px"><img class="buch-cover" id="${k.id}-cover" src="${esc(b.src)}" alt=""></span></div>`; };
  for (const k of kapitel) if (k.buch) top.push(buchHtml(k)); else top.push(`<div ${clip(k.id, k.start, k.end, 4, 'kapitel')} style="top:${k.top}px"><span class="kap">${k.nummer ? `<span class="kap-numw" id="${k.id}-num"><span class="kap-num">${esc(k.nummer)}</span></span>` : ''}<span class="kap-title" id="${k.id}-title">${escEmoji(k.titel)}</span></span></div>`);
  for (const h of h1) top.push(`<div ${clip(h.id, h.start, h.end, 2, 'h1')} style="top:${250 + (h.versatz || 0)}px;font-size:${h.fontSize}px"><span class="h1${h.klein ? ' h1-klein' : ''}">${lines(h.lines)}</span></div>`);
  for (const h of h2) top.push(`<div ${clip(h.id, h.start, h.end, 3, 'h2')} style="top:${h.top}px"><span class="h2">${lines(h.lines)}</span></div>`);
  for (const p of pillen) top.push(`<div ${clip(p.id, p.start, p.end, 5, 'pillen', ` data-layout="${p.layout}"`)} style="top:${p.top}px">${p.items.map((it, i) => `<span class="pill-pop" id="${p.id}-${i}"><span class="pill${p.layout === 'row' ? ' pill-row' : ''}" style="${p.layout === 'stack' ? `transform:translateX(${it.dx}px) rotate(${it.rot}deg)` : ''}">${p.layout === 'row' && !p.rowDot ? '' : p.numbered ? `<span class="pill-dot"><span class="pill-no">${i + 1}</span></span>` : '<span class="pill-dot pill-dot-s"></span>'}<span class="pill-text">${escEmoji(it.text)}</span></span></span>`).join('')}</div>`);
  for (const a of akronyme) top.push(`<div ${clip(a.id, a.start, a.end, 6, 'akronym')} style="top:240px"><div class="ak-row">${a.letters.map((l, i) => `<span class="ak-pop" id="${a.id}-p${i}"><span class="ak-letter" id="${a.id}-l${i}" style="transform:rotate(${l.rot}deg)">${esc(l.b)}</span></span>`).join('')}</div><div class="ak-pills" style="top:${a.pillTop - 240}px">${a.letters.map((l, i) => `<span class="ak-pill-pop" id="${a.id}-q${i}"><span class="pill ak-pill"><span class="pill-text">${escEmoji(l.text)}</span></span></span>`).join('')}</div></div>`);
  for (const n of randnotizen) top.push(`<div ${clip(n.id, n.start, n.end, 7, 'randnotiz')} style="left:${n.left}px;top:${n.top}px">${n.lines.map((l, j) => `<div class="note-line" id="${n.id}-l${j}" style="margin-top:${l.gapBefore}px">${l.html}${l.strikeAt != null ? `<svg class="note-strike" id="${n.id}-s${j}" height="20" style="left:-8px;top:calc(54% - 10px);width:calc(100% + 16px)" overflow="visible" preserveAspectRatio="none"><path pathLength="1" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path pathLength="1" fill="none" stroke="${C.pink}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/></svg>` : ''}</div>`).join('')}</div>`);
  for (const b of lebensbalken) top.push(`<div ${clip(b.id, b.start, b.end, 9, 'balken')} style="left:190px;top:${370 - 58}px;width:700px;height:${58 + 26}px">${b.segments.map((s, i) => `<span class="bal-label" id="${b.id}-l${i}" style="left:${s.labelLeft}px">${escEmoji(s.label)}</span>`).join('')}<div class="bal-bed">${b.segments.map((s, i) => `<div class="bal-fill" id="${b.id}-f${i}" style="left:${s.from * 700}px;width:${(s.to - s.from) * 700}px"></div>`).join('')}${b.trenner ? b.segments.slice(1).map((s, i) => `<div class="bal-sep" id="${b.id}-t${i + 1}" style="left:${s.from * 700 - 1.5}px"></div>`).join('') : ''}</div></div>`);
  for (const l of logos) top.push(`<div ${clip(l.id, l.start, l.end, 13, 'logo')} style="top:${l.top ?? 250}px"><span class="logo">${(l.files || [{ src: l.src, height: l.height, width: l.width }]).map(f => `<img src="${esc(f.src)}" style="height:${f.height}px${f.width ? `;width:${f.width}px` : ''}" alt="">`).join('')}</span></div>`);
  // 17 (Test): B-Roll-Fotokarten; die Orts-Marke steht als eigene Zeile auf x = 540 (nicht mit dem Versatz der Karte).
  for (const b of plan.bilder || []) top.push(`<div ${clip(b.id, b.start, b.end, 14, 'bilder')} style="left:0;top:0;width:1080px;height:1920px">${b.fotos.map((f, i) => `<div class="bild-lage${b.collage ? ' bild-klein' : ''}" id="${b.id}-${i}" style="left:${b.collage ? f.x : 540 - BILD.w / 2 + f.dx}px;top:${b.collage ? f.y : BILD.top + f.dy}px${b.collage && b.kw !== COLL.w ? `;width:${b.kw}px;height:${b.kh}px` : ''}"><div class="bild-karte" style="transform:rotate(${f.rot}deg)"><img class="bild-foto" id="${b.id}-${i}-img" src="${esc(f.src)}" style="object-position:${f.fokus}" alt=""></div></div>`).join('')}${b.fotos.map((f, i) => f.ort ? `<div class="bild-ortw" style="top:${b.collage ? b.ortTop : BILD.ortTop}px"><span class="bild-ort" id="${b.id}-${i}-ort">${escEmoji(f.ort)}</span></div>` : '').join('')}</div>`);
  for (const t of plan.tagesplaene || []) top.push(`<div ${clip(t.id, t.start, t.end, 15, 'tagesplan')} style="left:150px;top:${PLAN.top}px;width:${PLAN.w}px;height:${t.height}px"><div class="tp-karte"><div class="tp-titel">${escEmoji(t.titel)}</div>${t.zeilen.map((r, j) => `<div class="tp-zeile" id="${t.id}-z${j}"><span class="tp-zeit">${esc(r.zeit)}</span><span class="tp-text">${escEmoji(r.text)}</span></div>`).join('')}</div></div>`);
  for (const s of schlagworte) top.push(`<div ${clip(s.id, s.start, s.end, 8, 'schlagwort')} style="top:330px"><span class="sw-pop"><span class="sw" style="transform-origin:50% ${(s.fontSize * 1.02 / 2).toFixed(1)}px"><span class="sw-word" style="font-size:${s.fontSize}px">${esc(s.text)}</span><svg class="sw-lines" viewBox="0 0 700 70" preserveAspectRatio="none" style="width:${s.width}px;height:70px" overflow="visible">${[['M 14 30 C 150 12, 300 40, 450 22 S 640 30, 688 16', 22, 12], ['M 60 54 C 210 40, 380 62, 560 46 S 650 50, 672 46', 20, 10]].map(([d, wi, wp], j) => `<path id="${s.id}-u${j}i" d="${d}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="${wi}" stroke-linecap="round" vector-effect="non-scaling-stroke" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path id="${s.id}-u${j}p" d="${d}" pathLength="1" fill="none" stroke="${C.pink}" stroke-width="${wp}" stroke-linecap="round" vector-effect="non-scaling-stroke" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>`).join('')}</svg></span></span></div>`);
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
[data-kind=h1]:not([data-einstieg]) .h1{transform-origin:50% 0}
.h2{display:inline-block;background:${C.blue};font-weight:800;font-size:58px;line-height:1.12;padding:8px 28px 14px;border-radius:12px;transform:rotate(-2deg);white-space:nowrap}
.kap{display:inline-flex;align-items:center;gap:28px;white-space:nowrap}
.kap-numw{display:inline-block}.kap-num{display:inline-block;font-family:"ABI Gochi";font-size:140px;line-height:1;color:${C.blue};${stroke(7)};transform:rotate(-4deg)}
.kap-title{display:inline-block;font-weight:900;font-size:64px;line-height:1.1;word-spacing:6px;${stroke(6)}}${kapitel.some(k => k.buch) ? '\n' + BUCH_CSS() : ''}${(plan.bilder || []).length ? '\n' + BILD_CSS : ''}${(plan.tagesplaene || []).length ? '\n' + PLAN_CSS : ''}${h1.some(h => h.klein) ? `\n.h1-klein{${stroke(5)};line-height:1.12}` : ''}${lebensbalken.some(b => b.trenner) ? `\n.bal-sep{position:absolute;top:0;width:3px;height:100%;background:${C.ink};opacity:0}` : ''}
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
.logo{display:inline-flex;align-items:center;gap:32px}.logo img{display:block}${e.logo ? `
.e-logo{display:inline-block;margin-left:${e.h2 ? 24 : 0}px}.e-logo img{display:block}
.e-logo-karte{padding:6px 12px;background:${C.white};border:4px solid ${C.ink};border-radius:12px;box-shadow:6px 6px 0 ${C.ink};transform:rotate(-2deg)}` : ''}
[data-kind=grafik]{transform-origin:50% 50%}
.card{width:780px;height:100%;padding:26px 34px 22px;background:${C.white};border:6px solid ${C.ink};border-radius:24px;box-shadow:12px 12px 0 ${C.ink};color:${C.ink};display:flex;flex-direction:column;gap:12px}
.card-title{font-weight:800;font-size:34px;line-height:1.2;white-space:nowrap}
.card text{font-family:"ABI Archivo";font-weight:700;font-size:24px;fill:${C.ink}}${grafiken.some(g => /class="bw"/.test(g.svg)) ? `
.bw{display:flex;flex-direction:column}.bw-row{display:flex;align-items:center;gap:${BW.spalte}px;font-weight:800;font-size:${BW.schrift}px;line-height:1;white-space:nowrap}
.bw-lab,.bw-val,.bw-track{flex:none;display:block}.bw-lab .emoji{margin-right:.25em}.bw-val{position:relative;text-align:right}.bw-ges{font-size:${BW.gesamtSchrift}px}
.bw-notiz{font-weight:700;font-size:${BW.notiz}px;line-height:1;white-space:nowrap;margin-top:-4px}
.bw-sep{height:4px;margin:4px 0;border-radius:2px;background:${C.ink}}.bw-kreis{position:absolute;left:50%;top:50%}` : ''}
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
<main id="root" data-composition-id="root" data-width="${opts.vorschau ? 540 : 1080}" data-height="${opts.vorschau ? 960 : 1920}" data-fps="30" data-duration="${opts.abschnitt ? LEN : duration}"${opts.vorschau ? ' style="zoom:.5"' : ''}>
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${opts.abschnitt ? LEN : duration}"${T0 ? ` data-media-start="${+T0.toFixed(4)}"` : ''} data-track-index="0" data-volume="0" muted playsinline></video>
${opts.abschnitt ? '' : `<audio id="voice" class="clip" src="${plan.tonQuelle || 'media.mp4'}" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>`}
${html.join('\n')}
<div id="top">${top.join('\n')}</div>
${caps}
${outroHtml}
${bubbles}
</main><script>${timeline22(plan, opts.abschnitt)}</script></body></html>`;
}

// 17 (Test): CSS und Zeitleiste der B-Roll-Fotokarten, nur eingefügt, wenn der Plan Bilder hat (alte Kompositionen bleiben bytegleich).
const BILD_CSS = `.bild-lage{position:absolute;width:${BILD.w}px;height:${BILD.h}px;transform-origin:50% 60%}.bild-karte{width:100%;height:100%;border:6px solid ${C.ink};border-radius:24px;box-shadow:12px 12px 0 ${C.ink};overflow:hidden;background:${C.ink}}.bild-foto{display:block;width:100%;height:100%;object-fit:cover}
.bild-ortw{position:absolute;left:0;width:1080px;text-align:center;line-height:0}.bild-ort{display:inline-block;background:${C.blue};border:4px solid ${C.ink};box-shadow:6px 6px 0 ${C.ink};font-weight:800;font-size:40px;line-height:1.12;padding:6px 22px 10px;border-radius:12px;transform:rotate(-2deg);white-space:nowrap}`;
const PLAN_CSS = `[data-kind=tagesplan]{transform-origin:50% 0}.tp-karte{width:${PLAN.w}px;height:100%;padding:${PLAN.pad[0]}px ${PLAN.pad[1]}px ${PLAN.pad[2]}px;background:${C.white};border:6px solid ${C.ink};border-radius:24px;box-shadow:12px 12px 0 ${C.ink};color:${C.ink}}
.tp-titel{font-weight:800;font-size:${PLAN.titel}px;line-height:1.2;margin-bottom:10px;white-space:nowrap}.tp-zeile{display:flex;align-items:center;height:${PLAN.zeile}px;white-space:nowrap}
.tp-zeit{width:${PLAN.zeitW}px;flex:0 0 ${PLAN.zeitW}px;font-family:"ABI Gochi";font-size:${PLAN.zeit}px;line-height:1;color:${C.blue};-webkit-text-stroke:4px ${C.ink};paint-order:stroke fill}.tp-text{font-weight:800;font-size:${PLAN.text}px;line-height:1.1}
.bild-klein{width:${COLL.w}px;height:${COLL.h}px}.bild-klein .bild-karte{border-width:5px;border-radius:18px;box-shadow:8px 8px 0 ${C.ink}}`;
const PLAN_TL = `// 17 (Test): Tagesplan-Karte. Karte Pop 90 → 100 % 0,35 s (wie Grafik); Zeilen am Wort 14 px von unten 0,22 s; Ausblenden 0,18 s, 8 px nach oben.
for(const t of D.tp){show('#'+t.id,t.start,t.end);pop('#'+t.id,t.start,.9,.35);t.zeilen.forEach((r,j)=>up('#'+t.id+'-z'+j,r.at));out('#'+t.id,t.end);}
`;
const BILD_TL = `// 17 (Test): B-Roll. Jedes Foto fällt auf den Stapel: aus 70 px tiefer, 6° stärker gedreht und 90 % in 0,40 s Abfedern, Deckkraft 0,12 s
// Ausklingen; darin ein ruhiger Zug 100 → 108 % (linear bis zum Gruppenende). Ort wischt ab +0,18 s in 0,28 s von links, die vorige Marke
// geht 0,10 s vor dem nächsten Foto aus. Die Gruppe blendet in 0,22 s linear aus und steigt dabei 16 px.
for(const b of D.bi){show('#'+b.id,b.start,b.end);b.fotos.forEach((f,i)=>{const s='#'+b.id+'-'+i,r=b.collage?(i%2?4:-4):(i%2?6:-6);
 tl.set(s,{opacity:0,y:70,rotation:r,scale:.9},0);tl.fromTo(s,{opacity:0},{opacity:1,duration:.12,ease:OUT,immediateRender:false},f.at);tl.fromTo(s,{y:70,rotation:r,scale:.9},{y:0,rotation:0,scale:1,duration:.4,ease:BACK,immediateRender:false},f.at);
 tl.set(s+'-img',{scale:1},0);tl.fromTo(s+'-img',{scale:1},{scale:1.08,duration:b.end-f.at,ease:LIN,immediateRender:false},f.at);
 if(f.ort){const o=s+'-ort',n=b.fotos[i+1];tl.set(o,{opacity:0},0);tl.set(o,{opacity:1},f.at+.18);wipe(o,f.at+.18,.28,20);if(n)tl.to(o,{opacity:0,duration:.1,ease:LIN},n.at-.1);}});
 tl.to('#'+b.id,{opacity:0,y:-16,duration:.22,ease:LIN},b.end-.22);}
`;
// 17 Buchcover: Zeitleisten-Teil, nur eingefügt, wenn ein Kapitel ein Cover hat (alte Kompositionen bleiben bytegleich).
const BUCH_TL = `// 17: Kapitel mit Buchcover. Cover groß Pop 90 → 100 % 0,35 s (wie Grafik), ab grossBis 0,5 s Ausklingen in den kleinen Platz
// (Rand 6 → 4, Schatten 12 → 8, Drehung −2° → −3°, nur über Transformationen); Titelzeile ab +0,3 s von unten 0,22 s, deutscher Titel 0,1 s später, Autor wischt 0,28 s.
for(const k of D.k){if(!k.buch)continue;const b=k.buch,cw='#'+k.id+'-cw',cv='#'+k.id+'-cover',f=b.big.h/b.small.h;show('#'+k.id,k.start,k.end);
 // Nur Transformationen bewegen (HyperFrames-Lint: left/top rasten auf ganze Pixel). Der Rahmen steht klein am Platzhalter; groß = verschoben
 // und skaliert (Ursprung oben links). Rand und Schatten als box-shadow, groß durch f geteilt, damit sie sichtbar 6 bzw. 12 px bleiben.
 tl.set(cw,{x:b.big.left-b.small.left,y:b.big.top-b.small.top,scale:f},0);tl.set(cv,{rotation:-2,borderRadius:8/f,boxShadow:'0 0 0 '+6/f+'px ${C.ink},'+12/f+'px '+12/f+'px 0 '+6/f+'px ${C.ink}'},0);
 pop(cv,k.start,.9,.35);tl.to(cw,{x:0,y:0,scale:1,duration:.5,ease:OUT},b.grossBis);
 tl.to(cv,{rotation:-3,borderRadius:6,boxShadow:'0 0 0 4px ${C.ink},8px 8px 0 4px ${C.ink}',duration:.5,ease:OUT},b.grossBis);
 up('#'+k.id+'-title',b.titleAt);if(b.de)up('#'+k.id+'-de',b.deAt);if(b.autor){const au='#'+k.id+'-autor';tl.set(au,{opacity:0},0);tl.set(au,{opacity:1},b.autorAt);wipe(au,b.autorAt,.28,20);}out('#'+k.id,k.end);}
`;
function timeline22(plan, abschnitt) {
  const hatBuch = (plan.kapitel || []).some(k => k.buch);
  const D = { ...((plan.bilder || []).length ? { bi: plan.bilder } : {}), ...((plan.tagesplaene || []).length ? { tp: plan.tagesplaene } : {}), e: plan.einstieg, k: plan.kapitel || [], h1: plan.h1 || [], h2: plan.h2 || [], p: plan.pillen || [], a: plan.akronyme || [], s: plan.schlagworte || [], g: plan.grafiken || [], n: plan.randnotizen || [], b: plan.lebensbalken || [], l: plan.logos || [], sb: plan.sprechblasen || [], c: plan.captions || [], z: plan.zooms || [], o: plan.outro, hide: plan.ausblenden || [], logoH1: plan.logoH1 || [] };
  return `
function bezier(x1,y1,x2,y2){const f=(s,a,b)=>3*(1-s)*(1-s)*s*a+3*(1-s)*s*s*b+s*s*s;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(f(m,x1,x2)<x)lo=m;else hi=m;}return f((lo+hi)/2,y1,y2);};}
const OUT=bezier(${EASE.out}),BACK=bezier(${EASE.back}),LIN='none',D=${JSON.stringify(D)};
const tl=gsap.timeline({paused:true});tl.to({},{duration:${plan.duration}});
// Sichtbarkeit am Inhalt des Clips; den Clip selbst verwaltet HyperFrames.
const show=(s,a,b)=>{const c=s+' > *';tl.set(c,{visibility:'visible'},a);tl.set(c,{visibility:'hidden'},b);};
const out=(s,end)=>tl.to(s,{opacity:0,y:-8,duration:.18,ease:LIN},end-.18);           // 15: Ausblenden 0,18 s, Linear, 8 px nach oben
const up=(s,at,dy=14)=>{tl.set(s,{opacity:0,y:dy},0);tl.fromTo(s,{opacity:0,y:dy},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},at);};
const pop=(s,at,from,dur)=>{tl.set(s,{opacity:0,scale:from},0);tl.set(s,{opacity:1},at);tl.fromTo(s,{scale:from},{scale:1,duration:dur,ease:BACK,immediateRender:false},at);};
// Wischblende in px (27.09.2026, Tempo Phase 3): Von „100 %“ auf „-20px“ rechnet GSAP ohne Einheit um, die Blende sprang
// im ersten Bild fast ganz auf. Breite deshalb beim ersten Abspielen messen (Schriften sind dann geladen).
const hidR=(s,m)=>()=>{const e=document.querySelector(s);return 'inset(-'+m+'px '+((e?e.offsetWidth:0)+m)+'px -'+m+'px -'+m+'px)';};
const wipe=(s,at,dur,m)=>{const vis='inset(-'+m+'px -'+m+'px -'+m+'px -'+m+'px)';tl.set(s,{clipPath:hidR(s,m)},0);tl.fromTo(s,{clipPath:hidR(s,m)},{clipPath:vis,duration:dur,ease:OUT,immediateRender:false},at);};
// Zeichnen über das SVG-Attribut: GSAP rundet die CSS-Eigenschaft strokeDashoffset auf ganze Pixel, bei pathLength 1
// sprang jede Linie dadurch von unsichtbar auf fertig (Fast 30, 27.09.2026: Durchstreichen und ETF-Linie „zu schnell“).
const draw=(s,at,dur)=>tl.to(s,{attr:{'stroke-dashoffset':0},duration:dur,ease:OUT},at);
// 5: Einstieg steht ab dem ersten Bild; H1 blendet aus, H2 0,06 s später.
show('#einstieg-h1',0,D.e.end);out('#einstieg-h1',D.e.end);if(D.e.h2||D.e.logo){show('#einstieg-h2',0,D.e.end+.06);out('#einstieg-h2',D.e.end+.06);}
// 15: H1 im Video Stoß 112 → 100 %, 0,22 s (Referenz h1in: zugleich Deckkraft 0 → 1).
for(const h of D.h1){show('#'+h.id,h.start,h.end);tl.set('#'+h.id+' .h1',{opacity:0,scale:1.12},0);tl.fromTo('#'+h.id+' .h1',{opacity:0,scale:1.12},{opacity:1,scale:1,duration:.22,ease:OUT,immediateRender:false},h.start);out('#'+h.id,h.end);}
// 15: H2 wischt in 0,28 s von links auf; 0,06 s nach einer gleichzeitig beginnenden H1.
for(const h of D.h2){const at=h.start+(D.h1.some(x=>Math.abs(x.start-h.start)<.01)?.06:0);show('#'+h.id,h.start,h.end);wipe('#'+h.id+' .h2',at,.28,20);out('#'+h.id,h.end);}
// 15: Kapitel. Zahl schreibt sich von links (Maske) 0,40 s, Titel ab 0,35 s von unten 0,22 s.
${hatBuch ? BUCH_TL : ''}for(const k of D.k){${hatBuch ? 'if(k.buch)continue;' : ''}show('#'+k.id,k.start,k.end);if(k.nummer)wipe('#'+k.id+'-num',k.start,.4,40);up('#'+k.id+'-title',k.start+(k.nummer?.35:0));out('#'+k.id,k.end);}
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
${(plan.lebensbalken || []).some(b => b.trenner) ? `// 13: Trennlinie in Tinte an der Abschnittsgrenze (Planoption trenner, Befund 04.10.2026: zwei blaue Abschnitte verschmelzen sonst).
for(const b of D.b){if(b.trenner)b.segments.forEach((s,i)=>{if(i){tl.set('#'+b.id+'-t'+i,{opacity:0},0);tl.set('#'+b.id+'-t'+i,{opacity:1},s.at);}});}
` : ''}for(const b of D.b){show('#'+b.id,b.start,b.end);up('#'+b.id+' .bal-bed',b.start);b.segments.forEach((s,i)=>{up('#'+b.id+'-l'+i,s.at);tl.to('#'+b.id+'-f'+i,{scaleX:1,duration:1,ease:OUT},s.at);});out('#'+b.id,b.end);}
// 15: Logo. Wischblende von links 0,28 s, Ausblenden 0,22 s in gleicher Richtung; H1/Kapitel 0,1 s vorher aus, 0,1 s danach wieder an.
for(const l of D.l){show('#'+l.id,l.start,l.end);wipe('#'+l.id+' .logo',l.start,.28,0);tl.to('#'+l.id+' .logo',{clipPath:()=>'inset(-0px -0px -0px '+document.querySelector('#'+l.id+' .logo').offsetWidth+'px)',duration:.22,ease:LIN},l.end-.22);}
for(const x of D.logoH1){tl.to(x.sel,{opacity:0,duration:.1,ease:LIN},x.out);tl.to(x.sel,{opacity:1,duration:.1,ease:LIN},x.in);}
// 10: Schlagwort. Stoßzoom hart auf 112 % (Ursprung 42/28), Wort Pop 55 → 100 % 0,30 s; Striche ab 0,25 s, je 0,25 s, der zweite 0,15 s später (Referenz).
for(const s of D.s){show('#'+s.id,s.start,s.end);pop('#'+s.id+' .sw-pop',s.start,.55,.3);draw(['#'+s.id+'-u0i','#'+s.id+'-u0p'],s.start+.25,.25);draw(['#'+s.id+'-u1i','#'+s.id+'-u1p'],s.start+.4,.25);tl.set('#footage',{scale:1.12},s.start);tl.set('#footage',{scale:1},s.end);out('#'+s.id,s.end);}
// Ausblenden anderer oberer Ebenen während Schlagwort und Grafik (über die Sichtbarkeit, Deckkraft-Animationen bleiben unberührt).
for(const h of D.hide){tl.set(h.sel+' > *',{visibility:'hidden'},h.from);if(h.to!=null)tl.set(h.sel+' > *',{visibility:'visible'},h.to);}
// 15: Grafik. Karte Pop 90 → 100 % 0,35 s; Hauptlinie 1,0 s; Vergleichslinie blendet 0,30 s ein; Kreis danach 0,30 s.
for(const g of D.g){if(!g.ohneHintergrund)show('#'+g.id+'-bg',g.start,g.end);show('#'+g.id,g.start,g.end);pop('#'+g.id,g.start,.9,.35);draw('#'+g.id+' .main-line',g.drawAt,1);tl.set('#'+g.id+' .cmp-line',{opacity:0},0);tl.to('#'+g.id+' .cmp-line',{opacity:1,duration:.3,ease:OUT},g.cmpAt);draw('#'+g.id+' .hl-circle',g.circleAt,.3);for(const x of g.labels){tl.set('#'+x.id,{opacity:0},0);tl.to('#'+x.id,{opacity:1,duration:.22,ease:OUT},x.at);}for(const z of g.spaet||[]){up('#'+z.id,z.at);draw('#'+z.id+' .late-line',z.at+.1,1);}}
${(plan.bilder || []).length ? BILD_TL : ''}${(plan.tagesplaene || []).length ? PLAN_TL : ''}// 7: Untertitel hart; genau ein Wort blau; das letzte bleibt blau, bis die nächste Gruppe beginnt.
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
${abschnitt ? `// Abschnitt ${abschnitt.t0}–${+(abschnitt.t0 + abschnitt.dauer).toFixed(4)} s: dieselbe absolute Zeitleiste, auf 1/30 s eingerastet,
// damit jedes Bild genau dem Bild der vollen Komposition entspricht.
// Erst direkt auf den Abschnittsbeginn setzen: sonst greifen die Anfangszustände (tl.set bei 0) im Sprung nicht (28.09.2026).
tl.totalTime(${abschnitt.t0},true);const seg=gsap.timeline({paused:true});seg.fromTo(tl,{totalTime:${abschnitt.t0}},{totalTime:${+(abschnitt.t0 + abschnitt.dauer).toFixed(6)},duration:${abschnitt.dauer},ease:'none',snap:{totalTime:1/30}},0);
window.__timelines={root:seg};` : 'window.__timelines={root:tl};'}
`;
}
