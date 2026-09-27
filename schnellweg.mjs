// Schneller Ablauf für DESIGN.md 2.2 (Abdullahs Tempo-Auftrag vom 27.09.2026):
//   node workflow.mjs storyboard "<Projekt>"   Kontaktblatt: ein Standbild je Einblendung bei voller Sichtbarkeit + Textliste
//   node workflow.mjs vorschau   "<Projekt>"   Sichtungsvideo in halber Auflösung (540 × 960, Entwurfsqualität)
//   node workflow.mjs build      "<Projekt>"   Zusammensetzen, Designprüfung, genau ein Master, Upload-Export, Prüfungen,
//                                              Kontaktblatt (≤ 12 Bilder), Bericht review/build-bericht.json
// Jeder Schritt schreibt Start und Ende in logs/zeiten.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const W = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

// ---------- Zeitmessung ----------
export async function zeit(project, schritt, fn) {
  const file = path.join(project, 'logs/zeiten.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const t0 = Date.now(), start = new Date(t0).toISOString();
  let ok = false;
  try { const r = await fn(); ok = true; return r; }
  finally {
    const log = fs.existsSync(file) ? J(file) : [];
    log.push({ schritt, start, ende: new Date().toISOString(), sekunden: Math.round((Date.now() - t0) / 100) / 10, ok });
    W(file, log);
  }
}

// ---------- Render-Prozesse nach Kernen und Arbeitsspeicher ----------
// Je Chrome-Prozess rund 256 MB laut HyperFrames, dazu Bildextraktion und Kodierung. Faustregel: 4 GB je Prozess
// Reserve für System, Drive und andere Sitzungen, höchstens Kerne − 2. --low-memory-mode nur bei ≤ 8 GB oder auf Wunsch.
// Zusätzlich nach dem gerade freien Speicher (≈ 1,5 GB je Prozess inkl. Encoder-Anteil): Am 27.09.2026 brach der Encoder
// bei 4 Prozessen unter Speicherdruck ab (9,3 von 10 GB Swap belegt, write EPIPE bei Bild 5.730 von 6.071).
export function renderProfil(meta = {}) {
  const kerne = os.cpus().length, gb = os.totalmem() / 2 ** 30, freiGB = os.freemem() / 2 ** 30;
  const lowMemory = meta.renderLowMemory === true || gb <= 8;
  const nachKernen = Math.max(1, Math.min(kerne - 2, Math.floor(gb / 4)));
  const workers = lowMemory ? 1 : Math.max(1, Math.min(nachKernen, Math.floor(freiGB / 1.5), meta.renderWorkers ?? 99));
  return { kerne, arbeitsspeicherGB: Math.round(gb), freiGB: Math.round(freiGB * 10) / 10, workers, lowMemory };
}

// ---------- Momente voller Sichtbarkeit (DESIGN.md 15: Aufbauzeiten) ----------
export function momente(plan) {
  const m = [], add = (t, art, text) => { if (t >= 0 && t < plan.duration) m.push({ t: Math.round(t * 100) / 100, art, text }); };
  const e = plan.einstieg; add(0, 'Einstieg', [...e.h1.lines, ...(e.h2?.lines || [])].join(' / '));
  for (const k of plan.kapitel || []) add(k.start + 0.62, 'Kapitel', `${k.nummer || ''} ${k.titel}`.trim());
  for (const h of plan.h1 || []) add(h.start + 0.3, 'H1', h.lines.join(' '));
  for (const h of plan.h2 || []) add(h.start + 0.4, 'H2', h.lines.join(' / '));
  for (const p of plan.pillen || []) add(Math.min(p.end - 0.25, p.items.at(-1).at + 0.35), `Pillen (${p.layout === 'row' ? 'nebeneinander' : 'untereinander'})`, p.items.map(i => i.text).join(' · '));
  for (const a of plan.akronyme || []) add(a.letters.at(-1).at + 0.35, 'Akronym', a.letters.map(l => l.b).join(''));
  for (const s of plan.schlagworte || []) add(s.start + 0.7, 'Schlagwort', s.text);
  for (const g of plan.grafiken || []) add(Math.min(g.end - 0.25, g.circleAt + 0.35), 'Grafik', g.title);
  for (const n of plan.randnotizen || []) add(Math.min(n.end - 0.25, Math.max(...n.lines.map(l => (l.strikeAt ?? l.at) + 0.35))), 'Randnotiz', n.lines.map(l => l.text).join(' / '));
  for (const b of plan.lebensbalken || []) add(Math.min(b.end - 0.25, b.segments.at(-1).at + 1.05), 'Lebensbalken', b.segments.map(s => s.label).join(' | '));
  for (const l of plan.logos || []) add(l.start + 0.35, 'Logo', path.basename(l.src));
  for (const b of plan.sprechblasen || []) add(b.start + 2.7, 'Sprechblase', b.text);
  add(plan.outro.start + 2, 'Outro', `Folgen nicht vergessen · ${plan.outro.followers.toLocaleString('de-DE')}`);
  return m.sort((a, b) => a.t - b.t);
}

// ---------- Standbilder im Browser (halbe Auflösung) ----------
async function browser(root) {
  const { default: puppeteer } = await import('puppeteer-core');
  const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
  return puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
}
async function standbilder(project, root, plan, zeiten, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const b = await browser(root), out = [];
  try {
    const page = await b.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 0.5 });
    await page.goto(pathToFileURL(path.join(project, 'index.html')).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    for (const [i, t] of zeiten.entries()) {
      // Chrome spielt kein ProRes: Personenebene einer Grafik als Einzelbild einsetzen (im Render übernimmt das HyperFrames).
      const g = (plan.grafiken || []).find(g => t >= g.start && t < g.end);
      let still = null;
      if (g && fs.existsSync(path.join(project, g.person))) { still = path.join(dir, `_person-${i}.png`); execFileSync(path.join(root, 'tools/bin/ffmpeg'), ['-v', 'error', '-y', '-ss', (t - g.start).toFixed(4), '-i', path.join(project, g.person), '-frames:v', '1', '-pix_fmt', 'rgba', still]); }
      await page.evaluate(async (t, gid, still) => {
        const v = document.getElementById('footage'); v.currentTime = t; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); });
        window.__timelines.root.seek(t, false);
        document.querySelectorAll('.snap-person').forEach(x => x.remove());
        if (gid && still) { const img = document.createElement('img'); img.className = 'snap-person'; img.src = still; img.style.cssText = 'position:absolute;inset:0;width:1080px;height:1920px'; document.getElementById(gid + '-person').after(img); await img.decode(); }
      }, t, g?.id, still ? pathToFileURL(still).href : null);
      const f = path.join(dir, `bild-${String(i).padStart(3, '0')}.png`);
      await page.screenshot({ path: f }); out.push(f);
    }
  } finally { await b.close(); }
  return out;
}

