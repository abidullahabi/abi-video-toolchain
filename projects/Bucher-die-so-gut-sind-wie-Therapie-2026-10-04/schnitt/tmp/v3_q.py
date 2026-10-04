#!/usr/bin/env python3
# v3_q.py a:b [th]  -> leise Laeufe (< th dB, 10 ms) mit Zeiten, Min-Pegel
import sys, numpy as np, os
os.chdir('/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt')
db=np.load('analysis/env-db.npy')
th=float(sys.argv[2]) if len(sys.argv)>2 else -42
for arg in sys.argv[1].split(','):
    a,b=map(float,arg.split(':')); i0,i1=int(a*100),int(b*100); out=[]; i=i0
    while i<i1:
        if db[i]<th:
            j=i
            while j<i1 and db[j]<th: j+=1
            out.append(f'{i/100:.2f}-{j/100:.2f}({db[i:j].min():.0f})'); i=j
        else: i+=1
    print(arg,' '.join(out))
