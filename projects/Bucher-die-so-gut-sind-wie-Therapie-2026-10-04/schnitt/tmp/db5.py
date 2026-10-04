import numpy as np, wave, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
w=wave.open('speech.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(sr*0.005); n=len(x)//hop; db=20*np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,axis=1))+1e-9)
a,b=float(sys.argv[1]),float(sys.argv[2])
for i in range(int(round(a/0.005)),int(round(b/0.005))):
    print(f"{i*0.005:8.3f} {db[i]:6.1f} "+'#'*max(0,int((db[i]+60)/2)))
