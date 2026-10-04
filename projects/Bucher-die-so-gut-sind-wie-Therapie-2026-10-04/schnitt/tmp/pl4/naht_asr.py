import json, wave, numpy as np, subprocess, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
w=wave.open('../pruef3/v3.wav'); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16)
m=json.load(open('../pruef3/map.json'))
W='/Users/abi/Projekte/abi-video-toolchain/tools/bin/whisper-cli'; M='/Users/abi/Projekte/abi-video-toolchain/tools/models/ggml-large-v3-turbo-q5_0.bin'
for roh in map(float,sys.argv[1:]):
    # Ausgabezeit des Intervallendes nahe roh
    k=min(range(len(m)),key=lambda k:abs(m[k][1]-roh)); a,b,t0=m[k]; o=t0+b-a
    y=x[int(max(0,o-3.5)*sr):int((o+3.0)*sr)]
    f=f'n_{roh}.wav'; ww=wave.open(f,'wb'); ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(sr); ww.writeframes(y.tobytes()); ww.close()
    r=subprocess.run([W,'-m',M,'-l','de','-nt','--prompt','Ähm, also, äh, ich, ich mein, ähm, ja.','-f',f],capture_output=True,text=True)
    print(f"{roh:8.3f} (out {o:6.2f}, Naht {b:.4f}|{m[k+1][0]:.4f}):", ' '.join(r.stdout.split()))
