#!/opt/miniconda3/bin/python3
"""Wöchentliche Speicherpflege für Abdullahs Mac.

Läuft jeden Sonntag um 19:00 über launchd (de.abi.speicherpflege). Sammelt alles,
was nach festen Regeln sicher entbehrlich ist, in einem Ordner

    ~/Jetzt löschen – Woche JJJJ-MM-TT

und schreibt dort BERICHT.md. Gelöscht wird nie etwas: Abdullah löscht den Ordner
am nächsten Tag selbst oder lässt ihn liegen. Verschoben wird nur innerhalb
desselben Laufwerks (Umbenennen, kein Kopieren). zurueckholen.py im Ordner legt
alles an seinen alten Ort zurück.

    speicherpflege.py           echter Lauf
    speicherpflege.py --probe   nur Bericht, nichts verschieben
"""
import datetime, glob, json, os, re, shutil, sqlite3, subprocess, sys

PROBE = '--probe' in sys.argv
H = os.path.expanduser('~')
HEUTE = datetime.date.today()
AS = H + '/Library/Application Support'
WORKFLOW = H + '/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow'
NODE = '/usr/local/bin/node'
DRIVE_ARCHIV = H + '/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/90_Archiv/Claude-Sitzungen – Ergebnisse'
HIER = os.path.dirname(os.path.abspath(__file__))
REFERENZ = {'Schnitttest-v2-07s-2026-09-13T13-10-58-274Z', 'Komplettvideo-Blau-2026-09-13T13-51-40-665Z',
            'Video-1-1x-2026-09-13T14-20-46-781Z'}
MEDIEN = {'.mp4', '.mov', '.m4v', '.mkv', '.webm', '.wav', '.pcm', '.aac', '.m4a', '.mp3'}
MIN_CACHE = 300e6          # Zwischenspeicher erst ab 300 MB anfassen
AKTIV_TAGE = 3             # Projekte mit Änderungen in dieser Zeit gelten als in Arbeit
CLAUDE_TAGE = 90           # Claude-Agent-Sitzungen, die so lange ruhen

Z = os.path.join(H, f'Jetzt löschen – Woche {HEUTE:%Y-%m-%d}')
k = 2
while os.path.exists(Z):
    Z = os.path.join(H, f'Jetzt löschen – Woche {HEUTE:%Y-%m-%d} ({k})'); k += 1

manifest, abschnitte, hinweise = [], {}, []


def gb(b): return f'{b / 1e9:.1f}'.replace('.', ',') + ' GB'


def groesse(p):
    try:
        r = subprocess.run(['du', '-sk', p], capture_output=True, text=True, timeout=600)
        return int(r.stdout.split()[0]) * 1024
    except Exception:
        return 0


def laeuft(app):
    return subprocess.run(['pgrep', '-f', f'{app}.app/Contents/MacOS'], capture_output=True).returncode == 0


def verschieben(src, abschnitt, grund):
    if not os.path.lexists(src): return 0
    s = groesse(src)
    dst = os.path.join(Z, abschnitt, os.path.relpath(src, H))
    if not PROBE:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.stat(os.path.dirname(dst)).st_dev != os.lstat(src).st_dev:
            hinweise.append(f'Nicht verschoben, anderes Laufwerk: {src}'); return 0
        os.rename(src, dst)
    manifest.append({'original': src, 'ziel': dst, 'bytes': s, 'grund': grund})
    abschnitte.setdefault(abschnitt, []).append((s, src.replace(H, '~'), grund))
    return s


def zuletzt_geaendert(p):
    m = 0
    for r, ds, fs in os.walk(p):
        ds[:] = [d for d in ds if d != 'node_modules']
        for f in fs:
            try: m = max(m, os.lstat(os.path.join(r, f)).st_mtime)
            except OSError: pass
    return m


def medienbytes(p):
    b = 0
    for r, ds, fs in os.walk(p):
        ds[:] = [d for d in ds if d != 'node_modules']
        for f in fs:
            q = os.path.join(r, f)
            if os.path.splitext(f)[1].lower() in MEDIEN and not os.path.islink(q): b += os.path.getsize(q)
    return b