// Kontaktblatt: Raster mit Zeit und Beschriftung, im Browser gesetzt (Archivo aus templates/fonts).
async function kontaktblatt(root, bilder, labels, ziel, spalten = 6) {
  const b = await browser(root);
  try {
    const page = await b.newPage(), w = 270, h = 480, zeilen = Math.ceil(bilder.length / spalten);
    await page.setViewport({ width: spalten * w, height: zeilen * (h + 58), deviceScaleFactor: 1 });
    const font = pathToFileURL(path.join(root, 'templates/fonts/Archivo[wdth,wght].ttf')).href;
    // Als Datei laden: Eine per setContent erzeugte Seite darf keine lokalen Bilder öffnen.
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html = path.join(path.dirname(ziel), '_kontaktblatt.html');
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:A;src:url("${font}")}body{margin:0;font-family:A;font-size:15px;font-weight:700;background:#fff}.g{display:grid;grid-template-columns:repeat(${spalten},${w}px)}.c{height:${h + 58}px}.c img{width:${w}px;height:${h}px;display:block}.l{padding:4px 6px;line-height:1.25;height:50px;overflow:hidden}</style><div class="g">${bilder.map((f, i) => `<div class="c"><img src="${pathToFileURL(f).href}"><div class="l">${esc(labels[i][0])}<br>${esc(labels[i][1])}</div></div>`).join('')}</div>`);
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ziel, type: 'jpeg', quality: 85, fullPage: true });
  } finally { await b.close(); }
}
const mmss = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export async function storyboard(project, { root, assemble }) {
  await zeit(project, 'storyboard: zusammensetzen', () => assemble(project));
  const plan = J(path.join(project, 'theme-plan.json')), ms = momente(plan);
  const dir = path.join(project, 'review/storyboard');
  const bilder = await zeit(project, 'storyboard: standbilder', () => standbilder(project, root, plan, ms.map(m => m.t), dir));
  await zeit(project, 'storyboard: kontaktblatt', () => kontaktblatt(root, bilder, ms.map(m => [`${mmss(m.t)} · ${m.art}`, m.text]), path.join(project, 'review/storyboard.jpg')));
  const txt = ms.map(m => `${mmss(m.t).padStart(7)}  ${m.art.padEnd(28)} ${m.text}`).join('\n');
  fs.writeFileSync(path.join(project, 'review/storyboard.txt'), `Storyboard ${plan.title || ''} · DESIGN.md ${plan.designVersion} · ${ms.length} Einblendungen · Kopf/Kappe: ${plan.kopfQuelle || '–'}\n\n${txt}\n\nHinweise: ${JSON.stringify(plan.hinweise || {}, null, 0)}\n`);
  console.log(`Storyboard: ${path.join(project, 'review/storyboard.jpg')} (${ms.length} Bilder)\n${txt}`);
  return ms;
}

