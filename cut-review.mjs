import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { makeComposition } from './composition.mjs';

const json = (p, x) => fs.writeFileSync(p, JSON.stringify(x, null, 2) + '\n');
export async function analyzeCut(input, { ROOT, BIN, MODEL, run, probe, opts }) {
  const source = fs.realpathSync(path.resolve(input));
  const info = probe(source);
  if (!info.streams.some(x => x.codec_type === 'video') || !info.streams.some(x => x.codec_type === 'audio')) throw Error('Bild oder Ton fehlt.');
  const project = path.join((await import('./projekte.mjs')).PROJEKTE, `Schnitttest-07s-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(path.join(project, 'logs'), { recursive: true });
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(source)) hash.update(chunk);
  const meta = { source, sourceSha256: hash.digest('hex'), originalDuration: Number(info.format.duration), mode: 'cut-only', status: 'analyzing', minimumSilence: 0.7, silenceDb: -35, edgePadding: 0.10, maximumImpulseGap: 0.04 };
  json(path.join(project, 'workflow.json'), meta);
  console.log(`Projekt: ${project}`);
  // Keep short quiet intervals in the analysis log so impulse-split pauses can
  // be reviewed before the 0.7-second editorial threshold is applied.
  run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-n', '-i', source, '-vn', '-af', 'silencedetect=noise=-35dB:d=0.25', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', 'speech.wav'], project, path.join(project, 'logs/silence.log'));
  console.log('Pausen analysiert. Wortpositionen werden ermittelt.');
  const args = ['-m', MODEL, '-f', 'speech.wav', '-l', 'de', '-ojf', '-otxt', '-of', 'source-transcript', '-ml', '1', '-sow', '-t', '6'];
  if (opts.cpu) args.push('-ng');
  run(path.join(BIN, 'whisper-cli'), args, project, path.join(project, 'logs/transcription.log'));
  meta.status = 'analysis_ready';
  json(path.join(project, 'workflow.json'), meta);
  console.log('Analyse fertig. Schnitte können jetzt einzeln festgelegt werden.');
}

// The cut list uses original timestamps. Every kept interval is applied to both
// picture and sound, so source timing remains aligned after each deletion.
export function keepIntervals(removals, duration, fps = 30) {
  if (!Number.isFinite(duration) || duration <= 0) throw Error('Ungültige Dauer.');
  const sorted = removals.map(x => {
    if (!Number.isFinite(x.start) || !Number.isFinite(x.end) || x.start < 0 || x.end > duration || x.end <= x.start) throw Error('Ungültiger Schnitt.');
    return { start: Math.ceil(x.start * fps) / fps, end: x.end === duration ? duration : Math.floor(x.end * fps) / fps };
  }).filter(x => x.end > x.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const x of sorted) {
    if (merged.length && x.start <= merged.at(-1).end) merged.at(-1).end = Math.max(merged.at(-1).end, x.end);
    else merged.push({ ...x });
  }
  const keep = [];
  let cursor = 0;
  for (const x of merged) {
    if (x.start > cursor) keep.push([cursor, x.start]);
    cursor = x.end;
  }
  if (cursor < duration) keep.push([cursor, duration]);
  if (!keep.length) throw Error('Der Schnitt würde das gesamte Video entfernen.');
  return keep;
}

export function previewCut(project, { ROOT, HF, run }) {
  const meta = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'), 'utf8'));
  const relative = path.relative(project, meta.latestExport);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(meta.latestExport)) throw Error('Export fehlt oder liegt außerhalb des Projekts.');
  const media = relative.split(path.sep).map(encodeURIComponent).join('/');
  const html = makeComposition({ duration: meta.cutDuration, cues: [], design: { title: '', callouts: [], accent: '#CAFF70', captionFontSize: 64, titleSeconds: 2.8 } }).replaceAll('src="media.mp4"', `src="${media}"`);
  fs.mkdirSync(path.join(project, 'vendor'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'templates/vendor/gsap.min.js'), path.join(project, 'vendor/gsap.min.js'));
  fs.writeFileSync(path.join(project, 'index.html'), html);
  console.log(run(process.execPath, [HF, 'preview', project, '--background', '--no-open', '--json']));
}

export async function exportCut(project, { BIN, MODEL, run, probe, opts }) {
  const meta = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'), 'utf8'));
  const cuts = JSON.parse(fs.readFileSync(path.join(project, 'cuts.json'), 'utf8'));
  const info = probe(meta.source);
  const v = info.streams.find(x => x.codec_type === 'video');
  const fps = v.avg_frame_rate.split('/').map(Number).reduce((a, b) => a / b);
  const keep = keepIntervals(cuts.removals, meta.originalDuration, fps);
  const selection = keep.map(([a, b]) => `gte(n,${Math.round(a * fps)})*lt(n,${Math.round(b * fps)})`).join('+');
  const filters = [`[0:v]select='${selection}',setpts=N/(${fps}*TB)[vout]`];
  const labels = [];
  keep.forEach(([start, end], i) => {
    filters.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.005,afade=t=out:st=${Math.max(0, end - start - 0.005)}:d=0.005[a${i}]`);
    labels.push(`[a${i}]`);
  });
  filters.push(`${labels.join('')}concat=n=${keep.length}:v=0:a=1[aout]`);
  fs.writeFileSync(path.join(project, 'cut-filter.txt'), filters.join(';\n'));
  fs.mkdirSync(path.join(project, 'exports'), { recursive: true });
  const output = path.join(project, 'exports', `Schnitttest-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
  console.log(`Export: ${keep.length - 1} Übergänge`);
  run(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'warning', '-n', '-i', meta.source, '-filter_complex_threads', '2', '-filter_complex_script', 'cut-filter.txt', '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], project, path.join(project, 'logs/export.log'));
  const result = probe(output);
  const outV = result.streams.find(x => x.codec_type === 'video');
  const outA = result.streams.find(x => x.codec_type === 'audio');
  const expected = keep.reduce((s, [a, b]) => s + b - a, 0);
  if (!outV || !outA || outV.width !== v.width || outV.height !== v.height || Math.abs(Number(result.format.duration) - expected) > 0.15) throw Error('Format oder Dauer des Exports stimmt nicht.');
  run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-'], project, path.join(project, 'logs/decode.log'));
  meta.status = 'exported_for_review';
  meta.latestExport = output;
  meta.cutDuration = Number(result.format.duration);
  meta.removedSeconds = meta.originalDuration - meta.cutDuration;
  meta.keepIntervals = keep;
  json(path.join(project, 'workflow.json'), meta);
  console.log(`Export technisch geprüft: ${output}\n${meta.originalDuration.toFixed(2)} s → ${meta.cutDuration.toFixed(2)} s`);
}
