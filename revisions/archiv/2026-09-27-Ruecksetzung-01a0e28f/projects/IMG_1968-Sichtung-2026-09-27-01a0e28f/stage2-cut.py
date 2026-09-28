import sys,json,pathlib,subprocess,hashlib,math,statistics,datetime

P=pathlib.Path(sys.argv[1]).resolve()
ACTION=sys.argv[2]
REV=sys.argv[3] if len(sys.argv)>3 else 'v1'
B=P.parent.parent
FF=str(B/'tools/bin/ffmpeg')
FP=str(B/'tools/bin/ffprobe')
def save(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def load(path): return json.loads(path.read_text())
def run(args,log=None):
    if log:
        with open(log,'w') as f: subprocess.run(args,stdout=f,stderr=f,check=True)
    else: return subprocess.check_output(args,text=True)
M=load(P/'workflow.json'); S=M['source']; R=P/'review'; R.mkdir(exist_ok=True)
plan=load(P/'selection-frozen.json')
planbytes=(P/'selection-frozen.json').read_bytes()
lock=P/'selection-frozen.sha256'
digest=hashlib.sha256(planbytes).hexdigest()
if lock.exists():
    assert lock.read_text().strip()==digest,'Frozen selection was changed'
else: lock.write_text(digest+'\n')
if ACTION=='prepare':
    info=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',S]))
    save(R/'source-probe.json',info)
    dur=float(info['format']['duration'])
    cache=R/'source-frame-times.json'
    if not cache.exists():
        f=json.loads(run([FP,'-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time','-of','json',S]))
        save(cache,sorted(float(x['pts_time']) for x in f['packets']))
    frames=load(cache)+[dur]
    def snap(t): return min(frames,key=lambda a:abs(a-t))
    pauseplan=load(P/f'pause-plan-{REV}.json')
    pauses=pauseplan['removals']
    overrides=pauseplan.get('wordProtectionBoundaryOverrides',{})
    keeps=[]
    for block in plan['blocks']:
        a,z=map(snap,overrides.get(block['id'],{}).get('sourceRange',block['sourceRange']))
        cuts=sorted([r for r in pauses if r['start']>=a and r['end']<=z],key=lambda r:r['start'])
        cursor=a
        for c in cuts:
            start,end=map(snap,[c['start'],c['end']])
            assert cursor<=start<end<=z,(block,c)
            if start>cursor: keeps.append({'sourceStart':cursor,'sourceEnd':start,'block':block['id']})
            cursor=end
        if cursor<z: keeps.append({'sourceStart':cursor,'sourceEnd':z,'block':block['id']})
    elapsed=0
    for k in keeps:
        k['outputStart']=elapsed
        elapsed+=k['sourceEnd']-k['sourceStart']
        k['outputEnd']=elapsed
    save(P/f'timeline-map-{REV}.json',{'source':S,'speed':1,'selectionSha256':digest,'expectedDuration':elapsed,'intervals':keeps})
    removals=[];cursor=0
    for k in keeps:
        if k['sourceStart']>cursor:
            matched=[x for x in pauses if abs(x['start']-cursor)<.04 and abs(x['end']-k['sourceStart'])<.04]
            removals.append({'start':cursor,'end':k['sourceStart'],'type':'silence' if matched else 'editorial','reason':matched[0]['reason'] if matched else 'Genehmigte Sinnauswahl: Anlauf, Dopplung, verworfene Aussage oder Vor-/Nachlauf; siehe selection-frozen.json.'})
        cursor=k['sourceEnd']
    if cursor<dur:removals.append({'start':cursor,'end':dur,'type':'editorial','reason':'Abschluss beendet. Nicht ausgewaehlter Folgeaufruf und Nachlauf.'})
    save(P/f'cuts-{REV}.json',{'sourceDuration':dur,'selectionSha256':digest,'speed':1,'frameAlignment':'Nearest actual source presentation timestamp, not average frame number','removals':removals,'reviewNotes':['No auditory review possible. DTW anchors and Silero are estimates.','PCM edge review supplements word protection, never used as pause-calibration metric.']})
    print(json.dumps({'prepared':REV,'intervals':len(keeps),'duration':elapsed}))
elif ACTION in ['pcm','video']:
    tl=load(P/f'timeline-map-{REV}.json');ks=tl['intervals'];filters=[];labels=[]
    for i,k in enumerate(ks):
        a,z=k['sourceStart'],k['sourceEnd'];d=z-a
        filters.append(f'[0:a:0]atrim=start={a:.9f}:end={z:.9f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st={max(0,d-.005):.9f}:d=0.005[a{i}]')
        labels.append(f'[a{i}]')
    filters.append(''.join(labels)+f'concat=n={len(ks)}:v=0:a=1[aout]')
    args=[FF,'-hide_banner','-v','warning','-n','-threads','2','-i',S,'-filter_complex_threads','2']
    if ACTION=='video':
        selection='+'.join(f'gte(t,{k["sourceStart"]-.000001:.9f})*lt(t,{k["sourceEnd"]-.000001:.9f})' for k in ks)
        gaps='+'.join(f'gte(T,{ks[i]["sourceStart"]-.000001:.9f})*{ks[i]["sourceStart"]-ks[i-1]["sourceEnd"]:.9f}' for i in range(1,len(ks))) or '0'
        filters.insert(0,f"[0:v:0]select='{selection}',setpts='PTS-STARTPTS-({gaps})/TB',scale=1080:1920:flags=lanczos,setsar=1,fps=30,trim=end_frame={round(tl['expectedDuration']*30)}[vout]")
        dest=P/'exports'/f'DreiFragen-Schnitt-{REV}.mp4';dest.parent.mkdir(exist_ok=True)
    else: dest=R/f'cut-audio-{REV}.wav'
    filt=P/f'{ACTION}-filter-{REV}.txt';filt.write_text(';\n'.join(filters)+'\n')
    args+=['-filter_complex_script',str(filt)]
    if ACTION=='video':
        args+=['-map','[vout]','-map','[aout]','-c:v','libx264','-threads:v','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-movflags','+faststart']
    else: args+=['-map','[aout]','-c:a','pcm_s16le','-ar','48000','-ac','1']
    args+=['-map_metadata','-1',str(dest)]
    save(R/f'{ACTION}-command-{REV}.json',{'argv':args,'source':S,'speed':1,'selectionSha256':digest,'limitation':'No perceptual listening review available'})
    run(args,P/'logs'/f'{ACTION}-{REV}.log')
    print(dest)
elif ACTION=='analyze':
    wav=R/f'cut-audio-{REV}.wav';small=R/f'cut-audio-{REV}-silero.wav'
    run([FF,'-v','error','-n','-i',str(wav),'-ar','16000','-ac','1','-c:a','pcm_s16le',str(small)])
    raw=json.loads(run([str(B/'tools/bin/silero-probabilities'),str(B/'tools/models/ggml-silero-v6.2.0.bin'),str(small)]))
    save(R/f'cut-probabilities-{REV}.json',raw)
    probs=raw['probabilities'];hop=raw['hopSamples']/raw['sampleRate'];duration=raw['sampleCount']/raw['sampleRate'];start=None;gaps=[]
    for i,x in enumerate(probs):
        t=i*hop
        if x<.55 and start is None:start=t
        elif x>=.7 and start is not None:
            if t-start+1e-9>=.064:gaps.append({'start':start,'end':t,'duration':t-start})
            start=None
    if start is not None and duration-start+1e-9>=.064:gaps.append({'start':start,'end':duration,'duration':duration-start})
    inner=[g for g in gaps if g['start']>0 and g['end']<duration-1e-6]
    ds=[round(g['duration']*1000,3) for g in inner];band=sum(63.99<=d<=96.01 for d in ds)/len(ds) if ds else 0
    stats={'duration':duration,'count':len(ds),'medianMs':statistics.median(ds) if ds else None,'fraction64to96':band,'over160':[g for g in inner if g['duration']>.160001],'gaps':gaps,'analysisOnly':True,'auditoryReviewPerformed':False,'criterion':{'medianMs':96,'minimumFraction64to96':.6},'validationScope':'Five videos of same speaker in previous recording situation. Transfer to this new rear camera setup not validated by listening.'}
    save(R/f'pause-check-{REV}.json',stats)
    print(json.dumps({k:v for k,v in stats.items() if k!='gaps'}))
else:raise ValueError(ACTION)
