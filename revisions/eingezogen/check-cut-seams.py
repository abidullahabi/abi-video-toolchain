"""Prueft die Schnittnahtstellen eines Schnittprojekts in Ton und Bild.

Aufruf: python3 check-cut-seams.py projects/PROJEKTNAME

Erwartet in workflow.json ein Feld keepIntervals mit den behaltenen Quellintervallen
sowie media.mp4 und speech.wav im Projektordner.

Ton: an jeder Naht darf im Fenster +/-0.03 s keine Sprache liegen. Groessere Fenster
melden Fehlalarme, weil sie bei kurzen Luecken schon ins Nachbarwort reichen.

Bild: Standbild vor und nach der Naht vergleichen. Der untere Bildbereich bleibt
aussen vor, dort liegen die Untertitel und wechseln ohnehin.
"""
from pathlib import Path
import subprocess, json, math, sys, array, wave, tempfile
import numpy as np
from PIL import Image

AUDIO_WINDOW = 0.03      # Sekunden um den Schnittpunkt
FRAME_OFFSET = 0.05      # Abstand der Vergleichsbilder zur Naht
TOP_FRACTION = 0.62      # oberer Bildanteil ohne Untertitelzone
JUMP_VISIBLE = 1.6       # Vielfaches des Medians
JUMP_STRONG = 2.2

project = Path(sys.argv[1]).resolve()
root = project.parent.parent
ff = str(root / 'tools/bin/ffmpeg')
meta = json.loads((project / 'workflow.json').read_text())
keep = meta.get('keepIntervals')
if not keep:
    sys.exit('workflow.json enthaelt keine keepIntervals. Das ist kein Schnittprojekt.')

speech = project / 'speech.wav'
media = project / 'media.mp4'
for f in (speech, media):
    if not f.exists():
        sys.exit(f'Fehlt: {f}')

# Nahtstellen auf der Ausgabezeitachse
seams, pos = [], 0.0
for a, b in keep[:-1]:
    pos += b - a
    seams.append(round(pos, 3))
if not seams:
    print('Nur ein Segment, keine Nahtstellen zu pruefen.')
    sys.exit(0)

# --- Ton -------------------------------------------------------------------
def levels(path):
    w = wave.open(str(path), 'rb')
    samples = array.array('h')
    samples.frombytes(w.readframes(w.getnframes()))
    data = np.asarray(samples, dtype=np.float64)
    win = int(w.getframerate() * 0.02)
    usable = len(data) - len(data) % win
    rms = np.sqrt((data[:usable].reshape(-1, win) ** 2).mean(axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-9) / 32768.0)

level = levels(speech)

# Die Sprachschwelle gehoert aus der UNGESCHNITTENEN Aufnahme bestimmt. Dort ist die
# Pegelverteilung zweigipflig, Raumton unten und Sprache oben. In der geschnittenen
# Fassung ist die Stille weitgehend entfernt, die unteren Perzentile sind dann bereits
# leise Sprache und die Schwelle faellt viel zu hoch aus.
source_speech = None
if meta.get('sourceProject'):
    candidate = root / meta['sourceProject'] / 'speech.wav'
    if candidate.exists():
        source_speech = candidate
basis = levels(source_speech) if source_speech else level
quiet, loud = np.percentile(basis, 20), np.percentile(basis, 70)
threshold = quiet + (loud - quiet) * 0.35
print(f'Sprachschwelle: {threshold:.1f} dBFS (Raumton {quiet:.1f}, Sprache {loud:.1f}, '
      f'bestimmt an {"der Originalaufnahme" if source_speech else "dieser Fassung"})')
if not source_speech:
    print('   Achtung: ohne Originalaufnahme bestimmt, die Schwelle kann zu hoch liegen.')

audio_findings = []
for i, s in enumerate(seams):
    lo = max(0, int((s - AUDIO_WINDOW) / 0.02))
    hi = min(len(level), int((s + AUDIO_WINDOW) / 0.02) + 1)
    peak = float(level[lo:hi].max())
    if peak >= threshold:
        audio_findings.append({'seam': i, 'time': s, 'peakDb': round(peak, 1)})

# --- Bild ------------------------------------------------------------------
diffs = []
with tempfile.TemporaryDirectory() as tmp:
    for i, s in enumerate(seams):
        frames = []
        for tag, t in (('a', max(0, s - FRAME_OFFSET)), ('b', s + FRAME_OFFSET)):
            out = f'{tmp}/s{i:02d}{tag}.png'
            subprocess.run([ff, '-nostdin', '-v', 'error', '-y', '-ss', f'{t:.3f}',
                            '-i', str(media), '-frames:v', '1', '-vf', 'scale=216:384',
                            '-update', '1', out], check=True)
            frames.append(np.asarray(Image.open(out).convert('L'), dtype=np.float32))
        d = np.abs(frames[0] - frames[1])
        diffs.append(float(d[:int(d.shape[0] * TOP_FRACTION)].mean()))

median = float(np.median(diffs))
video_findings = []
for i, (s, d) in enumerate(zip(seams, diffs)):
    ratio = d / median if median > 0 else 0.0
    if ratio >= JUMP_VISIBLE:
        video_findings.append({'seam': i, 'time': s, 'diff': round(d, 2),
                               'ratio': round(ratio, 2),
                               'grade': 'deutlich' if ratio >= JUMP_STRONG else 'sichtbar'})

# --- Bericht ---------------------------------------------------------------
report = {
    'seams': len(seams),
    'speechThresholdDb': round(float(threshold), 1),
    'audioWindowSeconds': AUDIO_WINDOW,
    'audioFindings': audio_findings,
    'videoDiffMedian': round(median, 2),
    'videoDiffMax': round(max(diffs), 2),
    'videoFindings': video_findings,
}
(project / 'review').mkdir(exist_ok=True)
(project / 'review/seam-check.json').write_text(json.dumps(report, indent=2) + '\n')

print(f'\n{len(seams)} Nahtstellen geprueft.')
if audio_findings:
    print(f'TON: {len(audio_findings)} Nahtstellen mit Sprache im Schnittfenster:')
    for f in audio_findings:
        print(f"   Naht {f['seam']:2d} bei {f['time']:6.2f}s: {f['peakDb']} dBFS")
else:
    print('TON: alle Nahtstellen in Stille.')

if median > 0:
    print(f'BILD: Median {median:.2f}, Maximum {max(diffs):.2f} ({max(diffs)/median:.1f}x Median)')
else:
    print('BILD: keine Bewertung moeglich.')
for f in video_findings:
    print(f"   Naht {f['seam']:2d} bei {f['time']:6.2f}s: {f['grade']} ({f['ratio']}x Median)")
if not video_findings:
    print('   Keine auffaelligen Bildspruenge.')

print(f'\nBericht: {project}/review/seam-check.json')
if audio_findings:
    sys.exit(1)
