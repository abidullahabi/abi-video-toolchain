import { SOCIAL_LAYOUT } from './social-layout.mjs';
import { makeDesign19Composition } from './theme-composition-design19.mjs';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines = item => (item.lines || [item.text]).map(escape).join('<br>');

// Draft identity. Content and timing remain separate from the visual template.
export function makeThemeComposition(plan) {
  if(plan.designVersion==='1.9')return makeDesign19Composition(plan);
  const {duration, sections, overlays, captions = [], zooms = [], logos = [], socialCtas = []} = plan;
  if (!(duration > 0)) throw Error('Dauer fehlt.');
  const all = [...sections, ...overlays, ...logos, ...socialCtas];
  const textLeft=(1080-SOCIAL_LAYOUT.textWidth)/2;
  for(const x of [...logos,...socialCtas.flatMap(x=>x.profiles||[x])])if(!/^assets\/[a-zA-Z0-9_.-]+$/.test(x.src))throw Error('Ungültiger Assetpfad.');
  for(const x of [...logos,...socialCtas])if(!(x.width>0&&x.height>0))throw Error('Ungültige Grafikgröße.');
  for(const x of socialCtas){if(x.height<100||(!x.profiles&&(!x.name||!x.label)))throw Error('Unvollständiger Profilhinweis.');if(x.profiles&&(x.profiles.length!==4||x.profiles.some(p=>!p.name||!p.platform)))throw Error('Vier bestätigte Profile erforderlich.');}
  for (const x of all) if (!/^[a-z][a-z0-9-]*$/.test(x.id) || !(x.start >= 0 && x.end > x.start && x.end <= duration)) throw Error('Ungültige Einblendung: '+x.id);
  for (const [i, cue] of captions.entries()) {
    if (!(cue.start >= 0 && cue.end > cue.start && cue.end <= duration && cue.words.length >= 1 && cue.words.length <= (plan.captionMaxWords||SOCIAL_LAYOUT.captionMaxWords))) throw Error('Ungültiger Untertitel: '+i);
    if (i && cue.start < captions[i-1].end-0.001) throw Error('Untertitel überlappen.');
    for (const [j, w] of cue.words.entries()) if (/\s/.test(w.text) || !(w.start >= cue.start && w.end > w.start && w.end <= cue.end+0.001) || (j && w.start < cue.words[j-1].end-0.001)) throw Error('Ungültiges Wort: '+w.text);
  }
  for (const z of zooms) if (!(z.start >= 0 && z.end > z.start && z.end <= duration && z.scale >= 1 && z.scale <= 1.1)) throw Error('Ungültiger Zoom.');
  const timing = x => `id="${x.id}" class="clip ${x.kind || 'section'}" data-start="${x.start}" data-duration="${x.end-x.start}" data-track-index="${!x.kind?2:3}"`;
  const sectionHtml = sections.map(s => `<div ${timing(s)} style="font-size:${s.fontSize||80}px${s.top!==undefined?`;top:${s.top}px`:''}${s.lineHeight?`;line-height:${s.lineHeight}`:''}"><span${s.background?` style="background:${escape(s.background)}"`:''}>${s.number?escape(s.number)+'. ':''}${lines(s)}</span></div>`).join('\n');
  const overlayHtml = overlays.map(x => `<div ${timing(x)} style="font-size:${x.fontSize||52}px${x.top!==undefined?`;top:${x.top}px`:''}${x.lineHeight?`;line-height:${x.lineHeight}`:''}${x.strokeWidth!==undefined?`;-webkit-text-stroke-width:${x.strokeWidth}px`:''}"><span>${lines(x)}</span></div>`).join('\n');
  const logoHtml = logos.map(x=>`<div id="${x.id}" class="clip logo" data-start="${x.start}" data-duration="${x.end-x.start}" data-track-index="5" style="left:${540-x.width/2}px;top:${x.top}px;width:${x.width}px;height:${x.height}px"><img src="${escape(x.src)}" alt="${escape(x.alt||'')}" width="${x.width}" height="${x.height}"></div>`).join('\n');
  const socialHtml = socialCtas.map(x=>{
    const content=x.profiles?`<div class="social-card social-grid${x.layout==='profiles-grid-compact'?' compact':''}">${x.profiles.map(p=>`<div class="social-profile" data-platform="${escape(p.platform)}"><img src="${escape(p.src)}" alt="${escape(p.platform)}"><span>${escape(p.name)}</span></div>`).join('')}</div>`:`<div class="social-card"><div class="social-label">${escape(x.label)}</div><div class="social-identity"><img src="${escape(x.src)}" alt="LinkedIn"><span>${escape(x.name)}</span></div></div>`;
    return `<div id="${x.id}" class="clip social-cta" data-start="${x.start}" data-duration="${x.end-x.start}" data-track-index="5" style="left:${540-x.width/2}px;top:${x.top}px;width:${x.width}px;height:${x.height}px">${content}</div>`;
  }).join('\n');
  const captionHtml = captions.map((c,i) => {
    const style=[c.top!==undefined?`top:${c.top}px`:'',c.fontSize!==undefined?`font-size:${c.fontSize}px`:''].filter(Boolean).join(';');
    return `<div id="caption-${i}" class="clip caption" data-start="${c.start}" data-duration="${c.end-c.start}" data-track-index="4"${style?` style="${style}"`:''}><span class="caption-line">${c.words.map((w,j)=>`<span id="word-${i}-${j}">${escape(w.text)}</span>`).join(' ')}</span></div>`;
  }).join('\n');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(plan.title || 'ABI · Einblendungen')}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#111;font-family:Arial,Helvetica,sans-serif}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111;color:#fff}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.section{position:absolute;left:${textLeft}px;top:320px;width:${SOCIAL_LAYOUT.textWidth}px;min-height:0;display:flex;justify-content:center;align-items:center;text-align:center;font-weight:800;line-height:1.05;letter-spacing:-1.5px;-webkit-text-stroke:7px #000;paint-order:stroke fill;z-index:10}
