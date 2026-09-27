// Grafik-Karte nach DESIGN.md 2.0 Abschnitt 11: x = 150, y = 270, Breite 780, Weiß, Rand Tinte 6, Radius 24,
// harter Schatten 12 px, Innenabstand 26/34/22, Titel Archivo 800 34 px, Hauptlinie Blau 9 auf Tinte 15 (runde Enden),
// Vergleichslinie Tinte 6 gepunktet (2 px Strich, 12 px Lücke), Achse Tinte 4, Beschriftung Archivo 700 24 px,
// Hervorhebung handgezeichneter Kreis Tinte 4 px. Die Zahlen rechnet der Aufrufer (grafik-rechnung.json).
const INK = '#111111', BLUE = '#5EAAEE';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildChart(g, { A, errors }) {
  const c = g.chart, W = 700, plotH = c.plotHeight ?? 300, top = 20, axisGap = 12, labelH = 29;
  const svgH = top + plotH + axisGap + labelH;
  const height = Math.round(6 + 26 + 34 * 1.2 + 14 + svgH + 22 + 6);
  if (270 + height + 12 > 900) errors.push(`Grafik ${g.id}: Karte samt Schatten reicht bis y ${270 + height + 12} (untere Zone rechts gesperrt ab x 930)`);
  if (A(c.title, 34, 800) > W) errors.push(`Grafik ${g.id}: Titel zu breit`);
  const X = x => ((x - c.xMin) / (c.xMax - c.xMin)) * W, Y = y => top + plotH - (y / c.yMax) * plotH;
  const d = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join(' ');
  const axisY = top + plotH;
  const ticks = c.xTicks.map(t => `<text x="${X(t.v).toFixed(1)}" y="${axisY + axisGap + 22}" text-anchor="${t.v === c.xMin ? 'start' : t.v === c.xMax ? 'end' : 'middle'}">${esc(t.label)}</text>`).join('');
  const labels = (c.labels || []).map(l => {
    const w = A(l.text, 24, 700);
    const x = X(l.x) + (l.dx || 0), y = Y(l.y) + (l.dy || 0), left = l.anchor === 'end' ? x - w : l.anchor === 'middle' ? x - w / 2 : x;
    if (left < -1 || left + w > W + 1) errors.push(`Grafik ${g.id}: Beschriftung „${l.text}" ragt aus der Karte`);
    return `<text id="${g.id}-${l.id}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${l.anchor || 'start'}"${l.size ? ` style="font-size:${l.size}px;font-weight:800"` : ''}>${esc(l.text)}</text>`;
  }).join('');
  const h = c.highlight, hx = X(h.x), hy = Y(h.y), r = h.r ?? 26;
  // Handgezeichneter Kreis: leicht unrund, Anfang und Ende überlappen.
  const circle = `M ${(hx + r).toFixed(1)} ${(hy - 3).toFixed(1)} C ${(hx + r + 2).toFixed(1)} ${(hy + r * 0.9).toFixed(1)} ${(hx - r * 0.9).toFixed(1)} ${(hy + r + 3).toFixed(1)} ${(hx - r - 1).toFixed(1)} ${(hy + 2).toFixed(1)} C ${(hx - r - 3).toFixed(1)} ${(hy - r * 0.95).toFixed(1)} ${(hx + r * 0.8).toFixed(1)} ${(hy - r - 4).toFixed(1)} ${(hx + r + 5).toFixed(1)} ${(hy - 7).toFixed(1)}`;
  const svg = `<svg width="${W}" height="${svgH}" viewBox="0 0 ${W} ${svgH}" style="margin-top:14px">
<line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>${ticks}
<path class="cmp-line" d="${d(c.cmp)}" fill="none" stroke="${INK}" stroke-width="6" stroke-dasharray="2 12"/>
<path class="main-line" d="${d(c.main)}" pathLength="1" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
<path class="main-line" d="${d(c.main)}" pathLength="1" fill="none" stroke="${BLUE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
<path class="hl-circle" d="${circle}" pathLength="1" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
${labels}</svg>`;
  return { id: g.id, start: g.start, end: g.end, drawAt: g.drawAt, cmpAt: g.cmpAt, circleAt: g.circleAt, title: c.title, height, svg, person: g.person, labels: (c.labels || []).filter(l => l.at != null).map(l => ({ id: `${g.id}-${l.id}`, at: l.at })) };
}
