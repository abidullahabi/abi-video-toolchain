#!/usr/bin/env python3
"""Zerlegt die Aufnahme an Silero-Luecken in Sprechbloecke (Regeln wie plan-cuts.py, IMG_1957).

Jede Luecke ab 150 ms wird auf LEAD nach dem Sprachende und TAIL vor dem Sprachanfang
gekuerzt (mit Pegel-Wortschutz). Die Schnittpunkte liegen auf dem 1/30-s-Raster der
CFR-Quelle. Ergebnis: blocks.json mit Text je Block; ein Block beginnt am Einstiegspunkt
der Luecke davor und endet am Ausstiegspunkt der Luecke danach. Aneinandergereiht ergibt
jede Naht wieder ~96 ms Restpause, egal welche Bloecke wegfallen.
"""
import array, json, math, wave, subprocess
THRESHOLD, RELEASE, MIN_GAP_MS = 0.70, 0.55, 64
MIN_GAP, ISLAND_MAX = 0.150, 0.100
LEAD, TAIL, LEAD_MIN, TAIL_MIN = 0.040, 0.056, 0.024, 0.040
START_TAIL, END_LEAD = 0.100, 0.200
FPS = 30
prob = json.load(open('probabilities.json'))
p, hop = prob['probabilities'], prob['hopSamples'] / prob['sampleRate']
duration = min(prob['sampleCount'] / prob['sampleRate'], 4926 / FPS)
gaps, start = [], None
for i, v in enumerate(p):
    t = i * hop
    if v < RELEASE and start is None: start = t
    elif v >= THRESHOLD and start is not None:
        if t - start + 1e-9 >= MIN_GAP_MS / 1000: gaps.append([start, t])
        start = None
if start is not None and duration - start >= MIN_GAP_MS / 1000: gaps.append([start, duration])
for i in range(len(gaps) - 1, 0, -1):
    l, r = gaps[i - 1], gaps[i]
    if r[0] - l[1] <= ISLAND_MAX and l[1] - l[0] >= MIN_GAP and r[1] - r[0] >= MIN_GAP:
        l[1] = r[1]; del gaps[i]
w = wave.open('speech.wav'); sr = w.getframerate(); pcm = array.array('h', w.readframes(w.getnframes()))
def level(t):
    s = pcm[max(0, int(t * sr)):max(0, int((t + 0.010) * sr))]
    return 10 * math.log10(sum(v * v for v in s) / len(s) / 32768 ** 2 + 1e-12) if s else -120.0
def guards(gs, ge):
    steps = [gs + k * 0.010 for k in range(int((ge - gs) / 0.010))]
    floor = sorted(level(t) for t in steps)[len(steps) // 2] if steps else -120.0
    limit = max(floor + 15, -65.0)
    te = gs
    while te - gs < 0.064 and te < ge and level(te) > limit: te += 0.010
    on = ge
    while ge - on < 0.064 and on > gs and level(on - 0.010) > limit: on -= 0.010
    return ((te - gs + 0.010) if te > gs else 0.0), ((ge - on + 0.010) if on < ge else 0.0)
cuts = []  # (out_frame, in_frame, gap)
for gs, ge in gaps:
    if ge - gs < MIN_GAP: continue
    at_start, at_end = gs <= 1e-6, ge >= duration - 1e-6
    nb, na = guards(gs, ge)
    # naechstes Bild zum Sollwert, dann nur so weit schieben, wie der Mindestschutz verlangt
    if at_start: out_f = 0
    else:
        out_f = round((gs + LEAD) * FPS)
        while out_f / FPS - gs < max(LEAD_MIN, nb) - 1e-9: out_f += 1
    if at_end: in_f = round(duration * FPS)
    else:
        in_f = round((ge - (START_TAIL if at_start else TAIL)) * FPS)
        while ge - in_f / FPS < max(TAIL_MIN, na) - 1e-9: in_f -= 1
    if in_f <= out_f: continue
    cuts.append((out_f, in_f, [round(gs, 3), round(ge, 3)]))
words = json.load(open('words.json'))
blocks, cur = [], 0
for out_f, in_f, g in cuts:
    if out_f > cur: blocks.append([cur, out_f, g])
    cur = in_f
if cur < round(duration * FPS): blocks.append([cur, round(duration * FPS), None])
res = []
for i, (a, b, g) in enumerate(blocks):
    txt = ' '.join(w['text'] for w in words if a / FPS <= w['c'] < b / FPS)
    res.append({'id': i, 'startFrame': a, 'endFrame': b, 'start': round(a / FPS, 3), 'end': round(b / FPS, 3), 'text': txt})
json.dump(res, open('blocks.json', 'w'), ensure_ascii=False, indent=1)
for r in res: print(f"{r['id']:3d} {r['start']:7.3f}-{r['end']:7.3f} ({r['end']-r['start']:5.2f}) {r['text']}")
print('gaps cut', len(cuts), 'blocks', len(res), 'speech total', round(sum(r['end'] - r['start'] for r in res), 2))
