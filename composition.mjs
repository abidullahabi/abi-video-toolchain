const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const jsData = value => JSON.stringify(value).replace(/</g, '\\u003c');

export function parseSrt(input) {
  const blocks = input.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/);
  const cues = [];
  const toSeconds = value => { const [h, m, s] = value.replace(',', '.').split(':').map(Number); return h * 3600 + m * 60 + s; };
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split('\n');
    if (/^\d+$/.test(lines[0])) lines.shift();
    const times = lines.shift()?.match(/^(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s*$/);
    if (!times) throw new Error('Ungültiger SRT-Zeitstempel.');
    const start = toSeconds(times[1]), end = toSeconds(times[2]);
    const text = lines.join(' ').replace(/<\/?(?:b|i|u)>/gi, '').trim();
    if (start < 0 || end <= start || !text) throw new Error('Untertitel ohne Text oder mit ungültiger Dauer.');
    if (cues.length && start < cues.at(-1).end - 0.002) throw new Error('Überlappende Untertitel. Bitte die Zeitangaben korrigieren.');
    cues.push({ start, end, text });
  }
  return cues;
}

export function makeComposition({ duration, cues, design }) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Ungültige Dauer.');
  if (!/^#[0-9a-f]{6}$/i.test(design.accent)) throw new Error('accent muss eine Farbe wie #CAFF70 sein.');
  const fontSize = Number(design.captionFontSize ?? 64);
  if (!Number.isFinite(fontSize) || fontSize < 36 || fontSize > 88) throw new Error('captionFontSize muss zwischen 36 und 88 liegen.');
  const title = String(design.title || '').trim();
  if (title.length > 100) throw new Error('Bitte die Überschrift auf höchstens 100 Zeichen kürzen.');
  const titleSeconds = Math.min(duration, Number(design.titleSeconds ?? 2.8));
  if (!Number.isFinite(titleSeconds) || titleSeconds <= 0) throw new Error('titleSeconds muss positiv sein.');
  const callouts = design.callouts || [];
  if (!Array.isArray(callouts)) throw new Error('callouts muss eine Liste sein.');
  let lastEnd = title ? titleSeconds : 0;
  const graphics = callouts.map((item, i) => {
    const start = Number(item.start), end = Number(item.end), text = String(item.text || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < lastEnd || end <= start || end > duration || !text.trim() || text.length > 100) throw new Error('Einblendungen benötigen Text, gültige Zeiten und dürfen sich nicht mit Titel oder anderen Einblendungen überschneiden.');
    lastEnd = end;
    return { id: `callout-${i}`, start, end, text };
  });
  const captionHtml = cues.map((c, i) => `<div id="caption-${i}" class="clip caption" data-start="${c.start}" data-duration="${Math.min(c.end, duration) - c.start}" data-track-index="2"><span>${escapeHtml(c.text)}</span></div>`).join('\n');
  const graphicHtml = graphics.map(g => `<div id="${g.id}" class="clip callout" data-start="${g.start}" data-duration="${g.end-g.start}" data-track-index="3"><span>${escapeHtml(g.text)}</span></div>`).join('\n');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title || 'Videoentwurf')}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#111;font-family:Arial,Helvetica,sans-serif}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111;color:#fff}
#footage{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0}
.caption{position:absolute;left:80px;right:160px;bottom:340px;text-align:center;z-index:20;font-size:${fontSize}px;font-weight:700;line-height:1.17;overflow-wrap:anywhere;text-shadow:0 2px 4px #000}
.caption span{background:rgba(0,0,0,.80);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:8px 18px;border-radius:10px}
.title,.callout{position:absolute;left:80px;right:160px;top:220px;z-index:30;font-size:68px;font-weight:800;line-height:1.08;overflow-wrap:anywhere}
.title span,.callout span{display:inline-block;background:${design.accent};color:#141711;padding:24px 28px;border-radius:16px;box-shadow:0 12px 40px #0005}
.callout{font-size:60px}
</style><script src="vendor/gsap.min.js"></script></head>
<body><main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
<audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
${title ? `<div id="title" class="clip title" data-start="0" data-duration="${titleSeconds}" data-track-index="3"><span>${escapeHtml(title)}</span></div>` : ''}
${captionHtml}
${graphicHtml}
</main><script>
const tl=gsap.timeline({paused:true});
tl.to({}, {duration:${duration}} ,0);
${title ? `tl.fromTo('#title',{y:-28,opacity:0},{y:0,opacity:1,duration:0.35,ease:'power2.out'},0);` : ''}
const graphics=${jsData(graphics)};
for(const g of graphics){tl.fromTo('#'+g.id,{y:26,opacity:0,scale:.97},{y:0,opacity:1,scale:1,duration:Math.min(.3,(g.end-g.start)/3),ease:'power2.out'},g.start);}
window.__timelines=window.__timelines||{};window.__timelines.root=tl;
</script></body></html>`;
}
