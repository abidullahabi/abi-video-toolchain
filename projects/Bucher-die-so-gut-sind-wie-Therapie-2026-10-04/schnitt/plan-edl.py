#!/usr/bin/env python3
"""Redaktioneller Schnitt IMG_2012 (Bücher wie Therapie), uebernommen aus KI-Zertifikate-Schnitt (IMG_1967) nach CONTENT_WORKFLOW.md Abschnitt 5, Fassung 2.

selection.json legt fest, WELCHE Anlaeufe bleiben (Originalzeit, Reihenfolge wie aufgenommen).
Dieses Skript setzt die Schnittpunkte:
- Pausen ab 150 ms (Silero-Luecke oder hoerbare Stille) werden gekuerzt, innerhalb eines
  Anlaufs und zwischen Anlaeufen.
- Kanten an den hoerbaren Wortgrenzen: Silero setzt bei dieser Aufnahme das Sprachende 40-240 ms
  nach dem letzten Laut (Befund 27.09.2026, review/pausen-vergleich.json). Als Wortende gilt der
  letzte 5-ms-Abschnitt ueber -52 dBFS (Ausklang eingeschlossen), als Anfang der erste darueber.
- Danach 40 ms Nachlauf und 56 ms Vorlauf, mindestens 24 bzw. 40 ms (Abschnitt 5, Median 96 ms).
- Nie in einen verworfenen Nachbaranlauf hineinschneiden (Abstand >= 20 ms zur Nachbarsprache).
- Schnittgrenzen auf echten Bildzeitstempeln (Quelle ist nicht exakt 30 fps).
Ergebnis: edl.json.
"""
import json, os, wave, statistics, math
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from bisect import bisect_left

MIN_GAP, LEAD, TAIL = 0.150, 0.080, 0.070   # Ziel ~150 ms hoerbare Stille je Anschluss wie Abdullahs eigener Schnitt (100/217/139 ms, ENTSCHEIDUNGEN 16.09.)
LEAD_MIN, TAIL_MIN, START_TAIL, NEIGHBOUR = 0.024, 0.040, 0.100, 0.020
TH, TH_END, STEP = -52.0, -58.0, 0.005

sel = json.load(open('selection.json'))
ADJ = json.load(open('adjust.json')) if os.path.exists('adjust.json') else {'lead': {}, 'tail': {}}
gaps = [(g['start'], g['end']) for g in json.load(open('analysis/speech-boundaries.json'))['candidates']]
frames = [float(v) for v in open('analysis/video-pts.txt') if v.strip()]
w = wave.open('speech.wav'); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * STEP); n = len(x) // hop
db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
loud = db >= TH
loud_end = db >= TH_END
I = lambda t: max(0, min(n - 1, int(round(t / STEP))))

def last_loud(t0, t1, arr=None):   # Ende des letzten hoerbaren Abschnitts in [t0, t1]
    arr = loud_end if arr is None else arr
    for i in range(I(t1), I(t0) - 1, -1):
        if arr[i]: return (i + 1) * STEP
    return None
def first_loud(t0, t1):   # erster Abschnitt, ab dem es mindestens 15 ms hoerbar bleibt (kein Knacken)
    for i in range(I(t0), I(t1) + 1):
        if loud[i] and loud[min(i + 1, n - 1)] and loud[min(i + 2, n - 1)]: return i * STEP
    return None
def quiet_runs(a, b, min_len):
    runs, i, i1 = [], I(a), I(b)
    while i < i1:
        if not loud_end[i]:
            j = i
            while j < i1 and not loud_end[j]: j += 1
            if (j - i) * STEP >= min_len: runs.append((i * STEP, j * STEP))
            i = j
        else: i += 1
    return runs

def frame_nearest(t):
    i = bisect_left(frames, t); c = [j for j in (i - 1, i) if 0 <= j < len(frames)]
    return frames[min(c, key=lambda j: abs(frames[j] - t))]
def frame_at_or_after(t):
    i = bisect_left(frames, t - 1e-6); return frames[min(i, len(frames) - 1)]
def frame_at_or_before(t):
    i = bisect_left(frames, t + 1e-6) - 1; return frames[max(i, 0)]

pieces = []
for r in sel['ranges']:
    a, b = r['a'], r['b']
    # Sprechanfang/-ende des Bereichs hoerbar bestimmen
    sa = a if r.get('hardStart') else (first_loud(a - 0.08, a + 0.12) or a)
    eb = b if r.get('hardEnd') else (last_loud(b - 0.35, b + 0.03) or b)
    # Pausen im Bereich: Silero-Luecken ab MIN_GAP und hoerbare Stille ab MIN_GAP
    cand = [(gs, ge) for gs, ge in gaps if gs > sa + 0.01 and ge < eb - 0.01 and ge - gs >= MIN_GAP]
    if r.get('endHold'):   # Schlusspose: nur Pausen vor dem letzten Wort kuerzen
        eb_word = last_loud(sa, b); cand = [c for c in cand if c[1] < eb_word]
        cand += quiet_runs(sa + 0.02, eb_word - 0.02, MIN_GAP)
    else:
        cand += quiet_runs(sa + 0.02, eb - 0.02, MIN_GAP)
    if r.get('keepInner'): cand = []   # Pausen in diesem Bereich bleiben wie gesprochen
    cand.sort(); merged = []
    for g in cand:
        if merged and g[0] <= merged[-1][1]: merged[-1] = (merged[-1][0], max(merged[-1][1], g[1]))
        else: merged.append(g)
    cuts = []
    for gs, ge in merged:
        e_ac = last_loud(gs - 0.30, ge) if not loud[I(ge) - 1] else None
        # hoerbare Stille in der Luecke suchen (laengster leiser Lauf)
        lo = max(gs - 0.30, (cuts[-1][1] if cuts else sa) + 0.02)
        runs = quiet_runs(lo, min(ge + 0.05, eb - 0.02), 0.05)
        if runs:
            q0, q1 = max(runs, key=lambda r: r[1] - r[0])
            if q1 - q0 >= 0.10: cuts.append((q0, q1)); continue
        cuts.append((gs, ge))
    pts = [sa] + [t for c in cuts for t in c] + [eb]
    for k in range(0, len(pts), 2):
        pieces.append({'range': r['id'], 's': pts[k], 'e': pts[k + 1],
                       'hardStart': bool(r.get('hardStart')) and k == 0,
                       'hardEnd': bool(r.get('hardEnd')) and k == len(pts) - 2})

