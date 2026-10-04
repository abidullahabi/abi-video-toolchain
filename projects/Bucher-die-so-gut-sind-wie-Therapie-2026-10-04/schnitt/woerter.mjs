// Wörter in Schnittzeit (wie die Vorlage sie liest), mit Satzende-Markierung.  node schnitt/woerter.mjs [von] [bis]
import path from 'node:path';
import { readTimedWords } from '/Users/abi/Projekte/abi-video-toolchain/assemble-full-video.mjs';
const P = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [a = 0, b = 1e9] = process.argv.slice(2).map(Number);
const r = readTimedWords(P), w = Array.isArray(r) ? r : r.timed;
for (const x of w) if (x.start >= a && x.start <= b) console.log(`${x.start.toFixed(2)}–${x.end.toFixed(2)}  ${x.text}`);