# 1. Videomaterial aus dem Content-Workflow
def videomaterial():
    lb = os.path.join(H, 'Löschbar')
    if os.path.isdir(lb):
        for d in sorted(os.listdir(lb)):
            m = re.search(r'löschbar ab (\d\d)-(\d\d)', d)
            faellig = 'sofort' in d
            if m:
                t = datetime.date(HEUTE.year, int(m.group(2)), int(m.group(1)))
                if t > HEUTE + datetime.timedelta(days=180): t = t.replace(year=HEUTE.year - 1)
                faellig = t <= HEUTE
            if faellig and os.path.isdir(os.path.join(lb, d)):
                verschieben(os.path.join(lb, d), 'Videomaterial', 'Aufgeräumtes Material eines geposteten Videos, Löschdatum erreicht')
    pd = os.path.join(WORKFLOW, 'projects')
    if not os.path.isdir(pd): return
    grenze = (datetime.datetime.now() - datetime.timedelta(days=AKTIV_TAGE)).timestamp()
    for n in sorted(os.listdir(pd)):
        p = os.path.join(pd, n)
        wf = os.path.join(p, 'workflow.json')
        if n in REFERENZ or not os.path.isfile(wf): continue
        try: m = json.load(open(wf))
        except Exception: continue
        if m.get('referenz') or m.get('videomaterialVerschoben'): continue
        if zuletzt_geaendert(p) > grenze: continue
        mb = medienbytes(p)
        if mb < 50e6: continue
        datum = m.get('postingDate')
        if m.get('postingFile') and m.get('postingSha256') and datum and datum < HEUTE.isoformat():
            projekte = [p]
            q = m.get('sourceProject')
            if q and os.path.isdir(q) and os.path.basename(q) not in REFERENZ and zuletzt_geaendert(q) <= grenze:
                try: qm = json.load(open(os.path.join(q, 'workflow.json')))
                except Exception: qm = {}
                if not qm.get('videomaterialVerschoben') and not qm.get('referenz'):
                    projekte.append(q)
            if PROBE:
                abschnitte.setdefault('Videomaterial', []).append((mb, n, 'würde aufgeräumt (Postingdatei in Drive, Postingtag vorbei)'))
                continue
            env = dict(os.environ, LOESCHBAR_DIR=os.path.join(Z, 'Videomaterial'))
            r = subprocess.run([NODE, 'aufraeumen.mjs', *projekte], cwd=WORKFLOW, env=env, capture_output=True, text=True)
            if r.returncode == 0:
                ziel = os.path.join(Z, 'Videomaterial')
                abschnitte.setdefault('Videomaterial', []).append((mb, n, 'Postingdatei in Drive per SHA-256 bestätigt, Postingtag vorbei'))
                manifest.append({'original': p, 'ziel': ziel, 'bytes': mb, 'grund': 'aufraeumen.mjs, Rückweg: node aufraeumen.mjs --zurueck mit LOESCHBAR_DIR=' + ziel})
            else:
                hinweise.append(f'Projekt {n}: Aufräumen abgelehnt – {r.stderr.strip().splitlines()[-1][:160] if r.stderr.strip() else "unbekannt"}')
        elif datum is None and zuletzt_geaendert(p) < (datetime.datetime.now() - datetime.timedelta(days=14)).timestamp() and mb > 200e6:
            hinweise.append(f'Projekt {n}: {gb(mb)} Video-/Tonmaterial, ohne Postingdatei, seit über 14 Tagen unverändert. Gehört es zu einem fertigen Video? Dann `node aufraeumen.mjs` mit dem Gestaltungsprojekt.')


