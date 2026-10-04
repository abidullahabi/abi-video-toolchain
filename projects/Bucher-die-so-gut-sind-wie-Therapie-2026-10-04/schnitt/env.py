import numpy as np, wave, sys, json, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def load():
    w=wave.open('speech.wav'); n=w.getnframes(); x=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768
    return x,w.getframerate()
x,sr=load()
hop=int(sr*0.01)
frames=len(x)//hop
rms=np.sqrt(np.mean(x[:frames*hop].reshape(frames,hop)**2,axis=1)+1e-12)
db=20*np.log10(rms)
np.save('analysis/env-db.npy',db)
def show(a,b):
    i0,i1=int(a*100),int(b*100)
    s=''
    for i in range(i0,i1):
        v=db[i]; c=' ' if v<-55 else '.' if v<-45 else ':' if v<-38 else '-' if v<-32 else '=' if v<-26 else '#'
        s+=c
    return s
if __name__=='__main__':
    print('noise floor p10', np.percentile(db,10), 'speech p90', np.percentile(db,90))
    for arg in sys.argv[1:]:
        a,b=map(float,arg.split(':'))
        print(f'{a:7.2f} |{show(a,b)}| {b:.2f}')
