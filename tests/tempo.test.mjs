// Tests für den Tempo-Auftrag (28.09.2026): Abschnitte, Schnittzeit, Kopfprofil-Bereiche, Plan-Ausschnitt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abschnitte, planFuer } from '../abschnitte.mjs';
import { schnittZeit, kopfBereiche } from '../vorbereiten.mjs';

test('Abschnitte: 300 Bilder, Rest unter 3 s zum vorigen, lückenlos bis zum letzten Bild', () => {
  assert.deepEqual(abschnitte(55.233333), [[0, 300], [300, 600], [600, 900], [900, 1200], [1200, 1500], [1500, 1657]]);
  assert.deepEqual(abschnitte(61), [[0, 300], [300, 600], [600, 900], [900, 1200], [1200, 1500], [1500, 1830]]);   // 30 Bilder Rest angehängt
  assert.deepEqual(abschnitte(5), [[0, 150]]);
});

test('Schnittzeit: erhaltene Stellen verschoben, herausgeschnittene fallen weg', () => {
  const keep = [[0, 2], [5, 8], [10, 11]];
  assert.equal(schnittZeit(keep, 1), 1);
  assert.equal(schnittZeit(keep, 3), null);
  assert.equal(schnittZeit(keep, 6), 3);
  assert.equal(schnittZeit(keep, 10.5), 5.5);
  assert.equal(schnittZeit(keep, 12), null);
});

test('Kopfprofil-Bereiche: nur Elemente über dem Kopf, nahe Bereiche zusammengefasst', () => {
  const plan = { kapitel: [{ id: 'k1', start: 1, end: 30 }], pillen: [{ kapitel: 'k1', items: [{ at: 5 }] }], h2: [{ start: 12, end: 14 }, { start: 14.3, end: 16 }], sprechblasen: [{ start: 40 }] };
  assert.deepEqual(kopfBereiche(plan), [[5, 30], [40, 44.25]]);
});

test('Plan-Ausschnitt: nur Elemente, die den Abschnitt berühren (mit Rand)', () => {
  const plan = { duration: 60, einstieg: { end: 4, h1: {} }, kapitel: [{ start: 5, end: 9 }, { start: 21, end: 29 }], h1: [], h2: [{ start: 9.8, end: 12 }], pillen: [], captions: [{ start: 19.9, end: 20.5 }, { start: 30.5, end: 31 }], zooms: [], outro: { start: 55 } };
  const q = planFuer(plan, 10, 20);
  assert.equal(q.kapitel.length, 0);
  assert.equal(q.h2.length, 1);
  assert.equal(q.captions.length, 1);
  assert.equal(q.einstieg, plan.einstieg);
});
