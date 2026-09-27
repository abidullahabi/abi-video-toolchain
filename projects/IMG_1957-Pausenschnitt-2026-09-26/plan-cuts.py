#!/usr/bin/env python3
"""Pausenschnitt nach CONTENT_WORKFLOW.md Abschnitt 5.

Liest die Silero-Rohwerte (probabilities.json) und die echten Bildzeitstempel
(logs/video-pts.txt) und schreibt cuts.json. Nur Sprechluecken werden gekuerzt,
kein Take und kein Wort wird entfernt. Jede Luecke ab MIN_GAP behaelt LEAD nach
dem Sprachende und TAIL vor dem Sprachanfang; Schnittgrenzen liegen auf echten
Bildzeitstempeln, weil die Quelle keine exakt konstante Bildrate hat.

Aufruf: python3 plan-cuts.py [LEAD_ms TAIL_ms]
"""
import array
import json
import math
import sys
import wave
from bisect import bisect_left

THRESHOLD, RELEASE, MIN_GAP_MS = 0.70, 0.55, 64  # identisch mit silero-review.mjs
MIN_GAP = 0.150          # ab 5 Silero-Schritten (160 ms); kuerzere bleiben (natuerlicher Rhythmus)
ISLAND_MAX = 0.100       # kuerzere Silero-"Sprache" zwischen zwei langen Luecken = Geraeusch
LEAD = float(sys.argv[1]) / 1000 if len(sys.argv) > 1 else 0.040
TAIL = float(sys.argv[2]) / 1000 if len(sys.argv) > 2 else 0.056
LEAD_MIN, TAIL_MIN = 0.024, 0.040   # Mindestschutz fuer Endsilben und leise Wortanfaenge
START_TAIL = 0.100       # vor dem ersten Wort
END_LEAD = 0.200         # nach dem letzten Wort

prob = json.load(open('probabilities.json'))
p, hop = prob['probabilities'], prob['hopSamples'] / prob['sampleRate']
duration = prob['sampleCount'] / prob['sampleRate']
frames = sorted(float(x) for x in open('logs/video-pts.txt') if x.strip())
video_end = json.load(open('workflow.json'))['originalDuration']
duration = min(duration, video_end)

# Luecken genau wie analyze-speech (Hysterese, kein 200-ms-Zusammenfuehren)
gaps, start = [], None
for i, v in enumerate(p):
    t = i * hop
    if v < RELEASE and start is None:
        start = t
    elif v >= THRESHOLD and start is not None:
        if t - start + 1e-9 >= MIN_GAP_MS / 1000:
            gaps.append([start, t])
        start = None
if start is not None and duration - start >= MIN_GAP_MS / 1000:
    gaps.append([start, duration])

# Abschnitt 5: Ein kurzer Impuls (Mundgeraeusch, Klick) teilt eine lange Luecke nicht.
# Kurze "Sprach"-Inseln zwischen zwei langen Luecken werden der Luecke zugeschlagen.
merged_islands = []
for i in range(len(gaps) - 1, 0, -1):
    left, right = gaps[i - 1], gaps[i]
    if (right[0] - left[1] <= ISLAND_MAX and left[1] - left[0] >= MIN_GAP
            and right[1] - right[0] >= MIN_GAP):
        merged_islands.append([round(left[1], 3), round(right[0], 3)])
        left[1] = right[1]
        del gaps[i]


def nearest_frame(t):
    i = bisect_left(frames, t)
    cands = [j for j in (i - 1, i) if 0 <= j < len(frames)]
    return min(cands, key=lambda j: abs(frames[j] - t))


# Wortschutz, keine Luecken-Messung: Silero setzt Sprachgrenzen auf ein 32-ms-Raster
# und erkennt leise Anlaute manchmal einen Schritt zu spaet. Steigt der Pegel direkt
# vor dem Sprachanfang schon an (oder klingt nach dem Sprachende noch aus), bleibt
# dieser Teil stehen. Schwelle relativ zum Grundpegel der jeweiligen Luecke.
GUARD_MAX, GUARD_MARGIN = 0.064, 0.010
w = wave.open('speech.wav')
sr = w.getframerate()
pcm = array.array('h', w.readframes(w.getnframes()))


def level(t):  # dBFS eines 10-ms-Fensters ab t
    s = pcm[max(0, int(t * sr)):max(0, int((t + 0.010) * sr))]
    return 10 * math.log10(sum(v * v for v in s) / len(s) / 32768 ** 2 + 1e-12) if s else -120.0


