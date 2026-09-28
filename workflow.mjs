#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { parseSrt, makeComposition } from './composition.mjs';
import { renderProfil } from './schnellweg.mjs';
import { projektOrdner, PROJEKTE } from './projekte.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(ROOT, 'tools/bin');
const MODEL = path.join(ROOT, 'tools/models/ggml-small.bin');
const HF = path.join(ROOT, 'node_modules/hyperframes/bin/hyperframes.mjs');
const ENV = {
  ...process.env,
  PATH: `${BIN}${path.delimiter}${process.env.PATH || ''}`,
  HYPERFRAMES_NO_TELEMETRY: '1',
  HYPERFRAMES_NO_UPDATE_CHECK: '1',
  HYPERFRAMES_NO_AUTO_INSTALL: '1',
  // Tempo-Auftrag 27.09.2026: mehrere Render-Prozesse, Bilder trotzdem direkt in den Encoder (kein Zwischenspeicher von
  // ~50 GB für 200 s). HyperFrames streamt sonst nur mit einem Prozess; bis 600 s Videodauer.
  HF_DE_PARALLEL_STREAM: 'true',
  PRODUCER_STREAMING_ENCODE_MAX_DURATION_SECONDS: '600',
};

function run(exe, args, cwd = ROOT, log) {
  const r = spawnSync(exe, args, { cwd, env: ENV, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (log) fs.writeFileSync(log, `${r.stdout || ''}\n${r.stderr || ''}`);
  if (r.error || r.status !== 0) {
    throw new Error(`${path.basename(exe)} fehlgeschlagen: ${r.error?.message || r.signal || r.status}\n${(r.stderr || r.stdout || '').slice(-5000)}${log ? `\nProtokoll: ${log}` : ''}`);
  }
  return r.stdout || '';
}

function probe(file) {
  return JSON.parse(run(path.join(BIN, 'ffprobe'), ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function duration(info) {
  const n = Number(info.format.duration);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Keine gültige Videodauer gefunden.');
  return n;
}
function number(value, name, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name}: Wert zwischen ${min} und ${max} erforderlich.`);
  return n;
}
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

function doctor() {
  const tools = [
    ['Auto-Editor', path.join(BIN, 'auto-editor'), ['--version']],
    ['FFmpeg', path.join(BIN, 'ffmpeg'), ['-version']],
    ['FFprobe', path.join(BIN, 'ffprobe'), ['-version']],
    ['Whisper', path.join(BIN, 'whisper-cli'), ['--help']],
    ['HyperFrames', process.execPath, [HF, '--version']],
  ];
  for (const [label, exe, args] of tools) {
    const out = run(exe, args);
    console.log(`${label}: OK${out.trim() ? ' · ' + out.trim().split('\n')[0] : ''}`);
  }
  if (!fs.existsSync(MODEL) || fs.statSync(MODEL).size < 480000000) throw new Error('Das Whisper-Modell fehlt oder ist unvollständig.');
  console.log('Mehrsprachiges Whisper-Modell: OK');
  console.log(`Render-Browser: ${run(process.execPath, [HF, 'browser', 'path']).trim()}`);
  // DESIGN.md 2.2: Schriften (templates/fonts), Freistellungsmodell mit Herkunftsdatei, onnxruntime in tools/venv-rvm.
  for (const f of ['Archivo[wdth,wght].ttf', 'GochiHand-Regular.ttf']) if (!fs.existsSync(path.join(ROOT, 'templates/fonts', f))) throw new Error(`Schrift fehlt: templates/fonts/${f}`);
  console.log('Schriften Archivo und Gochi Hand: OK');
  const rvm = path.join(ROOT, 'tools/models/rvm_mobilenetv3_fp32.onnx'), rvmInfo = path.join(ROOT, 'tools/models/rvm-mobilenetv3-provenance.json');
  if (!fs.existsSync(rvm) || !fs.existsSync(rvmInfo)) throw new Error('Freistellungsmodell oder Herkunftsdatei fehlt (tools/models).');
  const want = JSON.parse(fs.readFileSync(rvmInfo, 'utf8')).sha256, got = createHash('sha256').update(fs.readFileSync(rvm)).digest('hex');
  if (want !== got) throw new Error('Freistellungsmodell: Prüfsumme weicht von der Herkunftsdatei ab.');
  console.log('Freistellungsmodell RVM: OK');
  console.log(`onnxruntime: ${run(path.join(ROOT, 'tools/venv-rvm/bin/python'), ['-c', 'import onnxruntime as o; print(o.__version__)']).trim()}`);
}

async function prepare(input, opts) {
  if (!input) throw new Error('Bitte den Pfad zur Aufnahme angeben.');
  const source = fs.realpathSync(path.resolve(input));
  if (!fs.statSync(source).isFile()) throw new Error('Die Aufnahme ist keine Datei.');
  const info = probe(source);
  const video = info.streams.find(x => x.codec_type === 'video' && !x.disposition?.attached_pic);
  if (!video || !info.streams.some(x => x.codec_type === 'audio')) throw new Error('Die Aufnahme muss Video und eine Tonspur enthalten.');
  const originalDuration = duration(info);
  const threshold = number(opts.threshold ?? 3, 'Schwelle in Prozent', 0.01, 30);
  const margin = number(opts.margin ?? 0.25, 'Schnittabstand in Sekunden', 0, 2);
  // Nachbesprechung Punkt 3: Arbeitet eine andere Sitzung schon an dieser Quelle?
  // Warnung, keine Sperre — eine Sperre respektiert gerade die Sitzung nicht,
  // die das Problem verursacht.
  const { kollision } = await import('./pruefungen.mjs');
  for (const x of kollision(source)) {
    console.warn(`Achtung: ${x.projekt} arbeitet seit ${x.begonnen} an derselben Quelle (${x.agent}: ${x.aufgabe}).`);
  }
  const name = path.basename(source, path.extname(source)).normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 55) || 'video';
  const project = path.join(PROJEKTE, `${name}-${stamp()}-${randomBytes(2).toString('hex')}`);
  fs.mkdirSync(path.join(project, 'logs'), { recursive: true });
  const manifest = { version: 1, created: new Date().toISOString(), source, sourceBytes: fs.statSync(source).size, originalDuration, threshold, margin, status: 'in_progress', language: opts.language || 'de',
    // Nachbesprechung Punkt 3: Anspruch auf diese Quelle, damit parallele Sitzungen einander sehen.
    bearbeitung: { agent: process.env.AGENT_NAME || 'unbenannte Sitzung', aufgabe: opts.title ? `Schnitt und Gestaltung: ${opts.title}` : 'Schnitt', begonnen: new Date().toISOString(), status: 'in_arbeit' },
    limitations: ['Keine automatische Auswahl der besten Takes.', 'Untertitel vor der Veröffentlichung prüfen.'] };
  const manifestFile = path.join(project, 'workflow.json');
  writeJson(manifestFile, manifest);
  console.log(`Projekt: ${project}`);
  try {
    // Source files are read only. All work products live inside a new project.
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(source)) hash.update(chunk);
    manifest.sourceSha256 = hash.digest('hex');
    console.log('1/4 · Arbeitskopie für Hochkant vorbereiten');
    const filters = [];
    const hdr = ['smpte2084', 'arib-std-b67'].includes(video.color_transfer);
    if (hdr) {
      filters.push('zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv');
      manifest.hdrToSdr = true;
      manifest.limitations.push('HDR wurde nach SDR umgewandelt. Farben visuell prüfen.');
    }
    filters.push('scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2', 'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black', 'setsar=1', 'fps=30', 'format=yuv420p');
    run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'warning', '-n', '-i', source, '-map', '0:v:0', '-map', '0:a:0', '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'fast', '-g', '30', '-keyint_min', '30', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-map_metadata', '-1', '-movflags', '+faststart', 'source.mp4'], project, path.join(project, 'logs/01-import.log'));
    console.log('2/4 · Stille entfernen');
    if (opts['no-cut']) fs.copyFileSync(path.join(project, 'source.mp4'), path.join(project, 'cut.mp4'));
    else run(path.join(BIN, 'auto-editor'), ['source.mp4', '--edit', `audio:threshold=${threshold}%`, '--margin', `${margin}sec`, '--smooth', '0.35sec,0.15sec', '--no-cache', '--no-open', '--progress', 'none', '-g', '30', '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-o', 'cut.mp4'], project, path.join(project, 'logs/02-cut.log'));
    manifest.cutDuration = duration(probe(path.join(project, 'cut.mp4')));
    manifest.removedSeconds = Math.max(0, originalDuration - manifest.cutDuration);
    if (manifest.cutDuration < originalDuration * 0.25) manifest.limitations.push('Mehr als 75 Prozent wurden entfernt. Schwelle und Schnitt sorgfältig prüfen.');
    console.log('3/4 · Sprachlautstärke bearbeiten');
    if (opts['no-normalize']) fs.copyFileSync(path.join(project, 'cut.mp4'), path.join(project, 'media.mp4'));
    else run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'warning', '-n', '-i', 'cut.mp4', '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'media.mp4'], project, path.join(project, 'logs/03-audio.log'));
    run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'warning', '-n', '-i', 'media.mp4', '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', 'speech.wav'], project);
    console.log('4/4 · Untertitel lokal erkennen');
    const whisperArgs = ['-m', MODEL, '-f', 'speech.wav', '-l', manifest.language, '-osrt', '-otxt', '-oj', '-of', 'captions', '-ml', '36', '-sow', '-t', '6'];
    if (opts.cpu) whisperArgs.push('-ng');
    run(path.join(BIN, 'whisper-cli'), whisperArgs, project, path.join(project, 'logs/04-transcription.log'));
    const cues = parseSrt(fs.readFileSync(path.join(project, 'captions.srt'), 'utf8'));
    if (!cues.length) throw new Error('Keine Untertitel erkannt. Tonspur und Sprachwahl prüfen.');
    fs.copyFileSync(path.join(project, 'captions.srt'), path.join(project, 'captions.original.srt'));
    const design = { title: opts.title || '', accent: '#CAFF70', titleSeconds: 2.8, captionFontSize: 64, callouts: [] };
    writeJson(path.join(project, 'design.json'), design);
    manifest.status = 'ready_for_review';
    manifest.captionCount = cues.length;
    writeJson(manifestFile, manifest);
    buildComposition(project);
    fs.writeFileSync(path.join(project, 'PRUEFEN.md'), `# Vor dem Export\n\n1. media.mp4 vollständig ansehen. Sind leise Wörter und Satzenden erhalten?\n2. captions.srt korrigieren. Zeitangaben beibehalten.\n3. design.json: Überschrift, Farbe und optionale Einblendungen einstellen.\n4. Über Codex den Export starten lassen.\n\nOriginal: ${source}\n\nDauer vorher: ${originalDuration.toFixed(2)} s\nDauer nachher: ${manifest.cutDuration.toFixed(2)} s\nEntfernt: ${manifest.removedSeconds.toFixed(2)} s\n\n${manifest.limitations.map(x => '- ' + x).join('\n')}\n`);
    console.log(`Entwurf fertig. ${manifest.removedSeconds.toFixed(2)} s entfernt.\nUntertitel prüfen: ${path.join(project, 'captions.srt')}`);
    return project;
  } catch (error) {
    manifest.status = 'failed';
    manifest.error = error.message;
    writeJson(manifestFile, manifest);
    throw error;
  }
}

function buildComposition(project) {
  const meta = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'), 'utf8'));
  const design = JSON.parse(fs.readFileSync(path.join(project, 'design.json'), 'utf8'));
  const cues = parseSrt(fs.readFileSync(path.join(project, 'captions.srt'), 'utf8'));
  if (!cues.length) throw new Error('Die Untertiteldatei enthält keine gültigen Einträge.');
  if (cues.at(-1).end > meta.cutDuration + 0.5) throw new Error('Untertitel reichen über das Videoende hinaus. Zeitangaben prüfen.');
  fs.mkdirSync(path.join(project, 'vendor'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'templates/vendor/gsap.min.js'), path.join(project, 'vendor/gsap.min.js'));
  fs.writeFileSync(path.join(project, 'index.html'), makeComposition({ duration: meta.cutDuration, cues, design }));
}

// Seit 27.09.2026 (Tempo): Projekte liegen im gemeinsamen projects/ des Hauptordners, auch wenn dieses Werkzeug in einem
// Arbeitsordner (git worktree) läuft. Ein Projektname ohne Pfad genügt.
function existingProject(value) { return projektOrdner(value); }

function render(project, opts, regenerate = true) {
  if (regenerate) buildComposition(project);
  const meta = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'), 'utf8'));
  console.log('Gestaltung prüfen und Video rendern');
  // Seit 27.09.2026 wählt designVersion in workflow.json Vorlage und Prüfung; ohne Eintrag gilt die Version aus theme-plan.json.
  const planFile = path.join(project, 'theme-plan.json');
  const version = String(meta.designVersion ?? (fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')).designVersion : '') ?? '');
  if (!regenerate && version === '2.2') {
    run(process.execPath, [path.join(ROOT, 'assemble-full-video.mjs'), project], ROOT, path.join(project, 'logs/03-assemble.log'));
    run(process.execPath, [path.join(ROOT, 'check-design22.mjs'), project], ROOT, path.join(project, 'logs/04-layout-check.log'));
  } else if (!regenerate) run(process.execPath, [path.join(ROOT, 'check-theme-layout.mjs'), project], ROOT, path.join(project, 'logs/04-layout-check.log'));
  run(process.execPath, [HF, 'lint', project], ROOT, path.join(project, 'logs/05-lint.log'));
  fs.mkdirSync(path.join(project, 'exports'), { recursive: true });
  // renderMaster "prores": HyperFrames captures PNG frames only for alpha formats; MP4 output uses JPEG quality 80.
  const prores = meta.renderMaster === 'prores';
  const output = path.join(project, 'exports', `final-${stamp()}.${prores ? 'mov' : 'mp4'}`);
  // Seit 27.09.2026 (Tempo-Auftrag): Prozesse nach Kernen und Arbeitsspeicher, --low-memory-mode nur bei ≤ 8 GB oder renderLowMemory.
  const prof = renderProfil(meta);
  const renderArgs = [HF, 'render', project, '--output', output, '--fps', '30', '--quality', opts.draft ? 'draft' : 'high', '--workers', String(prof.workers), '--sdr'];
  if (prof.lowMemory) renderArgs.push('--low-memory-mode');
  if (prores) renderArgs.push('--format', 'mov');
  run(process.execPath, renderArgs, ROOT, path.join(project, 'logs/06-render.log'));
  const result = probe(output);
  const v = result.streams.find(x => x.codec_type === 'video');
  const a = result.streams.find(x => x.codec_type === 'audio');
  if (!v || !a || v.width !== 1080 || v.height !== 1920 || Math.abs(duration(result) - meta.cutDuration) > 0.25) throw new Error('Exportprüfung fehlgeschlagen: Format, Tonspur oder Dauer stimmt nicht.');
  // Decode the complete file so a valid container alone does not count as success.
  run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-'], ROOT, path.join(project, 'logs/07-decode.log'));
  meta.status = 'exported';
  meta.latestExport = output;
  meta.exportedAt = new Date().toISOString();
  writeJson(path.join(project, 'workflow.json'), meta);
  console.log(`Export geprüft: ${output}`);
}

function changeSpeed(sourceProject, opts) {
  const rate = number(opts.speed ?? 1.1, 'Geschwindigkeit', 0.5, 2);
  const sourceMeta = JSON.parse(fs.readFileSync(path.join(sourceProject, 'workflow.json'), 'utf8'));
  const source = sourceMeta.latestExport;
  if (!source || !fs.existsSync(source)) throw Error('Der fertige Export fehlt.');
  const info = probe(source);
  const originalDuration = duration(info);
  const project = path.join(PROJEKTE, `Video-${String(rate).replace('.', '-')}x-${stamp()}`);
  fs.mkdirSync(path.join(project, 'logs'), {recursive: true});
  fs.mkdirSync(path.join(project, 'exports'), {recursive: true});
  const output = path.join(project, 'exports', `Video-${String(rate).replace('.', '-')}x.mp4`);
  const meta = {mode: 'speed-adjustment', sourceProject, source, speed: rate, originalDuration, cutDuration: originalDuration/rate, status:'in_progress', createdAt:new Date().toISOString(), notes:['Fertiger Export gemeinsam in Bild und Ton beschleunigt. Einblendungen und Untertitel sind bereits im Bild enthalten.', 'atempo verändert die Geschwindigkeit bei erhaltener Tonhöhe. Gestaltung im verknüpften Quellprojekt bearbeiten.']};
  writeJson(path.join(project, 'workflow.json'), meta);
  console.log(`Geschwindigkeit ${rate}× · ${originalDuration.toFixed(2)} → ${(originalDuration/rate).toFixed(2)} Sekunden\nProjekt: ${project}`);
  run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'warning', '-n', '-i', source, '-map', '0:v:0', '-map', '0:a:0', '-vf', `setpts=(PTS-STARTPTS)/${rate},fps=30`, '-af', `atempo=${rate},asetpts=PTS-STARTPTS`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4', '-g', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output], project, path.join(project, 'logs/speed-export.log'));
  const result = probe(output);
  const v = result.streams.find(s=>s.codec_type==='video');
  const a = result.streams.find(s=>s.codec_type==='audio');
  if (!v || !a || v.width!==1080 || v.height!==1920 || Math.abs(duration(result)-originalDuration/rate)>0.1) throw Error('Dauer oder Format der beschleunigten Fassung stimmt nicht.');
  run(path.join(BIN, 'ffmpeg'), ['-v','error','-xerror','-i',output,'-f','null','-'], project, path.join(project,'logs/decode.log'));
  meta.cutDuration = duration(result); meta.latestExport = output; meta.status='exported'; meta.exportedAt=new Date().toISOString();
  writeJson(path.join(project, 'workflow.json'), meta);
  writeJson(path.join(project, 'export-info.json'), result);
  console.log(`Export geprüft: ${output}`);
}

try {
  const { values: opts, positionals } = parseArgs({ allowPositionals: true, options: {
    title: { type: 'string' }, farbkorrektur: { type: 'string' }, datum: { type: 'string' }, aufgabe: { type: 'string' }, neu: { type: 'boolean' }, language: { type: 'string' }, threshold: { type: 'string' }, margin: { type: 'string' }, 'speech-model': { type: 'string' }, speed: { type: 'string' },
    'no-cut': { type: 'boolean' }, 'no-normalize': { type: 'boolean' }, cpu: { type: 'boolean' }, draft: { type: 'boolean' }, review: { type: 'boolean' },
  }});
  const [action, target] = positionals;
  if (action === 'doctor') doctor();
  else if (action === 'analyze-speech') {
    const { analyzeSpeech } = await import('./silero-review.mjs');
    analyzeSpeech(target, { ROOT, BIN, run, opts });
  }
  else if (['analyze-cut', 'export-cut', 'preview-cut'].includes(action)) {
    const { analyzeCut, exportCut, previewCut } = await import('./cut-review.mjs');
    if (action === 'analyze-cut') await analyzeCut(target, { ROOT, BIN, MODEL, run, probe, opts });
    else if (action === 'preview-cut') previewCut(existingProject(target), { ROOT, HF, run });
    else await exportCut(existingProject(target), { ROOT, BIN, MODEL, run, probe, opts });
  }
  else if (action === 'anlegen') { const { anlegen } = await import('./vorbereiten.mjs'); await anlegen(target, opts); }
  else if (action === 'vorbereiten') { const { vorbereiten } = await import('./vorbereiten.mjs'); await vorbereiten(existingProject(target), opts); }
  else if (action === 'planentwurf') { const { planentwurf } = await import('./planentwurf.mjs'); const P = existingProject(target), { zeit } = await import('./projekte.mjs'); console.log(JSON.stringify(await zeit(P, 'planentwurf', () => planentwurf(P)), null, 1)); }
  else if (action === 'kopfprofil') { const { kopfprofil } = await import('./vorbereiten.mjs'); console.log(JSON.stringify(await kopfprofil(existingProject(target)))); }
  else if (action === 'prepare') await prepare(target, opts);
  else if (action === 'render') render(existingProject(target), opts);
  else if (action === 'render-html') render(existingProject(target), opts, false);
  else if (action === 'speed') changeSpeed(existingProject(target), opts);
  else if (['storyboard', 'vorschau', 'build'].includes(action)) {
    const sw = await import('./schnellweg.mjs');
    const { assembleFullVideo } = await import('./assemble-full-video.mjs');
    const { checkDesign22 } = await import('./check-design22.mjs');
    const ctx = { root: ROOT, run, env: ENV, assemble: (p, o) => assembleFullVideo(p, o), check: p => checkDesign22(p) };
    await sw[action](existingProject(target), ctx);
  }
  else if (action === 'green-screen') {
    // DESIGN.md 11: Personenebene je Grafikabschnitt (Robust Video Matting); --review misst zusätzlich das Kopfprofil.
    const args = [path.join(ROOT, 'green-screen-maske.py'), existingProject(target)];
    if (opts.review) args.push('--kopfprofil');
    console.log(run(path.join(ROOT, 'tools/venv-rvm/bin/python'), args, ROOT));
  }
  else if (action === 'transcribe-words') {
    const { transcribeWords } = await import('./word-captions.mjs');
    transcribeWords(existingProject(target), { BIN, MODEL, run, opts });
  }
  else if (action === 'preview-html') {
    console.log(run(process.execPath, [HF, 'preview', existingProject(target), '--background', '--no-open', '--json']));
  }
  else if (action === 'compose') buildComposition(existingProject(target));
  else if (action === 'preview') {
    const p = existingProject(target);
    buildComposition(p);
    console.log(run(process.execPath, [HF, 'preview', p, '--background', '--no-open']));
  } else {
    console.log('Verwendung:\n  node workflow.mjs doctor\n  node workflow.mjs anlegen "/Pfad/Rohvideo.mp4" --title "Titel" [--farbkorrektur A] [--datum JJJJ-MM-TT]\n  node workflow.mjs vorbereiten "<Projekt>" [--neu]\n  node workflow.mjs kopfprofil "<Projekt>"\n  node workflow.mjs planentwurf "<Projekt>"\n  node workflow.mjs prepare "/Pfad/Video.mov" --title "Deine Überschrift"\n  node workflow.mjs preview "/Pfad/Projekt"\n  node workflow.mjs render "/Pfad/Projekt"\n  node workflow.mjs render-html "/Pfad/Projekt"\n  node workflow.mjs green-screen "/Pfad/Projekt" [--review]\n  node workflow.mjs storyboard "/Pfad/Projekt"\n  node workflow.mjs vorschau "/Pfad/Projekt"\n  node workflow.mjs build "/Pfad/Projekt"\n\nOptionen für prepare: --language de --threshold 3 --margin 0.25 --cpu --no-cut --no-normalize\nOption für render: --draft');
    if (action) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
