import { SOCIAL_LAYOUT, layoutFor } from './social-layout.mjs';
import fs from 'node:fs';
import path from 'node:path';
import * as fontkit from 'fontkit';
import { makeThemeComposition } from './theme-composition.mjs';
import { fileURLToPath } from 'node:url';
import { makeMeasure, groupCaptions22, planZooms22, layoutDesign22, makeDesign22Composition } from './theme-composition-design22.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export function readWhisperWords(file, offset = 0) {
  const data = JSON.parse(fs.readFileSync(file));
  const words = [];
  for (const segment of data.transcription) for (const token of segment.tokens) {
    if (token.id >= 50257 || token.text.startsWith('[_')) continue;
    const lexical = /[\p{L}\p{N}]/u.test(token.text);
    const center = offset + token.t_dtw / 100;
    if (/^\s/.test(token.text) || !words.length) words.push({text: token.text.trim(), rawStart: offset + token.offsets.from / 1000, rawEnd: offset + token.offsets.to / 1000, centers: lexical && token.t_dtw >= 0 ? [center] : []});
    else {
      const word = words.at(-1);
      word.text += token.text;
      if (lexical) {
        word.rawEnd = offset + token.offsets.to / 1000;
        if (token.t_dtw >= 0) word.centers.push(center);
      }
    }
  }
  return words.filter(w => w.text).map(w => ({...w, source: path.basename(path.dirname(file))+'/'+path.basename(file)}));
}

const center = w => w.centers.length ? (w.centers[0] + w.centers.at(-1)) / 2 : (w.rawStart + w.rawEnd) / 2;
const rounded = x => Math.round(x * 1000) / 1000;

export function timeWords(raw, duration) {
  // DTW anchors follow the sound. Segment character estimates can drift by over half a second.
  const spans = raw.map(w => ({first:w.centers[0] ?? w.rawStart, last:w.centers.at(-1) ?? w.rawEnd}));
  return raw.map((w, i) => {
    const {first,last} = spans[i];
    const prev = spans[i-1]?.last;
    const next = spans[i+1]?.first;
    const gapBefore = prev === undefined ? 0.24 : Math.max(0, first-prev);
    const gapAfter = next === undefined ? 0.3 : Math.max(0,next-last);
    const start = Math.max(0, first - Math.min(0.18,gapBefore/2));
    const end = Math.min(duration,last + Math.min(0.18,gapAfter/2));
    return {text:w.text,start:rounded(start),end:rounded(Math.max(start+0.02,end)),source:w.source};
  });
}

export function groupCaptions(words, measure, maxWidth=SOCIAL_LAYOUT.captionMaxWidth, maxWords=SOCIAL_LAYOUT.captionMaxWords) {
  if(!Number.isInteger(maxWords)||maxWords<1||maxWords>4)throw Error('Ungültige maximale Wortzahl.');
  const n=words.length, costs=Array(n+1).fill(Infinity), choices=Array(n), overflowSizes=Array(n);
  costs[n]=0;
  const weakEnd=/^(der|die|das|ein|eine|einen|einem|einer|den|dem|für|zum|zur|im|in|auf|vor|von|und|oder)$/i;
  const minOverflowFontSize=34;
  for(let i=n-1;i>=0;i--) for(let size=1;size<=maxWords&&i+size<=n;size++) {
    const slice=words.slice(i,i+size), last=slice.at(-1), text=slice.map(w=>w.text).join(' ');
    const width=measure(text);
    let overflowSize=null;
    if(width>maxWidth) {
      // A single word wider than the safe area cannot be shortened further by grouping.
      // Shrink just this one cue rather than dropping or rewriting the spoken word.
      if(size>1)break;
      const perUnit=measure(text,1);
      overflowSize=Math.floor(maxWidth/perUnit);
      if(overflowSize<minOverflowFontSize)throw Error('Ein Wort ist auch verkleinert für eine einzeilige Darstellung zu breit: '+text);
    }
    if(slice.some((w,j)=>j&&(/[.!?]$/.test(slice[j-1].text)||w.start-slice[j-1].end>0.34)))break;
    const d=last.end-slice[0].start;
    let cost=costs[i+size]+({1:2.8,2:0.9,3:0,4:0.12}[size]);
    if(overflowSize)cost+=5;
    if(weakEnd.test(last.text)&&i+size<n)cost+=1.8;
    if(d<0.45)cost+=2;
    if(d>2.2)cost+=(d-2.2)*2;
    if(/[,.:!?]$/.test(last.text))cost-=0.35;
    if(cost<costs[i]){costs[i]=cost;choices[i]=size;overflowSizes[i]=overflowSize;}
  }
  if(!Number.isFinite(costs[0]))throw Error('Ein Wort ist für eine einzeilige Darstellung zu breit.');
  const cues=[];
  for(let i=0;i<n;) {
    const slice=words.slice(i,i+choices[i]);
    const end=Math.min(words[i+slice.length]?.start??Infinity,slice.at(-1).end+0.07);
    const cue={start:slice[0].start,end:rounded(end),words:slice.map(({text,start,end})=>({text,start,end}))};
    if(overflowSizes[i])cue.fontSize=overflowSizes[i];
    cues.push(cue);
    i+=slice.length;
  }
  return cues;
}

