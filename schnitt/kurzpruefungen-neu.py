#!/usr/bin/env python3
"""word-review-turbo nach einer Schnitt- oder Tempoänderung neu erzeugen (Vorbild Bücher die so gut sind wie Therapie
04.10.2026): Grenzen aus word-review-turbo/chunks.json (alte Planzeit) über schnitt/vorher.json in die neue Zeit, Ausschnitte
aus dem neuen media.mp4, Whisper turbo wie in HERKUNFT.md. Vorgabe je Teil aus word-review-turbo/prompts.json
{"standard": "<Vorgabe>" | null, "teile": {"<i>": "<Vorgabe>" | null}}; fehlt sie, wird sie aus HERKUNFT.md gelesen und als
prompts.json abgelegt. Teile, deren Bereich herausgeschnitten ist, entfallen (Dateien nach word-review-turbo/entfallen/).
Aufruf über node workflow.mjs schnitt-umstellen "<Projekt>".
python3 schnitt/kurzpruefungen-neu.py <Projektordner> [--probe]"""
import json, sys, os, re, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zeiten import lade
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.abspath(sys.argv[1]); Z = lade(P); um = Z.um
RV = os.path.join(P, 'word-review-turbo'); alt = json.load(open(os.path.join(RV, 'chunks.json')))
neu = [[um(a), um(b)] for a, b in alt]

def zahlen(s):   # „0,1,3–8,10“ / „2 und 9“ → {0, 1, 3, …}
    out = set()
    for teil in re.split(r'\s*(?:,|und)\s*', s.strip()):
        m = re.fullmatch(r'(\d+)\s*[–-]\s*(\d+)', teil)
        if m: out.update(range(int(m[1]), int(m[2]) + 1))
        elif teil.isdigit(): out.add(int(teil))
    return out
def aus_herkunft(text):
    t = re.sub(r'\s+', ' ', text)
    m = re.search(r'--prompt „([^“]+)“', t)
    v = {'_quelle': 'aus word-review-turbo/HERKUNFT.md gelesen (kurzpruefungen-neu.py); bei Bedarf hier ändern', 'standard': m[1] if m else None, 'teile': {}}
    for m in re.finditer(r'Teile ((?:\d+(?:\s*[–-]\s*\d+)?(?:\s*(?:,|und)\s*)?)+) ohne Vorgabe', t):
        for i in zahlen(m[1]): v['teile'][str(i)] = None
    for m in re.finditer(r'Teil (\d+)\b([^„.]*?)(?:ohne Vorgabe|Vorgabe „([^“]+)“)', t):
        v['teile'][m[1]] = m[3] if m[3] else None
    return v
pf = os.path.join(RV, 'prompts.json')
if os.path.exists(pf): V = json.load(open(pf)); quelle = 'prompts.json'
elif os.path.exists(os.path.join(RV, 'HERKUNFT.md')):
    V = aus_herkunft(open(os.path.join(RV, 'HERKUNFT.md')).read()); quelle = 'HERKUNFT.md'
    if '--probe' not in sys.argv: json.dump(V, open(pf, 'w'), indent=1, ensure_ascii=False)
else: sys.exit('word-review-turbo: weder prompts.json noch HERKUNFT.md – Vorgaben je Teil in prompts.json festlegen.')
vorgabe = lambda i: V['teile'][str(i)] if str(i) in V.get('teile', {}) else V.get('standard')
print(f'Vorgaben aus {quelle}: Standard {"„" + V["standard"][:50] + "…“" if V.get("standard") else "keine"}; je Teil ' + ', '.join(f'{k}: {"keine" if x is None else "„" + x[:25] + "…“"}' for k, x in sorted(V.get('teile', {}).items(), key=lambda kv: int(kv[0]))))
if '--probe' in sys.argv:
    for i, (a, b) in enumerate(neu): print(i, alt[i], '→', [a, b], 'entfällt' if b - a < 0.5 else '')
    sys.exit(0)
media = os.path.join(P, 'media.mp4')
if not os.path.exists(media): sys.exit('media.mp4 fehlt (erst vorbereiten).')
os.makedirs(os.path.join(P, 'schnitt/tmp'), exist_ok=True)
wav = os.path.join(P, 'schnitt/tmp/cut16k-neu.wav')
subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-i', media, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], check=True)
entfallen = []
for i, (a, b) in enumerate(neu):
    stem = os.path.join(RV, f'part-{i}')
    if b - a < 0.5:
        entfallen.append(i); os.makedirs(os.path.join(RV, 'entfallen'), exist_ok=True)
        for ext in ('.json', '.txt', '.wav'):
            if os.path.exists(stem + ext): shutil.move(stem + ext, os.path.join(RV, 'entfallen', f'part-{i}{ext}'))
        print(i, 'entfällt (Bereich herausgeschnitten)'); continue
    subprocess.run([W + '/tools/bin/ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-to', str(b), '-i', wav, '-c:a', 'pcm_s16le', stem + '.wav'], check=True)
    args = [W + '/tools/bin/whisper-cli', '-m', W + '/tools/models/ggml-large-v3-turbo-q5_0.bin', '-f', stem + '.wav', '-l', 'de', '-ojf', '-of', stem, '-dtw', 'large.v3.turbo', '-nfa', '-t', '6']
    if vorgabe(i): args += ['--prompt', vorgabe(i)]
    subprocess.run(args, check=True, capture_output=True)
    j = json.load(open(stem + '.json')); print(i, a, b, ' '.join(s['text'].strip() for s in j['transcription']))
json.dump(neu, open(os.path.join(RV, 'chunks.json'), 'w'))
with open(os.path.join(RV, 'HERKUNFT.md'), 'a') as f:
    f.write(f'\nNeu erzeugt nach Schnitt-/Tempoänderung (schnitt/vorher.json, Tempo {Z.ta:g} → schnitt.json, Tempo {Z.tn:g}; node workflow.mjs schnitt-umstellen): Grenzen umgerechnet, gleiche Einstellungen, Vorgaben aus {quelle}'
            + (f'; entfallen: Teile {", ".join(map(str, entfallen))}' if entfallen else '') + '.\n')
