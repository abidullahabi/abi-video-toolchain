import numpy as np, wave, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
w=wave.open('speech.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
a,b=float(sys.argv[1]),float(sys.argv[2]); win=int(sr*0.01); hop=int(sr*0.005)
print('sr',sr)
t=a
while t<b:
    i=int(t*sr); seg=x[i:i+win]*np.hanning(win); S=np.abs(np.fft.rfft(seg))**2; f=np.fft.rfftfreq(win,1/sr)
    db=10*np.log10(np.mean(x[i:i+hop]**2)+1e-12)
    print(f"{t:8.3f} {db:6.1f} dB  centroid {np.sum(f*S)/np.sum(S):6.0f} Hz")
    t+=0.005
