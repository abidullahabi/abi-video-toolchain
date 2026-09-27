// Randnotiz nach DESIGN.md 2.0 Abschnitt 12 (nur Vorher/Nachher): Archivo 800 46 px, Zeilenhöhe 1,3, Kontur 4 px,
// Wortabstand +4 px, linksbündig, Seite dort, wo neben dem Kopf Platz ist, Oberkante ≥ 60 px unter der Überschrift (Regelfall 430),
// Durchstreichen Pink 5 auf Tinte 11, Mitte bei 54 % der Zeilenhöhe, 8 px Überstand, Abstand alt zu neu 22 px,
// Zahlen der neuen Zeile Gochi Hand 58 px Blau Kontur 5 px, nie über Gesicht/Kappe, unten vor y = 1280.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LH = 46 * 1.3;

export function buildNote(n, { A, G, heads, errors, h1Bottom }) {
  const lines = n.lines.map((l, j) => {
    const neu = !l.strikeAt && j > 0, parts = neu ? l.text.split(/(\d+(?:[.,]\d+)?)/) : [l.text];
    const width = parts.reduce((s, p, i) => s + (i % 2 ? G(p, 58) : A(p, 46, 800, 100, 4)), 0) + 8;
    const html = parts.map((p, i) => i % 2 ? `<span class="note-num">${esc(p)}</span>` : esc(p)).join('');
    const strike = l.strikeAt != null ? { at: l.strikeAt, w: Math.round(width - 8 + 16), top: Math.round(LH * 0.54 - 12), d: `M 0 13 C ${((width + 8) * 0.35).toFixed(1)} 10.5 ${((width + 8) * 0.7).toFixed(1)} 14 ${(width + 8).toFixed(1)} 11.5` } : null;
    return { text: l.text, at: l.at, html, width, strike };
  });
  const width = Math.max(...lines.map(l => l.width)) + 8;
  const height = lines.length * LH + (lines.length - 1) * 22;
  const top = Math.max(430, h1Bottom(n.start + 0.01) + 60);
  const hs = heads(n.start, n.end);
  const headLeft = Math.min(...hs.map(h => h.x)), headRight = Math.max(...hs.map(h => h.x + h.w));
  const leftRoom = headLeft - 10 - 108, rightRoom = 972 - (headRight + 10);
  const side = n.seite && n.seite !== 'auto' ? n.seite : leftRoom >= rightRoom ? 'links' : 'rechts';
  const left = side === 'links' ? 108 : Math.round(Math.min(972 - width, headRight + 30));
  const box = { x: left - 8, y: top, w: width + 8, h: height };
  const over = hs.filter(h => box.x < h.x + h.w && box.x + box.w > h.x && box.y < h.y + h.h && box.y + box.h > h.y);
  if (over.length) errors.push(`Randnotiz ${n.id} (${side}) überdeckt Kopf/Kappe in ${over.length} Stichproben; Breite ${Math.round(width)} px, Platz links ${Math.round(leftRoom)}, rechts ${Math.round(rightRoom)}`);
  if (top + height > 1280) errors.push(`Randnotiz ${n.id} reicht bis y ${Math.round(top + height)}`);
  return { id: n.id, start: n.start, end: n.end, left, top, side, lines };
}
