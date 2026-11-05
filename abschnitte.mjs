// Rendern in Abschnitten (Gesamtauftrag Tempo, Phase 4, 27.09.2026).
//
// HyperFrames 0.8.34 kann über die Befehlszeile keinen Zeitbereich rendern (der interne „distributed“-Modus ist nicht
// freigegeben und verlangt Software-Grafik). Deshalb baut die Vorlage je Abschnitt eine eigene Komposition: gleiche
// absolute Zeitleiste, auf 1/30 s eingerastet, Kamerabild über data-media-start versetzt, ohne Ton.
//
// - Abschnitte von 300 Bildern (10 s), nur Bild. Schlüssel je Abschnitt: Prüfsumme seiner Komposition (enthält nur die
//   Plan-Elemente, die ihn berühren), des Kamerabilds, der Personenebenen, der eingebundenen Dateien und der Einstellungen.
// - Unveränderte Abschnitte werden übernommen, geänderte parallel gerendert, soweit der Speicher reicht.
// - Aneinanderhängen ohne Neukodierung (concat, -c copy); der Ton kommt erst beim Upload-Export dazu.
// - Nähte: Bildzahl je Abschnitt und gesamt, vollständige Decodierung, kein Bildsprung an einer Naht ohne Schnitt.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { makeDesign22Composition } from './theme-composition-design22.mjs';
import { pruefsumme, hash, schreibeJson } from './projekte.mjs';

const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export const FPS = 30, ABSCHNITT_BILDER = 300, RAND = 0.35;

export function abschnitte(duration, groesse = ABSCHNITT_BILDER) {
  const n = Math.round(duration * FPS), out = [];
  for (let a = 0; a < n; a += groesse) out.push([a, Math.min(n, a + groesse)]);
  // Ein Rest unter 3 s kommt zum vorigen Abschnitt (Startkosten je Render-Prozess).
  if (out.length > 1 && out.at(-1)[1] - out.at(-1)[0] < 90) { const [, e] = out.pop(); out.at(-1)[1] = e; }
  return out;
}

// Nur Elemente, die den Abschnitt (mit Rand für Ein- und Ausblenden) berühren. So bleibt die Komposition eines
// Abschnitts bytegleich, solange sich an seinen Elementen nichts ändert.
export function planFuer(plan, a, b) {
  const lo = a - RAND, hi = b + RAND, ov = (s, e) => s < hi && e > lo;
  const q = { ...plan };
  q.kapitel = (plan.kapitel || []).filter(k => ov(k.start, k.end));
  q.h1 = (plan.h1 || []).filter(h => ov(h.start, h.end));
  q.h2 = (plan.h2 || []).filter(h => ov(h.start, h.end));
  q.pillen = (plan.pillen || []).filter(p => ov(p.start, p.end));
  q.akronyme = (plan.akronyme || []).filter(x => ov(x.start, x.end));
  q.schlagworte = (plan.schlagworte || []).filter(x => ov(x.start, x.end));
  q.grafiken = (plan.grafiken || []).filter(g => ov(g.start, g.end));
  q.randnotizen = (plan.randnotizen || []).filter(n => ov(n.start, n.end));
  q.lebensbalken = (plan.lebensbalken || []).filter(x => ov(x.start, x.end));
  q.logos = (plan.logos || []).filter(l => ov(l.start, l.end));
  if (plan.bilder) q.bilder = plan.bilder.filter(b => ov(b.start, b.end));
  if (plan.tagesplaene) q.tagesplaene = plan.tagesplaene.filter(t => ov(t.start, t.end));
  if (plan.tagmarken) q.tagmarken = plan.tagmarken.filter(t => ov(t.start, t.end));
  q.sprechblasen = (plan.sprechblasen || []).filter(s => ov(s.start, s.start + 4.25));
  q.captions = (plan.captions || []).filter(c => ov(c.start, c.end));
  q.zooms = (plan.zooms || []).filter(z => ov(z.start, z.end));
  // Einstieg und Outro gehören zur Struktur jeder Komposition; außerhalb ihrer Zeit liegen ihre Clips hinter dem Abschnitt.
  delete q.hinweise;
  return q;
}

