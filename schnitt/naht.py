#!/usr/bin/env python3
"""Nahtprüfung: zwei Rohzeit-Stücke aus <Projekt>/schnitt/speech.wav zusammensetzen und erkennen lassen
(turbo mit Füllwort-Prompt und small mit demselben Prompt, wie chunk-asr.py), damit Doppelanläufe, verschluckte
Silben und abgehackte Wörter an der Naht hörbar werden.
node workflow.mjs schnitt-naht "<Projekt>" <a1> <b1> <a2> <b2>
(python3 schnitt/naht.py <Projektordner> <a1> <b1> <a2> <b2>)  → schnitt/tmp/naht-<a1>-<b2>.wav"""
import os, sys, subprocess
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.join(os.path.abspath(sys.argv[1]), 'schnitt'))
a1, b1, a2, b2 = map(float, sys.argv[2:6])
if not (b1 > a1 and b2 > a2): sys.exit('Bitte zwei Bereiche <a1> <b1> <a2> <b2> mit a < b angeben (Rohzeit, Sekunden).')
os.makedirs('tmp', exist_ok=True)
out = f'tmp/naht-{a1:.2f}-{b2:.2f}.wav'
fc = f'[0]atrim={a1:.4f}:{b1:.4f},asetpts=N/SR/TB[s0];[0]atrim={a2:.4f}:{b2:.4f},asetpts=N/SR/TB[s1];[s0][s1]concat=n=2:v=0:a=1'
subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-i', 'speech.wav', '-filter_complex', fc, '-c:a', 'pcm_s16le', out], check=True)
PROMPT = 'Ähm, also, äh, ich, ich mein, ähm, ja. Hm, äh.'
print(f'Naht bei {b1 - a1:.2f} s im Ausschnitt ({a1:.2f}–{b1:.2f} | {a2:.2f}–{b2:.2f}, zusammen {b1 - a1 + b2 - a2:.2f} s): schnitt/{out}')
for name, datei in (('turbo', 'ggml-large-v3-turbo-q5_0.bin'), ('small', 'ggml-small.bin')):
    r = subprocess.run([W + '/tools/bin/whisper-cli', '-m', W + '/tools/models/' + datei, '-f', out, '-l', 'de', '--prompt', PROMPT, '-nt', '-t', '6'], capture_output=True, text=True)
    if r.returncode != 0: sys.exit(f'whisper-cli ({name}) fehlgeschlagen: {r.stderr[-500:]}')
    print(f'{name:5}: ' + ' '.join(l.strip() for l in r.stdout.splitlines() if l.strip()))
