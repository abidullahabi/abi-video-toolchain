from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parent.parent;p=Path((root/'experiments/project-werki.txt').read_text().strip());m=json.loads((p/'workflow.json').read_text());assert m['status']=='experiment_complete'
out=root/'experiments/Schnitt-Experiment-2026-09-13';out.mkdir(exist_ok=True);dest=out/'Werki_Vorher_Nachher_20s.mp4';assert not dest.exists()
font='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
filters=[]
for i,label in enumerate(['VORHER / AKTUELL FREIGEGEBEN','EXPERIMENT / NEUER SCHNITT']):
 filters.append(f"[{i}:v]trim=duration=10,setpts=PTS-STARTPTS,pad=1080:2160:0:120:color=0x0a101b,drawtext=fontfile='{font}':text='{label}':fontsize=42:fontcolor=white:x=(w-tw)/2:y=39,drawtext=fontfile='{font}':text='Vergleich der Einstiege · Tonpegel angeglichen':fontsize=30:fontcolor=0x94badb:x=(w-tw)/2:y=2075,setsar=1[v{i}]")
 filters.append(f'[{i}:a]atrim=duration=10,asetpts=PTS-STARTPTS,'+('loudnorm=I=-16:TP=-1:LRA=11,' if i==0 else '')+f'aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st=9.98:d=0.02[a{i}]')
filters.append('[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]')
subprocess.run([str(root/'tools/bin/ffmpeg'),'-v','error','-n','-i',m['baseline'],'-i',m['latestExport'],'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','30','-c:v','libx264','-preset','medium','-threads','4','-crf','18','-maxrate','14M','-bufsize','28M','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','120k','-movflags','+faststart',str(dest)],check=True)
subprocess.run([str(root/'tools/bin/ffmpeg'),'-v','error','-xerror','-i',str(dest),'-f','null','-'],check=True)
print(dest,flush=True)
