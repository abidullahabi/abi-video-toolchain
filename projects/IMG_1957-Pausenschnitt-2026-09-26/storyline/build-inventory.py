#!/usr/bin/env python3
"""Baut das Take-Verzeichnis fuer die Storyline-Auswahl aus Schnitt v1.

Je Sprechabschnitt (Segment zwischen zwei Pausenschnitten von v1): Zeiten im
Schnitt v1, Pause davor im Original (lange Pausen = neuer Anlauf), Text aus der
Einzeltranskription (Whisper-Erkennungsdurchgang, DTW-Wortzeiten) und saubere
Schnittpunkte innerhalb des Segments (Silero-Luecken >= 64 ms), markiert als [a], [b] ...

Aufruf (im Ordner storyline): python3 build-inventory.py
"""
import glob
import json
import string

segs = json.load(open('segments.json'))
cuts = sorted(json.load(open('../cuts.json'))['removals'], key=lambda r: r['start'])
sil = json.load(open(glob.glob('../../../analysis/Silero-IMG_1957-Schnitt-Ton-v2-*/speech-boundaries.json')[0]))
gaps = sil['candidates']


def fmt(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'


inventory, lines = [], []
for s in segs:
    i, a, b = s['id'], s['cutStart'], s['cutEnd']
    # Pause im Original direkt vor diesem Segment (Silero-Luecke, die v1 gekuerzt hat)
    pre = cuts[i]['sileroGap'] if i < len(cuts) else None
    pause_before = round(pre[1] - pre[0], 2) if pre and abs(cuts[i]['end'] - s['origStart']) < 0.01 else None
    d = json.load(open(f'segments/seg-{i:03d}.wav.json'))
    words = []
    for seg in d['transcription']:
        for tok in seg['tokens']:
            txt = tok['text']
            if txt.startswith('[_'):
                continue
            t = tok['t_dtw'] / 100 if tok.get('t_dtw', -1) >= 0 else tok['offsets']['from'] / 1000
            if txt.startswith(' ') or not words:
                words.append({'w': txt.strip(), 't': round(t, 3), 'p': [tok['p']]})
            else:
                words[-1]['w'] += txt
                words[-1]['p'].append(tok['p'])
    for w in words:
        w['p'] = round(min(w['p']), 2)
    # Saubere Schnittpunkte: Silero-Luecken vollstaendig im Segment
    points = []
    for g in gaps:
        gs, ge = g['start'] - a, g['end'] - a
        if gs > 0.08 and ge < (b - a) - 0.08:
            k = sum(1 for w in words if w['t'] < gs + 0.02)  # Woerter vor der Luecke
            if 0 < k < len(words):
                points.append({'id': string.ascii_lowercase[len(points)], 'afterWord': k,
                               'gap': [round(g['start'], 3), round(g['end'], 3)],
                               'gapMs': round((g['end'] - g['start']) * 1000)})
    text_parts = []
    for k, w in enumerate(words, 1):
        text_parts.append(w['w'] + ('?' if w['p'] < 0.4 else ''))
        for p in points:
            if p['afterWord'] == k:
                text_parts.append(f"[{p['id']}]")
    probs = [w['p'] for w in words] or [0]
    entry = {'id': i, 'cutStart': a, 'cutEnd': b, 'duration': round(b - a, 3),
             'pauseBeforeInOriginal': pause_before, 'words': words, 'cutPoints': points,
             'text': ' '.join(text_parts), 'meanWordP': round(sum(probs) / len(probs), 2)}
    inventory.append(entry)
    pb = f'Pause davor {pause_before:.1f}s' if pause_before is not None else 'Pause davor —'
    lines.append(f"S{i:03d} | {fmt(a)}–{fmt(b)} ({b - a:.2f}s) | {pb} | p {entry['meanWordP']:.2f} | {entry['text']}")

json.dump(inventory, open('inventory.json', 'w'), indent=1, ensure_ascii=False)
header = [
    '# Take-Verzeichnis „Fast 30 Jahre“ (Schnitt v1, 7:11 min)',
    '',
    'Eine Zeile je Sprechabschnitt S### (zwischen zwei Pausenschnitten von v1). Zeiten = Schnitt v1.',
    '„Pause davor“ = Länge der Sprechpause im Original vor diesem Abschnitt. Lange Pausen (> 1 s) markieren',
    'meist einen neuen Anlauf oder eine neue Szene; kurze (< 0,5 s) meist fließendes Weitersprechen.',
    '„p“ = mittlere Erkennungssicherheit (niedrig kann Nuscheln, Versprecher oder Geräusch bedeuten).',
    'Wort mit „?“ = unsicher erkannt. [a], [b] … = saubere Schnittpunkte innerhalb des Abschnitts',
    '(echte Sprechlücke ≥ 64 ms). Nur dort, am Abschnittsanfang oder -ende kann geschnitten werden.',
    'Texte stammen aus Einzeltranskription kurzer Abschnitte; Erkennungsfehler sind möglich (z. B. Zahlen, Eigennamen).',
    '',
]
open('inventory.md', 'w').write('\n'.join(header + lines) + '\n')
print(len(inventory), 'Abschnitte,', sum(len(e['cutPoints']) for e in inventory), 'innere Schnittpunkte')
