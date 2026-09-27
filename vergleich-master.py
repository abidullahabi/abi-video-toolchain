#!/usr/bin/env python3
"""Textkanten: JPEG-Master (MP4, HyperFrames speichert Bilder als JPEG q80) gegen ProRes-Master (PNG-Aufnahme).

Tempo-Auftrag 27.09.2026, Punkt 3b. Beide Master laufen durch denselben Upload-Export (Profil CONTENT_WORKFLOW.md 10,
wie finalize-buffer-video.py). Verglichen werden Ausschnitte mit Text an drei Zeitpunkten gegen den ProRes-Master als
Referenz (verlustfrei aufgenommen): SSIM und PSNR je Ausschnitt, dazu ein Bild mit 2-facher Vergrößerung nebeneinander.

  python3 vergleich-master.py "<Projekt>" --mp4 <JPEG-Master.mp4> --prores <ProRes-Master.mov> \\
      --zeit 0.5:100,240,880,380 --zeit 53.5:100,250,880,380 --zeit 197.5:90,1270,700,390
"""
import argparse, json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FF = str(ROOT / 'tools/bin/ffmpeg')

ap = argparse.ArgumentParser()
ap.add_argument('project')
ap.add_argument('--mp4', required=True)
ap.add_argument('--prores', required=True)
ap.add_argument('--zeit', action='append', required=True, help='t:x,y,w,h')
a = ap.parse_args()
p = Path(a.project).resolve()
out = p / 'review' / 'master-vergleich'
out.mkdir(parents=True, exist_ok=True)
plan = json.loads((p / 'theme-plan.json').read_text())
vb = min(12000, int((300e6 * 0.97 * 8 / plan['duration'] - 120e3) / 1000))
conv = 'scale=in_color_matrix=bt601:in_range=tv:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1'


def upload(master, ziel):
    """Upload-Profil wie finalize-buffer-video.py (ohne Ton, ohne Projektstand zu ändern)."""
    if not ziel.exists():
        subprocess.run([FF, '-v', 'error', '-y', '-i', master, '-an', '-vf', conv, '-c:v', 'libx264', '-preset', 'slow', '-threads', '8',
                        '-b:v', f'{vb}k', '-maxrate', '14M', '-bufsize', '28M', '-profile:v', 'high', '-level:v', '4.1', '-g', '60', '-bf', '2',
                        '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', str(ziel)], check=True)
    return ziel


def frame(src, t, crop, ziel, matrix=None):
    x, y, w, h = crop
    vf = (f'{matrix},' if matrix else '') + f'crop={w}:{h}:{x}:{y},format=rgb24'
    subprocess.run([FF, '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', str(src), '-frames:v', '1', '-vf', vf, str(ziel)], check=True)
    return ziel


def metric(a_png, b_png, kind):
    r = subprocess.run([FF, '-v', 'info', '-i', str(a_png), '-i', str(b_png), '-lavfi', f'[0][1]{kind}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.search(r'All:([\d.]+)' if kind == 'ssim' else r'average:([\d.inf]+)', r)
    return float(m.group(1)) if m else None


exp_mp4 = upload(a.mp4, out / 'upload-aus-jpeg-master.mp4')
exp_pr = upload(a.prores, out / 'upload-aus-prores-master.mp4')
ergebnis = []
for z in a.zeit:
    t, c = z.split(':'); t = float(t); crop = [int(v) for v in c.split(',')]
    ref = frame(a.prores, t, crop, out / f'{t:06.1f}-referenz-prores-master.png', conv)
    e_j = frame(exp_mp4, t, crop, out / f'{t:06.1f}-upload-jpeg-weg.png')
    e_p = frame(exp_pr, t, crop, out / f'{t:06.1f}-upload-prores-weg.png')
    m_j = frame(a.mp4, t, crop, out / f'{t:06.1f}-jpeg-master.png', conv)
    ergebnis.append({'zeit': t, 'ausschnitt': crop,
                     'ssim_upload_jpegWeg': metric(e_j, ref, 'ssim'), 'ssim_upload_proresWeg': metric(e_p, ref, 'ssim'),
                     'psnr_upload_jpegWeg': metric(e_j, ref, 'psnr'), 'psnr_upload_proresWeg': metric(e_p, ref, 'psnr'),
                     'ssim_jpegMaster': metric(m_j, ref, 'ssim'), 'psnr_jpegMaster': metric(m_j, ref, 'psnr')})
    # Nebeneinander, 2-fach vergrößert (Punkt für Punkt): links JPEG-Weg, rechts ProRes-Weg.
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(e_j), '-i', str(e_p), '-filter_complex',
                    '[0]scale=iw*2:ih*2:flags=neighbor[a];[1]scale=iw*2:ih*2:flags=neighbor[b];[a][b]hstack=inputs=2', str(out / f'{t:06.1f}-nebeneinander.png')], check=True)
bericht = {'grundlage': 'Tempo-Auftrag 27.09.2026 Punkt 3b; Referenz = ProRes-Master (PNG-Aufnahme, verlustfrei), beide Wege mit demselben Upload-Profil',
           'uploadVideoKbit': vb, 'ergebnisse': ergebnis}
(out / 'bericht.json').write_text(json.dumps(bericht, indent=1, ensure_ascii=False))
print(json.dumps(bericht, indent=1, ensure_ascii=False))
