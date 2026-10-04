import json, wave, numpy as np
w=wave.open('v3.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(sr*0.005); n=len(x)//hop; db=20*np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,axis=1))+1e-9)
seams=json.load(open('seams.json'))
for i,s in enumerate(seams):
    j=int(round(s['out']/0.005))
    # silence span around junction: frames < -49
    a=j
    while a>0 and db[a-1]<-49: a-=1
    b=j
    while b<n and db[b]<-49: b+=1
    # speech level: 300ms of loud frames before a / after b
    pre=db[max(0,a-60):a]; post=db[b:b+60]
    pk=lambda v: np.percentile(v,90) if len(v) else -99
    jump=abs(x[int(s['out']*sr)]-x[int(s['out']*sr)-1])
    print(f"{i:2d} {s['von']:>10}|{s['nach']:<10} out {s['out']:7.2f} stille {(b-a)*5:4d}ms  pegel vor {pk(pre):6.1f} nach {pk(post):6.1f}  diff {pk(post)-pk(pre):+5.1f}  sprung {jump:.4f}")
