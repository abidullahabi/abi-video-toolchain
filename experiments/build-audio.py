from pathlib import Path
import json,subprocess,math,wave,sys
import numpy as np
root=Path(__file__).resolve().parent.parent;key=sys.argv[1] if len(sys.argv)>1 else 'consulting';p=Path((root/f'experiments/project-{key}.txt').read_text());m=json.loads((p/'workflow.json').read_text());duration=m['cutDuration'];sr=48000;n=int(round(duration*sr));rng=np.random.default_rng(14092026)
ff=str(root/'tools/bin/ffmpeg')
def run(args):
 r=subprocess.run([ff,'-hide_banner','-nostdin','-y']+args,capture_output=True,text=True)
 if r.returncode:print(r.stderr[-3500:],file=sys.stderr);r.check_returncode()
 return r
def wav(path,a):
 a=np.clip(a,-.98,.98);data=(a*32767).astype('<i2')
 with wave.open(str(path),'wb') as w:w.setnchannels(a.shape[1] if a.ndim>1 else 1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(data.tobytes())
def time(d):return np.arange(int(sr*d),dtype=np.float64)/sr
def note(midi,d=2.8):
 t=time(d);f=440*2**((midi-69)/12);env=(1-np.exp(-t*90))*np.exp(-t*1.5)*np.minimum(1,(d-t)*10)
 # A mellow electric-piano voice with a soft, decaying tine.
 return (np.sin(2*np.pi*f*t+.7*np.sin(2*np.pi*f*2*t)*np.exp(-t*3))+.13*np.sin(2*np.pi*f*3*t)*np.exp(-t*5))*env
music=np.zeros((n,2),dtype=np.float64)
def add(arr,sound,at,gain=1,pan=0):
 offset=int(round(at*sr));cut=max(0,-offset);offset=max(0,offset);s=sound[cut:cut+max(0,n-offset)]*gain
 if len(s):arr[offset:offset+len(s),0]+=s*math.sqrt((1-pan)/2);arr[offset:offset+len(s),1]+=s*math.sqrt((1+pan)/2)
def bandnoise(d,lo,hi):
 k=int(sr*d);z=rng.normal(0,1,k);f=np.fft.rfftfreq(k,1/sr);shape=np.clip((f-lo)/max(lo*.3,100),0,1)*np.clip((hi-f)/max(hi*.25,100),0,1);v=np.fft.irfft(np.fft.rfft(z)*shape,n=k);return v/max(np.std(v),1e-8)
beat=.6;bar=beat*4;chords=[[50,57,60,65,69],[46,53,57,62,65],[41,53,57,60,64],[48,55,60,62,67]];roots=[38,34,29,36]
for b in range(math.ceil(duration/bar)):
 at=b*bar;ci=(b//2)%4
 for k,midi in enumerate(chords[ci]):
  add(music,note(midi,3.8),at+k*.012,.14,(-.4+k*.2))
 if b%2==1:
  for k,midi in enumerate(chords[ci][2:]):add(music,note(midi+12,1.8),at+beat*(2.5+k*.5),.035,-.25+k*.25)
 for pos in [0,2.5]:
  t=time(.40);f=440*2**((roots[ci]-69)/12);s=(np.sin(2*np.pi*f*t)+.15*np.sin(4*np.pi*f*t))*(1-np.exp(-t*140))*np.exp(-t*6)
  add(music,s,at+beat*pos,.27)
 for pos in [0,1.75,2.5]:
  t=time(.21);phase=2*np.pi*(48*t+55*.018*(1-np.exp(-t/.018)));kick=np.sin(phase)*np.exp(-t*22)*(1-np.exp(-t*600));add(music,kick,at+beat*pos,.38)
 for pos in [1,3]:
  t=time(.10);sn=bandnoise(.10,750,6500)*np.exp(-t*65)*(1-np.exp(-t*1100))+.2*np.sin(2*np.pi*185*t)*np.exp(-t*80);add(music,sn,at+beat*pos,.075,.08)
 for i in range(8):
  t=time(.055);hat=bandnoise(.055,6000,14000)*np.exp(-t*100)*(1-np.exp(-t*1700));swing=.018 if i%2 else 0;add(music,hat,at+i*.5*beat+swing,.022 if i%2 else .029,-.30 if i%2 else .30)
# Stereo early reflections, musical delay and gentle fade at the boundaries.
for delay,amount in [(int(sr*.19),.11),(int(sr*.31),.07)]:music[delay:]+=music[:-delay,::-1]*amount
music*=np.minimum(np.arange(n)/sr/.7,1)[:,None]*np.minimum((n-1-np.arange(n))/sr/1.1,1)[:,None];music=np.tanh(music*.8)
wav(p/'assets/original-instrumental.wav',music)
def mapping(t):
 for s in m['keepIntervals']:
  if t<s['sourceStart']:return s['start']
  if t<=s['sourceEnd']:return s['start']+t-s['sourceStart']
 return duration
sfx=np.zeros((n,2),dtype=np.float64);events=[]
for src in {'consulting':[10.3,20.64,23.52,26.12,55.34,66.23,75.55,88.58,95.72],'werki':[0.12,5.12,9.67,20.23,30.2,40.3,45.72,50.5],'berufserfahrung':[0.16,11.52,22.57,25.05,32.43,44.98,59.55,80.13]}[key]:
 at=mapping(src);t=time(.32);whoosh=bandnoise(.32,550,7500)*np.sin(np.pi*t/.32)**2
 add(sfx,whoosh,at-.13,.048);events.append({'time':round(at,3),'type':'soft air transition'})
for src in {'consulting':[3.63,5.28,7.10,56.5,59.44,64.58,68.71,90.20,91.67,99.65],'werki':[0.12,0.89,11.0,17.18,21.55,24.5,32.2,43.9,46.5,54.34],'berufserfahrung':[3.0,5.6,23.26,26.55,29.0,32.43,46.1,52.4,61.16,68.3,82.9]}[key]:
 at=mapping(src);t=time(.105);tone=np.sin(2*np.pi*(650*t+140*t*t))*np.exp(-t*55)*(1-np.exp(-t*950));add(sfx,tone,at,.075);events.append({'time':round(at,3),'type':'soft UI tick'})
# A small low-frequency accent at the direct start.
t=time(.28);add(sfx,np.sin(2*np.pi*(63*t+1.4*(1-np.exp(-t*15))))*np.exp(-t*19)*(1-np.exp(-t*800)),0,.14)
wav(p/'assets/original-sfx.wav',sfx)
voice=p/'assets/voice-original.wav';stats=run(['-i',str(voice),'-af','loudnorm=I=-16:TP=-2:LRA=11:print_format=json','-f','null','-']);st=json.loads(stats.stderr[stats.stderr.rfind('{'):]);(p/'review/voice-loudness-before.json').write_text(json.dumps(st,indent=2)+'\n')
af=f"loudnorm=I=-16:TP=-2:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true:print_format=json"
run(['-i',str(voice),'-af',af,'-ar','48000','-c:a','pcm_s24le',str(p/'assets/voice.wav')])
run(['-i',str(p/'assets/original-instrumental.wav'),'-af','loudnorm=I=-30:TP=-3:LRA=8','-ar','48000','-c:a','pcm_s24le',str(p/'assets/music-bed.wav')])
filter='[0:a]asplit=2[voice][control];[1:a][control]sidechaincompress=threshold=0.035:ratio=2:attack=15:release=260:makeup=1[bed];[voice][bed][2:a]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.84:level=0:latency=1[mix]'
run(['-i',str(p/'assets/voice.wav'),'-i',str(p/'assets/music-bed.wav'),'-i',str(p/'assets/original-sfx.wav'),'-filter_complex',filter,'-map','[mix]','-ar','48000','-c:a','pcm_s24le',str(p/'assets/mix.wav')])
run(['-i',str(p/'assets/voice.wav'),'-i',str(p/'assets/original-sfx.wav'),'-filter_complex','[0:a][1:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.84:level=0:latency=1[m]','-map','[m]','-ar','48000','-c:a','pcm_s24le',str(p/'assets/mix-no-music.wav')])
for name in ['mix','mix-no-music']:
 r=run(['-i',str(p/f'assets/{name}.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']);j=json.loads(r.stderr[r.stderr.rfind('{'):]);(p/f'review/{name}-loudness.json').write_text(json.dumps(j,indent=2)+'\n');assert float(j['input_tp'])<-1.0;print(name,j['input_i'],'LUFS',j['input_tp'],'dBTP',flush=True)
(p/'assets/sources.json').write_text(json.dumps({'music':{'origin':'Original locally composed instrumental, synthesized specifically for this experiment. No external recordings or third-party samples.','tempoBPM':100,'duration':duration,'instruments':['electric piano','synth bass','soft kick','rim noise','shaker']},'soundEffects':{'origin':'Original procedural air transitions and soft UI tones','events':events},'speech':'User recording, synchronized cuts, linear loudness adjustment, no speed changes'},ensure_ascii=False,indent=2)+'\n')
print('Audio abgeschlossen.',flush=True)