// ---------- Rendern ----------
function renderHF(project, { root, run, out, format, quality, meta, comp }) {
  const HF = path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), prof = renderProfil(meta);
  const args = [HF, 'render', project, '--output', out, '--fps', '30', '--quality', quality, '--workers', String(prof.workers), '--sdr'];
  if (prof.lowMemory) args.push('--low-memory-mode');
  if (format === 'mov') args.push('--format', 'mov');
  const log = path.join(project, `logs/06-render-${path.basename(out).replace(/\.\w+$/, '')}.log`), t0 = Date.now();
  run(process.execPath, args, root, log);
  const sek = (Date.now() - t0) / 1000, frames = Math.round(meta.cutDuration * 30);
  // ms pro Bild: Gesamtzeit und reine Aufnahme (HyperFrames-Protokoll, Phase capture_streaming).
  const cap = [...fs.readFileSync(log, 'utf8').matchAll(/"phase":"capture[^"]*","status":"end"[^}]*"durationMs":(\d+)[^}]*"captureMode":"(\w+)"/g)].at(-1);
  return { datei: out, format, quality, ...prof, bilder: frames, sekunden: Math.round(sek), msProBild: Math.round(sek * 1000 / frames), aufnahmeMsProBild: cap ? Math.round(+cap[1] / frames) : null, aufnahmeModus: cap?.[2] ?? null };
}

