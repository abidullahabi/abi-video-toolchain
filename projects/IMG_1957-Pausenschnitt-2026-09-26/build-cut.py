#!/usr/bin/env python3
"""Setzt cuts.json um. Zwei Schritte, damit der Ton vor dem langen 4K-Export geprueft wird.

  python3 build-cut.py audio   -> exports/cut-audio.wav (48 kHz, Originalton, 5-ms-Blenden)
  python3 build-cut.py video   -> exports/<name>.mp4 (Bild nach echten Zeitstempeln + cut-audio.wav)

Das Bild wird nach Zeitstempeln statt nach Bildnummern ausgewaehlt: Die Quelle hat
101 Bildabstaende von 35 statt 33,3 ms. Jedes Bild behaelt seinen Zeitpunkt minus
der davor entfernten Zeit, danach fps=30. So bleibt der Ton an jedem Segment synchron.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FFMPEG, FFPROBE = ROOT / 'tools/bin/ffmpeg', ROOT / 'tools/bin/ffprobe'
meta = json.load(open('workflow.json'))
cuts = json.load(open('cuts.json'))
src, total = meta['source'], meta['originalDuration']

keep, cursor = [], 0.0
for r in sorted(cuts['removals'], key=lambda r: r['start']):
    if r['start'] > cursor:
        keep.append((cursor, r['start']))
    cursor = max(cursor, r['end'])
if cursor < total:
    keep.append((cursor, total))
keep = [(a, b) for a, b in keep if b - a > 0.001]
cut_duration = sum(b - a for a, b in keep)
Path('exports').mkdir(exist_ok=True)


def run(args, log):
    with open(log, 'w') as f:
        r = subprocess.run([str(a) for a in args], stdout=f, stderr=subprocess.STDOUT)
    if r.returncode:
        sys.exit(f'{Path(args[0]).name} fehlgeschlagen, Protokoll: {log}')


def audio():
    parts, labels = [], []
    for i, (a, b) in enumerate(keep):
        fade_out = max(0.0, b - a - 0.005)
        parts.append(f'[0:a:0]atrim=start={a:.6f}:end={b:.6f},asetpts=PTS-STARTPTS,'
                     f'afade=t=in:st=0:d=0.005,afade=t=out:st={fade_out:.6f}:d=0.005[a{i}]')
        labels.append(f'[a{i}]')
    parts.append(f"{''.join(labels)}concat=n={len(keep)}:v=0:a=1[aout]")
    Path('cut-audio-filter.txt').write_text(';\n'.join(parts))
    out = Path('exports/cut-audio.wav')
    run([FFMPEG, '-hide_banner', '-y', '-i', src, '-filter_complex_script', 'cut-audio-filter.txt',
         '-map', '[aout]', '-c:a', 'pcm_s24le', '-ar', '48000', out], 'logs/cut-audio.log')
    print(json.dumps({'audio': str(out), 'segments': len(keep), 'cutDuration': round(cut_duration, 3)}))


def video(name):
    eps = 0.001  # Zeitstempel liegen auf 1/600-s-Raster, Grenzen sind echte Bildzeiten
    sel, off, out_t = [], [], 0.0
    for a, b in keep:
        cond = f'gte(T,{a - eps:.6f})*lt(T,{b - eps:.6f})'
        sel.append(cond)
        off.append(f'{cond}*{a - out_t:.6f}')
        out_t += b - a
    vf = (f"[0:v:0]select='{'+'.join(sel).replace('T,', 't,')}',"
          f"setpts='PTS-({'+'.join(off)})/TB',fps=30,format=yuv420p[vout]")
    Path('cut-video-filter.txt').write_text(vf)
    out = Path('exports') / name
    if out.exists():
        sys.exit(f'{out} existiert bereits, nicht ueberschrieben.')
    run([FFMPEG, '-hide_banner', '-n', '-i', src, '-i', 'exports/cut-audio.wav',
         '-filter_complex_script', 'cut-video-filter.txt', '-map', '[vout]', '-map', '1:a:0',
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-profile:v', 'high',
         '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart',
         '-t', f'{cut_duration:.6f}', out], 'logs/cut-video.log')
    print(json.dumps({'video': str(out), 'cutDuration': round(cut_duration, 3)}))


if sys.argv[1:2] == ['audio']:
    audio()
elif sys.argv[1:2] == ['video'] and len(sys.argv) == 3:
    video(sys.argv[2])
else:
    sys.exit(__doc__)
