#!/usr/bin/env python3
"""Nach einer Schnitt- oder Tempoänderung: Zeiten in design-plan.json und caption-edit-plan.json von schnitt/vorher.json
(alte Fassung mit ihrem Tempo) auf schnitt.json mit workflow.json "tempo" umrechnen (Vorbild Bücher die so gut sind wie
Therapie 04.10.2026). Untertitel-Korrekturen und Kurzprüfungs-Ersetzungen, deren Wörter herausgeschnitten sind, fallen weg;
Gestaltungselemente an herausgeschnittenen Stellen rücken an den Anfang des nächsten Stücks und werden genannt.
Aufruf über node workflow.mjs schnitt-umstellen "<Projekt>".
python3 schnitt/umstellen.py <Projektordner> [--schreiben]"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zeiten import lade
P = os.path.abspath(sys.argv[1]); os.chdir(P)
Z = lade(P); um, roh, drin = Z.um, Z.roh, Z.drin
KEYS = {'start', 'end', 'at', 'grossBis', 'autorAb', 'outroStart', 'from', 'to', 'streichenAb'}
verschoben = []
def walk(o, pfad=''):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in KEYS and isinstance(v, (int, float)) and not isinstance(v, bool):
                if not drin(roh(v)): verschoben.append(f'{pfad}.{k} {v}')
                o[k] = um(v)
            else: walk(v, f'{pfad}.{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o): walk(v, f'{pfad}[{i}]')
schreiben = '--schreiben' in sys.argv
weg = []
c = json.load(open('caption-edit-plan.json')) if os.path.exists('caption-edit-plan.json') else None
if c is not None:
    # Untertitel: Korrekturen nur behalten, wenn ihr Bereich (Mitte) noch im Schnitt liegt
    keep_c = []
    for k in c.get('corrections', []):
        if drin(roh((k['from'] + k['to']) / 2)): keep_c.append(k)
        else: weg.append(('Korrektur', k['before'], k['after'], k['from']))
    c['corrections'] = keep_c
    # Kurzprüfungen: Teile, deren Bereich ganz herausgeschnitten ist, entfallen (kurzpruefungen-neu.py, gleiche Regel)
    ch = json.load(open('word-review-turbo/chunks.json')) if os.path.exists('word-review-turbo/chunks.json') else []
    entfaellt = {i for i, (a, b) in enumerate(ch) if um(b) - um(a) < 0.5}
    keep_r = []
    for r in c.get('reviewReplacements', []):
        a, b = roh(r['from']), roh(r['to'])
        if r.get('folder') == 'word-review-turbo' and r['index'] in entfaellt: weg.append(('Ersetzung (Teil entfällt)', r['index'], r['from'], r['basis'][:60]))
        elif any(drin(a + (b - a) * i / 10) for i in range(11)): keep_r.append(r)
        else: weg.append(('Ersetzung', r['index'], r['from'], r['basis'][:60]))
    c['reviewReplacements'] = keep_r
    walk(c['corrections'], 'caption-edit-plan.corrections'); walk(c['reviewReplacements'], 'caption-edit-plan.reviewReplacements')
d = json.load(open('design-plan.json')) if os.path.exists('design-plan.json') else None
if d is not None:
    walk(d, 'design-plan')
    d.setdefault('_umgerechnet', []).append(f'Zeiten von schnitt/vorher.json (Tempo {Z.ta:g}) auf schnitt.json (Tempo {Z.tn:g}) umgerechnet (node workflow.mjs schnitt-umstellen); Elemente an herausgeschnittenen Stellen rücken an den Anfang des nächsten Stücks – Planer prüft danach.')
for w in weg: print('entfällt:', w)
for v in verschoben: print('an herausgeschnittener Stelle, an den Anfang des nächsten Stücks gerückt:', v)
if schreiben:
    if c is not None: json.dump(c, open('caption-edit-plan.json', 'w'), indent=1, ensure_ascii=False)
    if d is not None: json.dump(d, open('design-plan.json', 'w'), indent=1, ensure_ascii=False)
print(f'Plan und Untertitel umgerechnet (Tempo alt {Z.ta:g}, neu {Z.tn:g}; {len(weg)} entfallen, {len(verschoben)} verschoben)' + ('' if schreiben else ' – Probe, nichts geschrieben'))
