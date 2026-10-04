#!/usr/bin/env python3
# cc.py name a:b a:b ...  -> concatenates speech.wav pieces and transcribes (turbo)
import sys, subprocess, os
D='/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt'
T='/Users/abi/Projekte/abi-video-toolchain/tools'
name=sys.argv[1]; rs=[r.split(':') for r in sys.argv[2:]]
fc=''.join(f'[0]atrim={a}:{b},asetpts=N/SR/TB[s{i}];' for i,(a,b) in enumerate(rs))
fc+=''.join(f'[s{i}]' for i in range(len(rs)))+f'concat=n={len(rs)}:v=0:a=1'
out=f'{D}/tmp/{name}.wav'
subprocess.run([f'{T}/bin/ffmpeg','-v','error','-y','-i',f'{D}/speech.wav','-filter_complex',fc,out],check=True)
r=subprocess.run([f'{T}/bin/whisper-cli','-m',f'{T}/models/ggml-large-v3-turbo-q5_0.bin','-f',out,'-l','de','--prompt','Ähm, also, äh, ich, ich mein, ähm, ja.','-nt'],capture_output=True,text=True)
print(' '.join(l.strip() for l in r.stdout.splitlines() if l.strip()), f'[{name}]')
