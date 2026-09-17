import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
const root=process.cwd();
const batch=JSON.parse(fs.readFileSync('projects/batch-safezone-2026-09-13.json'));
const out=path.join(root,'projects/safezone-review-2026-09-13');fs.mkdirSync(out,{recursive:true});
const samples=[['consulting',1.5,'Consulting · Einstieg'],['berufserfahrung',23.6,'Berufserfahrung · YouTube'],['werki',1.5,'Werkstudent vs. Praktikum · Einstieg'],['consulting',100.4,'Consulting · Abschluss'],['berufserfahrung',83,'Berufserfahrung · Abschluss'],['werki',54,'Werkstudent vs. Praktikum · Abschluss']];
const heart='<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z"/>';
const bubble='<path d="M22 11c0 6-7 10-13 7l-6 3 1-6C-2 7 5 1 12 1c6 0 10 4 10 10Z"/>';
const bookmark='<path d="M5 2h14v20l-7-5-7 5Z"/>';
const share='<path d="m14 2 10 9-10 9v-6C6 14 3 16 1 21 1 10 6 7 14 7Z"/>';
const svg=s=>`<svg viewBox="0 0 24 24" width="70" height="70" fill="white">${s}</svg>`;
let cards=[];let manifest=[];
for(let i=0;i<samples.length;i++){
 const [key,time,title]=samples[i],project=batch[key],m=JSON.parse(fs.readFileSync(path.join(project,'workflow.json')));
 if(!m.latestExport)throw new Error(key+' noch nicht fertig');
 const frame=path.join(out,`frame-${i+1}.png`);
 execFileSync(path.join(root,'tools/bin/ffmpeg'),['-v','error','-y','-ss',String(time),'-i',m.latestExport,'-frames:v','1',frame]);
 manifest.push({project:key,title,time,file:m.latestExport,frame});
 cards.push(`<article><h2>${title}</h2><div class="viewport"><div class="scene"><img class="frame" src="${pathToFileURL(frame)}"><div class="top"><span>Explore</span><span>Following</span><b>For You</b><span class="search">⌕</span></div><div class="rail"><div class="avatar">A</div>${[heart,bubble,bookmark,share].map(s=>`<div>${svg(s)}<small>2.8M</small></div>`).join('')}<div class="disc">♪</div></div><div class="bottom"><b>Your name</b><p>Hier steht die Beschreibung des Videos</p><p>♪ Originalton</p></div></div></div></article>`);
}
const html=`<!DOCTYPE html><html lang="de"><meta charset="utf-8"><title>TikTok-Prüfansicht</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#171c23;color:#f5f7fa;font:15px Arial,sans-serif}h1{font-size:24px;margin:0 0 9px}p{margin:0 0 22px;color:#b9c4d3}.grid{display:grid;grid-template-columns:repeat(3,360px);gap:24px 18px}h2{font-size:16px;font-weight:600;margin:0 0 10px;height:20px}.viewport{width:360px;height:640px;overflow:hidden;border-radius:4px}.scene{position:relative;width:1080px;height:1920px;transform:scale(.3333333333);transform-origin:top left}.frame{width:1080px;height:1920px}.top{position:absolute;left:190px;right:80px;top:190px;display:flex;align-items:center;gap:45px;font-size:43px;color:#ddd;text-shadow:0 1px 5px #555}.top b{color:white;position:relative}.top b:after{content:'';position:absolute;bottom:-22px;width:70px;height:6px;background:white;left:25px}.search{font-size:86px;line-height:.6}.rail{position:absolute;right:42px;top:810px;width:104px;display:flex;align-items:center;gap:56px;flex-direction:column;color:white;filter:drop-shadow(0 1px 4px #555)}.rail>div{text-align:center}.rail small{display:block;font-size:33px;margin-top:6px}.avatar{width:104px;height:104px;border:4px solid white;background:#a6b0bc;border-radius:50%;font-size:66px;padding-top:7px}.disc{font-size:72px;background:#3339;width:104px;height:104px;border-radius:50%}.bottom{position:absolute;left:30px;right:180px;top:1640px;color:white;text-shadow:0 1px 5px #555;font-size:44px}.bottom p{color:white;font-size:35px;margin:30px 0 0}.bottom b{font-weight:600}</style><h1>TikTok-Prüfansicht</h1><p>Vereinfachte Oberfläche nach Deinem Screenshot. Nur zur Kontrolle, nicht Teil der Videos. Die tatsächliche App kann abweichen.</p><section class="grid">${cards.join('')}</section></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(manifest,null,2)+'\n');
const browserPath=execFileSync(process.execPath,[path.join(root,'node_modules/hyperframes/bin/hyperframes.mjs'),'browser','path'],{encoding:'utf8',env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_NO_UPDATE_CHECK:'1'}}).trim();
const browser=await puppeteer.launch({executablePath:browserPath,headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();await page.setViewport({width:1164,height:1500,deviceScaleFactor:1});await page.goto(pathToFileURL(path.join(out,'index.html')).href,{waitUntil:'load'});await page.screenshot({path:path.join(out,'tiktok-pruefansicht.png'),fullPage:true});await page.screenshot({path:path.join(out,'tiktok-einstieg-und-logo.png'),clip:{x:0,y:0,width:1164,height:788}});console.log(out);}finally{await browser.close();}
