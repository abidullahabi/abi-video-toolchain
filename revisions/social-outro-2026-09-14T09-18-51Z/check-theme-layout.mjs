import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { SOCIAL_LAYOUT, boxViolations } from './social-layout.mjs';
const project=path.resolve(process.argv[2]);
const root=path.resolve(project,'../..');
const plan=JSON.parse(fs.readFileSync(path.join(project,'theme-plan.json')));
const facePath=path.join(project,'review/source-faces.json');
if(!fs.existsSync(facePath)){
 fs.mkdirSync(path.dirname(facePath),{recursive:true});
 execFileSync('swift',['-module-cache-path',path.join(root,'tools/swift-module-cache'),path.join(root,'check-face-placement.swift'),path.join(project,'media.mp4'),facePath],{stdio:'inherit'});
}
const faces=JSON.parse(fs.readFileSync(facePath));
if(!faces.length||faces.some(sample=>sample.error))throw new Error('Die Gesichtsprüfung ist unvollständig. Aufnahme erneut prüfen, bevor der Export freigegeben wird.');
const browserPath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
const browser=await puppeteer.launch({executablePath:browserPath,headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(project,'index.html')).href,{waitUntil:'load'});
 await page.evaluate(()=>document.fonts.ready);
 await page.addScriptTag({content:`const SOCIAL_LAYOUT=${JSON.stringify(SOCIAL_LAYOUT)};window.checkSocialBox=${boxViolations.toString()};`});
 const report=await page.evaluate(({plan,faces,layout})=>{
  const errors=[], seen=new Set();
  const add=e=>{const key=JSON.stringify(e);if(!seen.has(key)&&errors.length<300){errors.push(e);seen.add(key);}};
  const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
  const expand=(b,n)=>({x:b.x-n,y:b.y-n,width:b.width+2*n,height:b.height+2*n});
  const intersect=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const themes=[...plan.sections,...plan.overlays,...(plan.logos||[]),...(plan.socialCtas||[])];
  const elements=themes.map(x=>({x,el:document.querySelector('#'+x.id+' .social-card')||document.querySelector('#'+x.id+' span')||document.querySelector('#'+x.id+' img'),stroke:x.src?0:(plan.sections.includes(x)?0:(x.strokeWidth??5))}));
  const captionEls=plan.captions.map((c,i)=>({c,i,el:document.querySelector('#caption-'+i+' .caption-line')}));
  const openingTitles=plan.sections.filter(x=>x.start===0),openingChecks=[];
  window.__timelines.root.seek(0,false);
  if(!openingTitles.length)add({type:'missing_opening_title',time:0});
  for(const x of [...openingTitles,...plan.overlays.filter(x=>x.start===0)]){
   const el=document.getElementById(x.id),style=getComputedStyle(el);
   let opacity=1,visible=true;
   for(let node=el;node&&node!==document.body;node=node.parentElement){const s=getComputedStyle(node);opacity*=Number(s.opacity);if(s.display==='none'||s.visibility!=='visible')visible=false;}
   const matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
   const passed=visible&&opacity>=.999&&Math.abs(matrix.e)<.01&&Math.abs(matrix.f)<.01&&el.textContent.trim().length>0;
   openingChecks.push({id:x.id,time:0,opacity,visible,translation:[matrix.e,matrix.f],passed});
   if(!passed)add({type:'opening_title_not_fully_visible',id:x.id,time:0});
  }
  const boxes={};
  for(const {x,el} of elements){window.__timelines.root.seek(Math.min(x.end-.001,x.start+.3),false);boxes[x.id]=rect(el);}
  function activeAt(t) {
   const active=[];
   for(const {x,el,stroke} of elements)if(x.start<=t&&t<x.end){
    const b=rect(el);
    if(x.kind==='social-cta')for(const child of el.querySelectorAll('.social-label,.social-identity,img,span')){const r=rect(child);if(r.x<b.x-.1||r.y<b.y-.1||r.x+r.width>b.x+b.width+.1||r.y+r.height>b.y+b.height+.1)add({type:'social_cta_overflow',id:x.id,time:t});}
    active.push({id:x.id,box:expand(b,stroke/2),kind:'theme'});
    for(const type of window.checkSocialBox(b,{stroke}))add({type,id:x.id,time:t});
   }
   const cues=captionEls.filter(({c})=>c.start<=t&&t<c.end);
   if(cues.length>1)add({type:'caption_overlap',time:t});
   for(const {c,i,el} of cues){
    if(c.words.length>layout.captionMaxWords)add({type:'too_many_words',i});
    const b=rect(el),words=Array.from(el.children);active.push({id:'caption-'+i,box:expand(b,3),kind:'caption'});
    for(const type of window.checkSocialBox(b,{stroke:6}))add({type,i,time:t});
    if(new Set(words.map(w=>Math.round(w.getBoundingClientRect().top))).size>1)add({type:'caption_line_wrap',i});
    if(words.filter(w=>getComputedStyle(w).color==='rgb(52, 159, 235)').length>1)add({type:'multiple_active_words',i,time:t});
   }
   for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(intersect(active[i].box,active[j].box))add({type:'graphic_overlap',a:active[i].id,b:active[j].id,time:t});
   return active;
  }
  for(let frame=0;frame<Math.ceil(plan.duration*30);frame++){
   const t=frame/30;window.__timelines.root.seek(t,false);activeAt(t);
  }
  for(const sample of faces){
   const t=sample.time;window.__timelines.root.seek(t,false);const active=activeAt(t);
   const style=getComputedStyle(document.getElementById('footage'));
   const matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform),origin=style.transformOrigin.split(' ').map(parseFloat);
   const transformed=(sample.faces||[]).map(f=>({x:origin[0]+(f.x-origin[0])*matrix.a+matrix.e,y:origin[1]+(f.y-origin[1])*matrix.d+matrix.f,width:f.width*matrix.a,height:f.height*matrix.d}));
   for(const el of active)for(const face of transformed)if(intersect(el.box,face))add({type:'face_'+el.kind+'_overlap',time:t,id:el.id});
  }
  return {errors,themeBoxes:boxes,framesChecked:Math.ceil(plan.duration*30),faceSamples:faces.length,cues:plan.captions.length,socialLayout:layout,animationFramesChecked:true,horizontalCenter:540,openingChecks};
 },{plan,faces,layout:SOCIAL_LAYOUT});
 fs.mkdirSync(path.join(project,'review'),{recursive:true});
 fs.writeFileSync(path.join(project,'review/layout-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({framesChecked:report.framesChecked,faceSamples:report.faceSamples,cues:report.cues,errors:report.errors},null,2));
 if(report.errors.length)process.exitCode=1;
} finally {await browser.close();}
