#!/usr/bin/env python3
"""Storyboard eines Themenplans: Standbild an jedem Moment, an dem oben etwas passiert.
Aufruf: python3 storyboard.py plan-input-A.json A"""
import json, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
src, key = sys.argv[1], sys.argv[2]
html = f'index-{key}.html'
env = dict(os.environ, LENIENT='1')
subprocess.run(['node', 'build-plan.mjs', src, html], check=True, env=env, stdout=subprocess.DEVNULL)
p = json.load(open(src))
events = []
for s in p['sections']: events.append((s['start'] + (0.02 if s['start'] == 0 else 0.45), 'H1 ' + s['text']))
for o in p['overlays']:
    label = ' · '.join(q['text'] for q in o['parts']) if o.get('parts') else ' / '.join(o['lines'])
    events.append((o['start'] + 0.35, 'H2 ' + label))
    for q in o.get('parts') or []:
        for a, b in q.get('active', [])[:1]:
            if a > o['start'] + 0.5: events.append((a + 0.1, f"H2 aktiv: {q['text']}"))
for n in p['notes']:
    last = max(l['at'] for l in n['lines'])
    strikes = [l['strikeAt'] for l in n['lines'] if l.get('strikeAt')]
    events.append((last + 0.35, 'Notiz ' + ' / '.join(l['text'] for l in n['lines'])))
    if strikes: events.append((max(strikes) + 0.35, 'Notiz durchgestrichen'))
for b in p['bigwords']: events.append((b['start'] + 0.35, 'Groß: ' + b['text']))
events.append((p['outroStart'] + 2.2, 'Outro'))
events = sorted(set((round(t, 2), l) for t, l in events if t < 200.8))
times = [str(t) for t, _ in events]
subprocess.run(['node', 'snap.mjs', f'sb{key}'] + times, check=True, env=dict(os.environ, HTML=html), stdout=subprocess.DEVNULL)
W, H, cols = 270, 480, 6
rows = (len(events) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, (H + 44) * rows), 'white')
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15)
except Exception: font = ImageFont.load_default()
for i, (t, label) in enumerate(events):
    im = Image.open(f'review/sb{key}-{float(t):.2f}.png').convert('RGB').resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 44)
    sheet.paste(im, (x, y))
    m, s = divmod(t, 60)
    d.text((x + 6, y + H + 4), f'{int(m)}:{s:04.1f}  {label}'[:34], fill='black', font=font)
    if len(label) > 26: d.text((x + 6, y + H + 22), label[26:60], fill='black', font=font)
sheet.save(f'review/Storyboard-Entwurf-{key}.jpg', quality=82)
os.makedirs('review/storyboard-html', exist_ok=True)
os.replace(html, f'review/storyboard-html/{html}')  # nur eine index.html im Projekt (HyperFrames-Lint)
print(key, len(events), 'Momente')