def edge_guards(gs, ge):
    steps = [gs + k * 0.010 for k in range(int((ge - gs) / 0.010))]
    floor = sorted(level(t) for t in steps)[len(steps) // 2] if steps else -120.0
    limit = max(floor + 15, -65.0)
    tail_end = gs  # Ausklang nach dem Sprachende
    while tail_end - gs < GUARD_MAX and tail_end < ge and level(tail_end) > limit:
        tail_end += 0.010
    onset = ge    # Anstieg vor dem Sprachanfang
    while ge - onset < GUARD_MAX and onset > gs and level(onset - 0.010) > limit:
        onset -= 0.010
    need_before = (tail_end - gs + GUARD_MARGIN) if tail_end > gs else 0.0
    need_after = (ge - onset + GUARD_MARGIN) if onset < ge else 0.0
    return need_before, need_after, round(floor, 1)


guarded = 0
removals, skipped = [], []
for gs, ge in gaps:
    if ge - gs < MIN_GAP:
        continue
    at_start, at_end = gs <= 1e-6, ge >= duration - 1e-6
    keep_before = 0.0 if at_start else (END_LEAD if at_end else LEAD)
    keep_after = 0.0 if at_end else (START_TAIL if at_start else TAIL)
    need_before, need_after, floor = edge_guards(gs, ge)
    a = 0 if at_start else nearest_frame(gs + keep_before)
    if not at_start:
        guard = max(LEAD_MIN, need_before)
        while frames[a] - gs < guard:
            a += 1
    if at_end:
        rs, re = frames[a], video_end
    else:
        b = nearest_frame(ge - keep_after)
        guard = max(TAIL_MIN if not at_start else keep_after - 0.017, need_after)
        while ge - frames[b] < guard:
            b -= 1
        guarded += (need_after > TAIL) + (need_before > LEAD)
        if b <= a:
            skipped.append({'gap': [gs, ge], 'why': 'kuerzer als ein Bild nach Schutzabstand'})
            continue
        rs, re = (0.0 if at_start else frames[a]), frames[b]
    removals.append({
        'start': round(rs, 6), 'end': round(re, 6), 'type': 'silence',
        'sileroGap': [round(gs, 3), round(ge, 3)],
        'keptBefore': round(rs - gs, 3), 'keptAfter': round(ge - re, 3), 'gapFloorDb': floor,
        'reason': 'Sprechluecke nach Silero gekuerzt, Sprache beidseitig erhalten',
    })

removed = sum(r['end'] - r['start'] for r in removals)
plan = {
    'basis': 'Originalzeit IMG_1957.MOV, echte Bildzeitstempel',
    'detection': {'tool': 'Silero VAD 6.2.0 (silero-probabilities)', 'threshold': THRESHOLD,
                  'release': RELEASE, 'minGapMs': MIN_GAP_MS, 'hopMs': round(hop * 1000)},
    'rule': {'cutGapsFromMs': MIN_GAP * 1000, 'leadMs': LEAD * 1000, 'tailMs': TAIL * 1000,
             'leadMinMs': LEAD_MIN * 1000, 'tailMinMs': TAIL_MIN * 1000,
             'startTailMs': START_TAIL * 1000, 'endLeadMs': END_LEAD * 1000,
             'wordEdgeGuard': 'Pegelanstieg/-ausklang direkt an der Sprachgrenze bleibt stehen '
                              '(Grundpegel der Luecke +15 dB, mind. -65 dBFS, max. 64 ms). '
                              'Nur Wortschutz, keine Messung der Luecke.',
             'guardedEdges': int(guarded),
             'note': 'Ziel nach Abschnitt 5: Restluecke 64-96 ms Silero-Nicht-Sprache, Median 96 ms'},
    'minimumSilence': MIN_GAP,
    'removals': removals,
    'skipped': skipped,
    'mergedNoiseIslands': sorted(merged_islands),
    'reviewNotes': ['Nur Pausen gekuerzt. Alle Anlaeufe/Takes erhalten (Auftrag 26.09.2026).'],
    'summary': {'gapsFound': len(gaps), 'cuts': len(removals), 'removedSeconds': round(removed, 3),
                'expectedDuration': round(video_end - removed, 3)},
}
json.dump(plan, open('cuts.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(plan['summary']), 'skipped', len(skipped))