function dateienHash(project, html) {
  // Alles, was die Komposition relativ einbindet und nicht in ihr selbst steht: Schriften, Icons, GSAP, Logos, Personenebenen.
  const refs = new Set(['vendor/gsap.min.js']);
  for (const m of html.matchAll(/(?:src|url)\(?=?["']?((?:assets|vendor|review|green)[^"')\s]*)/g)) refs.add(decodeURI(m[1]));
  for (const f of fs.readdirSync(path.join(project, 'assets/fonts'))) refs.add('assets/fonts/' + f);
  return hash([...refs].sort().map(f => [f, fs.existsSync(path.join(project, f)) ? pruefsumme(path.join(project, f)) : 'fehlt']));
}

function hfVersion(root) { return J(path.join(root, 'node_modules/hyperframes/package.json')).version; }

function renderEins(project, root, env, { html, out, format, quality, log }) {
  return new Promise((resolve, reject) => {
    const HF = path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs');
    const args = [HF, 'render', project, '--composition', path.basename(html), '--output', out, '--fps', String(FPS), '--quality', quality, '--workers', '1', '--sdr'];
    if (format === 'mov') args.push('--format', 'mov');
    const t0 = Date.now(), p = spawn(process.execPath, args, { cwd: root, env }), chunks = [];
    p.stdout.on('data', d => chunks.push(d)); p.stderr.on('data', d => chunks.push(d));
    p.on('close', code => {
      fs.writeFileSync(log, Buffer.concat(chunks));
      if (code) return reject(Error(`Abschnitt ${path.basename(out)}: HyperFrames fehlgeschlagen (${code}), siehe ${log}`));
      resolve({ sekunden: (Date.now() - t0) / 1000 });
    });
  });
}

const bilderIn = (ffprobe, f) => +execFileSync(ffprobe, ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();

// plan: theme-plan.json (zusammengesetzt). ziel: exports/master.<mp4|mov>. parallel: gleichzeitige Render-Prozesse.
export async function renderAbschnitte(project, { root, env, plan, format = 'mp4', quality = 'high', ziel, parallel = 2, nur = null }) {
  const BIN = path.join(root, 'tools/bin'), ffprobe = path.join(BIN, 'ffprobe');
  const dir = path.join(project, 'exports/abschnitte'); fs.mkdirSync(dir, { recursive: true });
  const media = pruefsumme(path.join(project, 'media.mp4')), hf = hfVersion(root);
  const liste = abschnitte(plan.duration).map(([a, b], k) => {
    const t0 = a / FPS, dauer = (b - a) / FPS, name = `a${String(k).padStart(2, '0')}`;
    const html = makeDesign22Composition(planFuer(plan, t0, b / FPS), { abschnitt: { t0, dauer } });
    const personen = (plan.grafiken || []).filter(g => g.person && g.start < b / FPS && g.end > t0).map(g => pruefsumme(path.join(project, g.person)));
    const schluessel = hash({ html, media, personen, dateien: dateienHash(project, html), hf, format, quality, fps: FPS });
    return { k, name, a, b, t0, dauer, html, schluessel, datei: path.join(dir, `${name}.${format}`), info: path.join(dir, `${name}.json`) };
  });
  const alt = x => { try { const i = J(x.info); return i.schluessel === x.schluessel && fs.existsSync(x.datei) && fs.statSync(x.datei).size === i.bytes ? i : null; } catch { return null; } };
  const offen = liste.filter(x => !alt(x) && (!nur || nur.includes(x.k)));
  const ergebnis = { abschnitte: liste.length, neu: offen.map(x => x.name), uebernommen: liste.filter(x => alt(x)).map(x => x.name), parallel: Math.min(parallel, offen.length) };
  const t0 = Date.now();
  // Warteschlange: höchstens `parallel` HyperFrames-Prozesse gleichzeitig, je einer mit einem Worker.
  const zeiten = {};
  let naechster = 0;
  const arbeiter = async () => {
    while (naechster < offen.length) {
      const x = offen[naechster++];
      const htmlDatei = path.join(project, `_abschnitt-${x.name}.html`), tmp = x.datei.replace(/(\.\w+)$/, '.unfertig$1');
      fs.writeFileSync(htmlDatei, x.html);
      try {
        const r = await renderEins(project, root, env, { html: htmlDatei, out: tmp, format, quality, log: path.join(project, `logs/06-abschnitt-${x.name}.log`) });
        const n = bilderIn(ffprobe, tmp);
        if (n !== x.b - x.a) throw Error(`Abschnitt ${x.name}: ${n} statt ${x.b - x.a} Bilder`);
        fs.renameSync(tmp, x.datei);   // überschreiben statt neu anlegen
        schreibeJson(x.info, { schluessel: x.schluessel, bilder: n, von: x.a, bis: x.b, bytes: fs.statSync(x.datei).size, sekunden: Math.round(r.sekunden * 10) / 10, am: new Date().toISOString() });
        zeiten[x.name] = Math.round(r.sekunden * 10) / 10;
      } finally { fs.rmSync(htmlDatei, { force: true }); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, ergebnis.parallel) }, arbeiter));
  ergebnis.renderSekunden = Math.round((Date.now() - t0) / 100) / 10; ergebnis.jeAbschnitt = zeiten;

  // Aneinanderhängen ohne Neukodierung.
  const listDatei = path.join(dir, 'liste.txt');
  fs.writeFileSync(listDatei, liste.map(x => `file '${x.datei.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const tmp = ziel.replace(/(\.\w+)$/, '.unfertig$1');
  const r = spawnSync(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listDatei, '-map', '0:v:0', '-c', 'copy', ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), tmp], { encoding: 'utf8' });
  if (r.status) throw Error('Aneinanderhängen fehlgeschlagen:\n' + r.stderr.slice(-2000));
  fs.renameSync(tmp, ziel);
  ergebnis.naehte = naehtePruefen(project, root, ziel, liste, plan);
  ergebnis.sekunden = Math.round((Date.now() - t0) / 100) / 10;
  return ergebnis;
}

// Nahtprüfung: gesamte Bildzahl, und an jeder Naht darf der Bildunterschied nicht aus der Reihe fallen
// (Grauwertdifferenz 90 × 160 an der Naht gegen die Nachbarpaare), außer an einem Schnittpunkt.
export function naehtePruefen(project, root, datei, liste, plan) {
  const ffprobe = path.join(root, 'tools/bin/ffprobe'), ffmpeg = path.join(root, 'tools/bin/ffmpeg');
  const soll = liste.at(-1).b, ist = bilderIn(ffprobe, datei);
  const befunde = [];
  if (ist !== soll) befunde.push(`Bildzahl ${ist} statt ${soll}`);
  const cutFile = path.join(project, 'review/cut-points.json'), cuts = fs.existsSync(cutFile) ? J(cutFile).cuts.map(c => c.frame) : [];
  const W = 90, H = 160, naehte = [];
  for (const x of liste.slice(1)) {
    const f = x.a, t = (f - 2) / FPS;
    const r = spawnSync(ffmpeg, ['-v', 'error', '-ss', t.toFixed(4), '-i', datei, '-frames:v', '4', '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 });
    const b = r.stdout, n = Math.floor(b.length / (W * H));
    if (n < 4) { befunde.push(`Naht ${f}: nur ${n} Bilder lesbar`); continue; }
    const d = i => { let s = 0; for (let k = 0; k < W * H; k++) s += Math.abs(b[i * W * H + k] - b[(i - 1) * W * H + k]); return s / (W * H); };
    const vor = d(1), naht = d(2), nach = d(3), schnitt = cuts.some(c => Math.abs(c - f) <= 1);
    const auffaellig = !schnitt && naht > 4 && naht > 3 * Math.max(vor, nach, 0.5);
    naehte.push({ bild: f, vorher: +vor.toFixed(2), naht: +naht.toFixed(2), nachher: +nach.toFixed(2), ...(schnitt ? { schnittpunkt: true } : {}), ...(auffaellig ? { auffaellig: true } : {}) });
    if (auffaellig) befunde.push(`Bildsprung an der Naht bei Bild ${f} (${(f / FPS).toFixed(2)} s)`);
  }
  return { bilder: ist, soll, naehte, befunde };
}
