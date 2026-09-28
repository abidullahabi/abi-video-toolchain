import pathlib,json,subprocess,math,datetime,hashlib
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';meta=json.load(open(p/'workflow.json'));plan=json.load(open(w/'candidate-v2-plan.json'));keep=plan['keepIntervals'];duration=sum(b-a for a,b in keep);fps=30
# Source nominal30 with small VFR jitter. Normalize its timestamp lattice once before frame selection.
selection='+'.join(f'gte(n,{round(a*fps)})*lt(n,{round(b*fps)})'for a,b in keep)
filters=f"[0:v:0]fps=fps=30:start_time=0,scale=1080:1920:flags=lanczos,setsar=1,select='{selection}',setpts=N/(30*TB)[vout]"
(w/'video-filter.txt').write_text(filters+'\n');(p/'exports').mkdir(exist_ok=True)
out=p/'exports/Consulting-Zertifikate-Rohschnitt-v1.mp4'
args=[str(r/'tools/bin/ffmpeg'),'-hide_banner','-loglevel','warning','-n','-threads','2','-i',meta['source'],'-i',str(w/'candidate-v2.wav'),'-filter_complex_threads','1','-filter_complex_script',str(w/'video-filter.txt'),'-map','[vout]','-map','1:a:0','-map_metadata','-1','-map_chapters','-1','-c:v','libx264','-preset','fast','-crf','18','-profile:v','high','-pix_fmt','yuv420p','-threads:v','2','-x264-params','threads=2:lookahead_threads=1','-r','30','-fps_mode','cfr','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-movflags','+faststart',str(out)]
(w/'render-command.json').write_text(json.dumps(args,indent=2)+'\n')
with open(w/'logs/video-export.log','w')as f:subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,check=True)
probe=json.loads(subprocess.check_output([str(r/'tools/bin/ffprobe'),'-v','error','-show_format','-show_streams','-of','json',str(out)]));(w/'export-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
v=next(x for x in probe['streams']if x['codec_type']=='video');a=next(x for x in probe['streams']if x['codec_type']=='audio')
assert(v['width'],v['height'])==(1080,1920)
assert v['avg_frame_rate']=='30/1'
assert a['sample_rate']=='48000' and a['channels']==1
assert abs(float(probe['format']['duration'])-duration)<.06,(probe['format']['duration'],duration)
assert int(v['nb_frames'])==round(duration*fps)
with open(w/'logs/final-decode.log','w')as f:subprocess.run([str(r/'tools/bin/ffmpeg'),'-v','error','-xerror','-threads','2','-i',str(out),'-f','null','-'],stdout=f,stderr=subprocess.STDOUT,check=True)
sha=hashlib.sha256(out.read_bytes()).hexdigest()
# Complete, source-timestamp-based removal ledger.
removals=[];cursor=0
for a,b in keep:
 if a>cursor+.001:
  known=next((x for x in plan['removalsWithinBlocks']if abs(x['start']-cursor)<.0001 and abs(x['end']-a)<.0001),None)
  removals.append(known or {'start':cursor,'end':a,'type':'editorial','reason':'Outside user-approved complete content blocks, excludes alternative takes, repeated assertions, broad AWS/Google list or unselected content.'})
 cursor=b
if cursor<meta['originalDuration']:removals.append({'start':cursor,'end':meta['originalDuration'],'type':'tail','reason':'Unselected recording tail after full CTA.'})
(p/'cuts.json').write_text(json.dumps({'source':meta['source'],'fps':30,'speed':1,'speechMethod':'Silero6.2 + reviewed DTW + PCM evidence','removals':removals,'selectionPlan':'rough-cut/candidate-v2-plan.json','hearingPerformed':False},indent=2,ensure_ascii=False)+'\n')
timeline=[];cursor=0
for a,b in keep:timeline.append({'sourceStart':a,'sourceEnd':b,'cutStart':cursor,'cutEnd':cursor+b-a});cursor+=b-a
(p/'timeline-map.json').write_text(json.dumps(timeline,indent=2)+'\n')
meta.update({'status':'rough_cut_exported_pending_final_checks','latestExport':str(out),'cutDuration':float(probe['format']['duration']),'keepIntervals':keep,'removedSeconds':meta['originalDuration']-duration,'speed':1,'cutPlan':'cuts.json','timelineMap':'timeline-map.json','sourceAudioExport':'rough-cut/candidate-v2.wav','exportedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aktuell':{'datei':str(out),'sha256':sha,'bytes':out.stat().st_size,'erzeugt':datetime.datetime.now(datetime.timezone.utc).isoformat()},'qualitativeFinalApproval':False})
(p/'workflow.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'output':str(out),'sha256':sha,'duration':duration,'frames':v['nb_frames'],'bytes':out.stat().st_size,'decode':'passed'},indent=2))
