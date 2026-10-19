// Ein Projekt pro Video und nur neu rechnen, was sich geändert hat (Gesamtauftrag Tempo, Phase 2, 27.09.2026).
//
//   node workflow.mjs anlegen "<Rohvideo>" --title "<Titel>" [--farbkorrektur A] [--datum JJJJ-MM-TT]
//        legt projects/<Titel>-<Datum> an (oder nimmt das bestehende Projekt derselben Aufnahme), mit Anspruch
//        (bearbeitung) und Kollisionsprüfung. Das Rohvideo wird nicht ins Projekt kopiert.
//   node workflow.mjs vorbereiten "<Projekt>"
//        Kamerabild media.mp4 (Schnitt aus schnitt.json und Farbkorrektur in einem Durchgang aus dem Rohvideo),
//        Tonspur speech.wav, Wörter (ein Whisper-Durchgang mit Wortzeiten), Gesichter, Schnittpunkte.
//        Jeder Schritt überspringt sich, wenn seine Eingaben gleich geblieben sind (logs/cache.json).
//
// schnitt.json (nur bei beauftragtem Schnitt): {"behalten": [[start, ende], …]} in Sekunden des Rohvideos. Die Bereiche laufen in der
// Reihenfolge der Liste; meist aufsteigend, umgestellt (Abdullahs Freigabe, etwa CTA ans Ende) nur ohne Überlappung (19.10.2026).
// Die Wörter werden dann einmal auf dem ungeschnittenen Ton erkannt und über die Schnittliste in die
// Schnittzeit umgerechnet, statt ein zweites Mal zu transkribieren.
//
// workflow.json "tempo" (z. B. 1.1, nur auf Abis Auftrag, CONTENT_WORKFLOW 8): Kamerabild und Ton werden im selben Durchgang
// beschleunigt (setpts/atempo, Tonhöhe bleibt), Wörter und Schnittpunkte in die beschleunigte Zeit umgerechnet. Die Gestaltung
// läuft danach in normaler Geschwindigkeit über dem schnelleren Bild (wie KI-Zertifikate, 27.09.2026). Ohne "tempo" unverändert.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, PROJEKTE, CACHE, schritt, pruefsumme, schreibeJson, hash } from './projekte.mjs';

const BIN = path.join(ROOT, 'tools/bin');
const FF = path.join(BIN, 'ffmpeg'), FP = path.join(BIN, 'ffprobe');
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const FPS = 30;

function ff(args, cwd, log) {
  const r = spawnSync(FF, ['-hide_banner', '-nostdin', ...args], { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (log) fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''));
  if (r.status) throw Error('ffmpeg fehlgeschlagen:\n' + (r.stderr || '').slice(-3000));
  return r.stdout;
}
const probe = f => JSON.parse(execFileSync(FP, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f], { encoding: 'utf8' }));
// Dauer aus der Bildspur (Bilder / 30): Der Container zählt die AAC-Auffüllung des Tons mit (55,24 statt 55,233 s).
const dauer = f => { const v = probe(f).streams.find(s => s.codec_type === 'video'); return +v.nb_frames > 0 ? +v.nb_frames / FPS : Number(v.duration); };

// 16: Farbkorrektur A im YUV- bzw. RGB-Raum mit ausdrücklicher BT.709-Matrix (wie build-graded-media.py, abgenommen 26.09.2026).
const FARBKORREKTUR = {
  A: "eq=gamma=0.96:saturation=1.12:brightness=-0.015,scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=gbrp,colorbalance=rm=0.03:gm=0.005:bm=-0.03:rh=0.01:bh=-0.02,curves=all='0/0 0.5/0.49 1/0.95',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
};
// Arbeitskopie: nahezu verlustfrei (CRF 10 wie bisher), aber schnellere Voreinstellung und Schlüsselbild je Sekunde,
// damit Standbilder, Gesichtserkennung und Abschnitts-Render schnell springen können. Messung siehe Testprotokoll.
export const KAMERABILD = { crf: 10, preset: 'fast', gop: 30, audio: '320k' };

