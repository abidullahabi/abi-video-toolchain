#!/usr/bin/env python3
"""Kamerabild fuer die Gestaltung in EINEM Durchgang aus der 4K-Originalaufnahme
(Muster: Angst-vor-Arbeiten build-graded-media.py, hier mit Zeitstempel-Auswahl wegen VFR-Quelle):
Schnitt (edl.json des Schnittprojekts, Bild nach echten Zeitstempeln) -> 1,1-fach -> 1080x1920 (lanczos)
-> Farbkorrektur A (DESIGN.md 16) -> x264 CRF 10.
Ton: exports/cut-audio.wav des Schnittprojekts (48 kHz Originalton, inkl. gedehntem 'Ng') -> atempo 1,1 -> AAC 320k.
"""
import json, subprocess, sys
from pathlib import Path
T = Path('/Users/abi/Projekte/abi-video-toolchain'); FF = T / 'tools/bin/ffmpeg'
CUT = T / 'projects/KI-Zertifikate-Schnitt-2026-09-27'
SPEED = 1.1
keep = [(k['start'], k['end']) for k in json.load(open(CUT / 'edl.json'))['keep']]
GRADE_A = ("eq=gamma=0.96:saturation=1.12:brightness=-0.015,"
           "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=gbrp,"
           "colorbalance=rm=0.03:gm=0.005:bm=-0.03:rh=0.01:bh=-0.02,curves=all='0/0 0.5/0.49 1/0.95',"
           "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p")
eps = 0.001; sel, off, out_t = [], [], 0.0
for a, b in keep:
    c = f'gte(t,{a - eps:.6f})*lt(t,{b - eps:.6f})'
    sel.append(c); off.append(f"{c.replace('(t,', '(T,')}*{a - out_t:.6f}"); out_t += b - a
cut_dur = out_t; dur = cut_dur / SPEED
vf = (f"[0:v:0]select='{'+'.join(sel)}',setpts='(PTS-({'+'.join(off)})/TB)/{SPEED}',fps=30,"
      f"scale=1080:1920:flags=lanczos,{GRADE_A}[vout];"
      f"[1:a:0]atempo={SPEED},asetpts=PTS-STARTPTS,aresample=48000[aout]")
Path('media-filter.txt').write_text(vf)
out = Path('media.mp4')
if out.exists(): sys.exit('media.mp4 existiert bereits, nicht ueberschrieben')
r = subprocess.run([str(FF), '-hide_banner', '-nostdin', '-n', '-i', str(CUT / 'sources/IMG_1967.MOV'), '-i', str(CUT / 'exports/cut-audio.wav'),
    '-filter_complex_script', 'media-filter.txt', '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-t', f'{dur:.6f}', str(out)],
    stdout=open('logs/media.log', 'w'), stderr=subprocess.STDOUT)
if r.returncode: sys.exit('ffmpeg fehlgeschlagen, logs/media.log')
print(json.dumps({'media': str(out), 'cutDuration1x': round(cut_dur, 3), 'duration': round(dur, 3)}))
