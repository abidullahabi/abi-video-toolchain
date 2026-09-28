import pathlib,json,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFont
base=pathlib.Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow');p=base/'projects/IMG_1966-Sichtung-2026-09-27-01a0e28f';v=p/'exports/Consulting-Zertifikate-Rohschnitt-v3.mp4';plan=json.load(open(p/'rough-cut/candidate-v4-plan.json'))
sha=hashlib.sha256(v.read_bytes()).hexdigest();assert sha=='f9384ce0e91dca9b42d1a203d475c4c6ac10a4ec7852ccbdc8dadd42301a4f19'
out=pathlib.Path('/private/tmp/abi-bildpruefung-20260927-01a0e28f/1966-v3-final-seams');out.mkdir(exist_ok=True)
intervals=[];cursor=0
for a,b in plan['keepIntervals']:
 block=next(x['id']for x in plan['blocks']if a>=x['start']-.0001 and b<=x['end']+.0001)
 count=round(b*30)-round(a*30);intervals.append({'block':block,'a':a,'b':b,'n0':cursor,'n1':cursor+count});cursor+=count
rows=[{'title':'Anfang','frames':[0,1,3,6],'type':'start'}]
for i,x in enumerate(intervals[1:],1):
 prev=intervals[i-1];theme=x['block']!=prev['block'];scrum=x['block']=='scrum_einsatz_und_name' and not theme
 sample=(not theme and not scrum and i in [3,6,8,11,13,20,22,27,30,33,35])
 if theme or scrum or sample:
  n=x['n0'];rows.append({'title':(prev['block']+' > '+x['block'])if theme else x['block']+' pause','frames':[n-3,n-1,n,n+2],'type':'theme'if theme else'scrum'if scrum else'sample','join':n,'sourceBefore':prev['b'],'sourceAfter':x['a']})
rows.append({'title':'Ende','frames':[cursor-7,cursor-4,cursor-2,cursor-1],'type':'end'})
frames=sorted({n for row in rows for n in row['frames']});sel='+'.join(f'eq(n,{n})'for n in frames)
a=[str(base/'tools/bin/ffmpeg'),'-y','-v','warning','-threads','2','-i',str(v),'-vf',f"select='{sel}',scale=324:576",'-fps_mode','vfr','-threads','1','-q:v','2',str(out/'frame_%03d.jpg')]
with open(out/'frame-extract.log','w')as f:subprocess.run(a,stdout=f,stderr=subprocess.STDOUT,check=True)
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',15)
for start in range(0,len(rows),3):
 selected=rows[start:start+3];sheet=Image.new('RGB',(4*324,len(selected)*632),(238,238,238));d=ImageDraw.Draw(sheet)
 for j,row in enumerate(selected):
  y=j*632;d.text((8,y+2),row['title'],font=font,fill='black')
  for k,n in enumerate(row['frames']):
   im=Image.open(out/f'frame_{frames.index(n)+1:03}.jpg');sheet.paste(im,(k*324,y+27));d.text((k*324+8,y+607),f'Frame {n} / {n/30:.4f}s',font=font,fill='black')
 sheet.save(out/f'contact_{start//3+1:02}.jpg',quality=90)
(out/'manifest.json').write_text(json.dumps({'video':str(v),'sha256':sha,'scope':'Visual still samples at all5 thematic joins, both new Scrum pause cuts, first/last frames and11 other pause cuts. No motion or hearing review.','rows':rows,'frameIds':frames,'frameCount':cursor},indent=2))
print(json.dumps({'out':str(out),'rows':len(rows),'samples':len(frames),'totalframes':cursor,'types':{t:sum(x['type']==t for x in rows)for t in ['start','theme','scrum','sample','end']},'joins':[{'n':x.get('join'),'outSeconds':x.get('join',0)/30,'sourceAfter':x.get('sourceAfter'),'type':x['type']}for x in rows if x['type']in['theme','scrum']]},indent=2))
