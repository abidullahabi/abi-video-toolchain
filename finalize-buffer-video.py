"""Upload-Export nach CONTENT_WORKFLOW Abschnitt 10 aus dem gerenderten Master (Bild) und media.mp4 (Ton).

Seit 28.09.2026 (Gesamtauftrag Tempo, Phase 5):
- ein Upload-Export pro finaler Fassung: fester Name exports/upload.mp4, wird überschrieben (CONTENT_WORKFLOW 1.28),
- Encoder-Voreinstellung EXPORT_PRESET (gemessen: VMAF und Profil halten, siehe Testprotokoll), alle Kerne,
- VMAF nur an Stichproben (6 × 1 s, darunter das erste Bild), jedes Bild darin,
- Tonabgleich vektorisiert (numpy), vollständige Decodierung wie bisher.
Aufruf: python3 finalize-buffer-video.py <Projekt> [<alter Namensparameter, wird ignoriert>]
"""
from pathlib import Path
import subprocess, json, hashlib, sys, datetime, os
import numpy as np

EXPORT_PRESET = os.environ.get('EXPORT_PRESET', 'medium')
p = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent
ff = str(root / 'tools/bin/ffmpeg'); probe = str(root / 'tools/bin/ffprobe')
m = json.loads((p / 'workflow.json').read_text()); plan = json.loads((p / 'theme-plan.json').read_text())
master = Path(m['renderedExport'] if m.get('renderedExport') and Path(m['renderedExport']).exists() else m['latestExport']); source = p / 'media.mp4'
# Tonspur: media.mp4 oder, wenn der Plan Soundeffekte hat, die fertige Mischung (ton-mix.py, DESIGN.md 17).
ton = p / plan['tonQuelle'] if plan.get('tonQuelle') else source
assert ton.exists(), ('Tonspur fehlt', str(ton))
(p / 'exports').mkdir(parents=True, exist_ok=True)
out = p / 'exports' / 'upload.mp4'
tmp = p / 'exports' / 'upload.unfertig.mp4'
source_duration = float(subprocess.check_output([probe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(source)]))
assert abs(source_duration - plan['duration']) < .1, 'Dieses Hilfsskript setzt unveränderten Schnitt und unverändertes Tempo voraus.'
# HyperFrames kodiert seinen Master (MP4 wie ProRes) mit der BT.601-Matrix, kennzeichnet MP4 aber als BT.709
# (gemessen 26.09.2026 an der H1-Flaeche #1668b5). Mit masterColorMatrix "bt601" wird echt nach BT.709 umgerechnet.
conv = 'scale=in_color_matrix=bt601:in_range=tv:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1' if m.get('masterColorMatrix') == 'bt601' else None
# Ziel 12 Mbit/s, aber nie über die 300-MB-Grenze des Zernio-Wegs (Abschnitt 10). 3 % Reserve, Ton 120 kbit/s.
vb = min(int(os.environ.get('EXPORT_KBIT', 12000)), int((300e6 * 0.97 * 8 / plan['duration'] - 120e3) / 1000))   # EXPORT_KBIT: höhere Zielrate für einzelne Videos (Vlog München, 05.11.2026)
args = [ff, '-v', 'error', '-y', '-i', str(master), '-i', str(ton), '-map', '0:v:0', '-map', '1:a:0'] + (['-vf', conv] if conv else []) + [
    '-c:v', 'libx264', '-preset', EXPORT_PRESET, '-threads', '0', '-b:v', f'{vb}k', '-maxrate', '14M', '-bufsize', '28M', '-profile:v', 'high', '-level:v', '4.1',
    '-g', '60', '-bf', '2', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '120k', '-ar', '48000', '-ac', '2', '-map_metadata', '-1', '-movflags', '+faststart', str(tmp)]
subprocess.run(args, check=True)
info = json.loads(subprocess.check_output([probe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(tmp)]))
v = next(s for s in info['streams'] if s['codec_type'] == 'video'); a = next(s for s in info['streams'] if s['codec_type'] == 'audio')
assert (v['width'], v['height'], v['avg_frame_rate'], v['codec_name'], v['pix_fmt']) == (1080, 1920, '30/1', 'h264', 'yuv420p')
assert all(v.get(k) == 'bt709' for k in ['color_space', 'color_transfer', 'color_primaries'])
assert int(v['bit_rate']) < 25000000 and int(a['bit_rate']) <= 128000 and tmp.stat().st_size < 300000000
assert a['codec_name'] == 'aac' and a['profile'] == 'LC'
assert abs(float(info['format']['duration']) - plan['duration']) < .1

