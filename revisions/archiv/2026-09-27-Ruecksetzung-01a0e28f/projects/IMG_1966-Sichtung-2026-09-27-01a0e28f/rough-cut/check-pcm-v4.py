import pathlib,json,subprocess,array
r=pathlib.Path(__file__).resolve().parents[3];p=pathlib.Path(__file__).resolve().parents[1];w=p/'rough-cut';meta=json.load(open(p/'workflow.json'));keep=json.load(open(w/'candidate-v4-plan.json'))['keepIntervals'];ff=r/'tools/bin/ffmpeg'
def dec(file):
 a=array.array('f');a.frombytes(subprocess.check_output([str(ff),'-v','error','-threads','2','-i',str(file),'-map','0:a:0','-ar','48000','-ac','1','-f','f32le','-']));return a
source=dec(meta['source']);cut=dec(w/'candidate-v4.wav');cursor=0;checks=[]
for a,b in keep:
 start=round(a*48000);n=round(b*48000)-start;err=max(abs(source[start+i]-cut[cursor+i])for i in range(288,n-288));checks.append({'sourceStart':a,'sourceEnd':b,'outputSampleStart':cursor,'samples':n,'maximumInteriorAbsoluteError':err});cursor+=n
report={'version':4,'source':meta['source'],'output':'candidate-v4.wav','sampleRate':48000,'channels':1,'expectedSamples':cursor,'actualSamples':len(cut),'expectedFramesFromSamples':cursor/1600,'sumIndividuallyRoundedVideoFrames':sum(round(b*30)-round(a*30)for a,b in keep),'excludesBoundarySeconds':.006,'maximumInteriorAbsoluteError':max(x['maximumInteriorAbsoluteError']for x in checks),'preservationPass':cursor==len(cut)and all(x['maximumInteriorAbsoluteError']<1.3e-7 for x in checks),'segments':checks,'limitation':'Proves kept sample preservation except boundary fades, not auditory completeness.'};assert report['preservationPass'];assert report['expectedFramesFromSamples']==report['sumIndividuallyRoundedVideoFrames']==2205
(w/'pcm-preservation-check-v4.json').write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items()if k!='segments'})