// Geprüfte Wortzeiten aus word-alignment-turbo, word-review-turbo und caption-edit-plan.json (für alle Designversionen gleich).
export function readTimedWords(project, duration) {
  const chunks=JSON.parse(fs.readFileSync(path.join(project,'word-alignment-turbo/chunks.json')));
  let words=chunks.flatMap(([start],i)=>readWhisperWords(path.join(project,`word-alignment-turbo/part-${i}.json`),start));
  const editFile=path.join(project,'caption-edit-plan.json');
  const editPlan=fs.existsSync(editFile)?JSON.parse(fs.readFileSync(editFile)):{replaceFromReview:[],corrections:[]};
  const reviews=editPlan.replaceFromReview.length?JSON.parse(fs.readFileSync(path.join(project,'word-review-turbo/chunks.json'))):[];
  // Short checks resolve the wording in these specific sentences. Keep the full-context reading elsewhere.
  for(const i of editPlan.replaceFromReview) {
    const [start,end]=reviews[i];
    const replacement=readWhisperWords(path.join(project,`word-review-turbo/part-${i}.json`),start);
    words=words.filter(w=>center(w)<start||center(w)>=end).concat(replacement).sort((a,b)=>center(a)-center(b));
  }
  for(const entry of editPlan.reviewReplacements || []) {
    if(!['word-review','word-review-turbo'].includes(entry.folder))throw Error('Unbekannter Prüfquellenordner.');
    const boundaries=JSON.parse(fs.readFileSync(path.join(project,entry.folder,'chunks.json')));
    const [offset,limit]=boundaries[entry.index];
    if(!(entry.from>=offset&&entry.to<=limit&&entry.to>entry.from))throw Error('Ungültiger Ersetzungsbereich.');
    const replacement=readWhisperWords(path.join(project,entry.folder,`part-${entry.index}.json`),offset).filter(w=>center(w)>=entry.from&&center(w)<entry.to);
    if(!replacement.length)throw Error('Leerer Ersetzungsbereich.');
    words=words.filter(w=>center(w)<entry.from||center(w)>=entry.to).concat(replacement).sort((a,b)=>center(a)-center(b));
  }
  const corrections=[];
  for(const correction of editPlan.corrections) {
    const matches=words.filter(w=>center(w)>=correction.from&&center(w)<correction.to&&w.text===correction.before);
    if(matches.length!==1)throw Error('Wortkorrektur nicht eindeutig: '+correction.before);
    const w=matches[0];corrections.push({time:center(w),before:w.text,after:correction.after,basis:correction.basis});w.text=correction.after;
  }
  words=words.filter(w=>w.text);
  let timed=timeWords(words,duration);
  for(let i=1;i<timed.length;i++) {
    if(timed[i].start<timed[i-1].end){const seam=rounded((timed[i].start+timed[i-1].end)/2);timed[i-1].end=seam;timed[i].start=seam;}
    if(timed[i].end<=timed[i].start)throw Error('Wortzeiten prüfen: '+timed[i].text);
  }
  return {timed,corrections};
}

