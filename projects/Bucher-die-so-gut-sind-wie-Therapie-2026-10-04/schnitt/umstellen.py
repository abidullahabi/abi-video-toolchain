#!/usr/bin/env python3
"""Nach einer Schnittänderung (auch mit herausgenommenem Inhalt): Plan- und Untertitelzeiten von <alt> auf <neu> umrechnen.
Untertitel-Korrekturen und Kurzprüfungs-Ersetzungen, deren Wörter herausgeschnitten sind, fallen weg (Liste in der Ausgabe).
python3 umstellen.py <schnitt-alt.json> <schnitt-neu.json> [--tempo-neu 1.1] [--schreiben]  (alte Fassung: Tempo 1)"""
import json, sys, os
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D)
R = lambda v: round(v * 30) / 30
alt = [[R(a), R(b)] for a, b in json.load(open(sys.argv[1]))['behalten']]
neu = [[R(a), R(b)] for a, b in json.load(open(sys.argv[2]))['behalten']]
def roh(t):
    c = 0
    for a, b in alt:
        if t <= c + (b - a) + 1e-9: return a + (t - c)
        c += b - a
    return alt[-1][1]
def drin(r): return any(a - 1e-6 <= r <= b + 1e-6 for a, b in neu)
def schnitt(r):
    c = 0
    for a, b in neu:
        if r < a: return c
        if r <= b: return c + (r - a)
        c += b - a
    return c
TN = float(sys.argv[sys.argv.index('--tempo-neu') + 1]) if '--tempo-neu' in sys.argv else 1.0
um = lambda t: round(schnitt(roh(t)) / TN, 2)
KEYS = {'start', 'end', 'at', 'grossBis', 'autorAb', 'outroStart', 'from', 'to', 'streichenAb'}
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in KEYS and isinstance(v, (int, float)): o[k] = um(v)
            else: walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
schreiben = '--schreiben' in sys.argv
# Untertitel: Korrekturen nur behalten, wenn ihr Bereich (Mitte) noch im Schnitt liegt
c = json.load(open('../caption-edit-plan.json')); weg = []
keep_c = []
for k in c['corrections']:
    if drin(roh((k['from'] + k['to']) / 2)): keep_c.append(k)
    else: weg.append(('Korrektur', k['before'], k['after'], k['from']))
c['corrections'] = keep_c
ch = json.load(open('../word-review-turbo/chunks.json'))
keep_r = []
for r in c['reviewReplacements']:
    a, b = roh(r['from']), roh(r['to'])
    if any(drin(a + (b - a) * i / 10) for i in range(11)): keep_r.append(r)
    else: weg.append(('Ersetzung', r['index'], r['from'], r['basis'][:60]))
c['reviewReplacements'] = keep_r
walk(c['corrections']); walk(c['reviewReplacements'])
d = json.load(open('../design-plan.json')); walk(d)
d.setdefault('_umgerechnet', []).append(f'Zeiten von {sys.argv[1]} auf {sys.argv[2]} umgerechnet (schnitt/umstellen.py, Tempo neu {TN}); Elemente an herausgeschnittenen Stellen rücken an den Anfang des nächsten Stücks – Planer prüft danach.')
for w in weg: print('entfällt:', w)
if schreiben:
    json.dump(c, open('../caption-edit-plan.json', 'w'), indent=1, ensure_ascii=False)
    json.dump(d, open('../design-plan.json', 'w'), indent=1, ensure_ascii=False)
print('Plan und Untertitel umgerechnet' + ('' if schreiben else ' (Probe, nichts geschrieben)'))
