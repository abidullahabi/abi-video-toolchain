import json, wave, numpy as np, os
os.chdir('/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt')
w=wave.open('speech.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16)
k=json.load(open('../schnitt.json'))['behalten']
out=[];t=0;m=[]
for a,b in k:
    out.append(x[int(round(a*sr)):int(round(b*sr))]); m.append((a,b,t)); t+=b-a
y=np.concatenate(out)
o=wave.open('tmp/pruef3/v3.wav','wb');o.setnchannels(1);o.setsampwidth(2);o.setframerate(sr);o.writeframes(y.tobytes());o.close()
json.dump(m,open('tmp/pruef3/map.json','w'))
sel=json.load(open('selection.json'))['ranges']
seams=[]
for r0,r1 in zip(sel,sel[1:]):
    # find output time of junction: end of last interval with a<=r0.b+0.2
    for i,(a,b,t0) in enumerate(m):
        if i+1<len(m) and b<=r0['b']+0.3 and m[i+1][0]>=r1['a']-0.3:
            seams.append({'von':r0['id'],'nach':r1['id'],'roh':[b,m[i+1][0]],'out':t0+b-a}); break
json.dump(seams,open('tmp/pruef3/seams.json','w'),indent=0)
for s in seams: print(s)
print(len(y)/sr)
