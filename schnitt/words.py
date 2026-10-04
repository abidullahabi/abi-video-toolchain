#!/usr/bin/env python3
"""Woerter mit Rohzeit (DTW) aus der Einzelstueck-Erkennung von schnitt-analyse.
node workflow.mjs schnitt-woerter "<Projekt>" <von> <bis> [turbo|small]
(python3 schnitt/words.py <Projektordner> <von> <bis> [turbo|small])
Spalten: Zeit (DTW, ca. Wortanfang ±60 ms), Wahrscheinlichkeit, Wort. Stueckgrenzen als ---."""
import json, os, sys
os.chdir(os.path.join(os.path.abspath(sys.argv[1]), 'schnitt'))
a, b = float(sys.argv[2]), float(sys.argv[3]); model = sys.argv[4] if len(sys.argv) > 4 else 'turbo'
summ = json.load(open(f'analysis/asr-{model}/summary.json'))
for c in summ:
    if c['end'] < a or c['start'] > b: continue
    j = json.load(open(f"analysis/asr-{model}/c{c['i']:03d}.json")); words = []
    for seg in j['transcription']:
        for t in seg['tokens']:
            tx = t['text']
            if tx.startswith('[_') or t['id'] >= 50257: continue
            tt = c['offset'] + t['t_dtw'] / 100 if t['t_dtw'] >= 0 else None
            if tx.startswith(' ') or not words: words.append([tt, t['p'], tx.strip()])
            else: words[-1][2] += tx; words[-1][1] = min(words[-1][1], t['p'])
    print(f"--- Stueck {c['i']} {c['start']:.2f}-{c['end']:.2f}")
    for tt, p, w in words:
        if tt is None or a - 0.5 <= tt <= b + 0.5: print(f"{tt:8.2f} {p:4.2f} {w}" if tt is not None else f"     ?   {p:4.2f} {w}")
