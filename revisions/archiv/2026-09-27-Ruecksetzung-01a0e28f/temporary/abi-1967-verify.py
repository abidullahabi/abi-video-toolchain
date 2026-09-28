from pathlib import Path
import subprocess,json
r=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow');p=r/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';q=p/'review'
jobs=[('outro-tail',p/'speech.wav',314,4),('selected-before-pauses',q/'selected-before-pauses.wav',None,None),('calibration-v2',q/'calibration-v2.wav',None,None)]
for name,source,start,duration in jobs:
 wav=q/f'{name}-asr16.wav';a=[str(r/'tools/bin/ffmpeg'),'-v','error','-n']
 if start is not None:a+=['-ss',str(start),'-t',str(duration)]
 a+=['-i',str(source),'-ac','1','-ar','16000','-c:a','pcm_s16le',str(wav)];subprocess.run(a,check=True)
 out=q/f'{name}-recognition';args=[str(r/'tools/bin/whisper-cli'),'-m',str(r/'tools/models/ggml-large-v3-turbo-q5_0.bin'),'-f',str(wav),'-l','de','-ojf','-otxt','-osrt','-of',str(out),'-dtw','large.v3.turbo','-nfa','-t','4','-mc','0','-et','100','-lpt','-100']
 with (p/'logs'/f'{name}-recognition.log').open('w') as log:subprocess.run(args,stdout=log,stderr=log,check=True)
 print(name,out.with_suffix('.txt').read_text(),flush=True)