export function assembleFullVideo(project, opts = {}) {
  // Seit 27.09.2026: workflow.json nennt designVersion. 2.2 misst mit Archivo und baut mit theme-composition-design22.mjs;
  // ältere Projekte behalten ihre Vorlage und die Arial-Messung, damit sich ihre Untertitelgruppen nicht verschieben.
  const metaFile=path.join(project,'workflow.json');
  const meta=fs.existsSync(metaFile)?JSON.parse(fs.readFileSync(metaFile)):{};
  if(String(meta.designVersion)==='2.2')return assembleDesign22(project,meta,opts);
  const plan=JSON.parse(fs.readFileSync(path.join(project,'theme-plan.json')));

  const SOCIAL_LAYOUT=layoutFor(plan);
  plan.captionFontSize=plan.captionFontSize||SOCIAL_LAYOUT.captionFontSize;
  plan.captionTop=plan.captionTop||SOCIAL_LAYOUT.captionTop;
  plan.captionMaxWords=Math.min(plan.captionMaxWords||SOCIAL_LAYOUT.captionMaxWords,SOCIAL_LAYOUT.captionMaxWords);
  plan.captionMaxWidth=Math.min(plan.captionMaxWidth||SOCIAL_LAYOUT.captionMaxWidth,SOCIAL_LAYOUT.captionMaxWidth);
  const {timed,corrections}=readTimedWords(project,plan.duration);
  const font=fontkit.openSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
  const measure=(text,size=plan.captionFontSize)=>font.layout(text).positions.reduce((sum,x)=>sum+x.xAdvance,0)/font.unitsPerEm*size;
  plan.captions=groupCaptions(timed,measure,plan.captionMaxWidth,plan.captionMaxWords);
  for(const cue of plan.captions) {
    const placement=(plan.captionPlacementRanges||[]).find(r=>cue.start<r.end&&cue.end>r.start);
    if(placement)cue.top=placement.top;
  }
  for(const section of plan.sections)for(const line of section.lines||[section.text])if(measure((section.number?section.number+'. ':'')+line,section.fontSize||80)+44>SOCIAL_LAYOUT.textWidth)throw Error('H1 zu breit: '+line);
  for(const overlay of plan.overlays)for(const line of overlay.lines||[overlay.text])if(measure(line,overlay.fontSize||52)>(['1.9','1.11','1.12'].includes(plan.designVersion)?(overlay.wide?780:560):SOCIAL_LAYOUT.textWidth-10))throw Error('H2 zu breit: '+line);
  const report={words:timed.length,cues:plan.captions.length,maxWords:Math.max(...plan.captions.map(c=>c.words.length)),maxWidth:Math.max(...plan.captions.map(c=>measure(c.words.map(w=>w.text).join(' '),c.fontSize||plan.captionFontSize))),availableWidth:SOCIAL_LAYOUT.textWidth,font:'Arial Bold',fontSize:plan.captionFontSize,corrections};
  const write=(name,value)=>fs.writeFileSync(path.join(project,name),JSON.stringify(value,null,2)+'\n');
  write('word-timing.json',timed);write('caption-review.json',report);write('theme-plan.json',plan);
  const stamp=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
  fs.writeFileSync(path.join(project,'captions.srt'),plan.captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.words.map(w=>w.text).join(' ')}\n`).join('\n'));
  fs.writeFileSync(path.join(project,'captions-reviewed.txt'),timed.map(w=>w.text).join(' ')+'\n');
  fs.writeFileSync(path.join(project,'index.html'),makeThemeComposition(plan));
  console.log(JSON.stringify(report,null,2));
}

// DESIGN.md 2.2: Eingabe design-plan.json (Elementplanung ohne Maße), Ausgabe theme-plan.json und index.html.
export function assembleDesign22(project,meta,opts={}) {
  const read=f=>JSON.parse(fs.readFileSync(path.join(project,f)));
  const input=read('design-plan.json'),duration=meta.cutDuration;
  const {timed,corrections}=readTimedWords(project,duration);
  const measure=makeMeasure(ROOT),errors=[],warnings=[],notes=[];
  // Kopf und Kappe: Personenmaske (review/kopf-profil.json, DESIGN.md 12) oder, falls sie fehlt, Schätzung aus der Gesichtserkennung.
  const profil=fs.existsSync(path.join(project,'review/kopf-profil.json'));
  const samples=profil?read('review/kopf-profil.json').proben:read('review/source-faces.json');
  const box=q=>profil?{x:q.x-4,y:q.y-4,w:q.width+8,h:q.height+8}:{x:q.x-.12*q.width,y:q.y-.5*q.height,w:1.24*q.width,h:1.5*q.height};
  const heads=(a,b)=>samples.filter(f=>f.time>=a-.25&&f.time<=b+.25).flatMap(f=>(f.faces||[]).map(box));
  const faces=read('review/source-faces.json');
  const faceWidth=t=>{const f=faces.reduce((b,x)=>Math.abs(x.time-t)<Math.abs(b.time-t)?x:b);return Math.max(0,...(f.faces||[]).map(q=>q.width));};
  const followers=read('follower-source.json').wert;
  const plan=layoutDesign22(input,{measure,heads,errors,warnings,notes,duration,followers});
  plan.title=meta.title;plan.kopfQuelle=profil?'Personenmaske (review/kopf-profil.json)':'Schätzung aus review/source-faces.json';
  plan.captions=groupCaptions22(timed,measure,duration);
  const cutFile=path.join(project,'review/cut-points.json'),cuts=fs.existsSync(cutFile)?read('review/cut-points.json').cuts.map(c=>c.time):[];
  plan.zooms=input.zooms??planZooms22({resets:[...cuts,...plan.kapitel.map(k=>k.start),...plan.h1.map(h=>h.start)],blocked:[...plan.schlagworte.map(s=>[s.start-.3,s.end+.3]),...plan.grafiken.map(g=>[g.start,g.end]),[plan.outro.start,duration],...(input.zoomSperren||[])],faceWidth,closeFrom:input.nahaufnahmeAbBreite??420,duration});
  plan.hinweise={warnings,notes};
  if(errors.length)throw Error('DESIGN.md 2.2:\n- '+errors.join('\n- '));
  // HyperFrames lädt nur Dateien im Projekt: Schriften, Profil-Icons und GSAP aus templates/ kopieren.
  fs.mkdirSync(path.join(project,'assets/fonts'),{recursive:true});fs.mkdirSync(path.join(project,'vendor'),{recursive:true});
  for(const f of fs.readdirSync(path.join(ROOT,'templates/fonts')))fs.copyFileSync(path.join(ROOT,'templates/fonts',f),path.join(project,'assets/fonts',f));
  for(const f of fs.readdirSync(path.join(ROOT,'templates/social-icons')).filter(f=>f.startsWith('tile-')))fs.copyFileSync(path.join(ROOT,'templates/social-icons',f),path.join(project,'assets',f));
  fs.copyFileSync(path.join(ROOT,'templates/vendor/gsap.min.js'),path.join(project,'vendor/gsap.min.js'));
  const report={words:timed.length,cues:plan.captions.length,maxWords:Math.max(...plan.captions.map(c=>c.words.length)),maxWidth:Math.max(...plan.captions.map(c=>c.width)),availableWidth:780,font:'Archivo 800',fontSize:64,corrections,zooms:plan.zooms.length,hinweise:plan.hinweise};
  const write=(name,value)=>fs.writeFileSync(path.join(project,name),JSON.stringify(value,null,2)+'\n');
  write('word-timing.json',timed);write('caption-review.json',report);write('theme-plan.json',plan);
  const stamp=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
  fs.writeFileSync(path.join(project,'captions.srt'),plan.captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.words.map(w=>w.text).join(' ')}\n`).join('\n'));
  fs.writeFileSync(path.join(project,'captions-reviewed.txt'),timed.map(w=>w.text).join(' ')+'\n');
  fs.writeFileSync(path.join(project,'index.html'),makeDesign22Composition(plan,{vorschau:!!opts.vorschau}));
  console.log(JSON.stringify(report,null,2));
  return plan;
}

if(process.argv[1]?.endsWith('assemble-full-video.mjs'))assembleFullVideo(path.resolve(process.argv[2]));
