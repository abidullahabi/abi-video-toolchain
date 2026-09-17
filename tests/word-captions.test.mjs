import test from 'node:test';
import assert from 'node:assert/strict';
import * as fontkit from 'fontkit';
import {groupCaptions, timeWords} from '../assemble-full-video.mjs';
import {makeThemeComposition} from '../theme-composition.mjs';

test('long German words fit at a constant font size without losing spoken words',()=>{
  const font=fontkit.openSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
  const measure=text=>font.layout(text).positions.reduce((n,p)=>n+p.xAdvance,0)/font.unitsPerEm*62;
  const text='Die KI-Anwendungen haben gar keine Schutzmechanismen. Für bestimmte Regularien oder Richtlinien.';
  const words=text.split(' ').map((text,i)=>({text,start:i*0.3,end:i*0.3+0.25}));
  const cues=groupCaptions(words,measure);
  assert.deepEqual(cues.flatMap(c=>c.words.map(w=>w.text)),words.map(w=>w.text));
  for(const c of cues){assert.ok(c.words.length<=4);assert.ok(measure(c.words.map(w=>w.text).join(' '))<=756);}
});

test('word highlighting follows acoustic anchors rather than drifting segment estimates',()=>{
  const words=timeWords([{text:'Folgen',rawStart:117.3,rawEnd:117.5,centers:[118.02,118.06]},{text:'nicht',rawStart:117.5,rawEnd:117.7,centers:[118.15]}],118.833333);
  assert.ok(words[0].start>117.8);
  assert.equal(words[0].end,words[1].start);
  assert.ok(words[1].end<=118.833333);
});

test('composition refuses five words, line breaks and overlapping highlight times',()=>{
  const base={duration:2,sections:[],overlays:[]};
  const word={text:'Hallo',start:0,end:0.2};
  assert.throws(()=>makeThemeComposition({...base,captions:[{start:0,end:2,words:Array(5).fill(word)}]}));
  assert.throws(()=>makeThemeComposition({...base,captions:[{start:0,end:1,words:[{...word,text:'zwei\nZeilen'}]}]}));
  assert.throws(()=>makeThemeComposition({...base,captions:[{start:0,end:1,words:[word,{text:'Welt',start:0.1,end:0.4}]}]}));
});
