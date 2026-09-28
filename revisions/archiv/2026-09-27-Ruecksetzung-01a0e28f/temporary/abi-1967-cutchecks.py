from pathlib import Path
import subprocess,json
root=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
jobs=[('IMG_1967',10,26,'turbo'),('IMG_1967',29,36,'turbo'),('IMG_1967',44,53,'turbo'),('IMG_1967',137,145,'turbo'),('IMG_1967',210,219,'turbo'),('IMG_1967',219,224,'turbo'),('IMG_1967',224,230,'turbo'),('IMG_1967',248,256,'turbo'),('IMG_1967',305,318,'turbo')]
for stem,start,end,model in jobs:
 p=root/'projects'/f'{stem}-Sichtung-2026-09-27-01a0e28f';name=f'cutcheck-{start}-{end}-{model}';o=p/'review'/name
 wav=o.with_suffix('.wav')
 subprocess.run([str(root/'tools/bin/ffmpeg'),'-v','error','-n','-ss',str(start),'-t',str(end-start),'-i',str(p/'speech.wav'),'-c:a','pcm_s16le',str(wav)],check=True)
 args=[str(root/'tools/bin/whisper-cli'),'-m',str(root/'tools/models'/('ggml-small.bin' if model=='small' else 'ggml-large-v3-turbo-q5_0.bin')),'-f',str(wav),'-l','de','-ojf','-otxt','-osrt','-of',str(o),'-dtw','small' if model=='small' else 'large.v3.turbo','-nfa','-t','4','-mc','0','-et','100','-lpt','-100']
 with (p/'logs'/(name+'.log')).open('w') as log: subprocess.run(args,stdout=log,stderr=log,check=True)
 print(stem,start,end,model,flush=True)
 print(o.with_suffix('.txt').read_text(),flush=True)
