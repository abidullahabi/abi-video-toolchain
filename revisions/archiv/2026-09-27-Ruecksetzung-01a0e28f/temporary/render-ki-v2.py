from pathlib import Path
import json,subprocess,hashlib,shutil
R=Path('/Users/abi/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow')
P=R/'projects/IMG_1967-Sichtung-2026-09-27-01a0e28f';Q=P/'review/revision-v2';F=R/'tools/bin/ffmpeg';FP=R/'tools/bin/ffprobe'
plan=json.loads((Q/'keep-v2.json').read_text());out=P/'exports/KI-Einstieg-Schnitt-v2.mp4'
assert not out.exists()
args=[str(F),'-hide_banner','-loglevel','warning','-n','-threads','2','-i',plan['source'],'-i',str(Q/'cut-audio.wav'),'-filter_complex_threads','2','-filter_complex_script',str(Q/'video-filter.txt'),'-map','[vout]','-map','1:a:0','-c:v','libx264','-threads:v','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-map_metadata','-1','-movflags','+faststart',str(out)]
(Q/'render-command.json').write_text(json.dumps({'argv':args,'speed':1,'inputIsVerifiedWorkingCopy':True,'noTargetDuration':True,'noAddedFreeze':True},indent=2)+'\n')
shutil.copy2(__file__,Q/'render-ki-v2.py')
with (Q/'render.log').open('w') as log:subprocess.run(args,stdout=log,stderr=log,check=True)
probe=json.loads(subprocess.check_output([str(FP),'-v','error','-show_streams','-show_format','-of','json',str(out)]))
(Q/'render-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
v=next(x for x in probe['streams'] if x['codec_type']=='video');a=next(x for x in probe['streams'] if x['codec_type']=='audio')
assert [v['width'],v['height']]==[1080,1920]
assert int(v['nb_frames'])==plan['frameCount']
assert abs(float(v['duration'])-plan['duration'])<.001
assert abs(float(a['duration'])-plan['duration'])<.001
assert a['sample_rate']=='48000' and a['channels']==1
result={'file':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'duration':plan['duration'],'frames':int(v['nb_frames']),'status':'rendered_pending_independent_qa','bytes':out.stat().st_size}
(Q/'render-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
