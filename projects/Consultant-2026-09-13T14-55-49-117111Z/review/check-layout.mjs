import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(project,'../..');
const plan=JSON.parse(fs.readFileSync(path.join(project,'theme-plan.json')));
const faces=JSON.parse(fs.readFileSync(path.join(project,'review/source-faces.json')));
const browserPath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8'}).trim();
const browser=await puppeteer.launch({executablePath:browserPath,headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(project,'index.html')).href,{waitUntil:'load'});
 await page.evaluate(()=>document.fonts.ready);
 const errors=await page.evaluate(({plan,faces})=>{
  const errors=[];
  const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
  const intersect=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const themes=[...plan.sections,...plan.overlays];
  const box={};
  for(const x of themes){
   const el=document.getElementById(x.id).querySelector('span');
   box[x.id]=rect(el);
   const b=box[x.id];
   if(b.x<96||b.x+b.width>888.01||b.y<0||b.y+b.height>1920)errors.push({type:'theme_bounds',id:x.id,box:b});
  }
  for(let frame=0;frame<Math.ceil(plan.duration*30);frame++){
   const t=frame/30;
   window.__timelines.root.seek(t,false);
   const cues=plan.captions.map((c,i)=>({c,i})).filter(({c})=>c.start<=t&&t<c.end);
   if(cues.length>1)errors.push({type:'overlap',frame});
   for(const {c,i} of cues){
    const line=document.querySelector('#caption-'+i+' .caption-line');
    const b=rect(line);
    const words=Array.from(line.children);
    if(b.x<96||b.x+b.width>888.01||new Set(words.map(w=>Math.round(w.getBoundingClientRect().top))).size>1)errors.push({type:'caption_bounds',frame,i,box:b});
    const blue=words.filter(w=>getComputedStyle(w).color==='rgb(52, 159, 235)');
    if(blue.length>1)errors.push({type:'multiple_active_words',frame,i});
   }
  }
  for(const sample of faces){
   const t=sample.time;
   for(const x of themes.filter(x=>x.start<=t&&t<x.end))for(const face of sample.faces||[])if(intersect(box[x.id],face))errors.push({type:'face_theme_overlap',time:t,id:x.id});
   const active=plan.captions.map((c,i)=>({c,i})).filter(({c})=>c.start<=t&&t<c.end);
   for(const {i} of active)for(const face of sample.faces||[])if(intersect(rect(document.querySelector('#caption-'+i+' .caption-line')),face))errors.push({type:'face_caption_overlap',time:t,i});
  }
  return {errors,themeBoxes:box,framesChecked:Math.ceil(plan.duration*30),faceSamples:faces.length,cues:plan.captions.length};
 },{plan,faces});
 fs.writeFileSync(path.join(project,'review/layout-check.json'),JSON.stringify(errors,null,2)+'\n');
 console.log(JSON.stringify({framesChecked:errors.framesChecked,faceSamples:errors.faceSamples,cues:errors.cues,errors:errors.errors},null,2));
 if(errors.errors.length)process.exitCode=1;
} finally {await browser.close();}
