import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {DESIGN111_LAYOUT as layout} from './social-layout.mjs';

// Layout check against DESIGN.md 1.11. Same structure as check-design19.mjs, but
// centred elements must sit on the full-frame centre x = 540 (correction of 17.09.2026),
// H1 sizes follow the 736 px rule, and the speech bubble is checked as a left-aligned element.
export async function checkDesign111(project){
 const plan=JSON.parse(fs.readFileSync(path.join(project,'theme-plan.json'))),root=path.resolve(project,'../..');
 const faces=JSON.parse(fs.readFileSync(path.join(project,'review/source-faces.json')));
 if(!faces.length||faces.some(s=>s.error||!s.faces?.length))throw Error('Gesichtsprüfung unvollständig.');
 const executablePath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});await page.goto(pathToFileURL(path.join(project,'index.html')).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  const report=await page.evaluate(({plan,faces,layout})=>{
   const errors=[],keys=new Set(),add=(type,detail={})=>{const key=type+JSON.stringify(detail);if(!keys.has(key)&&errors.length<200){keys.add(key);errors.push({type,...detail});}};
   const rect=(el,pad=0)=>{const b=el.getBoundingClientRect();return{x:b.x-pad,y:b.y-pad,width:b.width+2*pad,height:b.height+2*pad};};
   const union=els=>{const r=els.map(e=>e.getBoundingClientRect());const x=Math.min(...r.map(b=>b.x)),y=Math.min(...r.map(b=>b.y));return{x,y,width:Math.max(...r.map(b=>b.right))-x,height:Math.max(...r.map(b=>b.bottom))-y};};
   const intersection=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   const width=(text,size,weight=800)=>{ctx.font=`${weight} ${size}px "ABI Arial Bold"`;return ctx.measureText(text).width;};
   const activeBoxes=t=>{const boxes=[];for(const el of document.querySelectorAll('[data-kind]')){
    const start=Number(el.dataset.start),end=start+Number(el.dataset.duration),kind=el.dataset.kind;
    if(t<start||t>=end||getComputedStyle(el).visibility!=='visible')continue;
    let box;
    if(kind==='bubble'){const parts=[...el.querySelectorAll('.message,.typing')].filter(p=>Number(getComputedStyle(p).opacity)>.001);if(!parts.length)continue;box=union([...parts,...el.querySelectorAll('.tail')].filter(p=>Number(getComputedStyle(p.closest('.message,.typing')||p).opacity)>.001));}
    else{
     if(Number(getComputedStyle(el).opacity)<.001)continue;
     const child=['h1','h2','follow','bigword'].includes(kind)?el.firstElementChild:kind==='caption'?el.querySelector('.caption-line'):el;
     if(kind==='note'){const lines=[...el.querySelectorAll('.note-line')].filter(l=>Number(getComputedStyle(l).opacity)>.001);if(!lines.length)continue;const u=union(lines);box={x:u.x-2.5,y:u.y-2.5,width:u.width+5,height:u.height+5};}
     const stroke=kind==='caption'?3:['h2','follow'].includes(kind)?2.5:kind==='bar'?3:0;
     if(kind!=='note')box=rect(child,stroke);
     // H2 mit gestaffelten Zeilen: nur sichtbare Zeilen zaehlen.
     if(kind==='h2'&&el.querySelector('.h2-line')){const vis=[...el.querySelectorAll('.h2-line')].filter(l=>Number(getComputedStyle(l).opacity)>.001);if(!vis.length)continue;const u=union(vis);box={x:u.x-stroke,y:u.y-stroke,width:u.width+2*stroke,height:u.height+2*stroke};}
     if(['h1','h2','follow','caption','bigword','bar','logo'].includes(kind)&&Math.abs(box.x+box.width/2-layout.centerX)>.7)add('center',{id:el.id,time:t,center:box.x+box.width/2});
     if(kind==='caption'){
      const spans=[...child.children];if(spans.filter(s=>getComputedStyle(s).color==='rgb(94, 179, 245)').length>1)add('multiple_active_words',{id:el.id,time:t});
      if(spans.length>layout.captionMaxWords||rect(child).width>layout.captionMaxWidth+.5)add('caption_width_or_count',{id:el.id,width:rect(child).width});
      if(new Set(spans.map(s=>Math.round(s.getBoundingClientRect().top))).size!==1)add('caption_wrap',{id:el.id});
     }
    }
    // All graphics are clipped by the safe-area wrapper, including H1 exit motion; the clipped box is what can be seen.
    const clipped={x:Math.max(layout.safeLeft,box.x),y:Math.max(layout.safeTop,box.y),width:Math.min(layout.safeRight,box.x+box.width)-Math.max(layout.safeLeft,box.x),height:Math.min(layout.safeBottom,box.y+box.height)-Math.max(layout.safeTop,box.y)};
    if(box.x<layout.safeLeft-.1||box.x+box.width>layout.safeRight+.1||box.y+box.height>layout.safeBottom+.1)add('safe_bounds',{id:el.id,time:t,box});
    if(box.y<layout.safeTop-.1&&!(['h1','follow','bigword'].includes(kind)))add('safe_top',{id:el.id,time:t});
    boxes.push({id:el.id,kind,box:clipped});
   }for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(intersection(boxes[i].box,boxes[j].box))add('graphic_overlap',{a:boxes[i].id,b:boxes[j].id,time:t});return boxes;};
   const tl=window.__timelines.root;
   tl.seek(0,false);
   for(const x of [...plan.sections,...plan.overlays].filter(x=>x.start===0)){const e=document.getElementById(x.id),s=getComputedStyle(e);if(s.visibility!=='visible'||+s.opacity<.999||new DOMMatrix(s.transform).f!==0)add('opening_not_visible',{id:x.id});}
   if(!plan.sections.some(s=>s.start===0))add('opening_missing');
   // DESIGN.md 8/11.4: logo group at the H1 position; fully revealed after the 0.28 s wipe, H1 hidden meanwhile.
   for(const l of plan.logos||[]){const t=Math.min(l.start+.4,l.end-.3);tl.seek(t,false);const e=document.getElementById(l.id),b=rect(e);
    if(Math.abs(b.y-(l.top??250))>.5||b.height>112.5)add('logo_geometry',{id:l.id,box:b});
    if(getComputedStyle(e).clipPath.replace(/\s/g,'')!=='inset(0%)'&&getComputedStyle(e).clipPath.replace(/\s/g,'')!=='inset(0%0%0%0%)')add('logo_not_revealed',{id:l.id,clip:getComputedStyle(e).clipPath});
    for(const s of plan.sections)if(s.start<t&&s.end>t&&+getComputedStyle(document.getElementById(s.id)).opacity>.001)add('logo_with_h1',{id:l.id,h1:s.id});}
   const heights={72:112,66:105,60:98,56:93};
   for(const s of plan.sections){
    const fit=[72,66,60,56].find(size=>width(s.text,size)<=736);
    if(!fit)add('h1_too_wide',{id:s.id});else if(s.fontSize!==fit)add('h1_size',{id:s.id,expected:fit,got:s.fontSize});
    tl.seek((s.start+s.end)/2,false);const span=document.querySelector('#'+s.id+' span'),b=rect(span);
    if(getComputedStyle(span).backgroundColor!=='rgb(22, 104, 181)')add('h1_color',{id:s.id});
    if(Math.abs(b.y-250)>.5||Math.abs(b.height-heights[s.fontSize])>1.5||b.width>780.5)add('h1_geometry',{id:s.id,box:b});
    for(const o of plan.overlays.filter(o=>o.start<s.end&&o.end>s.start&&!o.standalone)){if(Math.abs(o.top-(250+heights[s.fontSize]+20))>.5)add('h2_top',{id:o.id,top:o.top,expected:250+heights[s.fontSize]+20});}
   }
   for(const s of plan.overlays){const lines=s.lines||[s.text];if(lines.length>2||lines.some(t=>width(t,46,700)>(s.wide?780:560)))add('h2_width_or_lines',{id:s.id});if(!s.standalone&&!plan.sections.some(h=>h.start<=s.start&&h.end>=s.end))add('h2_without_h1',{id:s.id});
    // Ohne H1 steht die H2 oben an der Zonenkante (Abdullah 26.09.2026: H1 darf auch mal fehlen).
    if(s.standalone&&(Math.abs(s.top-262)>.5||plan.sections.some(h=>h.start<s.end&&h.end>s.start)))add('h2_standalone',{id:s.id});}
   for(const img of document.images)if(!img.complete||!img.naturalWidth)add('missing_asset',{src:img.getAttribute('src')});
   for(let frame=0;frame<Math.ceil(plan.duration*30);frame++){const t=frame/30;tl.seek(t,false);activeBoxes(t);}
   for(const sample of faces){tl.seek(sample.time,false);for(const el of activeBoxes(sample.time))for(const f of sample.faces){if(intersection(el.box,f))add(el.kind==='bubble'?'bubble_face_overlap':'face_overlap',{id:el.id,time:sample.time,faceBottom:f.y+f.height});
    // Kopf samt Kappe: die Gesichtserkennung endet an der Stirn. Bereich nach oben um die halbe Gesichtshoehe, seitlich um 12 % erweitert.
    const head={x:f.x-.12*f.width,y:f.y-.5*f.height,width:1.24*f.width,height:.5*f.height};
    if(['note','bar','bigword','h2','logo'].includes(el.kind)&&intersection(el.box,head))add('head_overlap',{id:el.id,time:sample.time,headTop:Math.round(head.y),box:el.box});}}
   tl.seek(plan.outro.start+2,false);
   const card=document.getElementById('progress-card'),cardBox=rect(card),counter=document.getElementById('counter-42').textContent,fill=new DOMMatrix(getComputedStyle(document.getElementById('progress-fill')).transform).a;
   if(Math.abs(cardBox.x-90)>.1||Math.abs(cardBox.y-1423)>.1||Math.abs(cardBox.width-700)>.1||Math.abs(cardBox.height-237)>.1)add('card_geometry',{cardBox});
   if(counter!==plan.outro.followers.toLocaleString('de-DE')||Math.abs(fill-plan.outro.followers/10000)>.0001)add('counter_bar_final',{counter,fill});
   for(const el of card.querySelectorAll('.profile,.handle,.icon-tile,.goal,.follower-count')){const b=rect(el);if(b.x<cardBox.x+21.9||b.y<cardBox.y+21.9||b.x+b.width>cardBox.x+cardBox.width-21.9||b.y+b.height>cardBox.y+cardBox.height-21.9)add('card_content_padding',{text:el.textContent,box:b});}
   const follow=rect(document.querySelector('#follow span'));if(Math.abs(follow.y-250)>.5)add('follow_top',{box:follow});
   let bubbleCheck=null;
   for(const [i,b] of (plan.bubbles||[]).entries()){
    tl.seek(b.start+3,false);const m=document.getElementById('bubble-'+i+'-message'),ty=document.getElementById('bubble-'+i+'-typing');const mb=rect(m),tb=rect(ty),tail=rect(m.querySelector('.tail'));
    bubbleCheck={message:mb,typing:tb,tail};
    const bt=b.top??1000;if(Math.abs(mb.x-106)>.5||Math.abs(mb.y-bt)>.5||mb.width>620.5)add('bubble_message_geometry',{box:mb});
    if(Math.abs(tb.y-(bt+81))>.5||Math.abs(tb.x-106)>.5)add('bubble_typing_geometry',{box:tb});
    if(Math.abs(tail.x-91)>.5)add('bubble_tail',{box:tail});
    tl.seek(b.start+1.5,false);if(Number(getComputedStyle(m).opacity)>.001)add('bubble_message_early');
    tl.seek(b.start+4.3,false);if(getComputedStyle(document.getElementById('bubble-'+i)).visibility==='visible')add('bubble_not_ended');
   }
   tl.seek(plan.outro.start+2,false);const handles=[...card.querySelectorAll('.handle')].map(h=>h.textContent);
   if(JSON.stringify(handles)!==JSON.stringify(['@itsabidullahabi','@abidullahabi','@abidullahabi','Abdullah Bachtari']))add('handles',{handles});
   return{designVersion:plan.designVersion,errors,framesChecked:Math.ceil(plan.duration*30),faceSamples:faces.length,cues:plan.captions.length,openingChecked:true,cardBox,counter,fill,handles,bubble:bubbleCheck,layout};
  },{plan,faces,layout});
  // Ausdrücklich abgenommene Befundarten stehen weiter im Bericht, blockieren aber nicht.
  const waiverFile=path.join(project,'review/layout-waivers.json');
  const waivers=fs.existsSync(waiverFile)?JSON.parse(fs.readFileSync(waiverFile)):{};
  const waived=report.errors.filter(e=>waivers[e.type]);
  const blocking=report.errors.filter(e=>!waivers[e.type]);
  report.waived=waived.length?{count:waived.length,types:Object.fromEntries(Object.entries(waivers).filter(([t])=>waived.some(e=>e.type===t)))}:undefined;
  report.blocking=blocking.length;
  fs.writeFileSync(path.join(project,'review/layout-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,errors:report.errors.slice(0,25)},null,2));
  if(waived.length)console.log(`Abgenommen und daher nicht blockierend: ${waived.length} Befunde (${[...new Set(waived.map(e=>e.type))].join(', ')}).`);
  if(blocking.length)throw Error('Designprüfung: '+blocking.length+' Abweichungen.');
 }finally{await browser.close();}
}