// ---------- anlegen ----------
export async function anlegen(roh, opts = {}) {
  if (!roh) throw Error('Bitte den Pfad zum Rohvideo angeben.');
  const quelle = fs.realpathSync(path.resolve(roh));
  fs.closeSync(fs.openSync(quelle, 'r'));
  const info = probe(quelle), v = info.streams.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
  if (!v || !info.streams.some(s => s.codec_type === 'audio')) throw Error('Das Rohvideo braucht Bild und Ton.');
  const { kollision } = await import('./pruefungen.mjs');
  const fremd = kollision(quelle);
  if (fremd.length) throw Error(`Andere Sitzung arbeitet an dieser Aufnahme: ${fremd.map(x => `${x.projekt} (${x.agent}, seit ${x.begonnen})`).join('; ')}. Nicht anfangen, Abdullah fragen.`);
  const sha = pruefsumme(quelle);
  // Ein Projekt pro Video: Gibt es schon ein Projekt (Design 2.2) für genau diese Aufnahme, wird es weiterverwendet.
  // --neu: trotzdem ein neues Projekt (nur für Messläufe; sonst gilt „ein Projekt pro Video“).
  for (const name of opts.neu ? [] : fs.readdirSync(PROJEKTE)) {
    const f = path.join(PROJEKTE, name, 'workflow.json');
    if (!fs.existsSync(f)) continue;
    let m; try { m = J(f); } catch { continue; }
    if (m.sourceSha256 === sha && String(m.designVersion) === '2.2') {
      m.bearbeitung = { agent: process.env.AGENT_NAME || 'claude', aufgabe: opts.aufgabe || `Gestaltung ${m.title}`, begonnen: new Date().toISOString(), status: 'in_arbeit' };
      schreibeJson(f, m);
      console.log(`Projekt besteht schon, wird weiterverwendet: ${path.join(PROJEKTE, name)}`);
      return path.join(PROJEKTE, name);
    }
  }
  const titel = opts.title || path.basename(quelle, path.extname(quelle)).replace(/^\d{4}-\d{2}-\d{2} - /, '');
  const datum = opts.datum || (path.basename(quelle).match(/^(\d{4}-\d{2}-\d{2}) - /)?.[1]) || null;
  const slug = titel.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'Video';
  let ordner = path.join(PROJEKTE, `${slug}-${new Date().toISOString().slice(0, 10)}`);
  for (let i = 2; fs.existsSync(ordner); i++) ordner = path.join(PROJEKTE, `${slug}-${new Date().toISOString().slice(0, 10)}-${i}`);
  fs.mkdirSync(path.join(ordner, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'review'), { recursive: true });
  const hdr = ['smpte2084', 'arib-std-b67'].includes(v.color_transfer);
  const meta = {
    mode: fs.existsSync(path.join(ordner, 'schnitt.json')) ? 'cut-and-design' : 'design-only', title: titel, designVersion: '2.2',
    source: quelle, sourceSha256: sha, sourceBytes: fs.statSync(quelle).size, sourceDuration: Number(info.format.duration),
    sourceVideo: { width: v.width, height: v.height, fps: v.avg_frame_rate, codec: v.codec_name, transfer: v.color_transfer || null, hdr },
    farbkorrektur: opts.farbkorrektur || null, renderMaster: 'mp4', masterColorMatrix: 'bt601',
    ...(datum ? { posting: { datum, zeit: '19:00', zeitzone: 'Europe/Berlin' } } : {}),
    createdAt: new Date().toISOString(),
    bearbeitung: { agent: process.env.AGENT_NAME || 'claude', aufgabe: opts.aufgabe || `Gestaltung ${titel}`, begonnen: new Date().toISOString(), status: 'in_arbeit' },
  };
  schreibeJson(path.join(ordner, 'workflow.json'), meta);
  console.log(`Projekt: ${ordner}`);
  return ordner;
}

