import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSrt, makeComposition } from '../composition.mjs';

test('SRT supports BOM, CRLF, multiline text and exact millisecond timing', () => {
  const cues = parseSrt('\uFEFF1\r\n00:00:01,250 --> 00:00:03,000\r\nHallo\r\nWelt\r\n\r\n2\r\n00:00:03,010 --> 00:00:04,500\r\nWeiter!');
  assert.deepEqual(cues, [{start:1.25,end:3,text:'Hallo Welt'},{start:3.01,end:4.5,text:'Weiter!'}]);
});

test('SRT rejects overlapping cues instead of rendering colliding captions', () => {
  assert.throws(() => parseSrt('1\n00:00:00,000 --> 00:00:02,000\nA\n\n2\n00:00:01,500 --> 00:00:03,000\nB'), /Überlappende/);
});

test('Text from a transcript or title remains text and cannot inject HTML or scripts', () => {
  const bad = '</script><script>alert(1)</script>';
  const html = makeComposition({duration:5,cues:[{start:0,end:4,text:bad}],design:{title:bad,accent:'#CAFF70',callouts:[]}});
  assert.ok(!html.includes(bad));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('data-width="1080"'));
  assert.ok(html.includes('data-height="1920"'));
});

test('Callouts cannot cover the title or extend past the video', () => {
  const base = {duration:5,cues:[],design:{title:'Titel',accent:'#CAFF70',callouts:[{start:1,end:3,text:'Fakt'}]}};
  assert.throws(() => makeComposition(base), /überschneiden/);
});
