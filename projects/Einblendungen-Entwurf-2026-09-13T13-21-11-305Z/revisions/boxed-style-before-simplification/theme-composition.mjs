const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Draft identity. Content and timing remain separate from the visual template.
export function makeThemeComposition(plan) {
  const {duration, sections, overlays} = plan;
  if (!(duration > 0)) throw Error('Dauer fehlt.');
  const all = [...sections, ...overlays];
  for (const x of all) if (!/^[a-z][a-z0-9-]*$/.test(x.id) || !(x.start >= 0 && x.end > x.start && x.end <= duration)) throw Error('Ungültige Einblendung: '+x.id);
  const timing = x => `id="${x.id}" class="clip ${x.kind || 'section'}" data-start="${x.start}" data-duration="${x.end-x.start}" data-track-index="${!x.kind?2:x.kind==='stat'?4:3}"`;
  const svg = type => type==='cart'
    ? '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 8h6l6 23h22l5-17H13M20 40h.1M36 40h.1"/></svg>'
    : '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 40h36M13 33V23h5v10M23 33V16h5v17M33 33V8h5v25"/></svg>';
  const sectionHtml = sections.map(s => `<div ${timing(s)} style="font-size:${s.fontSize||80}px"><span class="number">${escape(s.number)}</span><span>${escape(s.text)}</span></div>`).join('\n');
  const overlayHtml = overlays.map(x => {
    if(x.kind==='stat') return `<aside ${timing(x)}><div class="stat-role">${escape(x.role)}</div><div class="stat-kicker">${escape(x.kicker)}</div><div class="stat-number"><small>ca.</small>${escape(x.value)}</div><div class="stat-unit">${escape(x.unit)}</div><div class="stat-country">${escape(x.country)}</div><div class="stat-source">${escape(x.source)}</div></aside>`;
    if(x.kind==='chips') return `<div ${timing(x)}>${x.items.map(i=>`<div class="chip">${svg(i.icon)}<span>${escape(i.text)}</span></div>`).join('')}</div>`;
    return `<div ${timing(x)}><span>${escape(x.text)}</span></div>`;
  }).join('\n');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ABI · Einblendungen · Stilprobe</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#111;font-family:Arial,Helvetica,sans-serif}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111;color:#fff}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.section{position:absolute;left:96px;top:210px;width:792px;min-height:88px;display:flex;justify-content:center;align-items:center;gap:22px;font-weight:800;line-height:1.05;letter-spacing:-1.5px;-webkit-text-stroke:7px #0a141d;paint-order:stroke fill;filter:drop-shadow(0 3px 2px #0008);z-index:10}
.number{display:flex;align-items:center;justify-content:center;width:76px;height:76px;border-radius:18px;background:#37a6ec;color:#fff;font-size:54px;font-weight:800;-webkit-text-stroke:0;flex:none;box-shadow:0 3px 0 #124567}
.chips,.support,.aside{position:absolute;left:96px;top:320px;width:792px;z-index:12}
.chips{display:flex;gap:16px}
.chip{display:flex;align-items:center;justify-content:center;gap:15px;min-height:76px;flex:1;background:#101d28ed;border:2px solid #ffffff44;border-radius:16px;font-size:49px;font-weight:700;box-shadow:0 6px 18px #0003}
.chip svg{height:46px;width:46px;fill:none;stroke:#99eaf0;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;flex:none}
.support{text-align:center;font-size:49px;line-height:1.14;font-weight:700;padding:12px 22px;background:#101d28ed;border-radius:16px;box-shadow:0 6px 18px #0003;border-left:7px solid #37a6ec}
.aside{text-align:center;top:1110px;font-size:58px;font-weight:800;line-height:1.12;padding:25px 16px;border-radius:18px;background:#a5edf0;color:#102334;box-shadow:0 6px 18px #0003}
.stat{position:absolute;left:568px;top:416px;width:320px;padding:24px 21px 20px;background:#101d28f2;border:2px solid #ffffff44;border-top:7px solid #37a6ec;border-radius:18px;box-shadow:0 8px 20px #0003;z-index:12}
.stat-role{font-size:29px;font-weight:700;letter-spacing:.4px;color:#a5edf0;margin-bottom:13px}
.stat-kicker{font-size:30px;font-weight:600;margin-bottom:8px}
.stat-number{font-size:60px;font-weight:800;line-height:1.03;letter-spacing:-2px;white-space:nowrap}
.stat-number small{font-size:27px;font-weight:600;display:block;line-height:1.1;margin-bottom:3px;letter-spacing:0;color:#c7d3dd}
.stat-unit{font-size:29px;font-weight:700;margin-top:10px}.stat-country{font-size:27px;color:#e1e8ec;margin-top:4px}
.stat-source{font-size:23px;line-height:1.15;color:#d1dfe7;margin-top:16px;padding-top:12px;border-top:1px solid #ffffff40}
</style><script src="vendor/gsap.min.js"></script></head><body><main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
<video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
<audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
${sectionHtml}\n${overlayHtml}
</main><script>
const tl=gsap.timeline({paused:true});tl.to({}, {duration:${duration}});
${all.map(x=>`tl.from('#${x.id}',{opacity:0,y:14,duration:0.22,ease:'power2.out'},${x.start});`).join('\n')}
window.__timelines=window.__timelines||{};window.__timelines.root=tl;
</script></body></html>`;
}
