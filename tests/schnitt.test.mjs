// Tests für die Schnitt-Befehle (Schnitt-Standard 04.10.2026): plan-edl.py und straffen2.py auf einer künstlichen
// Aufnahme, Sicherung der bisherigen schnitt.json als schnitt/vorher.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { py, vorherSichern, tempoVonMedia } from '../schnitt.mjs';

// Künstliche Aufnahme: 6 s Rauschboden −60 dB, drei „Wörter“ (Ton −20 dB) bei 1,0–1,6 / 2,4–3,0 / 4,0–4,6 s.
function testprojekt() {
  const P = fs.mkdtempSync(path.join(os.tmpdir(), 'schnitt-test-'));
  fs.mkdirSync(path.join(P, 'schnitt/analysis'), { recursive: true });
  const r = spawnSync('python3', ['-c', `
import numpy as np, wave, sys
sr = 16000; t = np.arange(int(6 * sr)) / sr
x = np.random.default_rng(1).normal(0, 10 ** (-60 / 20), t.size)
for a, b in ((1.0, 1.6), (2.4, 3.0), (4.0, 4.6)):
    m = (t >= a) & (t < b); x[m] += 10 ** (-20 / 20) * np.sqrt(2) * np.sin(2 * np.pi * 220 * t[m])
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()`, path.join(P, 'schnitt/speech.wav')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  fs.writeFileSync(path.join(P, 'schnitt/analysis/video-pts.txt'), Array.from({ length: 181 }, (_, i) => (i / 30).toFixed(6)).join('\n') + '\n');
  fs.writeFileSync(path.join(P, 'schnitt/analysis/speech-boundaries.json'), JSON.stringify({ candidates: [{ start: 1.65, end: 2.35 }, { start: 3.05, end: 3.95 }] }));
  fs.writeFileSync(path.join(P, 'workflow.json'), JSON.stringify({ source: '/x/IMG_0001.MOV', sourceDuration: 6 }));
  // Anlauf 2 (2,4–3,0 s) wird verworfen.
  fs.writeFileSync(path.join(P, 'schnitt/selection.json'), JSON.stringify({ basis: 'Test', ranges: [{ id: 'a', a: 0.95, b: 1.65 }, { id: 'c', a: 3.95, b: 4.65 }] }));
  return P;
}

test('schnitt-plan: Wörter bleiben, verworfener Anlauf fällt weg, Grenzen auf 1/30 s, Bericht und EDL', () => {
  const P = testprojekt();
  py('plan-edl.py', [P]);
  const nach = py('straffen2.py', [P]);
  const s = JSON.parse(fs.readFileSync(path.join(P, 'schnitt.json'), 'utf8'));
  assert.match(s._quelle, /IMG_0001\.MOV/);
  assert.equal(s.behalten.length, 2);
  for (const [a, b] of s.behalten) { assert.ok(Math.abs(a * 30 - Math.round(a * 30)) < 1e-4 && Math.abs(b * 30 - Math.round(b * 30)) < 1e-4); assert.ok(b > a); }
  const [[a1, b1], [a2, b2]] = s.behalten;
  assert.ok(a1 <= 1.0 && b1 >= 1.6 && b1 < 2.4, `erstes Stück ${a1}–${b1}`);
  assert.ok(a2 > 3.0 && a2 <= 4.0 && b2 >= 4.6, `zweites Stück ${a2}–${b2}`);
  // Naht gestrafft: höchstens ~60 ms Nachlauf + ~40 ms Vorlauf plus Raster
  assert.ok(b1 - 1.6 <= 0.06 + 1 / 30 + 0.006 && 4.0 - a2 <= 0.04 + 1 / 30 + 0.006, `Naht ${b1} | ${a2}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(P, 'schnitt/straffen2-bericht.json'), 'utf8')).length, 1);
  assert.ok(fs.existsSync(path.join(P, 'schnitt/edl.json')));
  assert.match(nach, /Nähte mit Restpause > 300 ms: 0/);
  fs.rmSync(P, { recursive: true, force: true });
});

test('vorher.json: Tempo von media.mp4; bleibt stehen, solange die Pläne noch auf den älteren Stand warten', () => {
  const P = fs.mkdtempSync(path.join(os.tmpdir(), 'schnitt-vorher-'));
  fs.mkdirSync(path.join(P, 'schnitt'));
  const meta = { tempo: 1.2, media: { datei: 'media.mp4', tempo: 1.1 } };
  const lies = () => JSON.parse(fs.readFileSync(path.join(P, 'schnitt/vorher.json'), 'utf8'));
  const schnitt = b => fs.writeFileSync(path.join(P, 'schnitt.json'), JSON.stringify({ behalten: b }));
  assert.equal(tempoVonMedia(meta), 1.1);
  assert.equal(tempoVonMedia({ tempo: 1.1 }), 1.1);
  assert.equal(tempoVonMedia({ media: { datei: 'media.mp4' }, tempo: 1.1 }), 1);
  assert.match(vorherSichern(P, meta), /erster Schnitt/);
  // ohne Pläne: immer der bisherige Stand
  schnitt([[1, 2], [3, 4]]); vorherSichern(P, meta);
  assert.deepEqual(lies().behalten, [[1, 2], [3, 4]]); assert.equal(lies().tempo, 1.1);
  schnitt([[1, 2], [3, 5]]); vorherSichern(P, meta);
  assert.deepEqual(lies().behalten, [[1, 2], [3, 5]]);
  // Pläne gibt es: Sie passen zu [[1,2],[3,5]]. Neuer Schnitt, noch nicht umgerechnet → vorher.json bleibt beim Planstand.
  fs.writeFileSync(path.join(P, 'design-plan.json'), JSON.stringify({ _umgerechnet: [] }));
  schnitt([[1, 2], [3, 5]]); vorherSichern(P, meta);   // gleicher Stand: auffrischen
  schnitt([[1, 2]]);
  assert.match(vorherSichern(P, meta), /bleibt/);
  assert.deepEqual(lies().behalten, [[1, 2], [3, 5]]);
  // Pläne wurden umgerechnet (neuer Vermerk) → der jetzige Stand ist der Planstand
  fs.writeFileSync(path.join(P, 'design-plan.json'), JSON.stringify({ _umgerechnet: ['umgerechnet'] }));
  vorherSichern(P, meta);
  assert.deepEqual(lies().behalten, [[1, 2]]); assert.equal(lies().umgerechnet, 1);
  fs.rmSync(P, { recursive: true, force: true });
});
