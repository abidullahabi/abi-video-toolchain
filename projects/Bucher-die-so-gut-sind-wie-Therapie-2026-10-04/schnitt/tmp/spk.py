import numpy as np, wave, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
w=wave.open('speech.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(sr*0.005); n=len(x)//hop; db=20*np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,axis=1))+1e-9)
for arg in sys.argv[1:]:
    a,b=map(float,arg.split(':'))
    i0,i1=int(round(a/0.005)),int(round(b/0.005))
    s=''.join(' ' if db[i]<-52 else '.' if db[i]<-49 else ',' if db[i]<-45 else ':' if db[i]<-38 else '-' if db[i]<-30 else '#' for i in range(i0,i1))
    print(f"{a:8.3f} |{s}| {b:.3f}")
