#!/usr/bin/env python3
"""word-review-turbo nach einer Schnittänderung neu erzeugen: Grenzen aus chunks.json (alte Schnittzeit) über
zeiten-umrechnen.py in die neue Schnittzeit, Ausschnitte aus dem neuen media.mp4, Whisper wie in HERKUNFT.md.
python3 kurzpruefungen-neu.py <schnitt-alt.json> <schnitt-neu.json>"""
import json, sys, os, subprocess
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.dirname(D); W = '/Users/abi/Projekte/abi-video-toolchain'
src = open(os.path.join(D, 'zeiten-umrechnen.py')).read().split('KEYS =')[0]
ARGV = list(sys.argv); g = {'__file__': os.path.join(D, 'zeiten-umrechnen.py')}; sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2]]; exec(src, g); sys.argv = ARGV
TN = float(sys.argv[sys.argv.index('--tempo-neu') + 1]) if '--tempo-neu' in sys.argv else 1.0
um = lambda t: round(g['schnitt'](g['roh'](t)) / TN, 2)
RV = os.path.join(P, 'word-review-turbo'); alt = json.load(open(os.path.join(RV, 'chunks.json')))
neu = [[um(a), um(b)] for a, b in alt]
wav = os.path.join(D, 'tmp', 'cut16k-neu.wav')
subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-i', os.path.join(P, 'media.mp4'), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], check=True)
PROMPT = 'Therapie, Anthony de Mello, The Way to Love, Awareness, Reconciliation, The Untethered Soul, Michael Singer, Gabor Maté, Khalil Gibran, Der Prophet, Hokuspokus, Bonusbuch.'
FUELL = 'Ähm, also, äh, ich, ich mein, ähm, ja.'
for i, (a, b) in enumerate(neu):
    stem = os.path.join(RV, f'part-{i}')
    if b - a < 0.5: print(i, 'entfällt (Bereich herausgeschnitten)'); continue
    subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-to', str(b), '-i', wav, '-c:a', 'pcm_s16le', stem + '.wav'], check=True)
    args = [W + '/tools/bin/whisper-cli', '-m', W + '/tools/models/ggml-large-v3-turbo-q5_0.bin', '-f', stem + '.wav', '-l', 'de', '-ojf', '-of', stem, '-dtw', 'large.v3.turbo', '-nfa', '-t', '6']
    if i == 12: args += ['--prompt', FUELL]
    elif i not in (2, 9, 11): args += ['--prompt', PROMPT]
    subprocess.run(args, check=True, capture_output=True)
    j = json.load(open(stem + '.json')); print(i, a, b, ' '.join(s['text'].strip() for s in j['transcription']))
json.dump(neu, open(os.path.join(RV, 'chunks.json'), 'w'))
with open(os.path.join(RV, 'HERKUNFT.md'), 'a') as f: f.write(f'\nNeu erzeugt nach Schnittänderung ({sys.argv[1]} → {sys.argv[2]}, Nähte gestrafft): Grenzen umgerechnet, gleiche Einstellungen.\n')