// ---------- Schnittliste ----------
export function behalten(project, meta) {
  const f = path.join(project, 'schnitt.json');
  if (!fs.existsSync(f)) return null;
  const s = J(f), d = meta.sourceDuration ?? Infinity;
  const k = (s.behalten || []).map(([a, b]) => [Math.round(a * FPS) / FPS, Math.round(b * FPS) / FPS]);
  const sortiert = [...k].sort((x, y) => x[0] - y[0]);
  if (!k.length || k.some(([a, b]) => !(a >= 0 && b > a && b <= d + 0.05)) || sortiert.some(([a], i) => i && a < sortiert[i - 1][1])) throw Error('schnitt.json: behalten muss nicht überlappende Bereiche [start, ende] in Sekunden des Rohvideos enthalten.');
  return k;
}
// Rohzeit → Schnittzeit (null, wenn die Stelle herausgeschnitten ist). Sucht den Bereich, der t enthält, auch bei umgestellten Bereichen.
export function schnittZeit(keep, t) {
  let vorher = 0;
  for (const [a, b] of keep) { if (t >= a && t <= b) return vorher + (t - a); vorher += b - a; }
  return null;
}
const bereichVon = (keep, t) => keep.findIndex(([a, b]) => t >= a && t <= b);
export const umgestellt = keep => keep.some(([a], i) => i && a < keep[i - 1][1]);

