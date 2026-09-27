"""Hoerbare Stille an jedem Anschluss des Schnitts (Pegel, 10-ms-Fenster). Ergaenzt die
Silero-Messung: zeigt, wo Silero das Sprachende spaeter setzt als der letzte Laut."""
import numpy as np, wave, json, sys
wav = sys.argv[1] if len(sys.argv) > 1 else 'exports/cut-speech16k.wav'
w = wave.open(wav); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.005); n = len(x) // hop
db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
TH = float(sys.argv[2]) if len(sys.argv) > 2 else -45.0
e = json.load(open('edl.json')); t = 0; J = []
for k in e['keep'][:-1]: t += k['end'] - k['start']; J.append(t)
out = []
for j, tj in enumerate(J):
    i = int(tj / 0.005)
    a = i
    while a > 0 and db[a - 1] < TH and i - a < 200: a -= 1
    b = i
    while b < n and db[b] < TH and b - i < 200: b += 1
    out.append({'j': j, 't': round(tj, 3), 'before': (i - a) * 5, 'after': (b - i) * 5, 'total': (b - a) * 5})
json.dump(out, open('review/acoustic-gaps.json', 'w'), indent=1)
p = e['pieces']
for o in out:
    flag = ' <-- lang' if o['total'] > 150 else (' <-- eng' if o['total'] < 40 else '')
    print(f"J{o['j']:2d} {p[o['j']]['range']:6s}->{p[o['j']+1]['range']:6s} hoerbare Stille {o['total']:4d} ms (vor {o['before']:3d} / nach {o['after']:3d}){flag}")
tot = [o['total'] for o in out]
print('Median', np.median(tot), 'ms; ueber 150 ms:', sum(v > 150 for v in tot))
