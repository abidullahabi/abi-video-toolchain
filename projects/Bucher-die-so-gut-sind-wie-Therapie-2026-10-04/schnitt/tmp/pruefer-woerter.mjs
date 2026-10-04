import { readTimedWords } from '/Users/abi/Projekte/abi-video-toolchain-buchcover/assemble-full-video.mjs';
const P='/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04';
const r = readTimedWords(P); const w = Array.isArray(r)?r:r.timed;
const [a=0,b=1e9]=process.argv.slice(2).map(Number);
let line=[];
for (const x of w) if (x.start>=a && x.start<=b) console.log(`${x.start.toFixed(2)}-${x.end.toFixed(2)} ${x.text}`);
