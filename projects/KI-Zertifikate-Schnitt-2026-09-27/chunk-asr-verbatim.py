import json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
W='/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow'
P=W+'/projects/KI-Zertifikate-Schnitt-2026-09-27'
os.chdir(P)
chunks=json.load(open(sys.argv[1]))
out=sys.argv[2]; model=sys.argv[3] if len(sys.argv)>3 else 'turbo'
os.makedirs(out,exist_ok=True)
M={'turbo':('ggml-large-v3-turbo-q5_0.bin','large.v3.turbo'),'small':('ggml-small.bin','small')}[model]
PAD=0.15
def job(i):
    s,e=chunks[i]; a=max(0,s-PAD); b=e+PAD
    stem=f'{out}/c{i:02d}'
    subprocess.run([W+'/tools/bin/ffmpeg','-v','error','-y','-ss',f'{a:.3f}','-to',f'{b:.3f}','-i','speech.wav','-c:a','pcm_s16le',stem+'.wav'],check=True)
    # whisper needs >=1s; pad with silence to 1.2s min
    r=subprocess.run([W+'/tools/bin/whisper-cli','-m',W+'/tools/models/'+M[0],'-f',stem+'.wav','-l','de','-et','100','-lpt','-100','-ojf','-of',stem,'-dtw',M[1],'-nfa','-t','4','--prompt','Ähm, also, äh, ich, ich mein, ähm, ja. Hm, äh.'],capture_output=True,text=True)
    j=json.load(open(stem+'.json'))
    text=' '.join(seg['text'].strip() for seg in j['transcription'])
    return i,a,text
with ThreadPoolExecutor(2) as ex:
    res=sorted(ex.map(job,range(len(chunks))))
json.dump([{'i':i,'offset':a,'text':t} for i,a,t in res],open(out+'/summary.json','w'),ensure_ascii=False,indent=1)
for i,a,t in res: print(f'{i:02d} {chunks[i][0]:7.2f}-{chunks[i][1]:7.2f}  {t}')
