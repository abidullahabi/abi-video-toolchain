#!/usr/bin/env python3
"""Woertliche Erkennung je Sprechstueck (Silero) mit Fuellwort-Prompt, damit versteckte Doppelanlaeufe
sichtbar werden (Befund 27.09.2026: -mc 0 schaltet den Prompt still ab, Stuecke < 1 s halluzinieren,
deshalb zwei Modelle gegenpruefen). Standard seit 04.10.2026 (Vorbild Bücher die so gut sind wie Therapie).
Aufruf über node workflow.mjs schnitt-analyse "<Projekt>".
python3 schnitt/chunk-asr.py <Projektordner> turbo|small   (arbeitet in <Projekt>/schnitt)"""
import json, subprocess, os, sys, wave
from concurrent.futures import ThreadPoolExecutor
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # Werkzeugordner (tools/ ist dort oder ein Verweis)
P = os.path.abspath(sys.argv[1])
os.chdir(os.path.join(P, 'schnitt'))
model = sys.argv[2] if len(sys.argv) > 2 else 'turbo'
M = {'turbo': ('ggml-large-v3-turbo-q5_0.bin', 'large.v3.turbo'), 'small': ('ggml-small.bin', 'small')}[model]
gaps = [(g['start'], g['end']) for g in json.load(open('analysis/speech-boundaries.json'))['candidates']]
# Dauer der Quelle wie in workflow.json (sourceDuration, von anlegen gemessen); sonst Länge von speech.wav
dur = json.load(open('../workflow.json')).get('sourceDuration')
if not dur:
    w = wave.open('speech.wav'); dur = w.getnframes() / w.getframerate()
# Sprechstuecke = Bereiche zwischen Silero-Luecken ab 0,30 s; sehr kurze Stuecke an den Nachbarn haengen
cuts = [(a, b) for a, b in gaps if b - a >= 0.30]
segs, t = [], 0.0
for a, b in cuts:
    if a > t: segs.append([t, a])
    t = b
if t < dur: segs.append([t, dur])
merged = []
for s in segs:
    if merged and (s[1] - s[0] < 1.0 or merged[-1][1] - merged[-1][0] < 1.0) and s[0] - merged[-1][1] < 0.8:
        merged[-1][1] = s[1]
    else: merged.append(list(s))
json.dump(merged, open('analysis/chunks.json', 'w'))
out = f'analysis/asr-{model}'; os.makedirs(out, exist_ok=True)
PAD = 0.15
def job(i):
    s, e = merged[i]; a = max(0, s - PAD); b = e + PAD
    stem = f'{out}/c{i:03d}'
    subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', 'speech.wav', '-c:a', 'pcm_s16le', stem + '.wav'], check=True)
    subprocess.run([W + '/tools/bin/whisper-cli', '-m', W + '/tools/models/' + M[0], '-f', stem + '.wav', '-l', 'de', '-et', '100', '-lpt', '-100', '-ojf', '-of', stem,
                    '-dtw', M[1], '-nfa', '-t', '3', '--prompt', 'Ähm, also, äh, ich, ich mein, ähm, ja. Hm, äh.'], capture_output=True, text=True)
    j = json.load(open(stem + '.json'))
    return i, a, ' '.join(seg['text'].strip() for seg in j['transcription'])
with ThreadPoolExecutor(3) as ex:
    res = sorted(ex.map(job, range(len(merged))))
json.dump([{'i': i, 'start': merged[i][0], 'end': merged[i][1], 'offset': a, 'text': t} for i, a, t in res], open(out + '/summary.json', 'w'), ensure_ascii=False, indent=1)
for i, a, t in res: print(f'{i:03d} {merged[i][0]:7.2f}-{merged[i][1]:7.2f}  {t}')