export async function vorschau(project, { root, run, assemble }) {
  const meta = J(path.join(project, 'workflow.json'));
  await zeit(project, 'vorschau: zusammensetzen (halbe Auflösung)', () => assemble(project, { vorschau: true }));
  try {
    fs.mkdirSync(path.join(project, 'exports'), { recursive: true });
    const out = path.join(project, 'exports', `vorschau-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
    const r = await zeit(project, 'vorschau: rendern', () => renderHF(project, { root, run, out, format: 'mp4', quality: 'draft', meta }));
    console.log(JSON.stringify(r, null, 1));
    return r;
  } finally { await zeit(project, 'vorschau: zusammensetzen (voll)', () => assemble(project)); }
}

// ---------- build ----------
export async function build(project, { root, run, assemble, check }) {
  const metaFile = path.join(project, 'workflow.json'), meta = J(metaFile), bericht = { projekt: project, begonnen: new Date().toISOString(), schritte: {} };
  if (String(meta.designVersion) !== '2.2') throw Error('build ist für designVersion 2.2 gebaut.');
  const plan = await zeit(project, 'build: zusammensetzen', () => assemble(project));
  for (const g of plan.grafiken || []) if (!fs.existsSync(path.join(project, g.person))) await zeit(project, 'build: green screen ' + g.id, () => run(path.join(root, 'tools/venv-rvm/bin/python'), [path.join(root, 'green-screen-maske.py'), project, '--nur', g.id], root, path.join(project, 'logs/green-screen.log')));
  const pruefung = await zeit(project, 'build: designprüfung (jedes Bild)', () => check(project));
  bericht.designpruefung = { bilder: pruefung.framesChecked, blockierend: pruefung.blocking, maxEbenen: pruefung.maxLayers, hinweise: pruefung.warnings.length };
  await zeit(project, 'build: lint', () => run(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'lint', project], root, path.join(project, 'logs/05-lint.log')));
  const format = meta.renderMaster === 'prores' ? 'mov' : 'mp4';
  const out = path.join(project, 'exports', `final-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  bericht.render = await zeit(project, `build: rendern (${format}, ein Master)`, () => renderHF(project, { root, run, out, format, quality: 'high', meta }));
  await zeit(project, 'build: master decodieren', () => {
    const info = JSON.parse(run(path.join(root, 'tools/bin/ffprobe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out]));
    const v = info.streams.find(s => s.codec_type === 'video');
    if (!v || v.width !== 1080 || v.height !== 1920 || Math.abs(+info.format.duration - meta.cutDuration) > 0.25) throw Error('Master: Format oder Dauer stimmt nicht.');
    run(path.join(root, 'tools/bin/ffmpeg'), ['-v', 'error', '-xerror', '-i', out, '-f', 'null', '-'], root, path.join(project, 'logs/07-decode.log'));
  });
  const m2 = J(metaFile); Object.assign(m2, { latestExport: out, renderedExport: out, status: 'exported', exportedAt: new Date().toISOString() }); W(metaFile, m2);
  const name = (meta.title || path.basename(project)).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  await zeit(project, 'build: upload-export (Abschnitt 10) + VMAF + Ton', () => run('python3', [path.join(root, 'finalize-buffer-video.py'), project, name], root, path.join(project, 'logs/08-export.log')));
  const exp = J(path.join(project, 'review/final-export-check.json'));
  bericht.export = { datei: exp.file, mb: Math.round(exp.sizeBytes / 1e5) / 10, videoKbit: Math.round(exp.videoBitrate / 1000), vmaf: Math.round(exp.vmafMeanVsRenderedMaster * 10) / 10, tonVersatzMs: exp.audioAlignmentChecks.map(c => c.bestLagMilliseconds), sha256: exp.sha256 };
  // Kontaktblatt aus der Exportdatei: erster Frame + wichtigste Einblendungen, höchstens 12 Bilder.
  await zeit(project, 'build: kontaktblatt (≤ 12)', async () => {
    const all = momente(plan), pick = [all[0], ...all.slice(1).filter((_, i, a) => a.length <= 11 || i % Math.ceil(a.length / 11) === 0)].slice(0, 12);
    const dir = path.join(project, 'review/kontaktblatt'); fs.mkdirSync(dir, { recursive: true });
    const bilder = pick.map((m, i) => { const f = path.join(dir, `bild-${i}.png`); run(path.join(root, 'tools/bin/ffmpeg'), ['-v', 'error', '-y', '-ss', m.t.toFixed(3), '-i', exp.file, '-frames:v', '1', '-vf', 'scale=540:960', f]); return f; });
    await kontaktblatt(root, bilder, pick.map(m => [`${mmss(m.t)} · ${m.art}`, m.text]), path.join(project, 'review/kontaktblatt.jpg'));
  });
  // Prüfliste DESIGN.md 20
  const fehler = t => pruefung.errors.filter(e => e.type === t || (Array.isArray(t) && t.includes(e.type))).length;
  const gs = fs.existsSync(path.join(project, 'review/green-screen/bericht.json')) ? J(path.join(project, 'review/green-screen/bericht.json')) : null;
  const fol = J(path.join(project, 'follower-source.json'));
  bericht.pruefliste20 = [
    ['1 Einstieg am ersten codierten Frame vollständig, ohne Animation', fehler('einstieg_frame0') === 0],
    ['2 Zentrierte Elemente auf x = 540', fehler('mittelachse') === 0],
    ['3 Nichts in gesperrten Zonen (inkl. Kontur, Schatten, Animation)', fehler(['gesperrte_zone', 'aktionsleiste', 'obere_zone']) === 0],
    ['4 Breitengrenzen, Untertitel einzeilig', fehler(['untertitel_breite', 'untertitel_umbruch', 'h1_breite', 'h2_breite', 'kapitel_breite', 'pillen_reihe_breite', 'schlagwort_breite']) === 0],
    ['5 Genau ein Wort blau im Untertitel', fehler('untertitel_blau') === 0],
    ['6 Pink nur Schlagwort und Durchstreichen (Emojis ausgenommen)', fehler(['pink_ausserhalb', 'farbe']) === 0],
    ['7 Gochi Hand nur für Zahlen und Akronyme', fehler('gochi_nicht_zahl') === 0],
    ['8 Höchstens zwei Textebenen zusätzlich zum Untertitel', fehler('drei_textebenen') === 0],
    ['9 Green Screen mit Robust Video Matting', !(plan.grafiken || []).length || !!gs, gs ? `Deckungssprung Mittel ${gs.abschnitte.map(a => a.deckungSprungMittel).join(', ')}` : null],
    ['10 Followerstand aus aktuellem Zernio-Abruf', fol.lastUpdated && plan.outro.followers === fol.wert, `${fol.wert}, Stand ${fol.lastUpdated}`],
    ['11 Nichts aus Abschnitt 17 ohne Testauftrag, nichts aus 18', true, 'Vorlage enthält keine Soundeffekte, B-Roll, Memes, Musik, Sticker'],
    ['12 Fertiges Video einmal vollständig angesehen (Handy)', null, 'offen: Abdullah'],
  ].map(([punkt, ok, notiz]) => ({ punkt, ergebnis: ok === null ? 'offen' : ok ? 'bestanden' : 'Befund', ...(notiz ? { notiz } : {}) }));
  const zs = J(path.join(project, 'logs/zeiten.json')).filter(z => z.start >= bericht.begonnen);
  bericht.dauerSekunden = Math.round(zs.reduce((s, z) => s + z.sekunden, 0)); bericht.schritte = zs.map(z => ({ schritt: z.schritt, sekunden: z.sekunden }));
  bericht.kontaktblatt = path.join(project, 'review/kontaktblatt.jpg'); bericht.fertig = new Date().toISOString();
  W(path.join(project, 'review/build-bericht.json'), bericht);
  console.log(JSON.stringify({ export: bericht.export, render: bericht.render, dauerSekunden: bericht.dauerSekunden, pruefliste: bericht.pruefliste20.map(p => `${p.ergebnis}: ${p.punkt}`) }, null, 1));
  return bericht;
}
