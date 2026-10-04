import json, wave, numpy as np
w=wave.open('v3.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(sr*0.005); n=len(x)//hop; db=20*np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,axis=1))+1e-9)
m=json.load(open('map.json')); TH=-45
tot=0; rows=[]
for k in range(len(m)-1):
    a,b,t0=m[k]; j=int(round((t0+b-a)/0.005))
    i=j-1
    while i>0 and db[i]<TH: i-=1
    e=j
    while e<n and db[e]<TH: e+=1
    p=(e-i-1)*0.005
    # max level in gap
    mx=db[i+1:e].max() if e>i+1 else -99
    rows.append((p,k,b,m[k+1][0],t0+b-a,mx))
for p,k,b,s,o,mx in sorted(rows,reverse=True)[:22]:
    print(f"naht {k:2d} roh {b:7.3f}|{s:7.3f} out {o:7.2f}  pause<-45dB {p*1000:4.0f} ms  max {mx:5.1f}")
print('summe ueber 150ms:', round(sum(max(0,r[0]-0.15) for r in rows),2))
