#!/usr/bin/env python3
"""Pegelverlauf (10-ms-Abschnitte) aus <Projekt>/schnitt/speech.wav als Zeichenzeile, Rohzeit.
node workflow.mjs schnitt-pegel "<Projekt>" <von>:<bis> [<von>:<bis> …]
(python3 schnitt/env.py <Projektordner> <von>:<bis> …)
Zeichen: ' ' < −55 dB, '.' < −45, ':' < −38, '-' < −32, '=' < −26, '#' darüber. Speichert analysis/env-db.npy."""
import numpy as np, wave, sys, json, os
os.chdir(os.path.join(os.path.abspath(sys.argv[1]), 'schnitt'))
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
    for arg in sys.argv[2:]:
        a,b=map(float,arg.split(':'))
        if not 0<=a<b<=len(db)/100: sys.exit(f'Bereich {arg} liegt nicht in der Aufnahme (0 bis {len(db)/100:.2f} s Rohzeit, <von> kleiner als <bis>).')
        print(f'{a:7.2f} |{show(a,b)}| {b:.2f}')
