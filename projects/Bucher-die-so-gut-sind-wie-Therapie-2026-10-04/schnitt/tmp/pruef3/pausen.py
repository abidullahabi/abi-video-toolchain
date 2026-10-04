import json, wave, numpy as np, sys
w=wave.open('v3.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(sr*0.01); n=len(x)//hop; db=20*np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,axis=1))+1e-9)
m=json.load(open('map.json'))
def roh(t):
    for a,b,t0 in m:
        if t0<=t<t0+(b-a): return a+t-t0
th=float(sys.argv[1]); mn=float(sys.argv[2])
i=0; res=[]
while i<n:
    if db[i]<th:
        j=i
        while j<n and db[j]<th: j+=1
        if (j-i)*0.01>=mn: res.append((i*0.01,(j-i)*0.01))
        i=j
    else: i+=1
for t,d in sorted(res,key=lambda r:-r[1])[:25]:
    print(f"out {t:7.2f}  {d*1000:5.0f} ms  roh {roh(t):7.2f}  max in pause {db[int(t*100):int((t+d)*100)].max():6.1f}")