.support{position:absolute;left:${textLeft}px;top:440px;width:${SOCIAL_LAYOUT.textWidth}px;text-align:center;font-size:52px;line-height:1.14;font-weight:700;-webkit-text-stroke:5px #000;paint-order:stroke fill;z-index:12}
${plan.h1Background?`.section{top:320px;min-height:0;-webkit-text-stroke:0}.section>span{display:inline-block;white-space:nowrap;padding:12px 22px 14px;border-radius:12px;background:${escape(plan.h1Background)};letter-spacing:-1.5px}`:''}
.caption{position:absolute;left:${textLeft}px;top:${plan.captionTop||SOCIAL_LAYOUT.captionTop}px;width:${SOCIAL_LAYOUT.textWidth}px;height:92px;display:flex;align-items:center;justify-content:center;white-space:nowrap;text-align:center;font-size:${plan.captionFontSize||SOCIAL_LAYOUT.captionFontSize}px;font-weight:800;line-height:1.12;-webkit-text-stroke:6px #000;paint-order:stroke fill;z-index:20}
.caption-line{display:inline-block;white-space:nowrap;max-width:${SOCIAL_LAYOUT.textWidth}px;overflow:visible}.caption-line>span{white-space:nowrap}
.social-cta{position:absolute;z-index:16}.social-card{width:100%;height:100%;background:#fff;color:#152332;border-radius:20px;padding:10px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transform-origin:center}.social-card.social-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,1fr);gap:8px 20px;padding:12px}.social-profile{display:flex;align-items:center;gap:12px;min-width:0;height:42px;font-size:32px;line-height:42px;font-weight:700;white-space:nowrap}.social-profile img{display:block;flex:0 0 38px;width:38px;height:38px;object-fit:contain}.social-label{font-weight:700;font-size:30px;line-height:34px;white-space:nowrap}.social-identity{display:flex;align-items:center;justify-content:center;gap:20px;height:48px;font-size:40px;line-height:48px;font-weight:700;white-space:nowrap}.social-identity img{display:block;object-fit:contain;width:54px;height:46px}.logo{position:absolute;z-index:15}.logo img{display:block;width:100%;height:100%;object-fit:contain}\n</style><script src="vendor/gsap.min.js"></script></head><body><main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
<audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
${sectionHtml}\n${overlayHtml}\n${logoHtml}\n${socialHtml}\n${captionHtml}
</main><style>.social-card.social-grid.compact{padding:8px;gap:8px 20px}.compact .social-profile{height:36px;line-height:36px;gap:10px}.compact .social-profile img{flex-basis:32px;width:32px;height:32px}</style><script>
const tl=gsap.timeline({paused:true});tl.to({}, {duration:${duration}});
${[...sections,...overlays].map(x=>x.start===0?`tl.set('#${x.id}',{opacity:1,y:0},0);`:`tl.from('#${x.id}',{opacity:0,y:14,duration:0.22,ease:'power2.out'},${x.start});`).join('\n')}
${logos.map(x=>`tl.from('#${x.id}',{clipPath:'inset(0 100% 0 0)',opacity:0,duration:0.28,ease:'power2.out'},${x.start});tl.to('#${x.id}',{opacity:0,duration:0.2},${x.end-0.2});tl.set('#${x.id}',{opacity:0},${x.end});`).join('\n')}
${socialCtas.map(x=>`tl.from('#${x.id} .social-card',{opacity:0,scale:0.92,y:3,duration:0.4,ease:'back.out(1.25)'},${x.start});`).join('\n')}
${zooms.map(z=>`tl.set('#footage',{scale:1,transformOrigin:'${z.origin||'42% 28%'}'},${z.start});tl.to('#footage',{scale:${z.scale},duration:${z.end-z.start},ease:'none'},${z.start});tl.set('#footage',{scale:1},${z.end});`).join('\n')}
${captions.flatMap((c,i)=>c.words.map((w,j)=>`tl.set('#word-${i}-${j}',{color:'${plan.captionAccent||'#349feb'}'},${w.start});tl.set('#word-${i}-${j}',{color:'#ffffff'},${w.end});`)).join('\n')}
window.__timelines=window.__timelines||{};window.__timelines.root=tl;
</script></body></html>`;
}
