"""Independent V2 technical QA. Never edits plan, media, workflow, or originals."""
from pathlib import Path
import argparse,array,datetime,hashlib,json,math,statistics,subprocess,sys

W=Path(__file__).resolve().parent
Q=W.parent
P=Q.parent.parent
R=P.parent.parent
FF=R/'tools/bin/ffmpeg'
FP=R/'tools/bin/ffprobe'
PLAN=Q/'keep-v2.json'
PCM=Q/'cut-audio.wav'
OUT=P/'exports/KI-Einstieg-Schnitt-v2.mp4'
FPS=30
SR=48000

def run(args,**kw):
    return subprocess.check_output([str(x) for x in args],**kw)
def save(name,data):
    with (W/name).open('x') as f:
        json.dump(data,f,indent=2,ensure_ascii=False)
        f.write('\n')
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def probe(path):
    return json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',path]))
def decode(path):
    samples=array.array('f')
    samples.frombytes(run([FF,'-v','error','-threads','2','-i',path,'-map','0:a:0','-vn','-ar',SR,'-ac','1','-f','f32le','-']))
    return samples

def correlation(a,b,indices,lag):
    xx=yy=xy=0.0
    for i in indices:
        x,y=a[i],b[i+lag]
        xx+=x*x;yy+=y*y;xy+=x*y
    return xy/math.sqrt(xx*yy) if xx>0 and yy>0 else None

