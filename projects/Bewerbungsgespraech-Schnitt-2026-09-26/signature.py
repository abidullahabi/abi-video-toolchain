#!/usr/bin/env python3
"""Pausensignatur nach Abschnitt 5 aus speech-boundaries.json von analyze-speech."""
import json, sys, collections
d = json.load(open(sys.argv[1]))
ms = sorted(round(c['duration'] * 1000) for c in d['candidates'])
n = len(ms)
band = sum(64 <= x <= 96 for x in ms)
res = {'duration': round(d['duration'], 3), 'gaps': n, 'gapsPerMin': round(n / d['duration'] * 60, 1),
       'medianMs': ms[n // 2] if n % 2 else (ms[n // 2 - 1] + ms[n // 2]) / 2,
       'inBand64to96': f'{band / n:.0%}', 'over160': sum(x > 160 for x in ms),
       'histogram': sorted(collections.Counter(ms).items())}
print(json.dumps(res))
