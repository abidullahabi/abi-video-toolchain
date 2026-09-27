"""Hoerbare Pausen (Pegel relativ zur eigenen Sprechlautstaerke) im Vergleich zu abgenommenen Schnitten.
Nur Vergleichsbeobachtung zwischen Dateien derselben Aufnahmesituation, keine Kalibriergroesse."""
import numpy as np, wave, sys, json
def pauses(path, rel=22, t0=0, t1=None):
    w = wave.open(path); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(sr * 0.005); n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[:n*hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
    a, b = int(t0/0.005), int((t1 or n*0.005)/0.005)
    db = db[a:b]
    th = np.percentile(db, 90) - rel
    quiet = db < th
    runs = []; i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            d = (j - i) * 5
            if 40 <= d <= 1500 and i > 0 and j < len(quiet): runs.append(d)
            i = j
        else: i += 1
    r = np.array(runs); mins = len(db) * 0.005 / 60
    return {'n': len(r), 'proMin': round(len(r)/mins, 1), 'p25': int(np.percentile(r, 25)), 'median': int(np.median(r)),
            'p75': int(np.percentile(r, 75)), 'ueber150': round(float((r > 150).mean()), 2), 'ueber250': round(float((r > 250).mean()), 2)}
rows = [('karriere (Referenz, 1,0x, abgenommen)', 'karriere.wav', 0, None),
        ('bewerbung (abgenommen, Tempo s.o.)', 'bewerbung.wav', 0, None),
        ('fast30 (abgenommen)', 'fast30.wav', 0, None),
        ('img1957 Pausenschnitt (Basis abgenommen)', 'img1957.wav', 0, None),
        ('Codex KI v1: 0-30 s (gelobt)', 'codex-v1.wav', 0, 30),
        ('Codex KI v1: ab 30 s (kritisiert)', 'codex-v1.wav', 30, None),
        ('mein Schnitt (Stand jetzt)', 'meinschnitt.wav', 0, None)]
res = {}
for name, f, a, b in rows:
    res[name] = pauses(f, t0=a, t1=b); print(f'{name:42s}', res[name])
json.dump(res, open('../pausen-vergleich.json', 'w'), indent=1, ensure_ascii=False)