def alignment(a,b,duration):
    # Search energetic 0.5-s windows locally, because the ending intentionally has a quiet tail.
    windows=[]
    regions=[('begin',.10,min(3.10,duration-.55)),('middle',max(.10,duration/2-1.5),min(duration-.55,duration/2+1.5)),('end',max(.10,duration-3.5),duration-.55)]
    for label,start,end in regions:
        candidates=[]
        for n in range(max(1,int((end-start)/.25)+1)):
            t=start+.25*n
            ix=range(round(t*SR),round((t+.5)*SR),16)
            energy=sum(a[i]*a[i] for i in ix)/len(ix)
            candidates.append((energy,t))
        energy,t=max(candidates)
        ix=range(round(t*SR),round((t+.5)*SR),8)
        coarse=[(correlation(a,b,ix,lag),lag) for lag in range(-960,961,16)]
        best=max(coarse,key=lambda x:-2 if x[0] is None else x[0])
        fine=[(correlation(a,b,ix,lag),lag) for lag in range(best[1]-15,best[1]+16) if abs(lag)<=960]
        best=max(fine,key=lambda x:-2 if x[0] is None else x[0])
        windows.append({'region':label,'startSeconds':t,'durationSeconds':.5,'pcmRmsDbFs':20*math.log10(max(math.sqrt(energy),1e-15)),'zeroLagCorrelation':correlation(a,b,ix,0),'bestCorrelation':best[0],'bestLagSamples':best[1],'bestLagMilliseconds':best[1]/48,'searchRangeSamples':[-960,960],'sampleStride':8,'refinedLagStepSamples':1})
    return windows

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--export-complete',action='store_true',help='Only after explicit completion signal from render owner')
    args=parser.parse_args()
    if not args.export_complete:
        print('Prepared only. No export or media accessed. Await explicit completion signal.')
        return
    # From this point only final export, approved plan and cut PCM are accessed.
    for f in [PLAN,PCM,OUT]:
        if not f.is_file():raise RuntimeError('Required input missing: '+str(f))
    hashes={str(f):digest(f) for f in [PLAN,PCM,OUT]}
    plan=json.loads(PLAN.read_text())
    intervals=plan['intervals'] if isinstance(plan,dict) else plan
    mapping=[];out_frame=out_sample=0
    for number,row in enumerate(intervals):
        if not isinstance(row,list) or len(row)<2:raise RuntimeError('Unsupported interval schema')
        start,end=float(row[0]),float(row[1])
        if not (0<=start<end):raise RuntimeError('Invalid interval')
        sf,ef=round(start*FPS),round(end*FPS)
        ss,es=round(start*SR),round(end*SR)
        mapping.append({'index':number,'sourceStart':start,'sourceEnd':end,'label':row[2] if len(row)>2 else None,'sourceStartFrame':sf,'sourceEndFrameExclusive':ef,'sourceStartSample':ss,'sourceEndSampleExclusive':es,'frameCount':ef-sf,'sampleCount':es-ss,'outputStartFrame':out_frame,'outputStartSample':out_sample,'frameRasterErrorSeconds':max(abs(start-sf/FPS),abs(end-ef/FPS)),'frameSampleCountsAgree':(ef-sf)*1600==es-ss})
        out_frame+=ef-sf;out_sample+=es-ss
    expected=out_sample/SR
    save('frame-sample-map.json',{'fps':FPS,'sampleRate':SR,'intervals':mapping,'expectedFrames':out_frame,'expectedSamples':out_sample,'expectedDuration':expected,'scope':'Arithmetic time/sample mapping only. Does not prove source-content identity or phonetic completeness.'})
    data=probe(OUT);pcmp=probe(PCM)
    save('export-probe.json',data);save('pcm-probe.json',pcmp)
    videos=[s for s in data['streams'] if s['codec_type']=='video'];audios=[s for s in data['streams'] if s['codec_type']=='audio']
    if len(videos)!=1 or len(audios)!=1:raise RuntimeError('Expected exactly one video and one audio stream')
    v,a=videos[0],audios[0];pa=next(s for s in pcmp['streams'] if s['codec_type']=='audio')
    with (W/'full-decode.log').open('x') as log:
        dec=subprocess.run([str(FF),'-v','error','-xerror','-threads','2','-i',str(OUT),'-map','0:v:0','-map','0:a:0','-f','null','-'],stdout=log,stderr=subprocess.STDOUT)
    run([FF,'-v','error','-n','-i',OUT,'-map','0:a:0','-c:a','copy','-map_metadata','-1',W/'actual-aac.m4a'])
    run([FF,'-v','error','-n','-threads','2','-i',OUT,'-map','0:a:0','-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',W/'actual-asr16.wav'])
    print('AAC_ASR16_READY '+str(W/'actual-asr16.wav'),flush=True)
    model=R/'tools/models/ggml-silero-v6.2.0.bin'
    if digest(model)!='2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987':raise RuntimeError('Silero model hash mismatch')
    sil=subprocess.run([str(R/'tools/bin/silero-probabilities'),str(model),str(W/'actual-asr16.wav')],capture_output=True,text=True,check=True)
    with (W/'silero.log').open('x') as f:f.write(sil.stderr)
    save('silero-probabilities.json',json.loads(sil.stdout))
    node="import fs from 'node:fs';import {nonSpeechCandidates} from './silero-review.mjs';console.log(JSON.stringify(nonSpeechCandidates(JSON.parse(fs.readFileSync(process.argv[1],'utf8')))));"
    sig=json.loads(run(['/usr/local/bin/node','--input-type=module','-e',node,W/'silero-probabilities.json'],cwd=R))
    inner=[g for g in sig['candidates'] if g['start']>0 and g['end']<sig['duration']-1e-6]
    ms=[g['duration']*1000 for g in inner]
    sig.update({'medianMs':statistics.median(ms) if ms else None,'innerCount':len(ms),'count64to96':sum(63.99<=x<=96.01 for x in ms),'fraction64to96':sum(63.99<=x<=96.01 for x in ms)/len(ms) if ms else None,'innerOver160ms':[g for g in inner if g['duration']>.16001],'status':'descriptive_measurements_only','automaticEditing':False,'hearingPerformed':False,'interpretation':'No target-median gate. VAD estimates neither establish phonetic boundaries nor listening quality.'})
    save('pause-measurements.json',sig)
    pcm=decode(PCM);aac=decode(OUT)
    aligns=alignment(pcm,aac,min(len(pcm),len(aac))/SR)
    frames=json.loads(run([FP,'-v','error','-threads','2','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',OUT]))['frames']
    pts=[float(f['best_effort_timestamp_time']) for f in frames]
    cfr_error=max(abs(t-i/FPS) for i,t in enumerate(pts))
    diffs=[b-a for a,b in zip(pts,pts[1:])]
    audio_packets=json.loads(run([FP,'-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=pts_time,duration_time,side_data_list','-of','json',OUT]))['packets']
    packet_gaps=[float(y['pts_time'])-float(x['pts_time'])-float(x['duration_time']) for x,y in zip(audio_packets,audio_packets[1:])]
    save('timing-evidence.json',{'videoFrameCount':len(pts),'videoFirstPts':pts[0],'videoLastPts':pts[-1],'maxCfrTimestampErrorSeconds':cfr_error,'minFrameStepSeconds':min(diffs),'maxFrameStepSeconds':max(diffs),'audioPacketCount':len(audio_packets),'firstAudioPacket':audio_packets[0],'lastAudioPacket':audio_packets[-1],'maximumAudioPacketContinuityErrorSeconds':max(abs(x) for x in packet_gaps),'lastVideoFramePresentationEnd':pts[-1]+1/FPS})
    lastframe=max(0,len(pts)-FPS)
    tail=run([FF,'-v','error','-threads','2','-i',OUT,'-map','0:v:0','-vf',f'trim=start_frame={lastframe},scale=90:160','-an','-f','framemd5','-'],text=True)
    with (W/'last-second-framemd5.txt').open('x') as f:f.write(tail)
    tail_hashes=[line.rsplit(',',1)[-1].strip() for line in tail.splitlines() if line and not line.startswith('#')]
    tail_pcm=aac[max(0,round((expected-1)*SR)):min(len(aac),out_sample)]
    peak=max(abs(x) for x in aac)
    report={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputHashes':hashes,'export':str(OUT),'exportBytes':OUT.stat().st_size,'audioCodec':a['codec_name'],'audioProfile':a.get('profile'),'audioChannels':a['channels'],'audioSampleRate':int(a['sample_rate']),'audioDurationSeconds':float(a['duration']),'videoDurationSeconds':float(v['duration']),'containerDurationSeconds':float(data['format']['duration']),'dimensions':[v['width'],v['height']],'averageFrameRate':v['avg_frame_rate'],'expectedDurationSeconds':expected,'expectedFrames':out_frame,'actualFrames':len(pts),'expectedPcmSamples':out_sample,'actualPcmSamples':len(pcm),'decodedAacSamples':len(aac),'decodedAacExtraSamples':len(aac)-len(pcm),'maximumCfrTimestampErrorSeconds':cfr_error,'fullDecodeExitCode':dec.returncode,'alignmentWindows':aligns,'aacPeakDbFs':20*math.log10(max(peak,1e-15)),'aacSamplesAtOrAboveFullScale':sum(abs(x)>=1 for x in aac),'lastSecondFrameCount':len(tail_hashes),'lastSecondDistinctScaledFrameHashes':len(set(tail_hashes)),'lastSecondAudioRmsDbFs':20*math.log10(max(math.sqrt(sum(x*x for x in tail_pcm)/len(tail_pcm)),1e-15)),'pauses':{k:sig[k] for k in ['medianMs','innerCount','count64to96','fraction64to96','innerOver160ms']},'hearingPerformed':False,'wordRecognitionPerformed':False,'visualMotionReviewPerformed':False,'originalReadOrModified':False,'workflowJsonChanged':False,'limitations':['No listening, word-completeness or naturalness approval.','Frame hashes report temporal variation only, not perceptual motion quality.','Mapping verifies temporal arithmetic and AAC-to-cut-PCM alignment, not semantic source selection.','Pausenwerte are descriptive and never an editing trigger.']}
    report['checks']={'planSettings':plan.get('speed')==1 and plan.get('fps')==FPS and plan.get('sampleRate')==SR and plan.get('channels')==1,'declaredPlanCounts':plan.get('frameCount')==out_frame and plan.get('sampleCount')==out_sample and abs(plan.get('duration',-1)-expected)<1e-6,'fullDecode':dec.returncode==0,'layout':report['dimensions']==[1080,1920],'audioFormat':a['codec_name']=='aac' and a['channels']==1 and int(a['sample_rate'])==SR,'pcmFormat':int(pa['sample_rate'])==SR and pa['channels']==1,'durationWithinOneMillisecond':abs(float(a['duration'])-expected)<=.001 and abs(float(v['duration'])-expected)<=.001,'frameSampleArithmetic':all(x['frameSampleCountsAgree'] and x['frameRasterErrorSeconds']<1e-6 for x in mapping),'frameSampleCounts':len(pts)==out_frame and len(pcm)==out_sample and out_sample==out_frame*1600,'cfr30':v['avg_frame_rate']=='30/1' and cfr_error<1e-6,'audioPacketContinuity':max(abs(x) for x in packet_gaps)<2e-6,'aacPaddingWithinOneFrame':0<=len(aac)-len(pcm)<=1024,'sampledAacPcmAlignment':all(abs(x['bestLagSamples'])<=1 and x['zeroLagCorrelation'] is not None and x['zeroLagCorrelation']>.995 for x in aligns),'inputFilesUnchanged':all(digest(Path(path))==h for path,h in hashes.items())}
    report['technicalChecksAllPassed']=all(report['checks'].values())
    report['qualitativeApproval']=None
    save('technical-report.json',report)
    print(json.dumps(report,indent=2,ensure_ascii=False))

if __name__=='__main__':main()
