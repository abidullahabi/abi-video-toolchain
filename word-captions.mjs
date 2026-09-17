import fs from 'node:fs';
import path from 'node:path';

export function transcribeWords(project, { BIN, MODEL, run, opts }) {
  const turbo = opts['speech-model'] === 'turbo';
  const modelFile = turbo ? path.resolve(BIN, '../models/ggml-large-v3-turbo-q5_0.bin') : MODEL;
  if (!fs.existsSync(modelFile)) throw Error('Sprachmodell fehlt: '+modelFile);
  const duration = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json'))).cutDuration;
  const promptFile = path.join(project, 'transcription-prompt.txt');
  const vocabulary = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8').trim() : '';
  const chunksFile = opts.review ? 'transcription-review-chunks.json' : 'transcription-chunks.json';
  const outputFolder = (opts.review ? 'word-review' : 'word-alignment')+(turbo?'-turbo':'');
  const boundaries = fs.existsSync(path.join(project, chunksFile))
    ? JSON.parse(fs.readFileSync(path.join(project, chunksFile)))
    : Array.from({length: Math.ceil(duration / 24)}, (_, i) => [i * 24, Math.min(duration, (i + 1) * 24)]);
  fs.mkdirSync(path.join(project, outputFolder), {recursive: true});
  for (let i = 0; i < boundaries.length; i++) {
    const [start, end] = boundaries[i];
    if (!(start >= 0 && end > start && end <= duration + 0.01)) throw Error('Ungültiger Transkriptionsabschnitt.');
    const stem = path.join(project, outputFolder, `part-${i}`);
    if (!fs.existsSync(`${stem}.wav`)) run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-n', '-ss', String(start), '-t', String(end-start), '-i', path.join(project, 'speech.wav'), '-c:a', 'pcm_s16le', `${stem}.wav`]);
    console.log(`Wortzeiten ${i+1}/${boundaries.length} · ${start.toFixed(1)}–${end.toFixed(1)} s`);
    const args = ['-m', modelFile, '-f', `${stem}.wav`, '-l', 'de', '-ojf', '-otxt', '-osrt', '-of', stem, '-dtw', turbo?'large.v3.turbo':'small', '-nfa', '-t', '6'];
    if (vocabulary) args.push('--prompt', vocabulary);
    if (opts.cpu) args.push('-ng');
    run(path.join(BIN, 'whisper-cli'), args, project, path.join(project, 'logs', `${outputFolder}-${i}.log`));
  }
  fs.writeFileSync(path.join(project, outputFolder, 'chunks.json'), JSON.stringify(boundaries, null, 2));
  console.log('Worterkennung abgeschlossen. Inhalt und Zeiten vor der Gestaltung prüfen.');
}