// ---------- vorbereiten ----------
export async function vorbereiten(project, opts = {}) {
  const metaFile = path.join(project, 'workflow.json');
  let meta = J(metaFile);
  if (!meta.source || !fs.existsSync(meta.source)) throw Error('workflow.json: source fehlt oder ist nicht lesbar.');
  const keep = behalten(project, meta);
  // selection.json "bildHalten": [[von, bis], …] in Rohzeit (Vlog Wiesbaden, 19.10.2026): Über einen Aussetzer im Rohvideo
  // (Clipwechsel mit Fremdbild) bleibt das letzte Bild davor stehen, der Ton läuft weiter. Nur innerhalb behaltener Bereiche.
  const halten = (() => { const f = path.join(project, 'schnitt/selection.json'); return keep && fs.existsSync(f) ? (J(f).bildHalten || []) : []; })();
  const grade = meta.farbkorrektur ? FARBKORREKTUR[meta.farbkorrektur] : null;
  if (meta.farbkorrektur && !grade) throw Error(`Unbekannte Farbkorrektur: ${meta.farbkorrektur}`);
  const erzwingen = !!opts.neu;
  const tempo = Number(meta.tempo ?? 1);
  if (!(tempo >= 0.5 && tempo <= 2)) throw Error(`workflow.json: tempo ${meta.tempo} außerhalb 0,5–2`);
  const mitTempo = tempo !== 1 ? { tempo } : {};   // Cache-Schlüssel alter Projekte bleiben gleich
  const vTempo = tempo !== 1 ? `setpts=PTS/${tempo},` : '', aTempo = tempo !== 1 ? `atempo=${tempo},` : '';

  // 1. Kamerabild: in einem Durchgang aus dem Rohvideo (Schnitt, HDR→SDR, Hochkant, 30 fps, Farbkorrektur).
  const kb = await schritt(project, 'vorbereiten: kamerabild', { eingaben: [meta.source, ...(keep ? ['schnitt.json'] : [])], werte: { grade: meta.farbkorrektur, KAMERABILD, v: 3, ...mitTempo, ...(keep && umgestellt(keep) ? { umgestellt: 1 } : {}), ...(halten.length ? { halten } : {}) }, ausgaben: ['media.mp4'] }, () => {
    const v = [], a = []; let eingaenge = 1;
    const hdr = meta.sourceVideo?.hdr ? 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,' : '';
    // Hochkant 1080 × 1920 nur, wenn die Aufnahme es nicht schon ist (spart einen Filterdurchgang je Bild).
    const sv = meta.sourceVideo || {}, passt = sv.width === 1080 && sv.height === 1920;
    const bild = `${hdr}${passt ? '' : 'scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,'}setsar=1,fps=${FPS}${grade ? ',' + grade : ',format=yuv420p'}`;
    let filter;
    // Umgestellte Bereiche: Liest ein trim früher in der Rohzeit als das vorige, liefert ffmpeg aus demselben Eingang ein Bild
    // mit Zeitsprung (fps füllte im Wiesbaden-Vlog 160 s auf, 19.10.2026). Jede aufsteigende Folge bekommt deshalb ihren
    // eigenen Eingang; ohne Umstellung bleibt es bei einem Eingang (gleicher Befehl wie bisher).
    const lauf = []; if (keep) keep.forEach(([s], i) => lauf.push(i && s < keep[i - 1][1] ? lauf[i - 1] + 1 : (lauf[i - 1] ?? 0)));
    eingaenge = keep ? lauf.at(-1) + 1 : 1;
    if (keep) {
      keep.forEach(([s, e], i) => {
        const h = halten.find(([x, y]) => x > s && y < e);
        if (h) v.push(`[${lauf[i]}:v:0]trim=start=${s}:end=${h[0]},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${(h[1] - h[0]).toFixed(6)}[v${i}a]`, `[${lauf[i]}:v:0]trim=start=${h[1]}:end=${e},setpts=PTS-STARTPTS[v${i}b]`, `[v${i}a][v${i}b]concat=n=2:v=1:a=0[v${i}]`);
        else v.push(`[${lauf[i]}:v:0]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
        a.push(`[${lauf[i]}:a:0]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st=${(e - s - 0.005).toFixed(6)}:d=0.005[a${i}]`);
      });
      filter = [...v, ...a, `${keep.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${keep.length}:v=1:a=1[vc][ac]`, `[vc]${vTempo}${bild}[vout]`, `[ac]${aTempo}aresample=48000[aout]`].join(';\n');
    } else filter = `[0:v:0]${vTempo}${bild}[vout];[0:a:0]${aTempo}aresample=48000[aout]`;
    fs.writeFileSync(path.join(project, 'logs/kamerabild-filter.txt'), filter);
    const tmp = path.join(project, 'media.unfertig.mp4');
    ff(['-y', '-filter_complex_threads', String(os.cpus().length), ...Array.from({ length: eingaenge }, () => ['-i', meta.source]).flat(), '-filter_complex_script', path.join(project, 'logs/kamerabild-filter.txt'), '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', KAMERABILD.preset, '-crf', String(KAMERABILD.crf), '-g', String(KAMERABILD.gop), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', KAMERABILD.audio, '-ar', '48000', '-map_metadata', '-1', '-movflags', '+faststart', tmp], project, path.join(project, 'logs/kamerabild.log'));
    fs.renameSync(tmp, path.join(project, 'media.mp4'));   // überschreiben statt neu anlegen (CONTENT_WORKFLOW 1.28)
    return { dauer: dauer(path.join(project, 'media.mp4')) };
  }, { erzwingen });
  meta = J(metaFile);
  const d = kb.ergebnis?.dauer ?? dauer(path.join(project, 'media.mp4'));
  if (Math.abs((meta.cutDuration ?? 0) - d) > 1e-6 || meta.mode !== (keep ? 'cut-and-design' : 'design-only')) { meta.cutDuration = d; meta.mode = keep ? 'cut-and-design' : 'design-only'; meta.media = { datei: 'media.mp4', farbkorrektur: meta.farbkorrektur, schnitt: !!keep, ...mitTempo }; schreibeJson(metaFile, meta); }

  // 2. Tonspur für die Worterkennung. Bei Schnitt: ungeschnittener Ton, damit die Wörter nur einmal erkannt werden.
  const tonQuelle = keep ? meta.source : path.join(project, 'media.mp4');
  await schritt(project, 'vorbereiten: tonspur', { eingaben: [tonQuelle], werte: { v: 1 }, ausgaben: ['speech.wav'] }, () => {
    ff(['-v', 'error', '-y', '-i', tonQuelle, '-map', '0:a:0', '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', path.join(project, 'speech.wav')], project);
  }, { erzwingen });

  // 3. Wörter: ein Whisper-Durchgang (large-v3-turbo, DTW-Wortzeiten) auf speech.wav.
  const ordner = keep ? 'woerter-roh' : 'word-alignment-turbo';
  const chunks = path.join(project, 'transcription-chunks.json');
  await schritt(project, 'vorbereiten: wörter (ein Durchgang)', { eingaben: ['speech.wav', ...(fs.existsSync(path.join(project, 'transcription-prompt.txt')) ? ['transcription-prompt.txt'] : []), ...(fs.existsSync(chunks) && !keep ? ['transcription-chunks.json'] : [])], werte: { ordner, modell: 'large-v3-turbo-q5_0', v: 1 }, ausgaben: [`${ordner}/chunks.json`] }, () => transkribieren(project, ordner, keep ? meta.sourceDuration : d), { erzwingen });
  if (keep) await schritt(project, 'vorbereiten: wörter in Schnittzeit', { eingaben: ['woerter-roh/chunks.json', 'schnitt.json'], werte: { v: 1, ...mitTempo }, ausgaben: ['word-alignment-turbo/chunks.json'] }, () => woerterUmrechnen(project, keep, tempo), { erzwingen });

  // 4. Gesichter alle 0,5 s (Vision), 5. Schnittpunkte (Bildsprünge und Schnittliste).
  await schritt(project, 'vorbereiten: gesichter', { eingaben: ['media.mp4'], werte: { v: 1 }, ausgaben: ['review/source-faces.json'] }, () => gesichter(project), { erzwingen });
  await schritt(project, 'vorbereiten: schnittpunkte', { eingaben: ['media.mp4', ...(keep ? ['schnitt.json'] : [])], werte: { v: 1, ...mitTempo }, ausgaben: ['review/cut-points.json'] }, () => schnittpunkte(project, keep, tempo), { erzwingen });
  console.log(`Vorbereitet: ${project} (${d.toFixed(2)} s)`);
}

// ---------- Worterkennung ----------
function transkribieren(project, ordner, laenge) {
  const modell = path.join(ROOT, 'tools/models/ggml-large-v3-turbo-q5_0.bin');
  if (!fs.existsSync(modell)) throw Error('Sprachmodell fehlt: ' + modell);
  const promptFile = path.join(project, 'transcription-prompt.txt');
  const prompt = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8').trim() : '';
  const cf = path.join(project, 'transcription-chunks.json');
  const grenzen = ordner === 'word-alignment-turbo' && fs.existsSync(cf) ? J(cf) : Array.from({ length: Math.ceil(laenge / 24) }, (_, i) => [i * 24, Math.min(laenge, (i + 1) * 24)]);
  const out = path.join(project, ordner);
  fs.mkdirSync(out, { recursive: true });
  grenzen.forEach(([a, b], i) => {
    const stem = path.join(out, `part-${i}`);
    ff(['-v', 'error', '-y', '-ss', String(a), '-t', String(b - a), '-i', path.join(project, 'speech.wav'), '-c:a', 'pcm_s16le', `${stem}.wav`], project);
    const args = ['-m', modell, '-f', `${stem}.wav`, '-l', 'de', '-ojf', '-otxt', '-osrt', '-of', stem, '-dtw', 'large.v3.turbo', '-nfa', '-t', '6'];
    if (prompt) args.push('--prompt', prompt);
    const r = spawnSync(path.join(BIN, 'whisper-cli'), args, { cwd: project, encoding: 'utf8' });
    fs.writeFileSync(path.join(project, 'logs', `${ordner}-${i}.log`), (r.stdout || '') + (r.stderr || ''));
    if (r.status) throw Error(`Whisper fehlgeschlagen (Abschnitt ${i}), siehe logs/${ordner}-${i}.log`);
    console.log(`Wörter ${i + 1}/${grenzen.length} · ${a.toFixed(1)}–${b.toFixed(1)} s`);
  });
  fs.writeFileSync(path.join(out, 'chunks.json'), JSON.stringify(grenzen, null, 2));
}

// Whisper-Tokens aus der Rohzeit in die Schnittzeit umrechnen. Ein Token bleibt, wenn seine Mitte erhalten ist;
// herausgeschnittene Tokens fallen weg. Ergebnis im selben Format wie word-alignment-turbo (ein Abschnitt ab 0).
export function woerterUmrechnen(project, keep, tempo = 1) {
  const roh = path.join(project, 'woerter-roh'), grenzen = J(path.join(roh, 'chunks.json'));
  const out = path.join(project, 'word-alignment-turbo');
  fs.mkdirSync(out, { recursive: true });
  const segmente = [], bereich = new Map();   // Token → Index des Bereichs in keep (nur für umgestellte Bereiche gebraucht)
  grenzen.forEach(([a], i) => {
    const data = J(path.join(roh, `part-${i}.json`));
    for (const seg of data.transcription) {
      const tokens = [];
      for (const t of seg.tokens) {
        if (t.id >= 50257 || t.text.startsWith('[_')) { tokens.push(t); continue; }
        const von = a + t.offsets.from / 1000, bis = a + t.offsets.to / 1000, mitte = t.t_dtw >= 0 ? a + t.t_dtw / 100 : (von + bis) / 2;
        const m = schnittZeit(keep, mitte);
        if (m === null) continue;
        const dv = m - mitte;   // gleicher Versatz für Anfang, Ende und DTW-Punkt des Tokens; danach in die beschleunigte Zeit
        tokens.push({ ...t, offsets: { from: Math.max(0, Math.round((von + dv) / tempo * 1000)), to: Math.max(0, Math.round((bis + dv) / tempo * 1000)) }, t_dtw: t.t_dtw >= 0 ? Math.round(m / tempo * 100) : t.t_dtw });
        bereich.set(tokens.at(-1), bereichVon(keep, mitte));
      }
      // Ein Wort beginnt mit Leerzeichen; fällt der Wortanfang weg, darf der Rest nicht an das vorige Wort anwachsen.
      // Umgestellte Bereiche: ein Whisper-Segment kann zwei Bereiche berühren, die jetzt an verschiedenen Stellen stehen.
      // Dann je Bereich ein eigenes Segment; unten nach Schnittzeit sortiert.
      const teile = [];
      if (umgestellt(keep)) for (const t of tokens) { const sonder = !bereich.has(t), r = sonder ? teile.at(-1)?.r : bereich.get(t);
        if (!teile.length || (!sonder && r !== teile.at(-1).r)) teile.push({ r, tokens: [] }); teile.at(-1).tokens.push(t); }
      for (const tt of teile.length ? teile.map(x => x.tokens) : [tokens]) {
        const lex = tt.filter(t => !(t.id >= 50257 || t.text.startsWith('[_')));
        if (lex.length && !/^\s/.test(lex[0].text)) lex[0].text = ' ' + lex[0].text;
        if (lex.length) segmente.push({ ...seg, tokens: tt });
      }
    }
  });
  // Sortiert nach dem DTW-Zeitpunkt des ersten Wortes: offsets.from liegt bei Whisper oft Sekunden daneben (Wiesbaden-Vlog 19.10.2026).
  const erstes = s => { const t = s.tokens.find(t => !(t.id >= 50257 || t.text.startsWith('[_'))); return t.t_dtw >= 0 ? t.t_dtw * 10 : t.offsets.from; };
  if (umgestellt(keep)) segmente.sort((x, y) => erstes(x) - erstes(y));
  fs.writeFileSync(path.join(out, 'part-0.json'), JSON.stringify({ transcription: segmente, umgerechnet: 'aus woerter-roh über schnitt.json (vorbereiten.mjs)' }));
  fs.writeFileSync(path.join(out, 'chunks.json'), JSON.stringify([[0, keep.reduce((s, [a, b]) => s + b - a, 0) / tempo]], null, 2));
}

// ---------- Gesichter ----------
// check-face-placement.swift wird einmal übersetzt und im Cache abgelegt; der interpretierte Aufruf brauchte je Lauf
// eine Übersetzung und scheiterte in Arbeitsordnern am pfadgebundenen Modulcache.
export function gesichterProgramm() {
  const src = path.join(ROOT, 'check-face-placement.swift'), exe = path.join(CACHE, 'bin', `check-face-placement-${hash(fs.readFileSync(src)).slice(0, 12)}`);
  if (!fs.existsSync(exe)) {
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    const r = spawnSync('swiftc', ['-O', '-module-cache-path', path.join(CACHE, 'swift-module-cache'), src, '-o', exe + '.tmp'], { encoding: 'utf8' });
    if (r.status) throw Error('swiftc fehlgeschlagen:\n' + (r.stderr || '').slice(-2000));
    fs.renameSync(exe + '.tmp', exe);
  }
  return exe;
}
function gesichter(project) {
  const r = spawnSync(gesichterProgramm(), [path.join(project, 'media.mp4'), path.join(project, 'review/source-faces.json')], { encoding: 'utf8' });
  if (r.status) throw Error('Gesichtserkennung fehlgeschlagen:\n' + (r.stderr || '').slice(-2000));
  const f = J(path.join(project, 'review/source-faces.json'));
  if (!f.length || f.some(s => s.error)) throw Error('Gesichtserkennung unvollständig.');
  return { proben: f.length, ohneGesicht: f.filter(s => !s.faces.length).length };
}

// ---------- Schnittpunkte ----------
// Bildsprung: mittlere Grauwertdifferenz 90 × 160 zum Vorbild, lokales Maximum, > 3 × lokaler Median und > 6
// (wie review/cut-points.json bei Fast 30). Bei eigenem Schnitt kommen die Nahtstellen der Schnittliste dazu.
function schnittpunkte(project, keep, tempo = 1) {
  const W = 90, H = 160;
  const r = spawnSync(FF, ['-v', 'error', '-i', path.join(project, 'media.mp4'), '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  if (r.status) throw Error('Schnittpunkte: ffmpeg fehlgeschlagen');
  const buf = r.stdout, n = Math.floor(buf.length / (W * H)), diff = new Float64Array(n);
  for (let i = 1; i < n; i++) { let s = 0; const o = i * W * H, p = o - W * H; for (let k = 0; k < W * H; k++) s += Math.abs(buf[o + k] - buf[p + k]); diff[i] = s / (W * H); }
  const cuts = [];
  for (let i = 2; i < n - 2; i++) {
    const um = [...diff.slice(Math.max(1, i - 15), i), ...diff.slice(i + 1, i + 16)].sort((a, b) => a - b), med = um[um.length >> 1] || 0;
    if (diff[i] > 6 && diff[i] >= diff[i - 1] && diff[i] >= diff[i + 1] && diff[i] > 3 * med) cuts.push({ frame: i, time: Math.round(i / FPS * 1000) / 1000, diff: Math.round(diff[i] * 100) / 100 });
  }
  if (keep) { let t = 0; for (const [a, b] of keep.slice(0, -1)) { t += b - a; const f = Math.round(t / tempo * FPS); if (!cuts.some(c => Math.abs(c.frame - f) <= 1)) cuts.push({ frame: f, time: Math.round(f / FPS * 1000) / 1000, quelle: 'schnitt.json' }); } cuts.sort((a, b) => a.frame - b.frame); }
  schreibeJson(path.join(project, 'review/cut-points.json'), { method: 'Bildsprung: mittlere Grauwertdifferenz 90x160 zum Vorbild, lokales Maximum, > 3x lokaler Median, > 6; dazu Nahtstellen aus schnitt.json', cuts });
  return { schnittpunkte: cuts.length };
}

// ---------- Kopfprofil an den Einblendungsstellen ----------
// DESIGN.md 9/12 verlangen für Pillen und Randnotiz den Platz aus der Personenmaske. Gemessen wird nur dort, wo ein
// Element über dem Kopf stehen kann (nicht Kapitel, Einstieg, Untertitel, Outro), in halber Auflösung, jedes zweite Bild.
export function kopfBereiche(plan) {
  const b = [], add = (a, e) => { if (Number.isFinite(a) && Number.isFinite(e) && e > a) b.push([Math.round(a * 100) / 100, Math.round(e * 100) / 100]); };
  const kapEnde = id => (plan.kapitel || []).find(k => k.id === id)?.end;
  for (const p of plan.pillen || []) add(p.items?.[0]?.at, p.end ?? kapEnde(p.kapitel));
  for (const x of [...(plan.h2 || []), ...(plan.randnotizen || []), ...(plan.lebensbalken || []), ...(plan.akronyme || []), ...(plan.schlagworte || []), ...(plan.logos || [])]) add(x.start ?? x.zeilen?.[0]?.at, x.end);
  for (const s of plan.sprechblasen || []) add(s.start, s.start + 4.25);
  b.sort((x, y) => x[0] - y[0]);
  const m = [];
  for (const [a, e] of b) { if (m.length && a <= m.at(-1)[1] + 0.5) m.at(-1)[1] = Math.max(m.at(-1)[1], e); else m.push([a, e]); }
  return m;
}
export async function kopfprofil(project) {
  const plan = J(path.join(project, 'design-plan.json')), bereiche = kopfBereiche(plan);
  if (!bereiche.length) return { bereiche: 0 };
  const sha = pruefsumme(path.join(project, 'media.mp4'));
  return (await schritt(project, 'kopfprofil (Einblendungsstellen, halbe Auflösung)', { eingaben: ['media.mp4', 'review/source-faces.json'], werte: { bereiche, v: 2 }, ausgaben: ['review/kopf-profil.json'] }, () => {
    const r = spawnSync(path.join(ROOT, 'tools/venv-rvm/bin/python'), [path.join(ROOT, 'green-screen-maske.py'), project, '--kopfprofil', '--halb', '--bereiche', JSON.stringify(bereiche), '--media-sha', sha], { encoding: 'utf8' });
    fs.writeFileSync(path.join(project, 'logs/kopfprofil.log'), (r.stdout || '') + (r.stderr || ''));
    if (r.status) throw Error('Kopfprofil fehlgeschlagen:\n' + (r.stderr || '').slice(-2000));
    return { bereiche: bereiche.length, sekunden: bereiche.reduce((s, [a, e]) => s + e - a, 0) };
  })).ergebnis;
}

// ---------- Freistellung (Green Screen) je Grafik ----------
// Rechnet nur neu, wenn sich Kamerabild, Abschnitt der Grafik oder das Freistellungsskript geändert haben.
export async function freistellung(project, g) {
  const skript = path.join(ROOT, 'green-screen-maske.py');
  return (await schritt(project, `freistellung ${g.id}`, { eingaben: ['media.mp4', skript], werte: { start: g.start, end: g.end, person: g.person, v: 1 }, ausgaben: [g.person] }, () => {
    const r = spawnSync(path.join(ROOT, 'tools/venv-rvm/bin/python'), [skript, project, '--nur', g.id], { encoding: 'utf8' });
    fs.writeFileSync(path.join(project, 'logs/green-screen.log'), (r.stdout || '') + (r.stderr || ''));
    if (r.status) throw Error(`Freistellung ${g.id} fehlgeschlagen:\n` + (r.stderr || '').slice(-2000));
  })).ergebnis;
}
