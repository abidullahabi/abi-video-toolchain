#!/usr/bin/env python3
"""Erzeugt das Kamerabild fuer die Gestaltung in EINEM Durchgang aus der Originalaufnahme:
Schnittliste (edl.json des Schnittprojekts) -> 1,1-fach -> Farbvariante A -> x264 CRF 10.
Gleiche Zeitlogik wie build-edl.py + Tempo-Schritt (select nach Bildnummer, setpts/1.1, fps=30),
damit Untertitel und Einblendzeiten der bisherigen media.mp4 unveraendert gelten.
Farbe: eq im YUV-Raum, colorbalance/curves im RGB-Raum mit ausdruecklicher BT.709-Matrix.
"""
import json, subprocess, sys
from pathlib import Path
CUT = Path(sys.argv[1]); OUT = Path(sys.argv[2])
FF = CUT.parents[1] / 'tools/bin/ffmpeg'
blocks = {b['id']: b for b in json.load(open(CUT / 'blocks.json'))}
edl = json.load(open(CUT / 'edl.json'))
pieces = []
for k in edl['order']:
    if isinstance(k, str):
        a, b = edl['split'][k]; a, b = round(a * 30), round(b * 30)
        if k.endswith('a'): a = blocks[int(k[:-1])]['startFrame']
        if k.endswith('b'): b = blocks[int(k[:-1])]['endFrame']
        if k.endswith('end'): a = blocks[int(k[:-3])]['startFrame']
    else:
        a, b = blocks[k]['startFrame'], blocks[k]['endFrame']
    if pieces and pieces[-1][1] == a: pieces[-1][1] = b
    else: pieces.append([a, b])
GRADE_A = ("eq=gamma=0.96:saturation=1.12:brightness=-0.015,"
           "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=gbrp,"
           "colorbalance=rm=0.03:gm=0.005:bm=-0.03:rh=0.01:bh=-0.02,curves=all='0/0 0.5/0.49 1/0.95',"
           "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p")
parts = []
for i, (a, b) in enumerate(pieces):
    d = (b - a) / 30
    parts.append(f"[0:v:0]select='between(n,{a},{b-1})',setpts=N/(30*TB)[v{i}]")
    fo = 0.08 if i == len(pieces) - 1 else 0.005  # Videoende: weiche Ausblendung (v3)
    parts.append(f"[0:a:0]atrim=start_sample={a*1470}:end_sample={b*1470},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={d-fo:.6f}:d={fo}[a{i}]")
parts.append(''.join(f'[v{i}][a{i}]' for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=1[vc][ac]")
parts.append(f"[vc]setpts=(PTS-STARTPTS)/1.1,fps=30,{GRADE_A}[vout]")
parts.append("[ac]atempo=1.1,asetpts=PTS-STARTPTS,aresample=48000[aout]")
Path('graded-filter.txt').write_text(';\n'.join(parts))
if OUT.exists(): sys.exit(f'{OUT} existiert')
r = subprocess.run([str(FF), '-hide_banner', '-nostdin', '-n', '-i', str(CUT / 'source.mov'), '-filter_complex_script', 'graded-filter.txt',
    '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', str(OUT)],
    stdout=open('logs/graded-media.log', 'w'), stderr=subprocess.STDOUT)
if r.returncode: sys.exit('ffmpeg fehlgeschlagen, logs/graded-media.log')
print(json.dumps({'pieces': len(pieces), 'out': str(OUT)}))
