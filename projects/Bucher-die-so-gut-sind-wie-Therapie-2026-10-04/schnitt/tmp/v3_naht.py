#!/usr/bin/env python3
# v3_naht.py t1 t2 ...  -> fuer jede Rohzeit t die Naht in ../schnitt.json, deren Luecke t enthaelt: 3 s davor + 3 s danach zusammensetzen, erkennen
import json, sys, subprocess
D='/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt'
T='/Users/abi/Projekte/abi-video-toolchain/tools'
k=json.load(open(f'{D}/../schnitt.json'))['behalten']
W=float(sys.argv[1]) if sys.argv[1].startswith('w') is False and False else 3.0
for t in map(float, sys.argv[1:]):
    j=next((j for j in range(len(k)-1) if k[j][1]-0.05<=t<=k[j+1][0]+0.05), None)
    if j is None: print(t,'keine Naht'); continue
    # Stuecke rueckwaerts/vorwaerts bis je 3 s
    seg=[]; need=3.0; i=j
    while need>0 and i>=0:
        a,b=k[i]; s=max(a,b-need); seg.insert(0,(s,b)); need-=b-s; i-=1
    need=3.0; i=j+1
    while need>0 and i<len(k):
        a,b=k[i]; e=min(b,a+need); seg.append((a,e)); need-=e-a; i+=1
    fc=''.join(f'[0]atrim={a:.4f}:{b:.4f},asetpts=N/SR/TB[s{n}];' for n,(a,b) in enumerate(seg))+''.join(f'[s{n}]' for n in range(len(seg)))+f'concat=n={len(seg)}:v=0:a=1'
    out=f'{D}/tmp/v3_naht_{t}.wav'
    subprocess.run([f'{T}/bin/ffmpeg','-v','error','-y','-i',f'{D}/speech.wav','-filter_complex',fc,out],check=True)
    r=subprocess.run([f'{T}/bin/whisper-cli','-m',f'{T}/models/ggml-large-v3-turbo-q5_0.bin','-f',out,'-l','de','--prompt','Ähm, also, äh, ich, ich mein, ähm, ja.','-nt'],capture_output=True,text=True)
    print(f'{t} [{k[j][1]:.3f}|{k[j+1][0]:.3f}]', ' '.join(l.strip() for l in r.stdout.splitlines() if l.strip()))
