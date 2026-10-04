#!/usr/bin/env python3
"""Lange hörbare Stille an Nähten kürzen (04.10.2026). Messung wie review/pausen-schnitt.json: hörbare Stille = Pegel unter
p90 − 28 dB des Schnitttons (hier −45,4 dB). Nähte innerhalb eines Themas mit mehr als 250 ms → ca. 170 ms; Themenwechsel
(neues Buch, Intro→Buch 1, Bonus→Heilen) dürfen als Beat bis 300 ms bleiben. Nur kürzen, nie verlängern; hardEnd/hardStart
bleiben unberührt. Schreibt adjust.json für plan-edl.py (lead = Ende des Stücks i, tail = Anfang des Stücks i, negativ = kürzer)."""
import json, wave, numpy as np, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
TH = -45.4; INNER, BEAT = 0.17, 0.30
e = json.load(open('edl.json')); P = e['pieces']
w = wave.open('speech.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.005); n = len(x) // hop; db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
I = lambda t: max(0, min(n - 1, int(round(t / 0.005))))
def audible_end(t0, t1):   # letzter hörbarer 5-ms-Abschnitt vor t1
    for i in range(I(t1), I(t0) - 1, -1):
        if db[i] >= TH: return (i + 1) * 0.005
    return t0
def audible_start(t0, t1):   # erster Abschnitt, ab dem es 15 ms hörbar bleibt
    for i in range(I(t0), I(t1) + 1):
        if db[i] >= TH and db[min(i + 1, n - 1)] >= TH and db[min(i + 2, n - 1)] >= TH: return i * 0.005
    return t1
topic = lambda r: r.split('-')[0]
adj = {'lead': {}, 'tail': {}}; rep = []
for i in range(len(P) - 1):
    a, b = P[i], P[i + 1]
    if abs(a['end'] - b['start']) < 1e-6: continue   # kein Schnitt (Stücke hängen zusammen)
    we = audible_end(a['end'] - 0.5, a['end']); ws = audible_start(b['start'], b['start'] + 0.5)
    tail, lead = a['end'] - we, ws - b['start']; tot = tail + lead
    ziel = BEAT if topic(a['range']) != topic(b['range']) else INNER
    # Bewusste Beats aus der Schnittprüfung: „Liebe. | Ankommen“ bleibt bei ~0,3 s (Befund P6), vor der Pointe „Was falsch ist.“ 0,25 s.
    if (a['range'], b['range']) == ('b4-5', 'b4-6'): continue
    if (a['range'], b['range']) == ('b2-2', 'b2-3'): ziel = 0.25
    if tot <= max(0.25 if ziel == INNER else ziel, ziel) + 1e-3: continue
    zu = tot - ziel
    # gleichmäßig kürzen, aber mindestens 60 ms nach dem Wortende und 50 ms vor dem Wortanfang lassen
    ct = min(max(0, tail - 0.06), zu / 2); cl = min(max(0, lead - 0.05), zu - ct); ct = min(max(0, tail - 0.06), zu - cl)
    if not a.get('hardEnd') and ct > 0.005: adj['lead'][str(i)] = -round(ct, 3)
    if not b.get('hardStart') and cl > 0.005: adj['tail'][str(i + 1)] = -round(cl, 3)
    rep.append((a['range'], b['range'], round(tot * 1000), round((tot - ct - cl) * 1000), 'Beat' if ziel == BEAT else ''))
json.dump(adj, open('adjust.json', 'w'), indent=1)
for r in rep: print(r)
print(len(rep), 'Nähte gekürzt')