# 2. Zwischenspeicher, die sich selbst neu aufbauen
def zwischenspeicher():
    feste = [
        (H + '/.cache/uv', None, 'Python-Paketzwischenspeicher (uv)'),
        (H + '/.npm/_cacache', None, 'npm-Zwischenspeicher'),
        (H + '/Library/Caches/pnpm', None, 'pnpm-Zwischenspeicher (nicht der Paketspeicher)'),
        (AS + '/Google/GoogleUpdater/crx_cache', None, 'Chrome-Updater-Zwischenspeicher'),
    ]
    feste += [(p, None, 'alte Update-Downloads') for p in glob.glob(H + '/Library/Caches/*ShipIt') + glob.glob(H + '/Library/Caches/*-updater')]
    for p, app, grund in feste:
        if os.path.isdir(p) and groesse(p) >= MIN_CACHE:
            verschieben(p, 'Zwischenspeicher', grund)
    electron = [('Notion', AS + '/Notion/Partitions/notion'), ('Antigravity IDE', AS + '/Antigravity IDE'),
                ('Antigravity', AS + '/Antigravity'), ('Visual Studio Code', AS + '/Code'), ('Notion Calendar', AS + '/Notion Calendar')]
    for app, base in electron:
        teile = [os.path.join(base, t) for t in ('Cache', 'Code Cache', 'GPUCache', 'CachedData', 'Service Worker/CacheStorage')]
        teile = [t for t in teile if os.path.isdir(t)]
        summe = sum(groesse(t) for t in teile)
        if summe < MIN_CACHE: continue
        if laeuft(app):
            hinweise.append(f'{app}: {gb(summe)} Zwischenspeicher, nicht verschoben, weil die App lief. Beim nächsten Mal App vorher beenden.')
            continue
        for t in teile: verschieben(t, 'Zwischenspeicher', f'{app}: Zwischenspeicher')
    cc = H + '/Movies/CapCut/User Data'
    teile = glob.glob(cc + '/Cache/*') + glob.glob(cc + '/Projects/com.lveditor.draft/.recycle_bin/*')
    summe = sum(groesse(t) for t in teile)
    if summe >= MIN_CACHE:
        if laeuft('CapCut'):
            hinweise.append(f'CapCut: {gb(summe)} Zwischenspeicher und Papierkorb, nicht verschoben, weil CapCut lief.')
        else:
            for t in teile:
                verschieben(t, 'Zwischenspeicher', 'CapCut ' + ('Papierkorb (gelöschte Entwürfe)' if 'recycle' in t else 'Zwischenspeicher'))


# 3. Alte Claude-Agent-Sitzungen, Ergebnisse vorher nach Google Drive
def claude_sitzungen():
    grenze = (datetime.datetime.now() - datetime.timedelta(days=CLAUDE_TAGE)).timestamp() * 1000
    for j in glob.glob(AS + '/Claude/local-agent-mode-sessions/*/*/local_*.json'):
        try: d = json.load(open(j))
        except Exception: continue
        la = int(d.get('lastActivityAt') or d.get('createdAt') or 0)
        if not la or la >= grenze: continue
        ordner = j[:-5]
        out = os.path.join(ordner, 'outputs')
        hat = os.path.isdir(out) and any(fs for _, _, fs in os.walk(out))
        titel = d.get('title') or d.get('sessionId')
        if hat and not PROBE:
            try:
                t = datetime.datetime.fromtimestamp(la / 1000)
                name = f'{t:%Y-%m-%d} - ' + re.sub(r'[/:\\]', '-', titel)[:80]
                dst = os.path.join(DRIVE_ARCHIV, name); n = 2
                while os.path.exists(dst): dst = os.path.join(DRIVE_ARCHIV, f'{name} ({n})'); n += 1
                shutil.copytree(out, dst, symlinks=True)
                zaehl = lambda p: sorted((os.path.relpath(os.path.join(r, f), p), os.path.getsize(os.path.join(r, f))) for r, _, fs in os.walk(p) for f in fs)
                if zaehl(out) != zaehl(dst): raise RuntimeError('Kopie unvollständig')
            except Exception as e:
                hinweise.append(f'Claude-Sitzung „{titel}“: Ergebnisse konnten nicht nach Drive gesichert werden ({e}); Sitzung bleibt.')
                continue
        grund = f'Claude-Agent-Sitzung „{titel}“, über {CLAUDE_TAGE} Tage ruhend' + ('; Ergebnisse in Drive 90_Archiv' if hat else '')
        if os.path.isdir(ordner): verschieben(ordner, 'Claude-Sitzungen', grund)
        verschieben(j, 'Claude-Sitzungen', 'Metadaten der Sitzung')


