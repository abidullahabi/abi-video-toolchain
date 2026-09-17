import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import puppeteer from 'puppeteer-core';
const project=path.dirname(new URL(import.meta.url).pathname);const root=path.resolve(project,'../..');
const executablePath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();await page.setViewport({width:1080,height:1920,deviceScaleFactor:1});await page.goto(pathToFileURL(path.join(project,'index.html')).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
for(const t of [0,3.1,14.9,21.5,28.5,39.4,43.9,44.2,45.4,47.4,49.3]){
 await page.evaluate(async t=>{window.__timelines.root.seek(t,false);for(const el of document.querySelectorAll('.clip')){const start=+el.dataset.start,end=start+(+el.dataset.duration);el.style.visibility=t>=start&&t<end?'visible':'hidden';}const v=document.querySelector('video');v.muted=true;if(v.readyState<2)await new Promise(res=>v.addEventListener('loadeddata',res,{once:true}));if(Math.abs(v.currentTime-t)>.01)await new Promise(res=>{v.addEventListener('seeked',res,{once:true});v.currentTime=t;});},t);
 await page.screenshot({path:path.join(project,`review/layout-${t}.png`)});
}
console.log('Acht Layoutansichten gespeichert.');}finally{await browser.close();}