def sil_gap_after(t):
    for gs, ge in gaps:
        if gs - 0.05 <= t < ge: return ge
    return t + 0.3
def sil_gap_before(t):
    for gs, ge in gaps:
        if gs < t <= ge + 0.05: return gs
    return t - 0.3
def next_src_speech_old(e):   # Ende der Stille nach dem Wortende e = Beginn der Nachbarsprache
    i = I(e)
    while i < n - 1 and not loud_end[i] and (i - I(e)) * STEP < 3.0: i += 1
    return i * STEP
def prev_src_speech_old(s):   # Beginn der Stille vor dem Wortanfang s = Ende der Nachbarsprache
    i = I(s) - 1
    while i > 0 and loud_end[i] and (I(s) - i) * STEP < 0.3: i -= 1   # Anlaut/Atem direkt vor s ueberspringen
    while i > 0 and not loud_end[i] and (I(s) - i) * STEP < 3.0: i -= 1
    return (i + 1) * STEP

keeps = []
for i, p in enumerate(pieces):
    s, e = p['s'], p['e']
    cross_prev = i > 0 and pieces[i - 1]['range'] != p['range']
    cross_next = i + 1 < len(pieces) and pieces[i + 1]['range'] != p['range']
    if p['hardStart']: ks = s
    elif i == 0: ks = frame_at_or_before(s - START_TAIL)
    else:
        ks = frame_nearest(s - TAIL - ADJ['tail'].get(str(i), 0))
        if s - ks < TAIL_MIN: ks = frame_at_or_before(s - TAIL_MIN)
        if cross_prev: ks = max(ks, frame_at_or_after(sil_gap_before(s) + NEIGHBOUR))
    if p['hardEnd']: ke = e
    else:
        ke = frame_nearest(e + LEAD + ADJ['lead'].get(str(i), 0))
        if ke - e < LEAD_MIN: ke = frame_at_or_after(e + LEAD_MIN)
        if cross_next: ke = min(ke, frame_at_or_before(sil_gap_after(e) - NEIGHBOUR))
    R = next(r for r in sel['ranges'] if r['id'] == p['range'])
    extra = {k: R[k] for k in ('fadeOut', 'audioEnd', 'stretch') if p['hardEnd'] and k in R}
    keeps.append({'range': p['range'], 'start': round(ks, 6), 'end': round(ke, 6), 'speech': [round(s, 3), round(e, 3)], **extra})

merged = []
for k in keeps:
    if merged and k['start'] <= merged[-1]['end'] + 1e-6:
        merged[-1]['end'] = max(merged[-1]['end'], k['end']); merged[-1]['ranges'].append(k['range'])
        for x in ('fadeOut', 'audioEnd', 'stretch'):
            if x in k: merged[-1][x] = k[x]
    else: merged.append({'start': k['start'], 'end': k['end'], 'ranges': [k['range']], **{x: k[x] for x in ('fadeOut', 'audioEnd', 'stretch') if x in k}})
# vorbereiten.mjs rundet jede Grenze auf 1/30 s: hier schon nach aussen aufs Raster legen
for m in merged:
    m['start'] = math.floor(m['start'] * 30 + 1e-6) / 30; m['end'] = math.ceil(m['end'] * 30 - 1e-6) / 30
for a, b in zip(merged, merged[1:]):
    if b['start'] < a['end']: b['start'] = a['end']
dur = sum(m['end'] - m['start'] for m in merged)
res = [round((keeps[i]['end'] - keeps[i]['speech'][1]) + (keeps[i + 1]['speech'][0] - keeps[i + 1]['start']), 3) for i in range(len(keeps) - 1)]
json.dump({'basis': sel['basis'], 'fassung': 2,
           'rule': {'minGap': MIN_GAP, 'lead': LEAD, 'tail': TAIL, 'wortgrenzeDbfs': TH, 'neighbourMargin': NEIGHBOUR,
                    'frames': 'echte Bildzeitstempel'},
           'pieces': keeps, 'keep': merged, 'plannedResidualGaps': res, 'cutDuration': round(dur, 3)},
          open('edl.json', 'w'), indent=1, ensure_ascii=False)
json.dump({'_quelle': 'schnitt/plan-edl.py aus schnitt/selection.json (Rohzeit IMG_2012.MOV, Sekunden, Raster 1/30 s)',
           'behalten': [[round(m['start'], 6), round(m['end'], 6)] for m in merged]}, open('../schnitt.json', 'w'), indent=1)
print('Stuecke', len(keeps), 'Intervalle', len(merged), 'Dauer', round(dur, 2), 's; geplante Restpause median',
      statistics.median(res), 'min', min(res), 'max', max(res))
