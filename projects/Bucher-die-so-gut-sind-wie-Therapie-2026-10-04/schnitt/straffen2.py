#!/usr/bin/env python3
"""Pausen an allen Nähten eng schneiden (Abis Rückmeldung 04.10.2026: „straffer schneiden“, Ziel ≤ 3:00).
Läuft nach plan-edl.py auf ../schnitt.json (Rohzeit). Hörbare Wortkanten aus dem Pegel dieser Aufnahme (Rauschboden ~ −55 dB):
Ende = letzter 5-ms-Abschnitt ≥ −49 dB, dessen Vorgänger ebenfalls ≥ −49 dB liegt, Anfang = erster Abschnitt, ab dem es 15 ms ≥ −46 dB bleibt. Danach 60 ms Nachlauf und
40 ms Vorlauf (≈ 100 ms hörbare Pause wie Abis eigener Schnitt bei Fast 30). Nur kürzen, nie verlängern; erster Anfang (Einstieg)
und letztes Ende (festgelegter Schluss) bleiben. Raster 1/30 s nach außen gerundet (vorbereiten.mjs rundet).
python3 straffen2.py [--nachlauf 0.06] [--vorlauf 0.04]"""
import json, wave, os, sys, math, statistics
import numpy as np
os.chdir(os.path.dirname(os.path.abspath(__file__)))
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
TAIL, LEAD, TE, TS = arg('--nachlauf', 0.06), arg('--vorlauf', 0.04), -49.0, -46.0
w = wave.open('speech.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.005); n = len(x) // hop; db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
I = lambda t: max(0, min(n - 1, int(round(t / 0.005))))
def ende(t0, t1):   # letzter Abschnitt, der mit seinem Vorgänger ≥ −49 dB liegt (einzelne 5-ms-Rauschspitzen zählen nicht; Befund B3)
    for i in range(I(t1) - 1, I(t0), -1):
        if db[i] >= TE and db[i - 1] >= TE: return (i + 1) * 0.005
    return None
def anfang(t0, t1):
    for i in range(I(t0), I(t1)):
        if db[i] >= TS and db[min(i + 1, n - 1)] >= TS and db[min(i + 2, n - 1)] >= TS: return i * 0.005
    return None
s = json.load(open('../schnitt.json')); k = [list(v) for v in s['behalten']]
alt = sum(b - a for a, b in k); bericht = []
for j in range(len(k) - 1):
    a0, e0 = k[j]; s1, e1 = k[j + 1]
    we = ende(max(a0, e0 - 0.8), e0); ws = anfang(s1, min(e1, s1 + 0.8))
    ne = e0 if we is None else min(e0, math.ceil((we + TAIL) * 30 - 1e-6) / 30)
    ns = s1 if ws is None else max(s1, math.floor((ws - LEAD) * 30 + 1e-6) / 30)
    if ne - a0 < 0.1: ne = e0
    if e1 - ns < 0.1: ns = s1
    bericht.append({'naht': j, 'ende': [round(e0, 3), round(ne, 3)], 'anfang': [round(s1, 3), round(ns, 3)], 'gespart_ms': round((e0 - ne + ns - s1) * 1000)})
    k[j][1] = ne; k[j + 1][0] = ns
neu = sum(b - a for a, b in k)
s['behalten'] = [[round(a, 6), round(b, 6)] for a, b in k]
s['_straffen2'] = f'Nähte nach hörbaren Wortkanten (−49/−46 dB) mit {int(TAIL*1000)}/{int(LEAD*1000)} ms Nach-/Vorlauf gekürzt, {alt - neu:.2f} s gespart (schnitt/straffen2.py)'
json.dump(s, open('../schnitt.json', 'w'), indent=1)
json.dump(bericht, open('straffen2-bericht.json', 'w'), indent=0)
print(f'Dauer {alt:.2f} → {neu:.2f} s (−{alt - neu:.2f} s), Nähte {len(bericht)}, Median gespart {statistics.median(b["gespart_ms"] for b in bericht)} ms')
