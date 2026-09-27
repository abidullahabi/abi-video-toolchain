#!/usr/bin/env python3
"""Setzt eine Storyline-Schnittliste (edl-*.json) um.

Jedes Element ist ein Teil genau eines v1-Abschnitts: {seg, from, to}. from/to sind
'start', 'end' oder ein innerer Schnittpunkt (Mitte einer Silero-Luecke). Weil v1-
Abschnittsgrenzen bereits in der Mitte einer gekuerzten Pause liegen, entsteht an jeder
neuen Naht wieder die abgenommene Restpause von ~96 ms.

Quelle: das Original IMG_1957.MOV, falls vorhanden (eine Kodierung weniger, und das
Zuklappen des Buchs am Ende ist verfuegbar), sonst der Export von Schnitt v1.

  python3 build-storyline.py plan  edl-final.json            -> storyline-plan.json
  python3 build-storyline.py audio edl-final.json            -> exports/storyline-audio.wav
  python3 build-storyline.py video edl-final.json NAME.mp4   -> exports/NAME.mp4
Option --ending SEK: im Original nach dem letzten Element bis SEK (Originalzeit) weiterlaufen
lassen, z. B. fuer das Zuklappen des Buchs.
"""
import json
import os
import subprocess
import sys
from bisect import bisect_left
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
ROOT = PROJECT.parents[1]
FFMPEG = ROOT / 'tools/bin/ffmpeg'

meta = json.load(open(PROJECT / 'workflow.json'))
segs = {s['id']: s for s in json.load(open(HERE / 'segments.json'))}
inv = {e['id']: e for e in json.load(open(HERE / 'inventory.json'))}
args = [a for a in sys.argv[1:]]
ending = None
if '--ending' in args:
    k = args.index('--ending')
    ending = float(args[k + 1])
    del args[k:k + 2]
mode, edl_file = args[0], args[1]
edl = json.load(open(HERE / edl_file))
stem = Path(edl_file).stem
edl = edl.get('final', edl)

# Drive hat den Upload des Originals am 26.09.2026 abgebrochen; die lokale Kopie liegt dann
# unter canceled_uploads (SHA-256 geprueft = meta['sourceSha256']). Nur lesend verwenden.
CANCELED = '/Users/abi/Library/Application Support/Google/DriveFS/canceled_uploads/107775308938735523322/IMG_1957.MOV'
orig = next((p for p in (meta['source'], CANCELED) if os.path.exists(p) and os.path.getsize(p) == 1998869288), meta['source'])
use_orig = os.path.exists(orig)
source = orig if use_orig else str(PROJECT / 'exports/IMG_1957-Schnitt_v1.mp4')
audio_source = orig if use_orig else str(PROJECT / 'exports/cut-audio.wav')
frames = (sorted(float(x) for x in open(PROJECT / 'logs/video-pts.txt') if x.strip()) if use_orig else None)


def rel(seg, point, default):
    if point == default:
        return 0.0 if default == 'start' else segs[seg]['cutEnd'] - segs[seg]['cutStart']
    if point.startswith('t='):  # exakte Zeit im Abschnitt (z. B. Abdullahs eigener Schnittpunkt)
        return float(point[2:])
    p = next(p for p in inv[seg]['cutPoints'] if p['id'] == point)
    return (p['gap'][0] + p['gap'][1]) / 2 - segs[seg]['cutStart']


def snap(t):
    if not use_orig:
        return round(t * 30) / 30
    i = bisect_left(frames, t)
    c = [j for j in (i - 1, i) if 0 <= j < len(frames)]
    return frames[min(c, key=lambda j: abs(frames[j] - t))]


items = [it for sec in edl['sections'] for it in sec['items']]
plan = []
for it in items:
    s = segs[it['seg']]
    a, b = rel(it['seg'], it['from'], 'start'), rel(it['seg'], it['to'], 'end')
    base = s['origStart'] if use_orig else s['cutStart']
    plan.append({'seg': it['seg'], 'from': it['from'], 'to': it['to'],
                 'start': snap(base + a), 'end': snap(base + b), 'text': it['text']})
# Direkt aufeinanderfolgende Teile desselben Quellverlaufs zusammenfassen (keine Naht)
merged = []
for p in plan:
    if merged and abs(merged[-1]['end'] - p['start']) < 0.02:
        merged[-1]['end'] = p['end']
        merged[-1]['text'] += ' ' + p['text']
        merged[-1]['segs'].append(p['seg'])
    else:
        merged.append({**p, 'segs': [p['seg']]})
