import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import puppeteer from 'puppeteer-core';
const root=path.resolve(import.meta.dirname,'..'),key=process.argv[2]||'werki',p=fs.readFileSync(path.join(root,`experiments/project-${key}.txt`),'utf8').trim();
const plan=JSON.parse(fs.readFileSync(path.join(p,'experiment-plan.json'))),faces=JSON.parse(fs.readFileSync(path.join(p,'review/source-faces.json')));
const bp=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
const browser=await puppeteer.launch({executablePath:bp,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});await page.goto(pathToFileURL(path.join(p,'index.html')).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 const qa=await page.evaluate(({plan,faces})=>{
  const errors=[],seen=new Set();const add=(kind,id,t,b)=>{const k=kind+' '+id;if(!seen.has(k)){seen.add(k);errors.push({kind,id,time:t,box:b});}};
  const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const rect=el=>{let e=el;if(el.classList.contains('center'))e=el.firstElementChild;const r=e.getBoundingClientRect();const str=parseFloat(getComputedStyle(el).webkitTextStrokeWidth)||0;return{x:r.x-str/2,y:r.y-str/2,width:r.width+str,height:r.height+str};};
  const visible=el=>{for(let p=el;p&&p!==document.body;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)<.015)return false;}return true;};
  const all=[...document.querySelectorAll('[data-safe],[data-graphic],.youtube')];
  function active(t){
   window.__timelines.root.seek(t,false);const arr=[];
   for(const el of all){if(!visible(el))continue;const box=rect(el),id=el.id||el.closest('section')?.id+':'+el.className;
    if(box.x<179||box.x+box.width>901||box.y<299||box.y+box.height>1501)add('danger_zone',id,t,box);
    if(Math.abs(box.x+box.width/2-540)>1.2)add('off_center',id,t,box);
    arr.push({el,id,box});
   }
   const caps=arr.filter(x=>x.el.classList.contains('caption-line'));if(caps.length>1)add('overlapping_captions','captions',t);
   for(const {el,id} of caps){if(el.children.length>3)add('too_many_words',id,t);if(new Set([...el.children].map(x=>Math.round(x.getBoundingClientRect().y))).size>1)add('caption_wrap',id,t);}
   for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)if(!arr[i].el.contains(arr[j].el)&&!arr[j].el.contains(arr[i].el)&&overlap(arr[i].box,arr[j].box))add('overlap',arr[i].id+' + '+arr[j].id,t);
   return arr;
  }
  for(let n=0;n<Math.round(plan.duration*30);n++)active(n/30);
  for(const s of plan.scenes){const t=s.start+Math.min(.7,(s.end-s.start)/2);active(t);if(!visible(document.getElementById(s.id)))add('missing_scene',s.id,t);}
  let checked=0;
  for(const s of faces){if(plan.scenes.some(x=>x.full&&x.start<=s.time&&s.time<x.end))continue;
   const arr=active(s.time),style=getComputedStyle(document.getElementById('footage')),tr=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform),origin=style.transformOrigin.split(' ').map(parseFloat);
   for(const f of s.faces){const b={x:origin[0]+(f.x-origin[0])*tr.a+tr.e,y:origin[1]+(f.y-origin[1])*tr.d+tr.f,width:f.width*tr.a,height:f.height*tr.d};for(const x of arr)if(overlap(b,x.box))add('face_overlap',x.id,s.time,b);}
   checked++;
  }
  return {errors,frames:Math.round(plan.duration*30),faceSamplesChecked:checked,graphicSceneFaceChecks:'Opaque illustrative cutaways intentionally replace the camera image; face checks apply to visible talking-head scenes.',captions:plan.captions.length};
 },{plan,faces});
 fs.writeFileSync(path.join(p,'review/experiment-layout-check.json'),JSON.stringify(qa,null,2)+'\n');console.log(JSON.stringify({...qa,errors:qa.errors.slice(0,20),errorCount:qa.errors.length},null,2));
 const times={werki:[.7,2.5,5.2,14.5,24,31.4,36.6,38.65],consulting:[1,6.4,13.5,16.2,40,55.1,76.5,85.2],berufserfahrung:[1.5,7,17.5,21,26,46,57.2,69.6]}[key];
 for(let i=0;i<times.length;i++){const t=Math.min(plan.duration-.1,times[i]);await page.evaluate(async t=>{const v=document.getElementById('footage');if(v.readyState<1)await new Promise(r=>v.addEventListener('loadedmetadata',r,{once:true}));if(Math.abs(v.currentTime-t)>.005){v.currentTime=t;await new Promise(r=>v.addEventListener('seeked',r,{once:true}));}window.__timelines.root.seek(t,false);},t);await page.screenshot({path:path.join(p,`review/scene-${i+1}.png`)});}
 const grid=`<html><style>body{margin:0;padding:20px;background:#121a25;color:white;font-family:Arial}h1{font-size:24px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(4,270px);gap:18px}.frame{width:270px}img{width:270px;display:block}span{display:block;padding:9px 0;font-size:16px}</style><body><h1>${key} · Experiment · ${plan.duration.toFixed(1)} Sekunden</h1><div class="grid">${times.map((t,i)=>`<div class="frame"><img src="${pathToFileURL(path.join(p,`review/scene-${i+1}.png`))}"><span>${t.toFixed(1)} s</span></div>`).join('')}</div></body></html>`;fs.writeFileSync(path.join(p,'review/contact.html'),grid);await page.setViewport({width:1174,height:1140});await page.goto(pathToFileURL(path.join(p,'review/contact.html')).href);await page.screenshot({path:path.join(p,'review/contact.png'),fullPage:true});
 if(qa.errors.length)process.exitCode=1;
}finally{await browser.close();}
