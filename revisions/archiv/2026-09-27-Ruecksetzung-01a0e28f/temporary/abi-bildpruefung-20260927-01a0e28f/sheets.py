from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import re
base=Path('/private/tmp/abi-bildpruefung-20260927-01a0e28f')
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',17)
for d in sorted(base.glob('IMG_*')):
 log=d/'decode-and-sampling.log'
 if not log.exists():continue
 rows=re.findall(r'n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([\d.]+)',log.read_text())
 rows=[r for r in rows if (d/f'sample_{int(r[0])+1:03d}.jpg').exists()]
 for start in range(0,len(rows),20):
  chunk=rows[start:start+20]
  sheet=Image.new('RGB',(1080,1680),(20,20,20));draw=ImageDraw.Draw(sheet)
  draw.text((10,5),d.name+f' | source timestamps | sheet {start//20+1}',font=font,fill='white')
  for j,row in enumerate(chunk):
   x=(j%5)*216;y=36+(j//5)*410
   im=Image.open(d/f'sample_{int(row[0])+1:03d}.jpg');im.thumbnail((216,384));sheet.paste(im,(x,y))
   s=float(row[2]);draw.text((x+5,y+385),f'{int(s)//60:02d}:{s%60:06.3f}',font=font,fill='white')
  sheet.save(d/f'view_{start//20+1:02d}.jpg',quality=92)
 print(d.name,len(rows),rows[-1][2] if rows else None)
