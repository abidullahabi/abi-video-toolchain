#!/usr/bin/env python3
"""Synchronpruefung ohne Originaldatei.

Der Ton wird segmentweise exakt an den Zeiten aus cuts.json geschnitten. Im Bild
erzeugt jeder Schnitt einen Sprung (Abdullah bewegt sich waehrend der Pause).
Liegt der groesste Bildsprung im Umfeld +-4 Bilder genau auf dem Bild, an dem der
Ton geschnitten ist, sind Bild und Ton dort synchron. Ein Drift zeigt sich als
wachsender Versatz ueber die Laufzeit.

Aufruf: python3 verify-jumps.py exports/<datei>.mp4
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
out_file = sys.argv[1]
total = json.load(open('workflow.json'))['originalDuration']
cuts = json.load(open('cuts.json'))['removals']
W, H = 90, 160

keep, cursor = [], 0.0
for r in sorted(cuts, key=lambda r: r['start']):
    if r['start'] > cursor:
        keep.append((cursor, r['start'], r['end'] - r['start']))
    cursor = max(cursor, r['end'])
removed_before = {}
seg_out, t = [], 0.0
for a, b, _ in keep:
    seg_out.append(t)
    t += b - a
removed = [r['end'] - r['start'] for r in sorted(cuts, key=lambda r: r['start'])]

p = subprocess.run([str(ROOT / 'tools/bin/ffmpeg'), '-v', 'error', '-i', out_file, '-map', '0:v:0',
                    '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'],
                   capture_output=True, check=True)
frames = np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, H, W).astype(np.int16)
d = np.concatenate([[0.0], np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))])

rows = []
for i in range(1, len(keep)):
    k = round(seg_out[i] * 30)
    lo, hi = max(1, k - 4), min(len(d) - 1, k + 4)
    win = d[lo:hi + 1]
    peak = int(np.argmax(win)) + lo
    rest = np.delete(win, peak - lo)
    clear = float(win.max()) > 2.5 * float(np.median(rest)) and float(win.max()) > 0.6
    rows.append({'cut': i, 'outTime': round(seg_out[i], 3), 'expectedFrame': k, 'peakFrame': peak,
                 'offset': peak - k, 'peak': round(float(win.max()), 2),
                 'neighbourMedian': round(float(np.median(rest)), 2), 'clearJump': clear})

clear = [r for r in rows if r['clearJump']]
third = len(frames) / 3
parts = {name: [r['offset'] for r in clear if lo <= r['expectedFrame'] < hi]
         for name, lo, hi in [('Anfang', 0, third), ('Mitte', third, 2 * third), ('Ende', 2 * third, 1e9)]}
summary = {'frames': len(frames), 'cuts': len(rows), 'clearJumps': len(clear),
           'offset0': sum(r['offset'] == 0 for r in clear),
           'offsetAbs1': sum(abs(r['offset']) == 1 for r in clear),
           'offsetAbsOver1': [r for r in clear if abs(r['offset']) > 1],
           'byThird': {k: {'n': len(v), 'offset0': v.count(0), 'mean': round(sum(v) / len(v), 3) if v else None}
                       for k, v in parts.items()}}
json.dump({'file': out_file, 'summary': summary, 'cuts': rows}, open('logs/sync-jumps.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
