"""Prueft, ob an einer Schnittnaht ein sichtbarer Sprung im Bild entsteht.

    python3 pruefe-bildnaht.py <video.mp4> [<silero-analyse-ordner>]

Hintergrund: Wenn zwischen zwei Anlaeufen desselben Satzes geschnitten wird,
vergehen Sekunden, in denen Abdullah sich bewegt. Der Ton ist seit der
Nachbesprechung messbar (Silero-Signatur), das Bild an der Naht war es nicht.
Der Vorgaenger check-cut-seams.py wurde eingezogen, weil sein Tonteil auf einer
Pegelschwelle beruhte; sein Bildteil hatte kein Ersatzstueck.

Verfahren: Je Naht ein Standbild kurz davor und kurz danach. Verglichen wird nur
der obere Bildteil — unten wechseln die Untertitel ohnehin. Kennzahl ist die
mittlere absolute Helligkeitsabweichung, normiert auf 0 bis 100.

Keine Bildbibliothek noetig: ffmpeg liefert Rohbilder, numpy rechnet.
"""
from pathlib import Path
import subprocess, json, sys, statistics
import numpy as np

ROOT = Path(__file__).resolve().parent
FF = str(ROOT / 'tools/bin/ffmpeg')

ABSTAND = 0.05        # Sekunden Abstand der Vergleichsbilder zur Naht
OBERER_TEIL = 0.62    # nur dieser Anteil des Bildes, darunter die Untertitelzone
BREITE, HOEHE = 1080, 1920


def bild(video, t):
    """Ein Standbild als Graustufen-Array, nur oberer Bildteil."""
    roh = subprocess.run(
        [FF, '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', str(video),
         '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True, check=True).stdout
    if len(roh) < BREITE * HOEHE * 3:
        return None
    a = np.frombuffer(roh[:BREITE * HOEHE * 3], dtype=np.uint8).reshape(HOEHE, BREITE, 3)
    return a[:int(HOEHE * OBERER_TEIL)].mean(axis=2)


def abweichung(a, b):
    """Mittlere absolute Helligkeitsabweichung, 0 bis 100."""
    return float(np.abs(a - b).mean()) / 255 * 100


def naehte_aus_silero(ordner):
    j = json.loads((Path(ordner) / 'speech-boundaries.json').read_text())
    d = j['duration']
    return [(c['start'], c['end']) for c in j['candidates'] if c['start'] > 0.2 and c['end'] < d - 0.2]


def pruefe(video, analyse):
    naehte = naehte_aus_silero(analyse)
    werte = []
    for start, ende in naehte:
        vor, nach = bild(video, start - ABSTAND), bild(video, ende + ABSTAND)
        if vor is None or nach is None:
            continue
        werte.append({'naht': round(start, 3), 'abweichung': round(abweichung(vor, nach), 2)})
    if not werte:
        return {'ok': False, 'grund': 'Keine auswertbare Naht gefunden.'}

    zahlen = [w['abweichung'] for w in werte]
    med = statistics.median(zahlen)
    # Schwelle relativ zum Video selbst: eine Naht faellt auf, wenn sie deutlich
    # staerker abweicht als die uebrigen Naehte derselben Aufnahme. Ein fester
    # Absolutwert waere von Licht und Kleidung abhaengig.
    grenze = max(med * 2.2, med + 1.5)
    auffaellig = [w for w in werte if w['abweichung'] > grenze]
    for w in werte:
        w['auffaellig'] = w['abweichung'] > grenze
    return {'ok': not auffaellig, 'naehte': len(werte), 'median': round(med, 2),
            'grenze': round(grenze, 2), 'auffaellig': auffaellig, 'alle': werte}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Aufruf: python3 pruefe-bildnaht.py <video.mp4> [<silero-analyse-ordner>]')
    video = Path(sys.argv[1]).resolve()
    if len(sys.argv) > 2:
        analyse = Path(sys.argv[2])
    else:
        treffer = sorted((ROOT / 'analysis').glob('Silero-*'))
        if not treffer:
            sys.exit('Keine Silero-Analyse gefunden. Erst: node workflow.mjs analyze-speech <video>')
        analyse = treffer[-1]
        print(f'Verwende Analyse: {analyse.name}', file=sys.stderr)
    r = pruefe(video, analyse)
    print(json.dumps(r, indent=2, ensure_ascii=False))
    if not r['ok']:
        print(f"\n{len(r['auffaellig'])} Naht/Naehte mit sichtbarem Sprung. Vor der Gestaltung ansehen.", file=sys.stderr)
        sys.exit(1)
