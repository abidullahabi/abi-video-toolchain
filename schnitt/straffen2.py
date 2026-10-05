#!/usr/bin/env python3
"""Pausen an allen Nähten eng schneiden (Abis Rückmeldung 04.10.2026: „straffer schneiden“, Ziel ≤ 3:00).
Standard seit 04.10.2026 (Vorbild Bücher die so gut sind wie Therapie); Aufruf über node workflow.mjs schnitt-plan "<Projekt>".
Läuft nach plan-edl.py auf <Projekt>/schnitt.json (Rohzeit). Hörbare Wortkanten aus dem Pegel der Aufnahme, relativ zum Rauschboden
(10-%-Wert der 5-ms-Pegel ohne digitale Stille): Ende-Schwelle = Rauschboden + 6 dB, begrenzt auf −60 … −49 dB, Anfang-Schwelle 3 dB höher.
Bei „Bücher die so gut sind wie Therapie“ (Rauschboden −55 dB) ergibt das −49/−46 dB; bei Aufnahmen mit Rauschunterdrückung
(KI-Zertifikate: −89 dB, ein Drittel digitale Stille) −60/−57 dB, sonst würden leise Anlaute und Auslaute angeschnitten (Blindtest 05.10.2026).
Ende = letzter 5-ms-Abschnitt über der Ende-Schwelle, dessen Vorgänger ebenfalls darüber liegt, Anfang = erster Abschnitt, ab dem es 15 ms über der Anfang-Schwelle bleibt. Danach 60 ms Nachlauf und
40 ms Vorlauf (≈ 100 ms hörbare Pause wie Abis eigener Schnitt bei Fast 30). Nur kürzen, nie verlängern; erster Anfang (Einstieg)
und letztes Ende (festgelegter Schluss) bleiben. Raster 1/30 s nach außen gerundet (vorbereiten.mjs rundet).
Geprüfte Kanten aus selection.json "kantenFest": {"anfang": [...], "ende": [...]} (Rohzeit) setzt das Skript danach wieder, nur nach außen
und nie in das Nachbarstück (vorher ein Projekt-Skript im Blindtest 05.10.2026).
python3 schnitt/straffen2.py <Projektordner> [--nachlauf 0.06] [--vorlauf 0.04] [--ende-db -49] [--anfang-db -46]"""
import json, wave, os, sys, math, statistics
import numpy as np
os.chdir(os.path.join(os.path.abspath(sys.argv[1]), 'schnitt'))
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
TAIL, LEAD = arg('--nachlauf', 0.06), arg('--vorlauf', 0.04)
w = wave.open('speech.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.005); n = len(x) // hop; db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
leben = db[db > -120]
RAUSCH = float(np.percentile(leben, 10)) if len(leben) else -55.0
TE = arg('--ende-db', float(max(-60, min(-49, round(RAUSCH) + 6)))); TS = arg('--anfang-db', TE + 3)
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
alt = sum(b - a for a, b in k); bericht = []; rest = []
for j in range(len(k) - 1):
    a0, e0 = k[j]; s1, e1 = k[j + 1]
    we = ende(max(a0, e0 - 0.8), e0); ws = anfang(s1, min(e1, s1 + 0.8))
    ne = e0 if we is None else min(e0, math.ceil((we + TAIL) * 30 - 1e-6) / 30)
    ns = s1 if ws is None else max(s1, math.floor((ws - LEAD) * 30 + 1e-6) / 30)
    if ne - a0 < 0.1: ne = e0
    if e1 - ns < 0.1: ns = s1
    bericht.append({'naht': j, 'ende': [round(e0, 3), round(ne, 3)], 'anfang': [round(s1, 3), round(ns, 3)], 'gespart_ms': round((e0 - ne + ns - s1) * 1000)})
    k[j][1] = ne; k[j + 1][0] = ns
    rest.append((j, e0, s1, None if we is None or ws is None else (ne - we) + (ws - ns)))   # hörbare Pause an der Naht (nur Ausgabe)
# Geprüfte Kanten (selection.json "kantenFest") wieder setzen: nur nach außen, nie in das Nachbarstück.
sel = json.load(open('selection.json')) if os.path.exists('selection.json') else {}
kf = sel.get('kantenFest') or {}; r30 = lambda t: round(t * 30) / 30; fest = []
for t in kf.get('anfang', []):   # Stück, dessen Anfang nahe t liegt; liegt er schon bei oder vor t, bleibt er
    t = r30(t); j = next((j for j, (a, b) in enumerate(k) if t - 0.25 <= a <= t + 0.25), None)
    if j is None: fest.append(f'Anfang {t:.3f}: kein Stück in der Nähe'); continue
    if k[j][0] <= t + 1e-6: continue
    if j > 0 and k[j - 1][1] > t + 1e-6: fest.append(f'Anfang {t:.3f}: Nachbarstück endet {k[j - 1][1]:.3f}, nicht gesetzt'); continue
    fest.append(f'Anfang {k[j][0]:.3f} → {t:.3f}'); k[j][0] = t
for t in kf.get('ende', []):   # Stück, dessen Ende nahe t liegt; liegt es schon bei oder nach t, bleibt es
    t = r30(t); j = next((j for j, (a, b) in enumerate(k) if t - 0.25 <= b <= t + 0.25), None)
    if j is None: fest.append(f'Ende {t:.3f}: kein Stück in der Nähe'); continue
    if k[j][1] >= t - 1e-6: continue
    if j + 1 < len(k) and k[j + 1][0] < t - 1e-6: fest.append(f'Ende {t:.3f}: Nachbarstück beginnt {k[j + 1][0]:.3f}, nicht gesetzt'); continue
    fest.append(f'Ende {k[j][1]:.3f} → {t:.3f}'); k[j][1] = t
neu = sum(b - a for a, b in k)
s['behalten'] = [[round(a, 6), round(b, 6)] for a, b in k]
te_txt, ts_txt = ('%.0f' % TE).replace('-', '−'), ('%.0f' % TS).replace('-', '−')
s['_straffen2'] = f'Nähte nach hörbaren Wortkanten ({te_txt}/{ts_txt} dB) mit {int(TAIL*1000)}/{int(LEAD*1000)} ms Nach-/Vorlauf gekürzt, {alt - neu:.2f} s gespart (schnitt/straffen2.py)'
json.dump(s, open('../schnitt.json', 'w'), indent=1)
json.dump(bericht, open('straffen2-bericht.json', 'w'), indent=0)
print(f'Dauer {alt:.2f} → {neu:.2f} s (−{alt - neu:.2f} s), Nähte {len(bericht)}, Median gespart {statistics.median(b["gespart_ms"] for b in bericht)} ms')
print(f'Wortkanten-Schwellen: Ende {te_txt} dB, Anfang {ts_txt} dB (Rauschboden {RAUSCH:.1f} dB)' + (f'; geprüfte Kanten: ' + '; '.join(fest) if fest else ''))
# Nur Ausgabe (ändert keine Datei): hörbare Restpause je Naht = Nachlauf nach dem Wortende + Vorlauf vor dem Wortanfang
gemessen = [r[3] for r in rest if r[3] is not None]
if gemessen: print(f'Restpause an den Nähten: Median {statistics.median(gemessen) * 1000:.0f} ms (min {min(gemessen) * 1000:.0f}, max {max(gemessen) * 1000:.0f})')
lang = [r for r in rest if r[3] is not None and r[3] > 0.3]
print(f'Nähte mit Restpause > 300 ms: {len(lang)}' + ''.join(f'\n  Naht {j}: Rohzeit {e0:.2f} | {s1:.2f}  {p * 1000:.0f} ms' for j, e0, s1, p in lang))
ohne = [r for r in rest if r[3] is None]
if ohne: print(f'Nähte ohne hörbare Wortkante (unverändert gelassen): {len(ohne)}' + ''.join(f'\n  Naht {j}: Rohzeit {e0:.2f} | {s1:.2f}' for j, e0, s1, _ in ohne))
