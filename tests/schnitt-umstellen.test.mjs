// Tests für schnitt-umstellen (zur Freigabe): Zeitumrechnung mit altem und neuem Tempo (schnitt/zeiten.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const SK = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schnitt');
const rechne = (alt, ta, neu, tn, zeiten) => {
  const r = spawnSync('python3', ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(SK)}); from zeiten import Umrechnung
Z = Umrechnung(${JSON.stringify(alt)}, ${ta}, ${JSON.stringify(neu)}, ${tn}); print(json.dumps([Z.um(t) for t in ${JSON.stringify(zeiten)}]))`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
};
test('Umrechnung: gleicher Schnitt, nur Tempo 1 → 1,1', () => {
  assert.deepEqual(rechne([[10, 20], [30, 40]], 1, [[10, 20], [30, 40]], 1.1, [0, 11, 15]), [0, 10, 13.64]);
});
test('Umrechnung: altes Tempo 1,1 wird berücksichtigt (Planzeit · Tempo = Schnittzeit)', () => {
  // Planzeit 10 bei Tempo 1,1 = Schnittzeit 11 = Rohzeit 31; neuer Schnitt ohne [10,20] und Tempo 1 → 1
  assert.deepEqual(rechne([[10, 20], [30, 40]], 1.1, [[30, 40]], 1, [10]), [1]);
});
test('Umrechnung: herausgeschnittene Stelle rückt an den Anfang des nächsten Stücks', () => {
  assert.deepEqual(rechne([[0, 10]], 1, [[0, 2], [5, 10]], 1, [3, 6]), [2, 3]);
});
