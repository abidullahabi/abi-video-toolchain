#!/usr/bin/env python3
# Freistellung für Grafik mit Green Screen nach DESIGN.md 2.0 Abschnitt 11:
# Robust Video Matting (rvm_mobilenetv3_fp32.onnx, v1.0.0), downsample_ratio 0,25 bei 1080 × 1920,
# ein durchgehender rekurrenter Zustand über den ganzen Abschnitt, 20 Bilder Vorlauf zum Einschwingen.
# Statue bleibt im Bild (keine Nachbearbeitung der Maske). Kontur Tinte #111111, 6 px um die Person.
# Ausgabe: ProRes 4444 mit Alpha (yuva444p10le), bildgenau ab Abschnittsbeginn, dazu Prüfbilder.
#
#   python3 rvm-matting.py --start 138.84 --end 147.48 --model <rvm.onnx> [--out person-etf.mov]
import argparse, json, subprocess, sys, time
from pathlib import Path
import numpy as np
import onnxruntime as ort

W, H, FPS = 1080, 1920, 30
INK = np.array([0x11, 0x11, 0x11], dtype=np.float32)
ROOT = Path(__file__).resolve().parent
FF = ROOT.parents[1] / 'tools/bin/ffmpeg'

ap = argparse.ArgumentParser()
ap.add_argument('--start', type=float, required=True)
ap.add_argument('--end', type=float, required=True)
ap.add_argument('--model', required=True)
ap.add_argument('--media', default=str(ROOT / 'media.mp4'))
ap.add_argument('--out', default=str(ROOT / 'person-etf.mov'))
ap.add_argument('--warmup', type=int, default=20)
ap.add_argument('--ratio', type=float, default=0.25)
ap.add_argument('--contour', type=int, default=6)
ap.add_argument('--checks', default=str(ROOT / 'review/matting'))
a = ap.parse_args()

first = round(a.start * FPS)            # erstes Bild des Abschnitts
last = round(a.end * FPS)               # erstes Bild nach dem Abschnitt
pre = min(a.warmup, first)
n_total = last - first + pre

# Dekodieren wie die Hauptebene (ffmpeg-Standardumrechnung), damit Person und übriges Video gleich aussehen.
dec = subprocess.Popen([str(FF), '-v', 'error', '-ss', f'{(first - pre) / FPS:.6f}', '-i', a.media,
                        '-frames:v', str(n_total), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                       stdout=subprocess.PIPE)
enc = subprocess.Popen([str(FF), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                        '-framerate', str(FPS), '-i', '-', '-c:v', 'prores_ks', '-profile:v', '4444',
                        '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', a.out],
                       stdin=subprocess.PIPE)

sess = ort.InferenceSession(a.model, providers=['CPUExecutionProvider'])
rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
ratio = np.array([a.ratio], dtype=np.float32)

# Kreisförmige Dilatation (Radius = Konturbreite) als Maximum über verschobene Kopien, weiche Kante bleibt erhalten.
r = a.contour
offsets = [(dy, dx) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dy * dy + dx * dx <= r * r + r]
def dilate(alpha):
    out = alpha.copy()
    for dy, dx in offsets:
        ys, yd = (slice(dy, None), slice(0, -dy or None)) if dy >= 0 else (slice(0, dy), slice(-dy, None))
        xs, xd = (slice(dx, None), slice(0, -dx or None)) if dx >= 0 else (slice(0, dx), slice(-dx, None))
        np.maximum(out[yd, xd], alpha[ys, xs], out=out[yd, xd])
    return out

Path(a.checks).mkdir(parents=True, exist_ok=True)
stats, t0 = [], time.time()
for i in range(n_total):
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        sys.exit(f'Zu wenige Bilder dekodiert: {i} von {n_total}')
    rgb = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)
    src = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
    fgr, pha, *rec = sess.run(None, {'src': src, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3],
                                      'downsample_ratio': ratio})
    if i < pre:
        continue                         # Vorlauf: nur Zustand einschwingen lassen
    alpha = np.clip(pha[0, 0], 0, 1).astype(np.float32)
    ring = dilate(alpha)                 # Person plus 6 px Rand
    # Farbe: innen Originalbild, im Randbereich Tinte; Deckkraft = erweiterte Maske.
    col = rgb.astype(np.float32) * alpha[..., None] + INK * (ring - alpha)[..., None]
    col = np.where(ring[..., None] > 1e-4, col / np.maximum(ring[..., None], 1e-4), 0)
    rgba = np.dstack([np.clip(col + .5, 0, 255).astype(np.uint8), np.clip(ring * 255 + .5, 0, 255).astype(np.uint8)])
    enc.stdin.write(rgba.tobytes())
    k = i - pre
    stats.append({'frame': first + k, 'deckung': round(float(alpha.mean()), 4)})
    if k % 45 == 0 or k == last - first - 1:
        from PIL import Image
        Image.fromarray(rgba, 'RGBA').save(Path(a.checks) / f'person-{first + k:05d}.png')
enc.stdin.close(); enc.wait(); dec.wait()
if enc.returncode:
    sys.exit('Kodierung fehlgeschlagen')
json.dump({'modell': Path(a.model).name, 'downsample_ratio': a.ratio, 'vorlauf': pre, 'erstesBild': first,
           'bilder': last - first, 'start': first / FPS, 'ende': last / FPS, 'kontur_px': a.contour,
           'ausgabe': Path(a.out).name, 'dauer_s': round(time.time() - t0, 1), 'deckung': stats},
          open(Path(a.checks) / 'matting-report.json', 'w'), indent=1)
print(f'{last - first} Bilder freigestellt in {time.time() - t0:.0f} s → {a.out}')
