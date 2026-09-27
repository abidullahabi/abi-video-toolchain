import subprocess, sys, os
W='/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow'
def sheet(times, out, cols=10, src='sources/IMG_1967.MOV', w=216):
    tmp='review/frames/_t'; os.makedirs(tmp, exist_ok=True)
    files=[]
    for k,t in enumerate(times):
        f=f'{tmp}/{k:03d}.png'
        subprocess.run([W+'/tools/bin/ffmpeg','-v','error','-y','-ss',f'{t:.3f}','-i',src,'-frames:v','1','-vf',
          f"scale={w}:-2,drawtext=text='{t:.2f}':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6",f],check=True)
        files.append(f)
    rows=(len(files)+cols-1)//cols
    inputs=[]; 
    for f in files: inputs+=['-i',f]
    layout='|'.join(f'{(i%cols)}*{w}_{(i//cols)}*h0'.replace('*h0', f'*{int(w*16/9)}') for i in range(len(files)))
    layout='|'.join(f'{(i%cols)*w}_{(i//cols)*int(w*16/9)}' for i in range(len(files)))
    subprocess.run([W+'/tools/bin/ffmpeg','-v','error','-y',*inputs,'-filter_complex',f'xstack=inputs={len(files)}:layout={layout}:fill=black',out],check=True)
if __name__=='__main__':
    a,b,s=map(float,sys.argv[1:4]); out=sys.argv[4]
    n=int(round((b-a)/s))+1
    sheet([a+i*s for i in range(n)], out, cols=int(sys.argv[5]) if len(sys.argv)>5 else 10)
