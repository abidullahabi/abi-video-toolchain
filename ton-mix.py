"""Soundeffekte in den Ton von media.mp4 mischen (DESIGN.md 17, nur auf ausdrücklichen Testauftrag; Abdullah 12.10.2026, HHU Rating).

Eingabe: design-plan.json "sounds": [{"datei": "assets/sounds/…", "at": Sekunden, "db": −11, "zweck": "…"}].
Pegel je Effekt: Effektivwert des Effekts (Bereich bis 40 dB unter seiner Spitze) liegt "db" (Standard −11, DESIGN.md: 10 bis
12 dB leiser) unter dem Effektivwert der Stimme in 1,5 s um den Einsatz (nur Sprachabschnitte, bis 30 dB unter dem lautesten).
Ausgabe: ton-mix.wav (48 kHz, Stereo, PCM 24 bit, gleiche Länge wie media.mp4) und review/ton-mix.json mit Zeit und Pegel je
Effekt. Die Datei wird nur neu geschrieben, wenn sich der Inhalt ändert.
Aufruf: python3 ton-mix.py <Projekt>
"""
from pathlib import Path
import subprocess, json, hashlib, sys
import numpy as np

p = Path(sys.argv[1]).resolve(); root = Path(__file__).resolve().parent; ff = str(root / 'tools/bin/ffmpeg'); SR = 48000
plan = json.loads((p / 'design-plan.json').read_text()); sounds = plan.get('sounds') or []
def lade(f):
    raw = subprocess.check_output([ff, '-v', 'error', '-i', str(f), '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).astype(np.float64)
def rms_aktiv(x, unter):
    n = int(0.02 * SR); m = x.mean(1)[: len(x) // n * n].reshape(-1, n); r = np.sqrt((m ** 2).mean(1) + 1e-20)
    db = 20 * np.log10(r); aktiv = r[db > db.max() - unter]
    return float(np.sqrt((aktiv ** 2).mean()))
stimme = lade(p / 'media.mp4'); mix = stimme.copy(); bericht = []
for s in sounds:
    f = p / s['datei']
    if not s['datei'].startswith('assets/') or not f.exists(): sys.exit(f'Sound fehlt oder liegt nicht unter assets/: {s["datei"]}')
    fx = lade(f); a = int(round(s['at'] * SR)); db = float(s.get('db', -11))
    if not (-16 <= db <= -10): sys.exit(f'Sound {s["datei"]} bei {s["at"]} s: {db} dB außerhalb −16 bis −10 (DESIGN.md 17)')
    fenster = stimme[max(0, a - int(0.75 * SR)): a + int(0.75 * SR)]
    v = rms_aktiv(fenster, 30); e = rms_aktiv(fx, 40); g = v / e * 10 ** (db / 20)
    seg = fx[: max(0, len(mix) - a)] * g; mix[a: a + len(seg)] += seg
    bericht.append({'datei': s['datei'], 'at': s['at'], 'zweck': s.get('zweck'), 'dbUnterStimme': db, 'verstaerkungDb': round(20 * np.log10(g), 2),
                    'stimmeRmsDb': round(20 * np.log10(v), 2), 'effektRmsDb': round(20 * np.log10(e), 2), 'dauer': round(len(fx) / SR, 3)})
spitze = float(np.abs(mix).max())
if spitze > 0.98: mix *= 0.98 / spitze   # nie hart übersteuern (kommt bei −11 dB praktisch nicht vor)
pcm = mix.astype('<f4').tobytes(); h = hashlib.sha256(pcm).hexdigest()
ziel = p / 'ton-mix.wav'; alt = p / 'review/ton-mix.json'
if not (ziel.exists() and alt.exists() and json.loads(alt.read_text()).get('pcmSha256') == h):
    subprocess.run([ff, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', str(ziel)], input=pcm, check=True)
(p / 'review').mkdir(exist_ok=True)
alt.write_text(json.dumps({'quelle': 'media.mp4', 'ausgabe': 'ton-mix.wav', 'pcmSha256': h, 'spitzeVorher': round(spitze, 4), 'gedaempft': spitze > 0.98, 'sounds': bericht, 'hoerpruefung': False}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'sounds': len(bericht), 'spitze': round(spitze, 3)}))
