// Tests für die Schnitt-Befehle (Schnitt-Standard 04.10.2026): plan-edl.py und straffen2.py auf einer künstlichen
// Aufnahme, Sicherung der bisherigen schnitt.json als schnitt/vorher.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { py, vorherSichern, vorherOhnePlaene, schreibeVorher, tempoVonMedia } from '../schnitt.mjs';
import { planentwurf } from '../planentwurf.mjs';

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

test('schnitt-plan: kantenFest nach außen aufs Raster (Anfang abrunden, Ende aufrunden), nie nach innen', () => {
  const P = testprojekt();
  const sel = JSON.parse(fs.readFileSync(path.join(P, 'schnitt/selection.json'), 'utf8'));
  // Messwerte zwischen zwei Bildern: gerundet lägen sie innen (1,6667 bzw. 3,9333) und würden übergangen
  sel.kantenFest = { ende: [1.68], anfang: [3.92] };
  fs.writeFileSync(path.join(P, 'schnitt/selection.json'), JSON.stringify(sel));
  py('plan-edl.py', [P]); py('straffen2.py', [P]);
  const [[, b1], [a2]] = JSON.parse(fs.readFileSync(path.join(P, 'schnitt.json'), 'utf8')).behalten;
  assert.ok(b1 >= 1.68 && Math.abs(b1 * 30 - Math.round(b1 * 30)) < 1e-4, `Ende ${b1}`);
  assert.ok(a2 <= 3.92 && Math.abs(a2 * 30 - Math.round(a2 * 30)) < 1e-4, `Anfang ${a2}`);
  fs.rmSync(P, { recursive: true, force: true });
});

test('schnitt-pegel: Bereich außerhalb der Aufnahme wird mit Meldung abgewiesen statt mit Python-Fehler', () => {
  const P = testprojekt();
  assert.match(py('env.py', [P, '0.9:1.1']), /0\.90 \|.{20}\| 1\.10/);
  assert.throws(() => py('env.py', [P, '5.9:7']), /liegt nicht in der Aufnahme \(0 bis 6\.00 s/);
  assert.throws(() => py('env.py', [P, '2:1']), /liegt nicht in der Aufnahme/);
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
  // ohne Pläne, Reihenfolge wie schnitt-plan (vorher sichern, plan-edl/straffen2 schreiben schnitt.json, danach vorherOhnePlaene):
  // vorher.json ist nach jedem Lauf die NEUE Fassung mit dem Tempo aus workflow.json (Prüfung 05.10.2026: nicht der vorletzte Lauf)
  const lauf = b => { const m = vorherSichern(P, meta); schnitt(b); vorherOhnePlaene(P, meta); return m; };
  lauf([[1, 2], [3, 4]]);
  assert.deepEqual(lies().behalten, [[1, 2], [3, 4]]); assert.equal(lies().tempo, 1.2);
  assert.match(lauf([[1, 2], [3, 5]]), /noch keine Pläne/);
  assert.deepEqual(lies().behalten, [[1, 2], [3, 5]]);
  // Pläne entstehen auf [[1,2],[3,5]] (vorbereiten lief mit Tempo 1,1: planentwurf schreibt den tatsächlichen Stand).
  fs.writeFileSync(path.join(P, 'design-plan.json'), JSON.stringify({ _umgerechnet: [] }));
  schreibeVorher(P, [[1, 2], [3, 5]], tempoVonMedia(meta));
  assert.equal(lies().tempo, 1.1);
  // Neuer Schnitt, noch nicht umgerechnet → vorher.json bleibt beim Planstand, vorherOhnePlaene tut nichts.
  assert.equal(vorherOhnePlaene(P, meta), null);
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

test('erster Schnitt nach Plänen auf der ungeschnittenen Aufnahme: vorher.json = ganze Aufnahme mit Tempo von media.mp4', () => {
  const P = fs.mkdtempSync(path.join(os.tmpdir(), 'schnitt-erst-'));
  fs.mkdirSync(path.join(P, 'schnitt'));
  fs.writeFileSync(path.join(P, 'design-plan.json'), JSON.stringify({ _umgerechnet: [] }));
  const meta = { sourceDuration: 6, media: { datei: 'media.mp4', tempo: 1.1 } };
  assert.match(vorherSichern(P, meta), /ungeschnittener Stand/);
  const v = JSON.parse(fs.readFileSync(path.join(P, 'schnitt/vorher.json'), 'utf8'));
  assert.deepEqual(v.behalten, [[0, 6]]); assert.equal(v.tempo, 1.1); assert.equal(v.sha256, null);
  // ein zweiter Lauf vor dem Umrechnen überschreibt diesen Stand nicht
  fs.writeFileSync(path.join(P, 'schnitt.json'), JSON.stringify({ behalten: [[1, 2]] }));
  assert.match(vorherSichern(P, meta), /bleibt/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(P, 'schnitt/vorher.json'), 'utf8')).behalten, [[0, 6]]);
  fs.rmSync(P, { recursive: true, force: true });
});

test('planentwurf bricht ab, wenn die Wörter nicht zur jetzigen schnitt.json passen (vorbereiten fehlt)', () => {
  const P = fs.mkdtempSync(path.join(os.tmpdir(), 'schnitt-plan-'));
  fs.mkdirSync(path.join(P, 'schnitt'));
  fs.writeFileSync(path.join(P, 'workflow.json'), JSON.stringify({ title: 'Test', cutDuration: 10 }));
  fs.writeFileSync(path.join(P, 'schnitt.json'), JSON.stringify({ behalten: [[0, 10]] }));
  assert.throws(() => planentwurf(P), /erst node workflow\.mjs vorbereiten/);
  assert.ok(!fs.existsSync(path.join(P, 'design-plan.json')) && !fs.existsSync(path.join(P, 'schnitt/vorher.json')));
  fs.rmSync(P, { recursive: true, force: true });
});