if ending is not None:
    if not use_orig:
        sys.exit('--ending braucht das Original IMG_1957.MOV.')
    last = merged[-1]
    if ending > last['end']:
        if segs[last['segs'][-1]]['origEnd'] - last['end'] < 0.02:
            last['end'] = snap(ending)
            last['ending'] = True
        else:
            merged.append({'start': snap(segs[max(segs)]['origEnd']), 'end': snap(ending), 'text': '(Buch zuklappen)',
                           'segs': [], 'ending': True})
total = sum(p['end'] - p['start'] for p in merged)
Path(HERE / 'exports').mkdir(exist_ok=True)


def run(cmd, log):
    with open(HERE / log, 'w') as f:
        r = subprocess.run([str(c) for c in cmd], stdout=f, stderr=subprocess.STDOUT, cwd=HERE)
    if r.returncode:
        sys.exit(f'{Path(str(cmd[0])).name} fehlgeschlagen, Protokoll: {log}')


def write_plan():
    json.dump({'edl': edl_file, 'source': source, 'useOriginal': use_orig, 'ending': ending,
               'pieces': merged, 'seconds': round(total, 3), 'joins': len(merged) - 1},
              open(HERE / f'{stem}-plan.json', 'w'), indent=1, ensure_ascii=False)
    print(json.dumps({'source': 'Original' if use_orig else 'Schnitt v1', 'pieces': len(merged),
                      'seconds': round(total, 3)}))


def audio():
    parts, labels = [], []
    for i, p in enumerate(merged):
        fo = max(0.0, p['end'] - p['start'] - 0.005)
        parts.append(f"[0:a:0]atrim=start={p['start']:.6f}:end={p['end']:.6f},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:st=0:d=0.005,afade=t=out:st={fo:.6f}:d=0.005[a{i}]")
        labels.append(f'[a{i}]')
    parts.append(f"{''.join(labels)}concat=n={len(merged)}:v=0:a=1[aout]")
    (HERE / f'{stem}-audio-filter.txt').write_text(';\n'.join(parts))
    run([FFMPEG, '-hide_banner', '-y', '-i', audio_source, '-filter_complex_script', f'{stem}-audio-filter.txt',
         '-map', '[aout]', '-c:a', 'pcm_s24le', '-ar', '48000', f'exports/{stem}-audio.wav'], f'logs-{stem}-audio.log')
    print(json.dumps({'audio': f'exports/{stem}-audio.wav', 'seconds': round(total, 3)}))


def video(name, preview=False):
    out = HERE / 'exports' / name
    if out.exists():
        sys.exit(f'{out} existiert bereits, nicht ueberschrieben.')
    eps = 0.001
    sel, off, t = [], [], 0.0
    for p in merged:
        cond = f"gte(T,{p['start'] - eps:.6f})*lt(T,{p['end'] - eps:.6f})"
        sel.append(cond)
        off.append(f"{cond}*{p['start'] - t:.6f}")
        t += p['end'] - p['start']
    vf = (f"[0:v:0]select='{'+'.join(sel).replace('T,', 't,')}',"
          f"setpts='PTS-({'+'.join(off)})/TB',fps=30,format=yuv420p[vout]")
    if preview:
        vf = vf.replace(',format=yuv420p[vout]', ',scale=720:1280,format=yuv420p[vout]')
    (HERE / f'{stem}-video-filter.txt').write_text(vf)
    quality = ['-preset', 'veryfast', '-crf', '23'] if preview else ['-preset', 'fast', '-crf', '18']
    run([FFMPEG, '-hide_banner', '-n'] + (['-hwaccel', 'videotoolbox'] if preview else []) +
        ['-i', source, '-i', f'exports/{stem}-audio.wav',
         '-filter_complex_script', f'{stem}-video-filter.txt', '-map', '[vout]', '-map', '1:a:0',
         '-c:v', 'libx264'] + quality + ['-profile:v', 'high',
         '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart',
         '-t', f'{total:.6f}', f'exports/{name}'], f'logs-{stem}-video.log')
    print(json.dumps({'video': str(out), 'seconds': round(total, 3)}))


write_plan()
if mode == 'audio':
    audio()
elif mode == 'video' and len(args) == 3:
    video(args[2])
elif mode == 'preview' and len(args) == 3:
    audio()
    video(args[2], preview=True)
elif mode != 'plan':
    sys.exit(__doc__)
