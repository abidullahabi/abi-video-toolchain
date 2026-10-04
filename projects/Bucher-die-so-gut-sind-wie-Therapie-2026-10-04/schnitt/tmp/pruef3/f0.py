import wave,numpy as np,os
os.chdir('/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt')
w=wave.open('speech.wav');sr=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
def f0(t):
    s=x[int(t*sr):int((t+0.04)*sr)]
    if 20*np.log10(np.sqrt(np.mean(s**2))+1e-9)<-35: return None
    s=s-s.mean(); ac=np.correlate(s,s,'full')[len(s)-1:]
    lo,hi=int(sr/300),int(sr/70); k=lo+np.argmax(ac[lo:hi])
    return sr/k if ac[k]>0.4*ac[0] else None
def track(a,b):
    out=[];t=a
    while t<b: v=f0(t); out.append('%3d'%v if v else ' - '); t+=0.02
    return ' '.join(out)
for name,a,b,c,d in [('Love.|es geht',56.5,57.0,59.57,60.0),('Leben,|und gar',106.9,107.37,113.85,114.3),('heißt|Reconc.',150.2,150.57,152.1,152.5),('Kind.|bei',180.0,180.7,182.53,182.9),('geschaut hat.|es gibt',186.2,186.75,197.25,197.7),('müssen.|stell',241.3,241.8,250.4,250.8),('sagst.|ist zäh',258.1,258.6,268.75,269.2),('Buch,|von',281.6,282.07,283.85,284.3),('Maté,|The',284.5,284.97,288.33,288.7),('Bonusbuch,|ist',334.0,334.53,335.27,335.6),('Prophet.|Es ist',336.6,337.3,344.3,344.7),('hast|oder die Sorgen',417.0,417.5,419.0,419.5),('Prozess.|Damit',382.0,382.6,395.0,395.4),('Sicherheit.|Dann',396.2,396.8,401.3,401.8)]:
    print(f'{name:22s} vor: {track(a,b)}\n{"":22s} nach: {track(c,d)}')
