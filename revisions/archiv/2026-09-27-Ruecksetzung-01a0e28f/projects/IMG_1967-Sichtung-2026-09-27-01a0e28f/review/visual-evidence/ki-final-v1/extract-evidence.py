import pathlib,json,subprocess,hashlib,argparse
from PIL import Image,ImageDraw,ImageFont
cli=argparse.ArgumentParser(description='Run only after final KI export completion has been confirmed. Reads export and cut plans only.')
cli.add_argument('--sha256',required=True);args=cli.parse_args()
b=pathlib.Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow');p=b/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';v=p/'exports/KI-Einstieg-Schnitt-v1.mp4';out=p/'review/visual-evidence/ki-final-v1'
assert v.is_file(),'Final export missing';assert not out.exists(),'Preserving existing evidence directory'
sha=hashlib.sha256(v.read_bytes()).hexdigest();assert sha==args.sha256,(sha,args.sha256)
plan=json.load(open(p/'review/keep-v3.json'));locked=json.load(open(p/'review/selection-locked.json'));assert locked['speed']==1
probe=json.loads(subprocess.check_output([str(b/'tools/bin/ffprobe'),'-v','error','-show_streams','-of','json',str(v)]));video=next(s for s in probe['streams']if s['codec_type']=='video');assert video['avg_frame_rate']=='30/1';assert int(video['nb_frames'])==1928
intervals=[];cursor=0
for a,z,block in plan['intervals']:
 ref=next(x for x in locked['blocks']if x['id']==block);assert a>=ref['start']-1e-7 and z<=ref['end']+1e-7
 n=round(z*30)-round(a*30);intervals.append({'block':block,'start':a,'end':z,'frame0':cursor,'frame1':cursor+n});cursor+=n
assert cursor==1928
rows=[{'title':'Anfang','frames':[0,1,2,3],'type':'start'}]
for i,x in enumerate(intervals[1:],1):
 prev=intervals[i-1];theme=x['block']!=prev['block'];n=x['frame0'];rows.append({'title':prev['block']+' > '+x['block']if theme else x['block']+' pause','type':'theme'if theme else'pause','frames':[n-2,n-1,n,n+1],'joinFrame':n,'outputSeconds':n/30,'sourceBefore':prev['end'],'sourceAfter':x['start']})
rows.append({'title':'Ende','frames':[cursor-4,cursor-3,cursor-2,cursor-1],'type':'end'})
assert len(rows)==30;assert sum(x['type']=='theme'for x in rows)==12;assert sum(x['type']=='pause'for x in rows)==16
frames=sorted({n for x in rows for n in x['frames']});assert len(frames)==120
out.mkdir(parents=True);sel='+'.join(f'eq(n,{n})'for n in frames)
command=[str(b/'tools/bin/ffmpeg'),'-v','warning','-threads','2','-i',str(v),'-vf',f"select='{sel}',scale=324:576",'-fps_mode','vfr','-threads','1','-q:v','2',str(out/'frame_%03d.jpg')]
(out/'extract-command.json').write_text(json.dumps(command,indent=2)+'\n')
with open(out/'extract.log','w')as f:subprocess.run(command,stdout=f,stderr=subprocess.STDOUT,check=True)
assert len(list(out.glob('frame_*.jpg')))==120
font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',15)
for start in range(0,len(rows),3):
 rs=rows[start:start+3];sheet=Image.new('RGB',(1296,len(rs)*632),(238,238,238));d=ImageDraw.Draw(sheet)
 for j,row in enumerate(rs):
  y=j*632;d.text((8,y+2),row['title'],fill='black',font=font)
  for k,n in enumerate(row['frames']):
   sheet.paste(Image.open(out/f'frame_{frames.index(n)+1:03d}.jpg'),(k*324,y+27));d.text((k*324+8,y+607),f'Frame {n} / {n/30:.4f}s',fill='black',font=font)
 sheet.save(out/f'contact_{start//3+1:02d}.jpg',quality=90)
manifest={'video':str(v),'sha256':sha,'scope':'120 still frames around all28 joins (12 thematic and16 pause joins) plus first4 and last4 frames. Each seam shows immediately consecutive frames n-2,n-1,n,n+1. No original video accessed.','frameCount':cursor,'rows':rows,'frameIds':frames,'visualReviewCompleted':False,'motionReviewPerformed':False,'auditoryReviewPerformed':False}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n');print(json.dumps({'evidence':str(out),'samples':len(frames),'thematic':12,'pause':16,'contactSheets':10,'sha256':sha},indent=2))
