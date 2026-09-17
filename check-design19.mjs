import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {DESIGN19_LAYOUT as layout} from './social-layout.mjs';

export async function checkDesign19(project){
 const plan=JSON.parse(fs.readFileSync(path.join(project,'theme-plan.json'))),root=path.resolve(project,'../..');
 const faces=JSON.parse(fs.readFileSync(path.join(project,'review/source-faces.json')));
 if(!faces.length||faces.some(s=>s.error||!s.faces?.length))throw Error('Gesichtsprüfung unvollständig.');
 const executablePath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});await page.goto(pathToFileURL(path.join(project,'index.html')).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  const report=await page.evaluate(({plan,faces,layout})=>{
   const errors=[],keys=new Set(),add=(type,detail={})=>{const key=type+JSON.stringify(detail);if(!keys.has(key)&&errors.length<100){keys.add(key);errors.push({type,...detail});}};
   const rect=(el,pad=0)=>{const b=el.getBoundingClientRect();return{x:b.x-pad,y:b.y-pad,width:b.width+2*pad,height:b.height+2*pad};};
   const intersection=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   const activeBoxes=t=>{const boxes=[];for(const el of document.querySelectorAll('[data-kind]')){
    const start=Number(el.dataset.start),end=start+Number(el.dataset.duration),kind=el.dataset.kind;
    if(t<start||t>=end||getComputedStyle(el).visibility!=='visible'||Number(getComputedStyle(el).opacity)<.001)continue;
    const child=['h1','h2','follow'].includes(kind)?el.firstElementChild:kind==='caption'?el.querySelector('.caption-line'):el;
    const stroke=['caption'].includes(kind)?3:['h2','follow'].includes(kind)?2.5:0;
    let box=rect(child,stroke);
    // All graphics are clipped by the authoritative safe-area wrapper, including H1 exit motion.
    const clipped={x:Math.max(90,box.x),y:Math.max(250,box.y),width:Math.min(930,box.x+box.width)-Math.max(90,box.x),height:Math.min(1660,box.y+box.height)-Math.max(250,box.y)};
    if(box.x<89.9||box.x+box.width>930.1||box.y+box.height>1660.1)add('safe_bounds',{id:el.id,time:t,box});
    if(box.y<249.9&&!(kind==='h1'||kind==='follow'))add('safe_top',{id:el.id,time:t});
    if(kind!=='card'&&Math.abs(box.x+box.width/2-510)>.7)add('center',{id:el.id});
    if(kind==='caption'){
     const spans=[...child.children];if(spans.filter(s=>getComputedStyle(s).color==='rgb(94, 179, 245)').length>1)add('multiple_active_words',{id:el.id,time:t});
     if(spans.length>4||rect(child).width>620.5)add('caption_width_or_count',{id:el.id,width:rect(child).width});
     if(new Set(spans.map(s=>Math.round(s.getBoundingClientRect().top))).size!==1)add('caption_wrap',{id:el.id});
    }
    boxes.push({id:el.id,kind,box:clipped});
   }for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(intersection(boxes[i].box,boxes[j].box))add('graphic_overlap',{a:boxes[i].id,b:boxes[j].id,time:t});return boxes;};
   window.__timelines.root.seek(0,false);
   for(const x of [...plan.sections,...plan.overlays].filter(x=>x.start===0)){const e=document.getElementById(x.id),s=getComputedStyle(e);if(s.visibility!=='visible'||+s.opacity<.999||new DOMMatrix(s.transform).f!==0)add('opening_not_visible',{id:x.id});}
   for(const s of plan.sections){ctx.font='bold '+s.fontSize+'px Arial';const w=ctx.measureText(s.text).width;if(![72,66,60,56].includes(s.fontSize)||w>796)add('h1_size',{id:s.id,width:w});if(getComputedStyle(document.querySelector('#'+s.id+' span')).backgroundColor!=='rgb(22, 104, 181)')add('h1_color',{id:s.id});}
   for(const s of plan.overlays){ctx.font='bold 46px Arial';if((s.lines||[s.text]).some(t=>ctx.measureText(t).width>560))add('h2_width',{id:s.id});}
   for(const img of document.images)if(!img.complete||!img.naturalWidth)add('missing_asset',{src:img.getAttribute('src')});
   for(let frame=0;frame<Math.ceil(plan.duration*30);frame++){const t=frame/30;window.__timelines.root.seek(t,false);activeBoxes(t);}
   for(const sample of faces){window.__timelines.root.seek(sample.time,false);for(const el of activeBoxes(sample.time))for(const f of sample.faces)if(intersection(el.box,f))add('face_overlap',{id:el.id,time:sample.time,faceBottom:f.y+f.height});}
   window.__timelines.root.seek(plan.outro.start+2,false);
   const card=document.getElementById('progress-card'),cardBox=rect(card),counter=document.getElementById('counter-42').textContent,fill=new DOMMatrix(getComputedStyle(document.getElementById('progress-fill')).transform).a;
   if(Math.abs(cardBox.x-90)>.1||Math.abs(cardBox.y-1423)>.1||Math.abs(cardBox.width-700)>.1||Math.abs(cardBox.height-237)>.1)add('card_geometry',{cardBox});
   if(counter!==plan.outro.followers.toLocaleString('de-DE')||Math.abs(fill-plan.outro.followers/10000)>.0001)add('counter_bar_final',{counter,fill});
   for(const el of card.querySelectorAll('.profile,.handle,.icon-tile,.goal,.follower-count')){const b=rect(el);if(b.x<cardBox.x+21.9||b.y<cardBox.y+21.9||b.x+b.width>cardBox.x+cardBox.width-21.9||b.y+b.height>cardBox.y+cardBox.height-21.9)add('card_content_padding',{text:el.textContent,box:b});}
   return{designVersion:plan.designVersion,errors,framesChecked:Math.ceil(plan.duration*30),faceSamples:faces.length,cues:plan.captions.length,openingChecked:true,cardBox,counter,fill,layout};
  },{plan,faces,layout});
  // Ausdrücklich abgenommene Befundarten stehen weiter im Bericht, blockieren aber nicht.
  // Ohne review/layout-waivers.json bleibt das Verhalten unverändert.
  const waiverFile=path.join(project,'review/layout-waivers.json');
  const waivers=fs.existsSync(waiverFile)?JSON.parse(fs.readFileSync(waiverFile)):{};
  const waived=report.errors.filter(e=>waivers[e.type]);
  const blocking=report.errors.filter(e=>!waivers[e.type]);
  report.waived=waived.length?{count:waived.length,types:Object.fromEntries(Object.entries(waivers).filter(([t])=>waived.some(e=>e.type===t)))}:undefined;
  report.blocking=blocking.length;
  fs.writeFileSync(path.join(project,'review/layout-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,errors:report.errors.slice(0,15)},null,2));
  if(waived.length)console.log(`Abgenommen und daher nicht blockierend: ${waived.length} Befunde (${[...new Set(waived.map(e=>e.type))].join(', ')}).`);
  if(blocking.length)throw Error('Designprüfung: '+blocking.length+' Abweichungen.');
 }finally{await browser.close();}
}
