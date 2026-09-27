// Umsetzung von DESIGN.md 2.0 „Klar mit Kante" (27.09.2026) für HyperFrames.
// Alle Maße, Farben, Schriften und Bewegungen stammen aus DESIGN.md 2.0; die Abschnittsnummern stehen am Code.
// Annahmen für Stellen, die DESIGN.md nicht regelt, stehen in plan.annahmen und im Projekt (review/annahmen.md).
// Geometrie (Schriftgrößen, Breiten, Positionen, Grafik-SVG) rechnet build-plan-klar.mjs vorab; diese Datei baut nur HTML und Zeitleiste.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const C = { ink: '#111111', white: '#FFFFFF', off: '#F6F1E9', blue: '#5EAAEE', pink: '#FF8AC2' };
const stroke = w => `-webkit-text-stroke:${2 * w}px ${C.ink};paint-order:stroke fill`; // Abschnitt 4: sichtbare Außenbreite w

export function makeKlarComposition(plan) {
  const { duration, einstieg, kapitel = [], h1Video = [], h2 = [], pillen = [], schlagworte = [], grafiken = [], randnotizen = [], balken = [], captions = [], zooms = [], outro } = plan;
  if (!outro || !Number.isInteger(outro.followers) || outro.followers < 0) throw Error('Followerstand fehlt (follower-source.json).');
  if (schlagworte.length > 2) throw Error('DESIGN.md 1: Schlagwort höchstens zweimal pro Video.');
  for (const z of zooms) if (!(z.scale >= 1.05 && z.scale <= 1.07 && z.end - z.start >= 2 - 1e-6 && z.end - z.start <= 4 + 1e-6)) throw Error('Zoom außerhalb DESIGN.md 15: ' + JSON.stringify(z));
  const clip = (id, start, end, track, kind, extra = '') => `id="${id}" class="clip" data-start="${start}" data-duration="${+(end - start).toFixed(4)}" data-track-index="${track}" data-kind="${kind}"${extra}`;
  const lines = (arr, cls = 'ln') => arr.map(l => `<span class="${cls}">${esc(l)}</span>`).join('');

  // 5 und 6: Einstieg (H1 Pflicht, H2 optional), steht ab dem ersten codierten Frame.
  const e = einstieg;
  const einstiegHtml = `<div ${clip('einstieg-h1', 0, e.end, 2, 'h1', ` data-einstieg="1"`)} style="top:250px;font-size:${e.h1.fontSize}px;visibility:visible;opacity:1"><span class="h1">${lines(e.h1.lines)}</span></div>`
    + (e.h2 ? `<div ${clip('einstieg-h2', 0, e.end + 0.06, 3, 'h2', ` data-einstieg="1"`)} style="top:${e.h2.top}px;visibility:visible;opacity:1"><span class="h2">${lines(e.h2.lines)}</span></div>` : '');
  const h1VideoHtml = h1Video.map(h => `<div ${clip(h.id, h.start, h.end, 2, 'h1')} style="top:250px;font-size:${h.fontSize}px"><span class="h1">${lines(h.lines)}</span></div>`).join('');
  const h2Html = h2.map(h => `<div ${clip(h.id, h.start, h.end, 3, 'h2')} style="top:${h.top}px"><span class="h2">${lines(h.lines)}</span></div>`).join('');

  // 8: Kapitel. Zahl Gochi Hand 140 px blau, Kontur 7, −4°, Titel Archivo 900 64 px, Abstand 28, Gruppe auf x = 540.
  const kapitelHtml = kapitel.map(k => `<div ${clip(k.id, k.start, k.end, 4, 'kapitel')} style="top:${k.top}px"><span class="kap"><span class="kap-num" id="${k.id}-num">${esc(k.nummer)}</span><span class="kap-title" id="${k.id}-title">${esc(k.titel)}</span></span></div>`).join('');

  // 9: Pillen. Kapsel mit weißem Rand 5 px zwischen zwei Tintenringen 3 px, Punkt 56 px mit Nummer (Gochi Hand 48 px).
  const pillenHtml = pillen.map(p => `<div ${clip(p.id, p.start, p.end, 5, 'pillen', ` data-layout="${p.layout}"`)} style="top:${p.top}px">${p.items.map((it, i) =>
    `<span class="pill-wrap" id="${p.id}-${i}" style="${p.layout === 'stack' ? `transform:translateX(${it.dx}px) rotate(${it.rot}deg)` : ''}"><span class="pill${p.layout === 'row' ? ' pill-row' : ''}">${p.layout === 'row' ? '' : p.numbered ? `<span class="pill-dot"><span class="pill-no">${i + 1}</span></span>` : '<span class="pill-dot pill-dot-s"></span>'}<span class="pill-text">${esc(it.text)}</span></span></span>`).join('')}</div>`).join('');

  // 10: Schlagwort mit pinker Doppelunterstreichung (handgezeichnet, Pink auf Tinte).
  const schlagHtml = schlagworte.map(s => `<div ${clip(s.id, s.start, s.end, 8, 'schlagwort')} style="top:330px"><span class="sw" style="font-size:${s.fontSize}px"><span class="sw-word">${esc(s.text)}</span>
    <svg class="sw-lines" width="${s.lineWidth}" height="60" viewBox="0 0 ${s.lineWidth} 60" overflow="visible">${s.paths.map((d, j) => `<path id="${s.id}-u${j}i" d="${d}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="${j ? 20 : 22}" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path id="${s.id}-u${j}p" d="${d}" pathLength="1" fill="none" stroke="${C.pink}" stroke-width="${j ? 10 : 12}" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>`).join('')}</svg></span></div>`).join('');

  // 12: Randnotiz (Vorher/Nachher). Linksbündig, Durchstreichen Pink 5 auf Tinte 11, Mitte 54 % der Zeilenhöhe, 8 px Überstand.
  const noteHtml = randnotizen.map(n => `<div ${clip(n.id, n.start, n.end, 7, 'randnotiz')} style="left:${n.left}px;top:${n.top}px">${n.lines.map((l, j) =>
    `<div class="note-line" id="${n.id}-l${j}" style="margin-top:${j ? 22 : 0}px">${l.html}${l.strike ? `<svg class="note-strike" id="${n.id}-s${j}" width="${l.strike.w}" height="24" viewBox="0 0 ${l.strike.w} 24" style="left:-8px;top:${l.strike.top}px" overflow="visible"><path d="${l.strike.d}" pathLength="1" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/><path d="${l.strike.d}" pathLength="1" fill="none" stroke="${C.pink}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/></svg>` : ''}</div>`).join('')}</div>`).join('');

  // 13: Lebensbalken 700 × 26 px, Oberkante y = 370, Füllung Blau in Abschnitten, Beschriftung über dem Abschnitt.
  const balkenHtml = balken.map(b => `<div ${clip(b.id, b.start, b.end, 9, 'balken')} style="left:190px;top:${370 - 54}px;width:700px">${b.segments.map((s, i) => `<span class="bal-label" id="${b.id}-l${i}" style="left:${s.labelLeft}px">${esc(s.label)}</span>`).join('')}<div class="bal-bed">${b.segments.map((s, i) => `<div class="bal-fill" id="${b.id}-f${i}" style="left:${s.from * 700}px;width:${(s.to - s.from) * 700}px"></div>`).join('')}</div></div>`).join('');

  // 11: Grafik mit Green Screen. Ebenen Hintergrund (Off-White + Seigaiha), Karte, Person (RVM, eigene Alpha-Ebene), Untertitel.
  const seigaiha = `<svg width="1080" height="1920" style="position:absolute;inset:0"><defs><pattern id="seigaiha" width="80" height="40" patternUnits="userSpaceOnUse">${[[40, 0], [0, 20], [80, 20], [40, 40]].map(([x, y]) => [40, 31, 22, 13, 5].map(r => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.off}" stroke="${C.ink}" stroke-width="2.5"/>`).join('')).join('')}</pattern></defs><rect width="1080" height="1920" fill="${C.off}"/><rect width="1080" height="1920" fill="url(#seigaiha)" opacity=".12"/></svg>`;
  const gsBack = grafiken.map(g => `<div ${clip(g.id + '-bg', g.start, g.end, 10, 'gs-bg')} style="inset:0">${seigaiha}</div>`).join('');
  const gsCard = grafiken.map(g => `<div ${clip(g.id, g.start, g.end, 11, 'grafik')} style="left:150px;top:270px;width:780px;height:${g.height}px"><div class="card" id="${g.id}-card"><div class="card-title">${esc(g.title)}</div>${g.svg}</div></div>`).join('');
  const gsPerson = grafiken.map(g => `<video id="${g.id}-person" class="clip" src="${g.person}" data-start="${g.start}" data-duration="${+(g.end - g.start).toFixed(4)}" data-track-index="12" data-volume="0" muted playsinline style="position:absolute;inset:0;width:1080px;height:1920px"></video>`).join('');

  // 7: Untertitel. Archivo 800 64 px, Kontur 6, ohne Box, ein aktives Wort blau, Oberkante y = 1280, einzeilig.
  const capHtml = captions.map((c, i) => `<div ${clip('cap-' + i, c.start, c.end, 20, 'caption')} style="top:1280px"><span class="cap-line">${c.words.map((w, j) => `<span id="w-${i}-${j}">${esc(w.text)}</span>`).join(' ')}</span></div>`).join('');

  // 14: Outro. „Folgen nicht vergessen" y = 250, Karte x = 90, Unterkante 1660, 700 × 237.
  const profiles = [['youtube', '@itsabidullahabi'], ['tiktok', '@abidullahabi'], ['instagram', '@abidullahabi'], ['linkedin', 'Abdullah Bachtari']];
  const outroHtml = `<div ${clip('follow', outro.start, outro.end, 21, 'follow')} style="top:250px"><span class="follow">Folgen nicht vergessen</span></div>
  <div ${clip('outro-card', outro.start, outro.end, 21, 'outro-card')} style="left:90px;top:${1660 - 237}px;width:700px;height:237px"><div class="oc"><div class="oc-head"><span class="oc-count">${Array.from({ length: 43 }, (_, i) => `<span id="cnt-${i}" class="cnt">0</span>`).join('')}</span><span class="oc-goal">Ziel 10.000</span></div><div class="oc-track"><div id="oc-fill" class="oc-fill"></div></div><div class="oc-grid">${profiles.map(([p, n]) => `<div class="oc-prof" data-platform="${p}"><span class="oc-icon"><img src="assets/tile-${p}.png" width="34" height="34" alt="${p}"></span><span class="oc-handle">${esc(n)}</span></div>`).join('')}</div></div></div>`;

  const css = `
