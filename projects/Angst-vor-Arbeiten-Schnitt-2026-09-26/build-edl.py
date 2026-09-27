#!/usr/bin/env python3
"""Setzt edl.json um: Bild und Ton bildgenau per trim/atrim aus der CFR-Quelle (30 fps,
44,1 kHz = 1470 Samples je Bild), 5-ms-Blenden an jeder Naht, concat in Ausgabereihenfolge.
  python3 build-edl.py plan | build NAME.mp4
"""
import json, sys, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; FF = ROOT / 'tools/bin/ffmpeg'
FPS, SPF = 30, 1470
blocks = {b['id']: b for b in json.load(open('blocks.json'))}
edl = json.load(open('edl.json'))
pieces = []
for k in edl['order']:
    if isinstance(k, str):
        a, b = edl['split'][k]; a, b = round(a * FPS), round(b * FPS)
        if k.endswith('a'): a = blocks[int(k[:-1])]['startFrame']
        if k.endswith('b'): b = blocks[int(k[:-1])]['endFrame']
        if k.endswith('end'): a = blocks[int(k[:-3])]['startFrame']
    else:
        a, b = blocks[k]['startFrame'], blocks[k]['endFrame']
    if pieces and pieces[-1][1] == a: pieces[-1][1] = b
    else: pieces.append([a, b])
total = sum(b - a for a, b in pieces)
json.dump({'pieces': pieces, 'frames': total, 'seconds': round(total / FPS, 3), 'joins': len(pieces) - 1}, open('edl-plan.json', 'w'), indent=1)
print(json.dumps({'pieces': len(pieces), 'seconds': round(total / FPS, 3)}))
if sys.argv[1] == 'build':
    out = Path('exports') / sys.argv[2]
    if out.exists(): sys.exit(f'{out} existiert bereits')
    parts, lab = [], []
    for i, (a, b) in enumerate(pieces):
        d = (b - a) / FPS
        pass
        parts.append(f'[0:a:0]atrim=start_sample={a*SPF}:end_sample={b*SPF},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={d-0.005:.6f}:d=0.005[a{i}]')
    # Bild: Auswahl nach Bildnummer (Quelle ist exakt CFR 30), neue Zeitstempel fortlaufend.
    # Reihenfolge je Stueck ueber eigene select-Zweige, damit auch verschobene Stuecke stimmen.
    for i, (a, b) in enumerate(pieces):
        parts.append(f"[0:v:0]select='between(n,{a},{b-1})',setpts=N/(30*TB)[v{i}]")
    parts.append(f"{''.join(f'[v{i}][a{i}]' for i in range(len(pieces)))}concat=n={len(pieces)}:v=1:a=1[vc][ac];[vc]format=yuv420p[vout];[ac]aresample=48000[aout]")
    Path('edl-filter.txt').write_text(';\n'.join(parts))
    r = subprocess.run([str(FF), '-hide_banner', '-nostdin', '-n', '-i', 'source.mp4', '-filter_complex_script', 'edl-filter.txt',
        '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-profile:v', 'high',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', str(out)],
        stdout=open('logs/edl-build.log', 'w'), stderr=subprocess.STDOUT)
    if r.returncode: sys.exit('ffmpeg fehlgeschlagen, logs/edl-build.log')
    print(json.dumps({'video': str(out)}))