# Stichproben: erstes Bild (Einstieg, Abschnitt 10) und fünf weitere Sekunden gleichmäßig verteilt, jede ganz.
d = plan['duration']
fenster = [0.0] + [round(min(d - 1.05, d * k / 6), 3) for k in range(1, 6)]
sel = '+'.join(f'between(t,{s:.3f},{s + 1 - 1e-3:.3f})' for s in fenster)
vmaf_file = p / 'review/buffer-vmaf.json'
# Ein Durchgang: decodiert beide Dateien vollständig (-xerror belegt die vollständige Decodierbarkeit) und misst VMAF
# nur an den ausgewählten Bildern.
ref = f'[1:v]{conv + "," if conv else ""}select=\'{sel}\',setpts=N/30/TB[ref]'
subprocess.run([ff, '-v', 'error', '-xerror', '-i', str(tmp), '-i', str(master), '-lavfi',
                f'[0:v]select=\'{sel}\',setpts=N/30/TB[dis];{ref};[dis][ref]libvmaf=n_threads={os.cpu_count()}:log_fmt=json:log_path={vmaf_file}', '-an', '-f', 'null', '-'], check=True)
vm = json.loads(vmaf_file.read_text())
vmaf = vm['pooled_metrics']['vmaf']['mean']; vmaf_min = vm['pooled_metrics']['vmaf']['min']; n_vmaf = len(vm['frames'])
assert n_vmaf >= 150, ('zu wenige VMAF-Bilder', n_vmaf)
assert vmaf > 95, ('VMAF', vmaf)
print('Buffer-Profil, vollständige Decodierung und VMAF-Stichproben geprüft.', flush=True)

def samples(f):
    data = subprocess.check_output([ff, '-v', 'error', '-i', str(f), '-vn', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 's16le', '-'])
    return np.frombuffer(data, dtype=np.int16).astype(np.float64)
original = samples(ton); encoded = samples(tmp); checks = []
for sec in [1, max(1, d / 2 - 2.5), d - 6]:
    st = int(sec * 8000); x = original[st:st + 40000]; x = x - x.mean()
    best = None
    for lag in range(-8, 9):
        y = encoded[st + lag:st + lag + len(x)]
        if len(y) != len(x): continue
        y = y - y.mean(); c = float(np.dot(x, y) / np.sqrt(np.dot(x, x) * np.dot(y, y)))
        if best is None or c > best[0]: best = (c, lag)
    score, lag = best; assert score > .97 and abs(lag) <= 1, (sec, score, lag)
    checks.append({'startSeconds': sec, 'durationSeconds': 5, 'bestLagMilliseconds': lag / 8, 'correlation': score})
os.replace(tmp, out)   # überschreiben statt neu anlegen
sha = hashlib.sha256()
with out.open('rb') as f:
    for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''): sha.update(chunk)
report = {'file': str(out), 'renderedMaster': str(master), 'duration': float(info['format']['duration']), 'width': 1080, 'height': 1920, 'fps': 30, 'frames': int(v['nb_frames']),
          'videoBitrate': int(v['bit_rate']), 'audioBitrate': int(a['bit_rate']), 'sizeBytes': out.stat().st_size, 'encoderPreset': EXPORT_PRESET,
          'vmafMeanVsRenderedMaster': vmaf, 'vmafMinVsRenderedMaster': vmaf_min, 'vmafStichproben': {'fensterSekunden': fenster, 'bilder': n_vmaf},
          'fullyDecoded': True, 'audioAlignmentChecks': checks,
          'audioHandling': ('Mix with sound effects (' + plan['tonQuelle'] + ', review/ton-mix.json)' if plan.get('tonQuelle') else 'Audio of media.mp4') + ' re-encoded once as AAC-LC at 120 kbit/s and 48 kHz' + (', voice enhanced in media.mp4 (workflow.json ton: ' + m['ton'] + ', logs/ton.json)' if m.get('ton') else ', without tempo or level changes') + '.',
          'captionMaxWords': max(len(c['words']) for c in plan['captions']), 'sha256': sha.hexdigest(), 'bufferProfilePassed': True}
(p / 'review/final-export-check.json').write_text(json.dumps(report, indent=2) + '\n')
jetzt = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
# Ein Zeiger statt vier (Nachbesprechung Punkt 7). Trägt die Prüfsumme mit, damit er nicht stillschweigend veralten kann.
m = json.loads((p / 'workflow.json').read_text())
m.update(latestExport=str(out), renderedExport=str(master), status='complete', audioHandling=report['audioHandling'],
         deliveryProfile=f'Zernio/Buffer: H264 ({EXPORT_PRESET}), 1080x1920p30, BT709, {vb}k video target (max. 12M, 300-MB-Grenze) / 14M VBV, AAC-LC 120k, faststart', layoutVersion='tiktok-safe-v1',
         aktuell={'datei': str(out), 'sha256': report['sha256'], 'bytes': report['sizeBytes'], 'erzeugt': jetzt, 'gesetztAm': jetzt})
(p / 'workflow.json').write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['file', 'duration', 'sizeBytes', 'videoBitrate', 'encoderPreset', 'vmafMeanVsRenderedMaster', 'vmafMinVsRenderedMaster', 'audioAlignmentChecks']}, indent=2), flush=True)