@font-face{font-family:"ABI Archivo";src:url("assets/Archivo.ttf") format("truetype");font-weight:100 900;font-stretch:62% 125%;font-style:normal;font-display:block}
@font-face{font-family:"ABI Gochi";src:url("assets/GochiHand-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:block}
*{box-sizing:border-box}html,body{margin:0;background:${C.ink}}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;color:${C.white};font-family:"ABI Archivo";font-synthesis:none;font-kerning:normal}
#footage{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;transform-origin:42% 28%}
.clip[data-kind]{position:absolute;visibility:hidden}
#layer-top{position:absolute;inset:0;clip-path:polygon(90px 250px,1024px 250px,1024px 900px,930px 900px,930px 1660px,90px 1660px)}
[data-kind=h1]{left:0;width:1080px;text-align:center;line-height:1.02}
.h1{display:inline-block;font-weight:900;font-stretch:125%;text-transform:uppercase;white-space:nowrap;${stroke(8)};transform-origin:50% 50%}
.h1 .ln{display:block}
[data-kind=h2]{left:0;width:1080px;text-align:center}
.h2{display:inline-block;background:${C.blue};color:${C.white};font-weight:800;font-size:58px;line-height:1.12;padding:8px 28px 14px;border-radius:12px;transform:rotate(-2deg);white-space:nowrap;max-width:780px}
.h2 .ln{display:block}
[data-kind=kapitel]{left:0;width:1080px;text-align:center}
.kap{display:inline-flex;align-items:center;gap:28px;white-space:nowrap}
.kap-num{font-family:"ABI Gochi";font-size:140px;line-height:1;color:${C.blue};${stroke(7)};display:inline-block;transform:rotate(-4deg)}
.kap-title{font-weight:900;font-size:64px;line-height:1.12;word-spacing:6px;${stroke(6)};display:inline-block}
[data-kind=pillen]{left:0;width:1080px;display:flex;flex-direction:column;align-items:center;gap:20px}
[data-kind=pillen][data-layout=row]{flex-direction:row;justify-content:center;gap:16px}
.pill-wrap{display:inline-block}
.pill{display:inline-flex;align-items:center;gap:12px;padding:8px 32px 10px 12px;border:5px solid ${C.white};border-radius:999px;box-shadow:0 0 0 3px ${C.ink},inset 0 0 0 3px ${C.ink};white-space:nowrap}
.pill-row{padding:8px 32px 10px 32px}
.pill-dot{width:56px;height:56px;flex:0 0 56px;border-radius:50%;background:${C.blue};border:3px solid ${C.ink};display:inline-flex;align-items:center;justify-content:center}
.pill-dot-s{width:26px;height:26px;flex-basis:26px}
.pill-no{font-family:"ABI Gochi";font-size:48px;line-height:1;color:${C.ink}}
.pill-text{font-weight:800;font-size:54px;line-height:1.12;${stroke(5)}}
.pill-row .pill-text{font-size:42px}
[data-kind=schlagwort]{left:0;width:1080px;text-align:center}
.sw{position:relative;display:inline-block;font-weight:900;font-stretch:125%;text-transform:uppercase;line-height:1.02;white-space:nowrap;${stroke(9)};transform:rotate(-3deg)}
.sw-word{display:block}
.sw-lines{position:absolute;left:50%;transform:translateX(-50%);top:100%;margin-top:-6px}
[data-kind=randnotiz]{font-weight:800;font-size:46px;line-height:1.3;word-spacing:4px;${stroke(4)};text-align:left}
.note-line{position:relative;width:max-content;white-space:nowrap}
.note-num{font-family:"ABI Gochi";font-size:58px;color:${C.blue};${stroke(5)}}
.note-strike{position:absolute}
.bal-bed{position:absolute;left:0;top:54px;width:700px;height:26px;border-radius:13px;background:${C.off};box-shadow:0 0 0 3px ${C.ink};overflow:hidden}
.bal-fill{position:absolute;top:0;height:100%;background:${C.blue};transform-origin:0 50%;transform:scaleX(0)}
.bal-label{position:absolute;top:0;font-weight:800;font-size:40px;line-height:1.2;${stroke(5)};white-space:nowrap}
[data-kind=grafik]{transform-origin:50% 50%}
.card{position:absolute;inset:0;background:${C.white};border:6px solid ${C.ink};border-radius:24px;box-shadow:12px 12px 0 ${C.ink};padding:26px 34px 22px;color:${C.ink}}
.card-title{font-weight:800;font-size:34px;line-height:1.2;white-space:nowrap}
.card svg{display:block;overflow:visible}
.card text{font-family:"ABI Archivo";font-weight:700;font-size:24px;fill:${C.ink}}
[data-kind=caption]{left:0;width:1080px;text-align:center;line-height:1.12}
.cap-line{display:inline-block;font-weight:800;font-size:64px;white-space:nowrap;${stroke(6)}}
.cap-line>span{color:${C.white}}
[data-kind=follow]{left:0;width:1080px;text-align:center}
.follow{display:inline-block;font-weight:800;font-size:50px;line-height:1.2;white-space:nowrap;${stroke(5)}}
[data-kind=outro-card]{transform-origin:0 100%}
.oc{width:100%;height:100%;padding:22px;background:#F8F9FB;border-radius:20px;color:#16181C;font-weight:700}
.oc-head{display:flex;align-items:center;justify-content:space-between;height:44px;line-height:1.2}
.oc-count{position:relative;display:block;width:160px;height:44px;font-size:36px}.cnt{position:absolute;left:0;top:0;visibility:hidden}.cnt:first-child{visibility:inherit}
.oc-goal{font-size:26px;color:#7A7E86}
.oc-track{height:19px;margin-top:12px;background:#DEE1E7;border-radius:10px;overflow:hidden}.oc-fill{height:100%;width:100%;background:${C.blue};border-radius:10px;transform-origin:0 50%;transform:scaleX(0)}
.oc-grid{display:grid;grid-template-columns:auto auto;justify-content:space-between;row-gap:13px;column-gap:14px;margin-top:18px}
.oc-prof{display:flex;align-items:center;gap:12px;height:34px;font-size:25px;line-height:1;white-space:nowrap}
.oc-icon{width:34px;height:34px;flex:0 0 34px;border-radius:7px;overflow:hidden}.oc-icon img{display:block;width:34px;height:34px}
`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(plan.title)}</title><style>${css}</style><script src="vendor/gsap.min.js"></script></head><body>
<main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
<audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
${gsBack}${gsCard}${gsPerson}
<div id="layer-top">${einstiegHtml}${kapitelHtml}${h1VideoHtml}${h2Html}${pillenHtml}${noteHtml}${balkenHtml}${schlagHtml}</div>
${capHtml}
${outroHtml}
</main><script>
${timelineScript(plan)}
</script></body></html>`;
}

function timelineScript(plan) {
  const data = JSON.stringify({ e: plan.einstieg, k: plan.kapitel || [], h1: plan.h1Video || [], h2: plan.h2 || [], p: plan.pillen || [], s: plan.schlagworte || [], g: plan.grafiken || [], n: plan.randnotizen || [], b: plan.balken || [], c: plan.captions || [], z: plan.zooms || [], o: plan.outro, hide: plan.ausblenden || [] });
  return `
// 15: nur drei Kurven. Ausklingen cubic-bezier(.22,1,.36,1), Abfedern cubic-bezier(.34,1.56,.64,1), Linear nur beim Ausblenden.
function bezier(x1,y1,x2,y2){const f=(s,a,b)=>3*(1-s)*(1-s)*s*a+3*(1-s)*s*s*b+s*s*s;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(f(m,x1,x2)<x)lo=m;else hi=m;}return f((lo+hi)/2,y1,y2);};}
const OUT=bezier(.22,1,.36,1),BACK=bezier(.34,1.56,.64,1),LIN='none';
const D=${data};
const tl=gsap.timeline({paused:true});tl.to({},{duration:${plan.duration}});
const show=(sel,a,b)=>{tl.set(sel,{visibility:'visible'},a);tl.set(sel,{visibility:'hidden'},b);};
const exitUp=(sel,end)=>tl.to(sel,{opacity:0,y:-8,duration:.18,ease:LIN},end-.18); // H1-Ausblenden 0,18 s, Linear, 8 px nach oben
// 5: Einstieg ohne Eingangsanimation. H1 blendet in 0,18 s aus, H2 folgt 0,06 s später.
show('#einstieg-h1',0,D.e.end);exitUp('#einstieg-h1',D.e.end);
if(D.e.h2){show('#einstieg-h2',0,D.e.end+.06);exitUp('#einstieg-h2',D.e.end+.06);}
// 15: H1 im Video, Stoß 112 → 100 %, 0,22 s, Ausklingen.
for(const h of D.h1){show('#'+h.id,h.start,h.end);tl.fromTo('#'+h.id+' .h1',{scale:1.12},{scale:1,duration:.22,ease:OUT,immediateRender:false},h.start);exitUp('#'+h.id,h.end);}
// 15: H2 wischt in 0,28 s von links auf (Ausklingen), 0,06 s nach einer gleichzeitigen H1.
for(const h of D.h2){show('#'+h.id,h.start,h.end);tl.set('#'+h.id+' .h2',{clipPath:'inset(-20px 100% -20px -20px)'},0);tl.fromTo('#'+h.id+' .h2',{clipPath:'inset(-20px 100% -20px -20px)'},{clipPath:'inset(-20px -20px -20px -20px)',duration:.28,ease:OUT,immediateRender:false},h.start);exitUp('#'+h.id,h.end);}
// 15: Kapitel. Zahl mit Maske von links nach rechts 0,40 s, Titel ab 0,35 s 14 px von unten 0,22 s.
for(const k of D.k){show('#'+k.id,k.start,k.end);
 tl.set('#'+k.id+'-num',{clipPath:'inset(-40px 100% -40px -40px)'},0);tl.fromTo('#'+k.id+'-num',{clipPath:'inset(-40px 100% -40px -40px)'},{clipPath:'inset(-40px -40px -40px -40px)',duration:.4,ease:OUT,immediateRender:false},k.start);
 tl.set('#'+k.id+'-title',{opacity:0,y:14},0);tl.fromTo('#'+k.id+'-title',{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},k.start+.35);
 exitUp('#'+k.id,k.end);}
// 15: Pillen einzeln am gesprochenen Wort, Pop 80 → 100 %, 0,30 s, Abfedern. Bleiben bis Kapitelende.
for(const p of D.p){show('#'+p.id,p.start,p.end);p.items.forEach((it,i)=>{const s='#'+p.id+'-'+i+' .pill';tl.set(s,{opacity:0,scale:.8},0);tl.set(s,{opacity:1},it.at);tl.fromTo(s,{scale:.8},{scale:1,duration:.3,ease:BACK,immediateRender:false},it.at);});exitUp('#'+p.id,p.end);}
// 15: Randnotiz. Zeile am Wort 14 px von unten 0,22 s; Durchstreichen 0,28 s von links; Ausblenden 0,18 s.
for(const n of D.n){show('#'+n.id,n.start,n.end);n.lines.forEach((l,j)=>{const s='#'+n.id+'-l'+j;tl.set(s,{opacity:0,y:14},0);tl.fromTo(s,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},l.at);if(l.strike)tl.to('#'+n.id+'-s'+j+' path',{strokeDashoffset:0,duration:.28,ease:OUT},l.strike.at);});exitUp('#'+n.id,n.end);}
// 15: Lebensbalken. Abschnitt füllt sich in 1,0 s (Ausklingen), Beschriftung wie Randnotiz-Zeile.
for(const b of D.b){show('#'+b.id,b.start,b.end);b.segments.forEach((s,i)=>{tl.set('#'+b.id+'-l'+i,{opacity:0,y:14},0);tl.fromTo('#'+b.id+'-l'+i,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},s.at);tl.to('#'+b.id+'-f'+i,{scaleX:1,duration:1,ease:OUT},s.at);});exitUp('#'+b.id,b.end);}
// 10: Schlagwort. Stoßzoom hart auf 112 % (Ursprung 42/28), Wort Pop 55 → 100 % 0,30 s, Unterstreichung je 0,25 s, zweite 0,15 s später.
for(const s of D.s){show('#'+s.id,s.start,s.end);tl.set('#'+s.id+' .sw',{opacity:0,scale:.55,rotation:-3},0);tl.set('#'+s.id+' .sw',{opacity:1},s.start);tl.fromTo('#'+s.id+' .sw',{scale:.55},{scale:1,duration:.3,ease:BACK,immediateRender:false},s.start);
 [0,1].forEach(j=>tl.to(['#'+s.id+'-u'+j+'i','#'+s.id+'-u'+j+'p'],{strokeDashoffset:0,duration:.25,ease:OUT},s.start+.3+.15*j));
 tl.set('#footage',{scale:1.12},s.start);tl.set('#footage',{scale:1},s.end);exitUp('#'+s.id,s.end);}
// Ausblenden anderer Ebenen während Schlagwort und Grafik (DESIGN.md 10; Kapitel siehe review/annahmen.md): hart aus, hart wieder an.
// Über die Sichtbarkeit, damit Deckkraft-Animationen unberührt bleiben; ohne „to" bleibt die Ebene bis zu ihrem Ende aus.
for(const h of D.hide){tl.set(h.sel,{visibility:'hidden'},h.from);if(h.to!=null)tl.set(h.sel,{visibility:'visible'},h.to);}
// 11 und 15: Grafik. Karte Pop 90 → 100 % 0,35 s, Hauptlinie zeichnet sich in 1,0 s, Vergleichslinie 0,30 s, Kreis danach 0,30 s.
for(const g of D.g){show('#'+g.id+'-bg',g.start,g.end);show('#'+g.id,g.start,g.end);
 tl.set('#'+g.id,{opacity:0,scale:.9},0);tl.set('#'+g.id,{opacity:1},g.start);tl.fromTo('#'+g.id,{scale:.9},{scale:1,duration:.35,ease:BACK,immediateRender:false},g.start);
 tl.to('#'+g.id+' .main-line',{strokeDashoffset:0,duration:1,ease:OUT},g.drawAt);
 tl.set('#'+g.id+' .cmp-line',{opacity:0},0);tl.to('#'+g.id+' .cmp-line',{opacity:1,duration:.3,ease:OUT},g.cmpAt);
 for(const x of g.labels||[]){tl.set('#'+x.id,{opacity:0},0);tl.to('#'+x.id,{opacity:1,duration:.22,ease:OUT},x.at);}
 tl.to('#'+g.id+' .hl-circle',{strokeDashoffset:0,duration:.3,ease:OUT},g.circleAt);}
// 7: Untertitel, harter Wechsel. Genau ein Wort blau; das letzte Wort bleibt blau bis zur nächsten Gruppe.
D.c.forEach((c,i)=>{show('#cap-'+i,c.start,c.end);c.words.forEach((w,j)=>{const on=j?w.start:c.start,off=j<c.words.length-1?c.words[j+1].start:c.end;tl.set('#w-'+i+'-'+j,{color:'${C.blue}'},on);tl.set('#w-'+i+'-'+j,{color:'${C.white}'},off);});});
// 15: Zoomfahrten, nur Videoebene, linear, harter Rücksprung.
for(const z of D.z){tl.set('#footage',{scale:1},z.start);tl.to('#footage',{scale:z.scale,duration:z.end-z.start,ease:LIN},z.start);tl.set('#footage',{scale:1},z.end);}
// 15: Outro. Folgen 0,22 s 14 px von unten; Karte ab 0,15 s Pop 88 → 100 % 0,45 s; Balken und Zähler ab 0,45 s 1,40 s synchron.
{const o=D.o;show('#follow',o.start,o.end);show('#outro-card',o.start,o.end);
 tl.fromTo('#follow',{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:OUT,immediateRender:false},o.start);
 tl.set('#outro-card',{opacity:0,scale:.88},0);tl.set('#outro-card',{opacity:1},o.start+.15);tl.fromTo('#outro-card',{scale:.88},{scale:1,duration:.45,ease:BACK,immediateRender:false},o.start+.15);
 for(let i=0;i<=42;i++){const f=OUT(i/42),at=o.start+.45+1.4*i/42;document.getElementById('cnt-'+i).textContent=Math.round(o.followers*f).toLocaleString('de-DE');tl.set('#cnt-'+i,{visibility:'visible'},at);if(i)tl.set('#cnt-'+(i-1),{visibility:'hidden'},at);tl.set('#oc-fill',{scaleX:Math.min(1,o.followers/10000)*f},at);}}
window.__timelines={root:tl};
`;
}
