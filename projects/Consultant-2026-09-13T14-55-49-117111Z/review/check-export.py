from pathlib import Path
import subprocess, json, hashlib, math
p=Path(__file__).resolve().parent.parent
root=p.parent.parent
ffmpeg=str(root/'tools/bin/ffmpeg')
ffprobe=str(root/'tools/bin/ffprobe')
source=p/'media.mp4'
export=p/'exports/Consulting_Vorschau.mp4'
def run(args):
    return subprocess.check_output(args)
def probe(file):
    return json.loads(run([ffprobe,'-v','error','-show_format','-show_streams','-of','json',str(file)]))
info=probe(export)
v=next(x for x in info['streams'] if x['codec_type']=='video')
a=next(x for x in info['streams'] if x['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'])==(1080,1920,'30/1')
assert abs(float(info['format']['duration'])-102.4)<0.1
subprocess.run([ffmpeg,'-v','error','-xerror','-i',str(export),'-map','0:v:0','-map','0:a:0','-f','null','-'],check=True)
def audiohash(file):
    return run([ffmpeg,'-v','error','-i',str(file),'-map','0:a:0','-c:a','pcm_s16le','-f','hash','-hash','sha256','-']).decode().strip()
original_audio=audiohash(source); export_audio=audiohash(export)
assert original_audio==export_audio,'Decodierter Ton unterscheidet sich vom Original.'
checks=[]
for t in [0,3,9,15,22,31,40,48,56,63,70,78,86,94,101,102.3]:
    frames=[]
    for file in [source,export]:
        data=run([ffmpeg,'-v','error','-ss',str(t),'-i',str(file),'-frames:v','1','-vf','crop=1080:650:0:500,scale=108:65,format=gray','-f','rawvideo','-'])
        assert len(data)==7020,(str(file),t,len(data))
        frames.append(list(data))
    x,y=frames
    mx=sum(x)/len(x); my=sum(y)/len(y)
    pearson=sum((a-mx)*(b-my) for a,b in zip(x,y))/math.sqrt(sum((a-mx)**2 for a in x)*sum((b-my)**2 for b in y))
    mae=sum(abs(a-b) for a,b in zip(x,y))/len(x)
    checks.append({'time':t,'correlation':pearson,'meanAbsolutePixelDifference':mae})
    assert pearson>0.985,(t,pearson)
report={'file':str(export),'duration':float(info['format']['duration']),'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':int(v['nb_frames']),'audioSampleRate':a['sample_rate'],'audioDecodedIdenticalToOriginal':True,'audioHash':original_audio,'fullyDecoded':True,'sourceFrameComparisons':checks,'sourceFrameComparisonRegion':'Middle 1080x650 region at y=500, outside all overlay and caption boxes','sha256':hashlib.sha256(export.read_bytes()).hexdigest()}
(p/'review/export-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'duration':report['duration'],'dimensions':[v['width'],v['height']],'frames':report['frames'],'audioIdentical':True,'fullyDecoded':True,'frameSamples':len(checks),'minFrameCorrelation':min(x['correlation'] for x in checks),'sha256':report['sha256']},indent=2))
