#!/usr/bin/env python3
"""Setzt edl.json um (nach IMG_1957 build-cut.py, bewaehrt 26.09.2026).
  python3 build-cut.py audio          -> exports/cut-audio.wav (48 kHz Originalton, 5-ms-Blenden, 80 ms am Ende)
  python3 build-cut.py video NAME W   -> exports/NAME (Bild nach echten Zeitstempeln + cut-audio.wav, Breite W)
"""
import json, subprocess, sys
from pathlib import Path
W = Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
FFMPEG = W / 'tools/bin/ffmpeg'
src = 'sources/IMG_1967.MOV'
EDL = json.load(open('edl.json'))['keep']
keep = [(k['start'], k['end']) for k in EDL]
cut_duration = sum(b - a for a, b in keep)

def run(args, log):
    with open(log, 'w') as f:
        r = subprocess.run([str(a) for a in args], stdout=f, stderr=subprocess.STDOUT)
    if r.returncode: sys.exit(f'{Path(args[0]).name} fehlgeschlagen, Protokoll: {log}')

def audio():
    parts, labels = [], []
    for i, (a, b) in enumerate(keep):
        last = i == len(keep) - 1
        fo = 0.080 if last else EDL[i].get('fadeOut', 0.005)
        st = EDL[i].get('stretch')
        if st:   # Laut dehnen (Tonhoehe bleibt): [a,von] + atempo([von,bis]) + [bis,audioEnd], exakt auf Bildlaenge b-a
            ae = EDL[i]['audioEnd']; v0, v1 = st['von'], st['bis']
            target = (b - a) - (v0 - a) - (ae - v1)
            tempo = (v1 - v0) / target
            EDL[i]['stretchTempo'] = round(tempo, 4)
            parts.append(f'[0:a:0]atrim=start={a:.6f}:end={v0:.6f},asetpts=PTS-STARTPTS[s{i}a]')
            parts.append(f'[0:a:0]atrim=start={v0 - 0.02:.6f}:end={v1 + 0.02:.6f},asetpts=PTS-STARTPTS,atempo={tempo:.5f},'
                         f'atrim=start={0.02 / tempo:.6f}:end={0.02 / tempo + target:.6f},asetpts=PTS-STARTPTS[s{i}b]')
            parts.append(f'[0:a:0]atrim=start={v1:.6f}:end={ae:.6f},asetpts=PTS-STARTPTS[s{i}c]')
            parts.append(f'[s{i}a][s{i}b][s{i}c]concat=n=3:v=0:a=1,apad,atrim=end={b - a:.6f},'
                         f'afade=t=in:st=0:d=0.005,afade=t=out:st={max(0.0, b - a - fo):.6f}:d={fo}[a{i}]')
            print(json.dumps({'dehnung': {'von': v0, 'bis': v1, 'tempo': round(tempo, 4), 'neu_ms': round(target * 1000)}}))
        else:
            parts.append(f'[0:a:0]atrim=start={a:.6f}:end={b:.6f},asetpts=PTS-STARTPTS,'
                         f'afade=t=in:st=0:d=0.005,afade=t=out:st={max(0.0, b - a - fo):.6f}:d={fo}[a{i}]')
        labels.append(f'[a{i}]')
    parts.append(f"{''.join(labels)}concat=n={len(keep)}:v=0:a=1[aout]")
    Path('cut-audio-filter.txt').write_text(';\n'.join(parts))
    run([FFMPEG, '-hide_banner', '-y', '-i', src, '-filter_complex_script', 'cut-audio-filter.txt',
         '-map', '[aout]', '-c:a', 'pcm_s24le', '-ar', '48000', 'exports/cut-audio.wav'], 'logs/cut-audio.log')
    run([FFMPEG, '-hide_banner', '-y', '-i', 'exports/cut-audio.wav', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
         'exports/cut-speech16k.wav'], 'logs/cut-speech16k.log')
    print(json.dumps({'segments': len(keep), 'cutDuration': round(cut_duration, 3)}))

def video(name, width):
    eps = 0.001
    sel, off, out_t = [], [], 0.0
    for a, b in keep:
        cond = f'gte(t,{a - eps:.6f})*lt(t,{b - eps:.6f})'
        sel.append(cond); off.append(f"{cond.replace('(t,', '(T,')}*{a - out_t:.6f}"); out_t += b - a
    vf = (f"[0:v:0]select='{'+'.join(sel)}',setpts='PTS-({'+'.join(off)})/TB',fps=30,"
          f"scale={width}:-2:flags=lanczos,format=yuv420p[vout]")
    Path('cut-video-filter.txt').write_text(vf)
    out = Path('exports') / name
    if out.exists(): sys.exit(f'{out} existiert bereits, nicht ueberschrieben.')
    run([FFMPEG, '-hide_banner', '-n', '-i', src, '-i', 'exports/cut-audio.wav',
         '-filter_complex_script', 'cut-video-filter.txt', '-map', '[vout]', '-map', '1:a:0',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-profile:v', 'high',
         '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart',
         '-t', f'{cut_duration:.6f}', out], f'logs/video-{name}.log')
    print(json.dumps({'video': str(out), 'cutDuration': round(cut_duration, 3)}))

if sys.argv[1:2] == ['audio']: audio()
elif sys.argv[1:2] == ['video']: video(sys.argv[2], int(sys.argv[3]))
else: sys.exit(__doc__)
