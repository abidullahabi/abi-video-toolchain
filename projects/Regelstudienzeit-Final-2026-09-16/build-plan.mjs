import fs from 'node:fs';
import {buildSocialOutro} from '../../social-outro.mjs';
const p=new URL('./',import.meta.url);
const meta=JSON.parse(fs.readFileSync(new URL('workflow.json',p)));
const d=meta.cutDuration;
const outro=buildSocialOutro(34,d);
const title=(id,text,start,end,fontSize=62)=>({id,text,start,end,fontSize,top:320});
const support=(id,text,start,end,fontSize=42)=>({id,text,start,end,fontSize,top:440,kind:'support'});
const plan={title:'Länger studieren oder schneller abschließen?',duration:d,h1Background:'#349feb',captionAccent:'#349feb',captionFontSize:56,captionTop:1280,captionMaxWords:3,captionMaxWidth:684,
 sections:[
 title('hook','Regelstudienzeit',0,2.0415782828),
 title('bachelor','9 Semester',2.0415782828,4.9581186869,70),
 title('master','3 Semester',4.9581186869,7.7079996392,70),
 title('bewerbungen','Bewerbungen',7.7079996392,10.5412103175),
 title('ergebnis','Bei mir kein Unterschied',10.5412103175,17.7908964646,52),
 title('skills','Was kannst du?',17.7908964646,24.0822907648),
 title('sorgen','Kein Grund für Panik',24.0822907648,27.2071554834,58),
 title('zeit','Studienzeit nutzen',27.2071554834,34,60),
 ...outro.sections],
 overlays:[
 support('hook-frage','Wie wichtig ist sie wirklich?',0,2.0415782828),
 support('bachelor-zeit','Bachelor statt 7 Semester',2.0415782828,4.9581186869),
 support('master-zeit','Master statt 4 Semester',4.9581186869,7.7079996392),
 support('bewerbungen-frage','Länger oder kürzer studiert?',7.7079996392,10.5412103175),
 support('persoenlich','Meine Bewerbungserfahrung',10.5412103175,17.7908964646,40),
 support('faehigkeiten','Erfahrung und Fähigkeiten',17.7908964646,24.0822907648,42),
 support('sorgen-text','Wenn das Studium länger dauert',24.0822907648,27.2071554834,40),
 support('zeit-text','Praxis sammeln. Gute Noten.',27.2071554834,34,42),
 ...outro.overlays],captions:[],
 zooms:[{start:2.0415782828,end:4.9581186869,scale:1.025,origin:'48% 37%'},{start:10.5412103175,end:13.0411020924,scale:1.03,origin:'48% 37%'},{start:17.7908964646,end:21.7073935786,scale:1.025,origin:'48% 37%'},{start:27.2071554834,end:32.9985714286,scale:1.035,origin:'48% 37%'}],socialCtas:outro.socialCtas,outroGroup:outro.outroGroup};
fs.writeFileSync(new URL('theme-plan.json',p),JSON.stringify(plan,null,2)+'\n');
const chunks=[[0,7.7079996392],[7.7079996392,17.7908964646],[17.7908964646,24.0822907648],[24.0822907648,32.9985714286],[32.9985714286,d]];
fs.writeFileSync(new URL('transcription-chunks.json',p),JSON.stringify(chunks,null,2)+'\n');
