// Wortliste mit Zeiten (gleiche Logik wie assemble-full-video.mjs), nur zum Planen.
import fs from 'node:fs';
import path from 'node:path';
import { readWhisperWords, timeWords } from '../../assemble-full-video.mjs';
const project = path.resolve(process.argv[2]);
const chunks = JSON.parse(fs.readFileSync(path.join(project, 'word-alignment-turbo/chunks.json')));
const words = chunks.flatMap(([start], i) => readWhisperWords(path.join(project, `word-alignment-turbo/part-${i}.json`), start));
const timed = timeWords(words, JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'))).cutDuration);
fs.writeFileSync(path.join(project, 'words-raw.json'), JSON.stringify(timed, null, 1));
const lines = []; let line = [];
for (const w of timed) { line.push(`${w.text}@${w.start.toFixed(2)}`); if (/[.!?]$/.test(w.text)) { lines.push(line.join(' ')); line = []; } }
if (line.length) lines.push(line.join(' '));
fs.writeFileSync(path.join(project, 'words-raw.txt'), lines.join('\n') + '\n');
console.log(timed.length, 'Wörter');
