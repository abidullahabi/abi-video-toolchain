#!/usr/bin/env python3
"""Freistellung für „Grafik mit Green Screen" nach DESIGN.md Abschnitt 11 (Version 2.2).

Je Grafikabschnitt aus theme-plan.json (grafiken[].start/end/person) entsteht eine eigene Personenebene mit Alpha:
Robust Video Matting, Modell tools/models/rvm_mobilenetv3_fp32.onnx (v1.0.0), downsample_ratio 0,25 bei 1080 × 1920,
ein durchgehender rekurrenter Zustand über den ganzen Abschnitt, 20 Bilder Vorlauf zum Einschwingen, keine
Einzelbild-Freistellung. Die Statue bleibt im Bild (Maske unverändert). Kontur Tinte #111111, 6 px um die Person.
Ausgabe: ProRes 4444 (yuva444p10le) im Projekt, bildgenau ab Abschnittsbeginn, dazu Prüfbilder und ein Bericht.

Aufruf (über die eigene Python-Umgebung mit onnxruntime):
  tools/venv-rvm/bin/python green-screen-maske.py "<Projektordner>" [--nur <grafik-id>]
  node workflow.mjs green-screen "<Projektordner>"
  … --kopfprofil   misst zusätzlich über das ganze Video alle 0,5 s die Box aus Kopf und Kappe aus der Personenmaske
                   (review/kopf-profil.json). Abschnitt 12 verlangt für die Randnotiz den Platz aus der Personenmaske,
                   Kappe eingeschlossen; Vorlage und Prüfung nutzen die Datei statt der Schätzung aus der Gesichtserkennung.
"""
import argparse, hashlib, json, subprocess, sys, time
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
FF = ROOT / 'tools/bin/ffmpeg'
MODEL = ROOT / 'tools/models/rvm_mobilenetv3_fp32.onnx'
MODEL_SHA = '88d4531297118f595bf2fd60f6f566aec2e559393802d1f436c380f0cbbd2828'
W, H, FPS = 1080, 1920, 30
INK = np.array([0x11, 0x11, 0x11], dtype=np.float32)
RATIO, WARMUP, CONTOUR = 0.25, 20, 6          # DESIGN.md 11


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def disk_offsets(r):
    return [(dy, dx) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dy * dy + dx * dx <= r * r + r]


def dilate(alpha, offsets):
    """Kreisförmige Dilatation als Maximum über verschobene Kopien; die weiche Kante bleibt erhalten."""
    out = alpha.copy()
    for dy, dx in offsets:
        ys, yd = (slice(dy, None), slice(0, -dy or None)) if dy >= 0 else (slice(0, dy), slice(-dy, None))
        xs, xd = (slice(dx, None), slice(0, -dx or None)) if dx >= 0 else (slice(0, dx), slice(-dx, None))
        np.maximum(out[yd, xd], alpha[ys, xs], out=out[yd, xd])
    return out


def matte(project, g, sess, offsets):
    first, last = round(g['start'] * FPS), round(g['end'] * FPS)
    pre = min(WARMUP, first)
    n = last - first + pre
    out = project / g['person']
    checks = project / 'review' / 'green-screen' / g['id']
    checks.mkdir(parents=True, exist_ok=True)
    # Dekodieren mit der ffmpeg-Standardumrechnung wie die Videoebene, damit Person und übriges Video gleich aussehen.
    dec = subprocess.Popen([str(FF), '-v', 'error', '-ss', f'{(first - pre) / FPS:.6f}', '-i', str(project / 'media.mp4'),
                            '-frames:v', str(n), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen([str(FF), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                            '-framerate', str(FPS), '-i', '-', '-c:v', 'prores_ks', '-profile:v', '4444',
                            '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', str(out)], stdin=subprocess.PIPE)
    rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
    ratio = np.array([RATIO], dtype=np.float32)
    cover, t0 = [], time.time()
    for i in range(n):
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            sys.exit(f'{g["id"]}: nur {i} von {n} Bildern dekodiert')
        rgb = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)
        src = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        _, pha, *rec = sess.run(None, {'src': src, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3], 'downsample_ratio': ratio})
        if i < pre:
            continue                                   # Vorlauf: Zustand einschwingen lassen
        a = np.clip(pha[0, 0], 0, 1).astype(np.float32)
        ring = dilate(a, offsets)                      # Person plus 6 px Kontur
        col = rgb.astype(np.float32) * a[..., None] + INK * (ring - a)[..., None]
        col = np.where(ring[..., None] > 1e-4, col / np.maximum(ring[..., None], 1e-4), 0)
        rgba = np.dstack([np.clip(col + .5, 0, 255).astype(np.uint8), np.clip(ring * 255 + .5, 0, 255).astype(np.uint8)])
        enc.stdin.write(rgba.tobytes())
        k = i - pre
        cover.append(round(float(a.mean()), 4))
        if k % 45 == 0 or k == last - first - 1:
            from PIL import Image
            Image.fromarray(rgba, 'RGBA').save(checks / f'person-{first + k:05d}.png')
    enc.stdin.close(); enc.wait(); dec.wait()
    if enc.returncode:
        sys.exit(f'{g["id"]}: Kodierung fehlgeschlagen')
    # Wackeln an den Kanten grob messen: mittlere Änderung der Deckung von Bild zu Bild.
    jitter = float(np.mean(np.abs(np.diff(cover)))) if len(cover) > 1 else 0.0
    return {'id': g['id'], 'datei': g['person'], 'sha256': sha256(out), 'erstesBild': first, 'bilder': last - first,
            'start': first / FPS, 'ende': last / FPS, 'vorlauf': pre, 'sekunden': round(time.time() - t0, 1),
            'deckungMittel': round(float(np.mean(cover)), 4), 'deckungSprungMittel': round(jitter, 5)}


