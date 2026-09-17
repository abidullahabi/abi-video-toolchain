from pathlib import Path
import subprocess,json,hashlib,math,sys
p=Path(sys.argv[1]).resolve(); name=sys.argv[2];root=p.parent.parent
ffmpeg=str(root/'tools/bin/ffmpeg');ffprobe=str(root/'tools/bin/ffprobe')
manifest=json.loads((p/'workflow.json').read_text());plan=json.loads((p/'theme-plan.json').read_text())
rendered=Path(manifest['latestExport']);source=p/'media.mp4';out=p/'exports'/(name+'_FINAL.mp4')
assert not out.exists(),'Final export already exists.'
subprocess.run([ffmpeg,'-v','error','-n','-i',str(rendered),'-i',str(source),'-map','0:v:0','-map','1:a:0','-c','copy','-map_metadata','-1','-movflags','+faststart',str(out)],check=True)
def run(args):return subprocess.check_output(args)
info=json.loads(run([ffprobe,'-v','error','-show_format','-show_streams','-of','json',str(out)]))
v=next(x for x in info['streams'] if x['codec_type']=='video');a=next(x for x in info['streams'] if x['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'])==(1080,1920,'30/1')
assert abs(float(info['format']['duration'])-plan['duration'])<0.1
subprocess.run([ffmpeg,'-v','error','-xerror','-i',str(out),'-map','0:v:0','-map','0:a:0','-f','null','-'],check=True)
def audiohash(f):return run([ffmpeg,'-v','error','-i',str(f),'-map','0:a:0','-c:a','pcm_s16le','-f','hash','-hash','sha256','-']).decode().strip()
originalhash=audiohash(source);assert originalhash==audiohash(out),'Audio differs from source.'
def scale_at(t):
    for z in plan['zooms']:
        if z['start']<=t<z['end']:return 1+(z['scale']-1)*(t-z['start'])/(z['end']-z['start'])
    return 1
checks=[]
for t in [round(i*(plan['duration']-.15)/15,3) for i in range(16)]:
    t=round(t*30)/30;scale=scale_at(t);frames=[]
    for f in [source,out]:
        filters=[]
        if f==source and scale>1.000001:filters.extend([f'scale=iw*{scale:.9f}:ih*{scale:.9f}', 'crop=1080:1920:(iw-1080)*0.42:(ih-1920)*0.28'])
        filters+=['crop=1080:650:0:500','scale=108:65','format=gray']
        data=run([ffmpeg,'-v','error','-ss',str(t),'-i',str(f),'-frames:v','1','-vf',','.join(filters),'-f','rawvideo','-'])
        assert len(data)==7020,(f,t,len(data));frames.append(list(data))
    x,y=frames;mx=sum(x)/len(x);my=sum(y)/len(y)
    corr=sum((a-mx)*(b-my) for a,b in zip(x,y))/math.sqrt(sum((a-mx)**2 for a in x)*sum((b-my)**2 for b in y))
    checks.append({'time':t,'zoom':scale,'correlation':corr});assert corr>.98,(t,corr)
report={'file':str(out),'sourceDuration':plan['duration'],'duration':float(info['format']['duration']),'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':int(v['nb_frames']),'audioDecodedIdenticalToOriginal':True,'audioHash':originalhash,'fullyDecoded':True,'sourceFrameComparisonsWithExpectedZoom':checks,'captionCues':len(plan['captions']),'captionMaxWords':max(len(c['words']) for c in plan['captions']),'captionFontSize':plan['captionFontSize'],'captionTop':plan['captionTop'],'zoomSegments':len(plan['zooms']),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
assert report['captionMaxWords']<=3
(p/'review/final-export-check.json').write_text(json.dumps(report,indent=2)+'\n')
manifest.update(renderedExport=str(rendered),latestExport=str(out),status='complete',audioHandling='Original audio stream copied without re-encoding',captionStandard={'fontSize':56,'top':plan['captionTop'],'maxWords':3})
(p/'workflow.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':str(out),'duration':report['duration'],'captions':report['captionCues'],'maxWords':report['captionMaxWords'],'audioIdentical':True,'decoded':True,'minImageCorrelation':min(c['correlation'] for c in checks),'zoomSegments':report['zoomSegments']},indent=2))
