#!/usr/bin/env python3
"""Rechnet die vier Outro-Icons (DESIGN.md Abschnitt 10) als fertige 34x34-Kacheln vor.

Bisher skalierte der Browser 180- bis 4168-px-Bilder auf 26-34 px herunter und faerbte sie
per CSS-Filter weiss. Das ergab ausgefranste Kanten, bei YouTube einen roten Kasten im roten
Kasten und bei LinkedIn einen weissen Rahmen. Hier: weisses Glyph aus dem offiziellen Asset
freistellen, auf die Markenflaeche (Eckenradius 7 px) setzen, alles in 8facher Groesse
rechnen und per Lanczos exakt auf 34x34 bringen. Der Browser zeigt die Kachel 1:1.

  python3 render-social-icons.py <Ordner mit den offiziellen Assets> <Zielordner>
"""
import sys, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
S, K = 34, 8               # Endgroesse, Rechenfaktor
N, R = S * K, 7 * K        # Arbeitsgroesse, Eckenradius

def tile(fill):
    base = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    mask = Image.new('L', (N, N), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, N - 1, N - 1], R, fill=255)
    base.paste(fill if isinstance(fill, Image.Image) else Image.new('RGBA', (N, N), fill), (0, 0), mask)
    return base, mask

def put_glyph(base, mask_tile, glyph_alpha, box):
    """glyph_alpha: float-Array 0..1 in Quellaufloesung; box: Zielrechteck (x, y, w, h) in Arbeitsgroesse."""
    x, y, w, h = [round(v) for v in box]
    g = Image.fromarray((np.clip(glyph_alpha, 0, 1) * 255).astype('uint8'), 'L').resize((w, h), Image.LANCZOS)
    white = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    base.paste(white, (x, y), g)
    base.putalpha(Image.fromarray(np.minimum(np.array(base.getchannel('A')), np.array(mask_tile))))
    return base

def save(img, name):
    small = img.resize((S, S), Image.LANCZOS); p = OUT / name; small.save(p, optimize=True)
    return {'datei': name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}

def arr(name): return np.asarray(Image.open(SRC / name).convert('RGBA')).astype(float) / 255
report = {}

# YouTube: Favicon = rote Play-Flaeche mit weissem Dreieck. Weisses Dreieck freistellen, die
# Hoehe der roten Flaeche entspricht der Kachelhoehe (Proportion Dreieck zu Flaeche bleibt).
a = arr('youtube-icon.png'); white = np.clip((a[..., :3].min(axis=2) - 0.55) / 0.35, 0, 1) * a[..., 3]
ys, xs = np.where(a[..., 3] > 0.5); by0, by1 = ys.min(), ys.max() + 1; bx0, bx1 = xs.min(), xs.max() + 1
k = N / (by1 - by0); cx = (bx0 + bx1) / 2; cy = (by0 + by1) / 2
ty, tx = np.where(white > 0.02); gy0, gy1, gx0, gx1 = ty.min(), ty.max() + 1, tx.min(), tx.max() + 1
g = white[gy0:gy1, gx0:gx1]
base, m = tile((255, 0, 0, 255))
report['youtube'] = {**save(put_glyph(base, m, g, (N / 2 + (gx0 - cx) * k, N / 2 + (gy0 - cy) * k, (gx1 - gx0) * k, (gy1 - gy0) * k)), 'tile-youtube.png'),
                     'quelle': 'youtube-icon.png (brand.youtube Favicon)', 'glyph': 'weisses Dreieck, Proportion zur roten Flaeche erhalten'}
# TikTok: offizielles schwarzes Quadrat, weisser Notenkern = Pixel, die in allen Kanaelen hell sind.
a = arr('tiktok-icon.png'); g = np.clip((a[..., :3].min(axis=2) - 0.45) / 0.4, 0, 1)
base, m = tile((0, 0, 0, 255))
report['tiktok'] = {**save(put_glyph(base, m, g, (0, 0, N, N)), 'tile-tiktok.png'),
                    'quelle': 'tiktok-icon.png (TikTok_Icon_Black_Square)', 'glyph': 'weisser Kern der Note, Lage im Quadrat erhalten'}
# Instagram: Glyph = Alphakanal des offiziellen Logos, auf diagonalem Verlauf des offiziellen Farbsatzes, 26/34 der Kachel.
a = arr('instagram-icon.png'); g = a[..., 3]
stops = [(0, (255, 214, 0)), (.25, (255, 122, 0)), (.5, (255, 0, 105)), (.75, (211, 0, 197)), (1, (118, 56, 250))]
yy, xx = np.mgrid[0:N, 0:N] / (N - 1); ang = np.deg2rad(35)
t = np.clip(((xx - .5) * np.sin(ang) - (yy - .5) * np.cos(ang)) / (abs(np.sin(ang)) + abs(np.cos(ang))) + .5, 0, 1)
grad = np.zeros((N, N, 4)); grad[..., 3] = 255
for c in range(3): grad[..., c] = np.interp(t, [s for s, _ in stops], [col[c] for _, col in stops])
base, m = tile(Image.fromarray(grad.astype('uint8'), 'RGBA'))
off = N * 4 / 34
report['instagram'] = {**save(put_glyph(base, m, g, (off, off, N - 2 * off, N - 2 * off)), 'tile-instagram.png'),
                       'quelle': 'instagram-icon.png (instagram.com)', 'glyph': 'Alphakanal, 26 von 34 px wie bisher'}
# LinkedIn: offizieller Bug = blaue Flaeche, das "in" ist ausgestanzt (transparent), rechts das (R).
# Innenflaeche je Zeile zwischen erstem und letztem deckenden Pixel; dort ist das Glyph = 1 - Alpha.
a = arr('linkedin-in-blue.png'); h = a.shape[0]; sq = a[:, :h]; al = sq[..., 3]
inside = np.zeros_like(al)
for r in range(h):
    cols = np.where(al[r] > 0.5)[0]
    if len(cols): inside[r, cols.min():cols.max() + 1] = 1
g = inside * (1 - al)
base, m = tile((10, 102, 194, 255))
report['linkedin'] = {**save(put_glyph(base, m, g, (0, 0, N, N)), 'tile-linkedin.png'),
                      'quelle': 'linkedin-in-blue.png (LI-In-Bug)', 'glyph': 'weisses "in", Lage in der quadratischen Flaeche erhalten'}
json.dump({'erzeugt': 'render-social-icons.py', 'groesse': '34x34, Eckenradius 7', 'tiles': report}, open(OUT / 'social-icons.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(report, ensure_ascii=False, indent=1))
