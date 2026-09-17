const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Implementation of the current, externally maintained DESIGN.md, version 1.9.
// Deliberately isolated from archived projects and their earlier design versions.
export function makeDesign19Composition(plan){
 const {duration,sections,overlays=[],captions=[],outro,zooms=[]}=plan;
 if(!outro||!Number.isInteger(outro.followers)||outro.followers<0)throw Error('Aktueller TikTok-Followerstand fehlt.');
 if(zooms.length||(plan.logos||[]).length||(plan.bubbles||[]).length)throw Error('Diese Design-1.9-Umsetzung ist bisher nur für dieses Video ohne zusätzliche Zooms, Marken oder Kommentaraufruf geprüft.');
 const timing=(id,start,end,track)=>`id="${id}" class="clip" data-start="${start}" data-duration="${end-start}" data-track-index="${track}"`;
 const titles=sections.map(s=>`<div ${timing(s.id,s.start,s.end,2)} data-kind="h1" style="font-size:${s.fontSize}px;${s.start===0?'visibility:visible;opacity:1':''}"><span>${escape(s.text)}</span></div>`).join('');
 const supports=overlays.map(s=>{
  const lines=s.lines||[s.text];
  if(s.lineRuns&&(s.lineRuns.length!==lines.length||s.lineRuns.some((runs,i)=>runs.map(r=>r.text).join('')!==lines[i])))throw Error('H2-Formatierung und Prüftext weichen ab: '+s.id);
  const content=s.lineRuns?s.lineRuns.map(runs=>`<span class="support-line">${runs.map(r=>r.mark==='cross'?`<span class="crossed-number"><span class="cross-mark" aria-hidden="true">❌</span><span class="readable-number">${escape(r.text)}</span></span>`:r.strike?`<span class="diagonal-strike">${escape(r.text)}</span>`:escape(r.text)).join('')}</span>`).join(''):lines.map(escape).join('<br>');
  return `<div ${timing(s.id,s.start,s.end,3)} data-kind="h2" style="top:${s.top}px;${s.start===0?'visibility:visible;opacity:1':''}"><span${s.lineRuns?' class="support-rich"':''}>${content}</span></div>`;
 }).join('');
 const captionHtml=captions.map((c,i)=>`<div ${timing('caption-'+i,c.start,c.end,4)} data-kind="caption" style="top:${c.top??plan.captionTop}px;font-size:${c.fontSize??56}px"><span class="caption-line">${c.words.map((w,j)=>`<span id="word-${i}-${j}">${escape(w.text)}</span>`).join(' ')}</span></div>`).join('');
 const profiles=[['youtube','@itsabidullahabi','youtube-icon.png'],['tiktok','@abidullahabi','tiktok-icon.png'],['instagram','@abidullahabi','instagram-icon.png'],['linkedin','Abdullah Bachtari','linkedin-in-blue.png']];
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(plan.title)}</title><style>
 @font-face{font-family:"ABI Arial Bold";src:url("assets/arial-bold.ttf") format("truetype");font-weight:100 900;font-style:normal;font-display:block}#root,#root *{font-family:"ABI Arial Bold",Arial,sans-serif!important;font-synthesis:none}*{box-sizing:border-box}html,body{margin:0;background:#111;font-family:Arial,sans-serif}#root{position:relative;width:1080px;height:1920px;overflow:hidden;color:white}video{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}
 #graphics{position:absolute;inset:0;clip-path:inset(250px 150px 260px 90px);pointer-events:none}.clip[data-kind]{position:absolute;visibility:hidden}
 [data-kind=h1]{left:90px;top:250px;width:840px;display:flex;justify-content:center;font-weight:800;line-height:1.2;text-align:center}
 [data-kind=h1]>span{display:inline-block;padding:12px 22px 14px;border-radius:12px;background:#1668b5;white-space:nowrap}
 [data-kind=h2]{left:230px;width:560px;text-align:center;font-size:46px;line-height:1.15;font-weight:700;-webkit-text-stroke:5px black;paint-order:stroke fill}
 .support-rich{display:inline-block}.support-line{display:block;white-space:nowrap}.diagonal-strike{position:relative;display:inline-block}.diagonal-strike::after{content:"";position:absolute;left:-2px;top:50%;width:calc(100% + 4px);height:3px;background:#fff;box-shadow:0 0 0 1.5px #000;transform:rotate(-28deg);transform-origin:center}
 @font-face{font-family:"ABI Emoji";src:local("Apple Color Emoji");font-weight:400;font-style:normal}.crossed-number{position:relative;display:inline-block;margin:0 7px}.readable-number{position:relative;z-index:1}#root .cross-mark{position:absolute;z-index:2;opacity:.95;left:50%;top:50%;transform:translate(-50%,-50%);font-family:"ABI Emoji"!important;font-size:24px;font-weight:400;line-height:1;-webkit-text-stroke:0;white-space:nowrap}
 [data-kind=caption]{left:90px;width:840px;height:92px;display:flex;align-items:center;justify-content:center;font-weight:800;white-space:nowrap;text-align:center;line-height:1;-webkit-text-stroke:6px black;paint-order:stroke fill}
 .caption-line{display:inline-block;white-space:nowrap;max-width:620px;overflow:visible}.caption-line>span{color:#fff}
 [data-kind=follow]{left:90px;top:250px;width:840px;text-align:center;font-size:50px;line-height:1.2;font-weight:800;-webkit-text-stroke:5px black;paint-order:stroke fill}
 [data-kind=card]{left:90px;top:1423px;width:700px;height:237px;transform-origin:0 100%}
 .progress-card{width:100%;height:100%;padding:22px;background:#f8f9fb;border-radius:20px;color:#16181c;font-weight:700}
 .progress-header{display:flex;align-items:center;justify-content:space-between;height:63px;line-height:1.2}.follower-count{font-size:36px;position:relative;width:140px;height:44px;display:block}.counter-value{position:absolute;left:0;top:0;visibility:hidden}.counter-value:first-child{visibility:visible}.goal{font-size:26px;color:#7a7e86}
 .progress-track{height:19px;background:#dee1e7;border-radius:10px;margin-top:12px;overflow:hidden}.progress-fill{height:100%;width:100%;background:#1668b5;transform-origin:0 50%;transform:scaleX(0);border-radius:10px}
 .profile-grid{display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:13px 14px;margin-top:18px}.profile{display:flex;align-items:center;gap:12px;height:34px;font-size:25px;line-height:1;white-space:nowrap}.icon-tile{width:34px;height:34px;flex:0 0 34px;border-radius:7px;overflow:hidden;display:flex;align-items:center;justify-content:center}.icon-tile img{width:100%;height:100%;object-fit:contain}
 .youtube{background:#ff0000}.youtube img{width:30px;height:30px}.tiktok{background:#000}.tiktok img{filter:grayscale(1) brightness(5) contrast(10)}.instagram{background:linear-gradient(35deg,#ffd600,#ff7a00,#ff0069,#d300c5,#7638fa)}.instagram img{width:26px;height:26px;filter:brightness(0) invert(1)}.linkedin{background:#0a66c2}.linkedin img{width:30px;height:30px;background:white;filter:url(#linkedin-color)}
 </style><script src="vendor/gsap.min.js"></script></head><body>
 <main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
 <video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
 <audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
 <svg width="0" height="0" style="position:absolute"><filter id="linkedin-color" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1.14 0 0 0 -.14 0 1.007 0 0 -.007 0 0 .792 0 .208 0 0 0 1 0"/></filter></svg>
 <div id="graphics">${titles}${supports}${captionHtml}
 <div ${timing('follow',outro.start,outro.end,5)} data-kind="follow"><span>Folgen nicht vergessen</span></div>
 <div ${timing('progress-card',outro.start,outro.end,5)} data-kind="card"><div class="progress-card"><div class="progress-header"><span id="follower-count" class="follower-count">${Array.from({length:43},(_,i)=>`<span id="counter-${i}" class="counter-value">0</span>`).join('')}</span><span class="goal">Ziel 10.000</span></div><div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div><div class="profile-grid">${profiles.map(([platform,name,asset])=>`<div class="profile" data-platform="${platform}"><span class="icon-tile ${platform}"><img src="assets/${asset}" alt="${platform}"></span><span class="handle">${name}</span></div>`).join('')}</div></div></div></div>
 </main><script>
 function bezier(x1,y1,x2,y2){const coord=(s,a,b)=>3*(1-s)*(1-s)*s*a+3*(1-s)*s*s*b+s*s*s;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(coord(mid,x1,x2)<x)lo=mid;else hi=mid;}return coord((lo+hi)/2,y1,y2);};}
 const out=bezier(.22,1,.36,1),back=bezier(.34,1.56,.64,1),tl=gsap.timeline({paused:true});tl.to({}, {duration:${duration}});
 const show=(id,start,end)=>{tl.set('#'+id,{visibility:'visible'},start);tl.set('#'+id,{visibility:'hidden'},end);};
 const titles=${JSON.stringify(sections)},supports=${JSON.stringify(overlays)},captions=${JSON.stringify(captions)},outro=${JSON.stringify(outro)};
 for(const x of [...titles,...supports]){show(x.id,x.start,x.end);if(x.start===0||x.transitionIn==='cut')tl.set('#'+x.id,{opacity:1,y:0},x.start);else tl.fromTo('#'+x.id,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},x.start);if(x.transitionOut!=='cut')tl.to('#'+x.id,{opacity:0,y:-8,duration:.18,ease:'none'},x.end-.18);}
 for(const [i,c] of captions.entries()){show('caption-'+i,c.start,c.end);for(const [j,w] of c.words.entries()){tl.set('#word-'+i+'-'+j,{color:'#5eb3f5'},w.start);tl.set('#word-'+i+'-'+j,{color:'#ffffff'},w.end);}}
 show('follow',outro.start,outro.end);show('progress-card',outro.start,outro.end);
 tl.fromTo('#follow',{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},outro.start);
 tl.set('#progress-card',{opacity:0,scale:.88},0);tl.set('#progress-card',{opacity:1},outro.start+.15);tl.to('#progress-card',{scale:1,duration:.45,ease:back},outro.start+.15);
 // Frame-specific values avoid callbacks being skipped by distributed render seeks.
 for(let i=0;i<=42;i++){const fraction=out(i/42),at=outro.start+.45+i/30;document.getElementById('counter-'+i).textContent=Math.round(outro.followers*fraction).toLocaleString('de-DE');tl.set('#counter-'+i,{visibility:'visible'},at);if(i>0)tl.set('#counter-'+(i-1),{visibility:'hidden'},at);tl.set('#progress-fill',{scaleX:Math.min(1,outro.followers/10000)*fraction},at);}
 window.__timelines={root:tl};
 </script></body></html>`;
}
