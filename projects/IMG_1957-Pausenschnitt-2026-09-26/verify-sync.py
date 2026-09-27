#!/usr/bin/env python3
"""Bildsynchronitaet des Schnitts pruefen.

Fuer Stichproben direkt nach Schnitten (ueber das ganze Video verteilt) wird das
Bild im Export mit den Originalbildern um die erwartete Stelle (-2..+2 Bilder)
verglichen. Das aehnlichste Originalbild muss das erwartete sein (Versatz 0).
Weil der Ton segmentweise exakt aus dem Original stammt, belegt Versatz 0 am
Segmentanfang, dass Bild und Ton dort zusammenpassen. Ein Drift wuerde sich als
zunehmender Versatz zeigen.

Aufruf: python3 verify-sync.py exports/<datei>.mp4
"""
import json
import subprocess
import sys
from bisect import bisect_left
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FFMPEG = str(ROOT / 'tools/bin/ffmpeg')
out_file = sys.argv[1]
meta = json.load(open('workflow.json'))
src, total = meta['source'], meta['originalDuration']
cuts = json.load(open('cuts.json'))['removals']
frames = sorted(float(x) for x in open('logs/video-pts.txt') if x.strip())
W, H = 270, 480

keep, cursor = [], 0.0
for r in sorted(cuts, key=lambda r: r['start']):
    if r['start'] > cursor:
        keep.append((cursor, r['start']))
    cursor = max(cursor, r['end'])
if cursor < total:
    keep.append((cursor, total))
seg_out, t = [], 0.0
for a, b in keep:
    seg_out.append(t)
    t += b - a


def grab(path, at, count):
    r = subprocess.run([FFMPEG, '-v', 'error', '-ss', f'{max(0, at - 0.001):.6f}', '-i', path, '-map', '0:v:0', '-an',
                        '-frames:v', str(count), '-vf', f'scale={W}:{H},format=gray',
                        '-f', 'rawvideo', '-'], capture_output=True, check=True)
    n = W * H
    return [r.stdout[i * n:(i + 1) * n] for i in range(len(r.stdout) // n)]


def diff(x, y):
    return sum(abs(p - q) for p, q in zip(x[::7], y[::7])) / (len(x) / 7)


step = max(1, len(keep) // 30)
samples = list(range(1, len(keep), step))[:30] + [len(keep) - 1]
report = []
for i in samples:
    a, b = keep[i]
    for inner in (0.0, min(1.0, (b - a) / 2)):  # Segmentanfang und Segmentmitte
        out_t = seg_out[i] + inner
        k = round(out_t * 30)
        orig = a + (k / 30 - seg_out[i])
        j = bisect_left(frames, orig - 0.0167)
        got = grab(out_file, k / 30, 1)
        cand = grab(src, frames[max(0, j - 2)], 5)
        if not got or len(cand) < 5:
            report.append({'segment': i, 'error': 'Bild nicht lesbar'})
            continue
        d = [diff(got[0], c) for c in cand]
        best = d.index(min(d)) - (j - max(0, j - 2))
        report.append({'segment': i, 'outTime': round(k / 30, 3), 'origTime': round(orig, 3),
                       'bestOffsetFrames': best, 'diffs': [round(x, 2) for x in d]})
        print(json.dumps(report[-1]), flush=True)

offsets = [r['bestOffsetFrames'] for r in report if 'bestOffsetFrames' in r]
summary = {'samples': len(offsets), 'offset0': offsets.count(0),
           'maxAbsOffset': max(map(abs, offsets)) if offsets else None,
           'errors': sum('error' in r for r in report)}
json.dump({'file': out_file, 'summary': summary, 'samples': report},
          open('logs/sync-check.json', 'w'), indent=1)
print(json.dumps(summary))
