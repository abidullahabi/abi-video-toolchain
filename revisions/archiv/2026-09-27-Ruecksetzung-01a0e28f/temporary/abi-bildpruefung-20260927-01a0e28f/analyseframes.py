from pathlib import Path
import subprocess, json, re, datetime
from PIL import Image, ImageDraw, ImageFont
base=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
src=Path('/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation/01_Rohvideos')
out=Path('/private/tmp/abi-bildpruefung-20260927-01a0e28f')
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',18)
for name in ['IMG_1966','IMG_1967','IMG_1968']:
 d=out/name
 cmd=[str(base/'tools/bin/ffmpeg'),'-hide_banner','-nostdin','-n','-xerror','-threads','2','-i',str(src/(name+'.MOV')),'-filter_threads','1','-map','0:v:0','-vf',"select='isnan(prev_selected_t)+gte(t-prev_selected_t,5)',scale=540:-2,showinfo",'-vsync','vfr','-q:v','3',str(d/'sample_%03d.jpg'),'-map','0:a:0','-f','null','-']
 with open(d/'decode-and-sampling.log','w') as log:
  run=subprocess.run(cmd,stdout=log,stderr=log)
 content=(d/'decode-and-sampling.log').read_text()
 rows=[{'index':int(m[0])+1,'pts':int(m[1]),'source_seconds':float(m[2]),'frame_file':str(d/f'sample_{int(m[0])+1:03d}.jpg')} for m in re.findall(r'n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([\d.]+)',content)]
 (d/'sampling-manifest.json').write_text(json.dumps({'source':str(src/(name+'.MOV')),'decode_exit_code':run.returncode,'decode_entire_video_and_audio':True,'sample_rule':'first frame and first frame >=5 s after prior sample','command':cmd,'samples':rows},ensure_ascii=False,indent=2))
 for start in range(0,len(rows),24):
  chunk=rows[start:start+24]
  sheet=Image.new('RGB',(1080,4*505+40),(20,20,20))
  draw=ImageDraw.Draw(sheet)
  draw.text((10,5),f'{name} source time / 5 s samples | part {start//24+1}',font=font,fill='white')
  for j,row in enumerate(chunk):
   x=(j%6)*180;y=40+(j//6)*505
   im=Image.open(row['frame_file']);im.thumbnail((180,480))
   sheet.paste(im,(x,y))
   sec=row['source_seconds'];label=f'{int(sec)//60:02d}:{sec%60:06.3f}'
   draw.text((x+4,y+480),label,font=font,fill='white')
  sheet.save(d/f'contact_{start//24+1:02d}.jpg',quality=90)
 print(name,'exit',run.returncode,'samples',len(rows),flush=True)