def kopfprofil(project, sess):
    """Box aus Kopf und Kappe je 0,5 s aus der RVM-Maske (gleiche Einstellungen, ein Zustand über das ganze Video)."""
    faces = json.load(open(project / 'review' / 'source-faces.json'))
    by_frame = {round(f['time'] * FPS): f for f in faces}
    dur = json.load(open(project / 'workflow.json'))['cutDuration']
    n = int(dur * FPS)
    dec = subprocess.Popen([str(FF), '-v', 'error', '-i', str(project / 'media.mp4'), '-frames:v', str(n),
                            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
    ratio = np.array([RATIO], dtype=np.float32)
    out, t0 = [], time.time()
    for i in range(n):
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        src = (np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        _, pha, *rec = sess.run(None, {'src': src, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3], 'downsample_ratio': ratio})
        f = by_frame.get(i)
        if not f or not f.get('faces'):
            continue
        m = pha[0, 0] > 0.5
        boxes = []
        for q in f['faces']:
            x0, x1 = int(max(0, q['x'] - 0.8 * q['width'])), int(min(W, q['x'] + 1.8 * q['width']))
            y1 = int(min(H, q['y'] + q['height']))
            reg = m[:y1, x0:x1]
            rows = np.where(reg.sum(axis=1) >= 3)[0]
            if not len(rows):
                continue
            top = int(rows[0])
            cols = np.where(reg[top:y1].any(axis=0))[0]
            boxes.append({'x': x0 + int(cols[0]), 'y': top, 'width': int(cols[-1] - cols[0] + 1), 'height': y1 - top})
        out.append({'time': f['time'], 'faces': boxes})
        if i % 900 == 0:
            print(f'Kopfprofil {i / FPS:.0f} s …', flush=True)
    dec.wait()
    json.dump({'grundlage': 'RVM-Personenmaske (DESIGN.md 11/12), Schwelle 0,5; Box = oberster Maskenpunkt über dem Gesicht bis Gesichtsunterkante, seitlich die Maske in diesem Band',
               'sekunden': round(time.time() - t0, 1), 'proben': out}, open(project / 'review' / 'kopf-profil.json', 'w'), indent=1)
    print(f'Kopfprofil: {len(out)} Proben in {time.time() - t0:.0f} s → review/kopf-profil.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--nur')
    ap.add_argument('--kopfprofil', action='store_true')
    a = ap.parse_args()
    project = Path(a.project).resolve()
    plan = json.load(open(project / 'theme-plan.json')) if (project / 'theme-plan.json').exists() else {}
    grafiken = [g for g in plan.get('grafiken', []) if not a.nur or g['id'] == a.nur]
    if not MODEL.exists() or sha256(MODEL) != MODEL_SHA:
        sys.exit(f'Modell fehlt oder Prüfsumme weicht ab: {MODEL}')
    import onnxruntime as ort
    sess = ort.InferenceSession(str(MODEL), providers=['CPUExecutionProvider'])
    if a.kopfprofil:
        kopfprofil(project, sess)
        return
    if not grafiken:
        print('Keine Grafikabschnitte im Plan.'); return
    offsets = disk_offsets(CONTOUR)
    report = {'werkzeug': 'Robust Video Matting v1.0.0 (rvm_mobilenetv3_fp32.onnx)', 'modellSha256': MODEL_SHA,
              'onnxruntime': ort.__version__, 'downsample_ratio': RATIO, 'vorlaufBilder': WARMUP, 'kontur_px': CONTOUR,
              'grundlage': 'DESIGN.md 2.2 Abschnitt 11', 'abschnitte': []}
    for g in grafiken:
        r = matte(project, g, sess, offsets)
        report['abschnitte'].append(r)
        print(f"{g['id']}: {r['bilder']} Bilder in {r['sekunden']} s → {g['person']}")
    (project / 'review' / 'green-screen').mkdir(parents=True, exist_ok=True)
    json.dump(report, open(project / 'review' / 'green-screen' / 'bericht.json', 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