# 4. Nur Hinweise, nichts verschieben
def pruefen():
    db = AS + '/Wispr Flow/flow.sqlite'
    if os.path.exists(db):
        try:
            c = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
            frei = c.execute('pragma freelist_count').fetchone()[0] * c.execute('pragma page_size').fetchone()[0]
            if frei > 1e9:
                hinweise.append(f'Wispr Flow: Datenbank hat {gb(frei)} leeren Platz (plus gleich große Tagessicherung). Zu Claude sagen: „Wispr tauschen“.')
        except Exception:
            pass
    for f in glob.glob(AS + '/Google/DriveFS/canceled_uploads/*/*'):
        if os.path.isfile(f) and os.path.getsize(f) > 100e6:
            hinweise.append(f'Abgebrochener Drive-Upload, {gb(os.path.getsize(f))}: {os.path.basename(f)}. Liegt nur lokal. Erst löschen, wenn die Datei sicher in Drive ist.')
    grenze = (datetime.datetime.now() - datetime.timedelta(days=30)).timestamp()
    for r, ds, fs in os.walk(H + '/Movies'):
        ds[:] = [d for d in ds if d != 'CapCut']
        for f in fs:
            q = os.path.join(r, f)
            try: st = os.stat(q)
            except OSError: continue
            if st.st_size > 500e6 and st.st_mtime < grenze:
                hinweise.append(f'Große alte Datei in Filme, {gb(st.st_size)}: {q.replace(H, "~")}')
    for d in sorted(glob.glob(H + '/Jetzt löschen*')):
        if d != Z: hinweise.append(f'Noch nicht gelöscht: „{os.path.basename(d)}“, {gb(groesse(d))}')


def main():
    frei_vorher = shutil.disk_usage('/System/Volumes/Data').free
    if not PROBE: os.makedirs(Z)
    for schritt in (videomaterial, zwischenspeicher, claude_sitzungen, pruefen):
        try: schritt()
        except Exception as e: hinweise.append(f'Schritt {schritt.__name__} abgebrochen: {e}')
    summe = sum(s for v in abschnitte.values() for s, _, _ in v)
    frei = shutil.disk_usage('/System/Volumes/Data').free
    zeilen = [f'# Speicherpflege {HEUTE:%d.%m.%Y}', '',
              f'**{gb(summe)}** liegen in diesem Ordner. Löschen: Ordner in den Papierkorb legen und leeren. Behalten: `python3 zurueckholen.py` in diesem Ordner ausführen.',
              f'Frei auf dem Mac: {gb(frei)}, nach dem Löschen etwa {gb(frei + summe)}.', '']
    for a, eintraege in abschnitte.items():
        zeilen += [f'## {a} ({gb(sum(s for s, _, _ in eintraege))})', '']
        zeilen += [f'- {gb(s)} · {p} · {g}' for s, p, g in sorted(eintraege, reverse=True)[:40]]
        if len(eintraege) > 40: zeilen.append(f'- … und {len(eintraege) - 40} weitere, siehe MANIFEST.json')
        zeilen.append('')
    if hinweise:
        zeilen += ['## Zum Ansehen, nicht verschoben', ''] + [f'- {h}' for h in hinweise] + ['']
    bericht = '\n'.join(zeilen)
    os.makedirs(os.path.join(HIER, 'berichte'), exist_ok=True)
    open(os.path.join(HIER, 'berichte', f'{HEUTE:%Y-%m-%d}{"-probe" if PROBE else ""}.md'), 'w').write(bericht)
    if PROBE:
        print(bericht); return
    if not manifest:
        os.rmdir(Z)
        text = f'Nichts zu verschieben. Frei: {gb(frei)}.' + (f' {len(hinweise)} Hinweise im Bericht.' if hinweise else '')
    else:
        open(os.path.join(Z, 'BERICHT.md'), 'w').write(bericht)
        json.dump(manifest, open(os.path.join(Z, 'MANIFEST.json'), 'w'), ensure_ascii=False, indent=1)
        shutil.copy2(os.path.join(HIER, 'zurueckholen.py'), os.path.join(Z, 'zurueckholen.py'))
        text = f'{gb(summe)} bereit in „{os.path.basename(Z)}“. Frei danach etwa {gb(frei + summe)}.'
    subprocess.run(['/usr/bin/osascript', '-e', f'display notification "{text}" with title "Speicherpflege" sound name "Glass"'])
    print(text)


if __name__ == '__main__':
    main()
