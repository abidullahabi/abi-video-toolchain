const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Implementation of DESIGN.md version 1.11 (17.09.2026).
// Differs from theme-composition-design19.mjs: every centred element sits on the
// full-frame centre x = 540 (H1 surface, H2 block, caption group, follow line),
// caption field x = 150..930, plus zooms and the speech bubble (sections 9, 11.5).
// Logo overlays (section 8) are not built yet and are rejected instead of guessed.
export function makeDesign111Composition(plan){
 const {duration,sections,overlays=[],captions=[],outro,zooms=[],bubbles=[],notes=[],bigwords=[],bars=[]}=plan;
 if(!outro||!Number.isInteger(outro.followers)||outro.followers<0)throw Error('Aktueller TikTok-Followerstand fehlt.');
 if((plan.logos||[]).length)throw Error('Logo-Einblendungen sind in der Design-1.11-Umsetzung noch nicht gebaut.');
 if(bubbles.length>1)throw Error('Höchstens eine Sprechblase je Video.');
 for(const b of bubbles)if(Math.abs(b.start-outro.start)>.001)throw Error('Die Sprechblase startet nach DESIGN.md 11.5 gleichzeitig mit der Outro-Karte.');
 // Slow zooms follow DESIGN.md 11 (1.025-1.055) unless the plan records an explicit exception; punch zooms
 // (hard in, hard out on a big word) were requested by Abdullah on 26.09.2026 and may reach 1.15.
 for(const z of zooms){const max=z.punch?1.15:(plan.zoomException?1.08:1.055);if(!(z.start>=0&&z.end>z.start&&z.end<=duration&&z.scale>=1.02&&z.scale<=max))throw Error('Zoom ausserhalb der Grenzen: '+JSON.stringify(z));}
 const timing=(id,start,end,track)=>`id="${id}" class="clip" data-start="${start}" data-duration="${end-start}" data-track-index="${track}"`;
 const titles=sections.map(s=>`<div ${timing(s.id,s.start,s.end,2)} data-kind="h1" style="font-size:${s.fontSize}px;${s.start===0?'visibility:visible;opacity:1':''}"><span>${escape(s.text)}</span></div>`).join('');
 const supports=overlays.map(s=>{
  const lines=s.lines||[s.text];
  const body=lines.map((l,j)=>`<span id="${s.id}-l${j}" class="h2-line${(s.accentLines||[]).includes(j)?' note-accent':''}">${escape(l)}</span>`).join('<br>');
  return `<div ${timing(s.id,s.start,s.end,3)} data-kind="h2"${s.wide?' data-wide="1"':''} style="top:${s.top}px;${s.start===0?'visibility:visible;opacity:1':''}"><span>${body}</span></div>`;
 }).join('');
 const captionHtml=captions.map((c,i)=>`<div ${timing('caption-'+i,c.start,c.end,4)} data-kind="caption" style="top:${c.top??plan.captionTop}px;font-size:${c.fontSize??56}px"><span class="caption-line">${c.words.map((w,j)=>`<span id="word-${i}-${j}">${escape(w.text)}</span>`).join(' ')}</span></div>`).join('');
 const tail='<svg class="tail" viewBox="0 0 16 21" aria-hidden="true"><path d="M16 21V4c0 8-4 14-14 16 4 1.4 9 1.2 14 1z" fill="currentColor"/></svg>';
 const bubbleHtml=bubbles.map((b,i)=>`<div ${timing('bubble-'+i,b.start,b.start+4.25,6)} data-kind="bubble"${b.top!=null?` style="top:${b.top}px"`:''}><div id="bubble-${i}-typing" class="typing">${tail}<i id="bubble-${i}-dot-0"></i><i id="bubble-${i}-dot-1"></i><i id="bubble-${i}-dot-2"></i></div><div id="bubble-${i}-message" class="message">${tail}${escape(b.text)}</div></div>`).join('');
 // Side notes, DESIGN.md 1.12 sections 9a and 11.7 (Abdullah, 26.09.2026): left-aligned text beside the head,
 // H2 typography, optional red strike-through, highlighted first letter and active item.
 const lineHtml=l=>{if(l.accentFirst)return `<span class="note-accent">${escape(l.text.slice(0,1))}</span>${escape(l.text.slice(1))}`;if(l.accentWord){const i=l.text.indexOf(l.accentWord);if(i<0)throw Error('accentWord fehlt: '+l.text);return escape(l.text.slice(0,i))+`<span class="note-accent">${escape(l.accentWord)}</span>`+escape(l.text.slice(i+l.accentWord.length));}return escape(l.text);};
 // Big word (Abdullah, 26.09.2026): a single word in H1 style, very large, replaces the headline for a strong statement.
 const bigHtml=bigwords.map(b=>`<div ${timing(b.id,b.start,b.end,8)} data-kind="bigword" style="font-size:${b.fontSize}px"><span>${escape(b.text)}${b.strikeAt!=null?`<i id="${b.id}-s" class="big-strike"></i>`:''}</span></div>`).join('');
 // Life bar (Abdullah, 26.09.2026, idea from the Notion plan): school + uni as a short blue part, the rest fills later.
 const barHtml=bars.map(b=>`<div ${timing(b.id,b.start,b.end,9)} data-kind="bar" style="left:${540-b.width/2}px;top:${b.top}px;width:${b.width}px"><div class="bar-labels"><span id="${b.id}-l1">${escape(b.label1.text)}</span><span id="${b.id}-l2">${escape(b.label2.text)}</span></div><div class="bar-track"><div id="${b.id}-f2" class="bar-fill2"></div><div id="${b.id}-f1" class="bar-fill1" style="width:${b.fill1.to*100}%"></div></div></div>`).join('');
 const noteHtml=notes.map(n=>`<div ${timing(n.id,n.start,n.end,7)} data-kind="note" style="left:${n.left}px;top:${n.top}px">${n.lines.map((l,j)=>`<div id="${n.id}-l${j}" class="note-line" style="margin-top:${l.gapBefore||0}px">${lineHtml(l)}${l.strikeAt!=null?`<i id="${n.id}-s${j}" class="note-strike"></i>`:''}</div>`).join('')}</div>`).join('');
 // Icons are pre-rendered 34x34 tiles (render-social-icons.py): shown 1:1, no browser scaling, no CSS filters.
 const profiles=[['youtube','@itsabidullahabi','tile-youtube.png'],['tiktok','@abidullahabi','tile-tiktok.png'],['instagram','@abidullahabi','tile-instagram.png'],['linkedin','Abdullah Bachtari','tile-linkedin.png']];
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(plan.title)}</title><style>
 @font-face{font-family:"ABI Arial Bold";src:url("assets/arial-bold.ttf") format("truetype");font-weight:100 900;font-style:normal;font-display:block}#root,#root *{font-family:"ABI Arial Bold",Arial,sans-serif!important;font-synthesis:none}*{box-sizing:border-box}html,body{margin:0;background:#111;font-family:Arial,sans-serif}#root{position:relative;width:1080px;height:1920px;overflow:hidden;color:white}video{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}
 #graphics{position:absolute;inset:0;clip-path:inset(250px 150px 260px 90px);pointer-events:none}.clip[data-kind]{position:absolute;visibility:hidden}
 [data-kind=h1]{left:0;top:250px;width:1080px;display:flex;justify-content:center;font-weight:800;line-height:1.2;text-align:center}
 [data-kind=h1]>span{display:inline-block;padding:12px 22px 14px;border-radius:12px;background:#1668b5;white-space:nowrap}
 [data-kind=h2]{left:260px;width:560px;text-align:center;font-size:46px;line-height:1.15;font-weight:700;-webkit-text-stroke:5px black;paint-order:stroke fill}
 [data-kind=h2]>span{display:inline-block;white-space:nowrap}
 [data-kind=h2][data-wide]{left:150px;width:780px}
 [data-kind=caption]{left:150px;width:780px;height:92px;display:flex;align-items:center;justify-content:center;font-weight:800;white-space:nowrap;text-align:center;line-height:1;-webkit-text-stroke:6px black;paint-order:stroke fill}
 .caption-line{display:inline-block;white-space:nowrap;max-width:620px;overflow:visible}.caption-line>span{color:#fff}
 [data-kind=follow]{left:0;top:250px;width:1080px;text-align:center;font-size:50px;line-height:1.2;font-weight:800;-webkit-text-stroke:5px black;paint-order:stroke fill}
 [data-kind=follow]>span{display:inline-block;white-space:nowrap}
 [data-kind=bubble]{left:90px;top:1000px;width:636px;height:122px}
 .message{position:absolute;left:16px;top:0;max-width:620px;background:#1668b5;color:#fff;font-size:34px;line-height:41px;font-weight:700;padding:13px 17px;border-radius:20px 20px 20px 6px;white-space:nowrap;transform-origin:0 100%;opacity:0}
 .typing{position:absolute;left:16px;top:0;background:#e9e9eb;border-radius:20px 20px 20px 6px;padding:15px 20px;display:flex;gap:8px;transform-origin:0 100%;opacity:0}
 .typing i{width:11px;height:11px;border-radius:50%;background:#6b6b70;opacity:.35;display:block}
 .tail{position:absolute;left:-15px;bottom:0;width:18px;height:23px;display:block}.message .tail{color:#1668b5}.typing .tail{color:#e9e9eb}
 [data-kind=note]{font-size:46px;line-height:1.15;font-weight:700;-webkit-text-stroke:5px black;paint-order:stroke fill;text-align:left}
 .note-line{position:relative;width:max-content;white-space:nowrap}.h2-line{display:inline-block;position:relative}.note-accent{color:#5eb3f5}
 .note-strike{position:absolute;left:-4px;right:-4px;top:54%;height:6px;margin-top:-3px;background:#e53935;border-radius:3px;box-shadow:0 0 0 2px #000;transform-origin:0 50%;transform:scaleX(0)}
 [data-kind=bigword]{left:0;top:250px;width:1080px;display:flex;justify-content:center;font-weight:800;line-height:1.05;text-align:center;transform-origin:50% 0}
 [data-kind=bigword]>span{position:relative;display:inline-block;padding:14px 26px 16px;border-radius:16px;background:#1668b5;white-space:nowrap}
 .big-strike{position:absolute;left:14px;right:14px;top:52%;height:14px;margin-top:-7px;background:#e53935;border-radius:7px;box-shadow:0 0 0 3px #000;transform-origin:0 50%;transform:scaleX(0)}
 [data-kind=bar]{font-weight:700}
 .bar-labels{display:flex;justify-content:space-between;font-size:36px;line-height:44px;height:44px;-webkit-text-stroke:4px black;paint-order:stroke fill;white-space:nowrap}
 .bar-labels span{opacity:0}
 .bar-track{position:relative;margin-top:10px;height:28px;border-radius:14px;background:#dee1e7;box-shadow:0 0 0 3px #000;overflow:hidden}
 .bar-fill1,.bar-fill2{position:absolute;left:0;top:0;height:100%;transform-origin:0 50%;transform:scaleX(0)}
 .bar-fill1{background:#1668b5;border-radius:14px 0 0 14px}.bar-fill2{width:100%;background:#5eb3f5;border-radius:14px}
 [data-kind=card]{left:90px;top:1423px;width:700px;height:237px;transform-origin:0 100%}
 .progress-card{width:100%;height:100%;padding:22px;background:#f8f9fb;border-radius:20px;color:#16181c;font-weight:700}
 .progress-header{display:flex;align-items:center;justify-content:space-between;height:63px;line-height:1.2}.follower-count{font-size:36px;position:relative;width:140px;height:44px;display:block}.counter-value{position:absolute;left:0;top:0;visibility:hidden}.counter-value:first-child{visibility:visible}.goal{font-size:26px;color:#7a7e86}
 .progress-track{height:19px;background:#dee1e7;border-radius:10px;margin-top:12px;overflow:hidden}.progress-fill{height:100%;width:100%;background:#1668b5;transform-origin:0 50%;transform:scaleX(0);border-radius:10px}
 .profile-grid{display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:13px 14px;margin-top:18px}.profile{display:flex;align-items:center;gap:12px;height:34px;font-size:25px;line-height:1;white-space:nowrap}.icon-tile{width:34px;height:34px;flex:0 0 34px;border-radius:7px;overflow:hidden;display:flex;align-items:center;justify-content:center}.icon-tile img{width:34px;height:34px;display:block}
 </style><script src="vendor/gsap.min.js"></script></head><body>
 <main id="root" data-composition-id="root" data-width="1080" data-height="1920" data-fps="30" data-duration="${duration}">
 <video id="footage" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="0" muted playsinline></video>
 <audio id="voice" class="clip" src="media.mp4" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="1"></audio>
 <svg width="0" height="0" style="position:absolute"><filter id="linkedin-color" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1.14 0 0 0 -.14 0 1.007 0 0 -.007 0 0 .792 0 .208 0 0 0 1 0"/></filter></svg>
 <div id="graphics">${titles}${supports}${captionHtml}${noteHtml}${barHtml}${bigHtml}${bubbleHtml}
 <div ${timing('follow',outro.start,outro.end,5)} data-kind="follow"><span>Folgen nicht vergessen</span></div>
 <div ${timing('progress-card',outro.start,outro.end,5)} data-kind="card"><div class="progress-card"><div class="progress-header"><span id="follower-count" class="follower-count">${Array.from({length:43},(_,i)=>`<span id="counter-${i}" class="counter-value">0</span>`).join('')}</span><span class="goal">Ziel 10.000</span></div><div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div><div class="profile-grid">${profiles.map(([platform,name,asset])=>`<div class="profile" data-platform="${platform}"><span class="icon-tile ${platform}"><img src="assets/${asset}" width="34" height="34" alt="${platform}"></span><span class="handle">${name}</span></div>`).join('')}</div></div></div></div>
 </main><script>
 function bezier(x1,y1,x2,y2){const coord=(s,a,b)=>3*(1-s)*(1-s)*s*a+3*(1-s)*s*s*b+s*s*s;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(coord(mid,x1,x2)<x)lo=mid;else hi=mid;}return coord((lo+hi)/2,y1,y2);};}
 const out=bezier(.22,1,.36,1),back=bezier(.34,1.56,.64,1),tl=gsap.timeline({paused:true});tl.to({}, {duration:${duration}});
 const show=(id,start,end)=>{tl.set('#'+id,{visibility:'visible'},start);tl.set('#'+id,{visibility:'hidden'},end);};
 const titles=${JSON.stringify(sections)},supports=${JSON.stringify(overlays)},captions=${JSON.stringify(captions)},outro=${JSON.stringify(outro)},zooms=${JSON.stringify(zooms)},bubbles=${JSON.stringify(bubbles)},notes=${JSON.stringify(notes)},bigwords=${JSON.stringify(bigwords)},bars=${JSON.stringify(bars)};
 // H1 11.1, H2 11.2: appear 0.22 s from 14 px below, disappear 0.18 s linear 8 px up. Opening elements stand from frame 0.
 // Staggered H2 lines (e.g. shout-out): each later line appears like a note line.
 for(const s of supports)(s.lineAt||[]).forEach((at,j)=>{if(at>s.start){tl.set('#'+s.id+'-l'+j,{opacity:0},0);tl.fromTo('#'+s.id+'-l'+j,{opacity:0,y:10},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},at);}});
 for(const x of [...titles,...supports]){show(x.id,x.start,x.end);if(x.start===0||x.transitionIn==='cut')tl.set('#'+x.id,{opacity:1,y:0},x.start);else tl.fromTo('#'+x.id,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},x.start);if(x.transitionOut!=='cut')tl.to('#'+x.id,{opacity:0,y:-8,duration:.18,ease:'none'},x.end-.18);}
 // 11.3: hard cuts only, one active word.
 for(const [i,c] of captions.entries()){show('caption-'+i,c.start,c.end);for(const [j,w] of c.words.entries()){tl.set('#word-'+i+'-'+j,{color:'#5eb3f5'},w.start);tl.set('#word-'+i+'-'+j,{color:'#ffffff'},w.end);}}
 // Zooms: only the video layer, linear push-in, hard return at a cut point.
 for(const z of zooms){tl.set('#footage',{scale:z.punch?z.scale:1,transformOrigin:'42% 28%'},z.start);if(!z.punch)tl.to('#footage',{scale:z.scale,duration:z.end-z.start,ease:'none'},z.start);tl.set('#footage',{scale:1},z.end);}
 // 11.6 outro.
 show('follow',outro.start,outro.end);show('progress-card',outro.start,outro.end);
 tl.fromTo('#follow',{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},outro.start);
 tl.set('#progress-card',{opacity:0,scale:.88},0);tl.set('#progress-card',{opacity:1},outro.start+.15);tl.to('#progress-card',{scale:1,duration:.45,ease:back},outro.start+.15);
 // Frame-specific values avoid callbacks being skipped by distributed render seeks.
 for(let i=0;i<=42;i++){const fraction=out(i/42),at=outro.start+.45+i/30;document.getElementById('counter-'+i).textContent=Math.round(outro.followers*fraction).toLocaleString('de-DE');tl.set('#counter-'+i,{visibility:'visible'},at);if(i>0)tl.set('#counter-'+(i-1),{visibility:'hidden'},at);tl.set('#progress-fill',{scaleX:Math.min(1,outro.followers/10000)*fraction},at);}
 // 11.5 speech bubble, parallel to the card.
 for(const [i,b] of bubbles.entries()){const s=b.start,typing='#bubble-'+i+'-typing',message='#bubble-'+i+'-message';show('bubble-'+i,s,s+4.25);
  tl.set(typing,{opacity:0,scale:.7,y:0},0);tl.set(message,{opacity:0,scale:.82,y:0},0);
  tl.to(typing,{opacity:1,scale:1,duration:.25,ease:back},s);
  for(let k=0;k<3;k++)for(let t=s+.25+k*.3;t<s+4;t+=.9){tl.to('#bubble-'+i+'-dot-'+k,{opacity:1,duration:.27,ease:'none'},t);tl.to('#bubble-'+i+'-dot-'+k,{opacity:.35,duration:.63,ease:'none'},t+.27);}
  tl.fromTo(message,{opacity:.6},{opacity:1,duration:.8,ease:back,immediateRender:false},s+1.75);
  tl.fromTo(message,{scale:.82},{scale:1.03,duration:.56,ease:back,immediateRender:false},s+1.75);
  tl.to(message,{scale:1,duration:.24,ease:back},s+2.31);
  tl.to(typing,{y:81,duration:.35,ease:out},s+1.75);
  tl.to(message,{opacity:0,y:-10,duration:.25,ease:'none'},s+4);tl.to(typing,{opacity:0,y:71,duration:.25,ease:'none'},s+4);}
 // Side notes: each line appears like H2 (0.22 s, 14 px from below); strike draws left to right in 0.28 s; the block leaves like H2.
 for(const n of notes){show(n.id,n.start,n.end);n.lines.forEach((l,j)=>{const id='#'+n.id+'-l'+j;tl.set(id,{opacity:0,y:0},0);tl.fromTo(id,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},l.at);if(l.strikeAt!=null)tl.to('#'+n.id+'-s'+j,{scaleX:1,duration:.28,ease:out},l.strikeAt);for(const [a,b] of l.active||[]){tl.set(id,{color:'#5eb3f5'},a);tl.set(id,{color:'#ffffff'},b);}});tl.to('#'+n.id,{opacity:0,y:-8,duration:.18,ease:'none'},n.end-.18);}
 // Life bar: container like H2, labels like note lines, fills with the ease-out curve.
 for(const b of bars){show(b.id,b.start,b.end);tl.fromTo('#'+b.id,{opacity:0,y:14},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},b.start);
  for(const k of ['l1','l2']){const l=k==='l1'?b.label1:b.label2;tl.fromTo('#'+b.id+'-'+k,{opacity:0,y:10},{opacity:1,y:0,duration:.22,ease:out,immediateRender:false},l.at);}
  tl.to('#'+b.id+'-f1',{scaleX:1,duration:b.fill1.dur,ease:out},b.fill1.at);tl.to('#'+b.id+'-f2',{scaleX:1,duration:b.fill2.dur,ease:out},b.fill2.at);
  tl.to('#'+b.id,{opacity:0,y:-8,duration:.18,ease:'none'},b.end-.18);}
 // Big words: top elements that overlap in time fade out 0.1 s before and return 0.1 s after (like DESIGN.md 11.4 for logos).
 const tops=[...titles.map(x=>x.id),...supports.map(x=>x.id),...notes.map(x=>x.id),...bars.map(x=>x.id)].map(id=>[id,[...titles,...supports,...notes,...bars].find(x=>x.id===id)]);
 for(const b of bigwords){show(b.id,b.start,b.end);
  tl.fromTo('#'+b.id,{opacity:0,scale:.55},{opacity:1,scale:1,duration:.32,ease:back,immediateRender:false},b.start);
  if(b.strikeAt!=null)tl.to('#'+b.id+'-s',{scaleX:1,duration:.28,ease:out},b.strikeAt);
  tl.to('#'+b.id,{opacity:0,duration:.15,ease:'none'},b.end-.15);
  for(const [id,x] of tops)if(x.start<b.end&&x.end>b.start){tl.to('#'+id,{opacity:0,duration:.1,ease:'none'},Math.max(x.start,b.start-.1));if(x.end>b.end+.1)tl.to('#'+id,{opacity:1,duration:.15,ease:'none'},b.end+.1);}}
 window.__timelines={root:tl};
 </script></body></html>`;
}
