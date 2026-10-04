#!/usr/bin/env python3
"""Zeiten in design-plan.json und caption-edit-plan.json von einer Schnittfassung in die nächste umrechnen
(Schnittzeit alt → Rohzeit → Schnittzeit neu), z. B. nach dem Straffen einzelner Nähte.
python3 zeiten-umrechnen.py <schnitt-alt.json> <schnitt-neu.json> [--schreiben]"""
import json, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
R = lambda v: round(v * 30) / 30   # wie vorbereiten.mjs
alt = [[R(a), R(b)] for a, b in json.load(open(sys.argv[1]))['behalten']]
neu = [[R(a), R(b)] for a, b in json.load(open(sys.argv[2]))['behalten']]
def roh(t):
    c = 0
    for a, b in alt:
        if t <= c + (b - a) + 1e-9: return a + (t - c)
        c += b - a
    return alt[-1][1]
def schnitt(r):
    c = 0
    for a, b in neu:
        if r < a: return c            # in herausgeschnittener Stille: an den Anfang des nächsten Stücks
        if r <= b: return c + (r - a)
        c += b - a
    return c
KEYS = {'start', 'end', 'at', 'grossBis', 'autorAb', 'outroStart', 'from', 'to', 'streichenAb'}
n = [0]
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in KEYS and isinstance(v, (int, float)): o[k] = round(schnitt(roh(v)), 2); n[0] += 1
            else: walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
for f in ['../design-plan.json', '../caption-edit-plan.json']:
    if not os.path.exists(f): continue
    d = json.load(open(f)); n[0] = 0; walk(d)
    print(f, n[0], 'Zeiten umgerechnet')
    if '--schreiben' in sys.argv:
        d.setdefault('_umgerechnet', []) if isinstance(d, dict) and f.endswith('design-plan.json') else None
        if f.endswith('design-plan.json'): d['_umgerechnet'].append(f'Zeiten von {sys.argv[1]} auf {sys.argv[2]} umgerechnet (schnitt/zeiten-umrechnen.py)')
        json.dump(d, open(f, 'w'), indent=1, ensure_ascii=False)
