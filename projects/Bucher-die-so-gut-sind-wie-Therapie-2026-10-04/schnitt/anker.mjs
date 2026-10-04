// Prüft nach dem Umrechnen: Welche Wörter stehen an den Einsatzzeiten der Gestaltung? Kapitel überlappen? Cover-Dauer, Outro-Standzeit.
import fs from 'node:fs'; import path from 'node:path';
import { readTimedWords } from '/Users/abi/Projekte/abi-video-toolchain/assemble-full-video.mjs';
const P = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = readTimedWords(P), w = Array.isArray(r) ? r : r.timed;
const d = JSON.parse(fs.readFileSync(path.join(P, 'design-plan.json')));
const dauer = JSON.parse(fs.readFileSync(path.join(P, 'workflow.json'))).cutDuration;
const um = t => { const i = w.findIndex(x => x.start >= t - 0.06); return w.slice(Math.max(0, i), i + 4).map(x => `${x.text}@${x.start.toFixed(2)}`).join(' '); };
console.log('Dauer', dauer, 'Einstieg bis', d.einstieg.end, '→', um(d.einstieg.end));
for (const b of d.lebensbalken) { console.log('Balken', b.start, b.end); for (const s of b.abschnitte) console.log('  ', s.beschriftung, s.at, '→', um(s.at)); }
d.kapitel.forEach((k, i) => { const n = d.kapitel[i + 1];
  console.log(k.id, k.start, '→', um(k.start), '| Ende', k.end, n && n.start - k.end < 0.2 ? 'ÜBERLAPPT/ZU NAH' : '', '| Länge', (k.end - k.start).toFixed(1));
  if (k.buch) console.log('   groß bis', k.buch.grossBis, `(${(k.buch.grossBis - k.start).toFixed(2)} s)`, '→', um(k.buch.grossBis), k.buch.autorAb ? '| Autor ab ' + k.buch.autorAb + ' → ' + um(k.buch.autorAb) : ''); });
for (const p of d.pillen) { console.log('Pillen bis', p.end); for (const it of p.items) console.log('  ', it.text, it.at, '→', um(it.at)); }
console.log('Outro', d.outroStart, '→', um(d.outroStart), 'Standzeit', (dauer - d.outroStart - 1.85).toFixed(2));
