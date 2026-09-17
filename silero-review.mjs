import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Analysis candidates, never automatic removals. Preserve short gaps which
// whisper.cpp 1.9.4's segment API would merge back into speech below 200 ms.
export function nonSpeechCandidates(data, threshold = 0.7, minGapMs = 64) {
  const { probabilities, sampleRate, hopSamples, sampleCount } = data;
  if (sampleRate !== 16000 || hopSamples !== 512 || !Array.isArray(probabilities)
      || probabilities.length !== Math.ceil(sampleCount / hopSamples)
      || !probabilities.every(p => Number.isFinite(p) && p >= 0 && p <= 1)) {
    throw new Error('Unerwartete Silero-Ausgabe. Modell und Zeitraster prüfen.');
  }
  if (!(threshold >= 0.15 && threshold <= 0.95 && minGapMs >= 32)) {
    throw new Error('Ungültige Erkennungsparameter.');
  }
  const releaseThreshold = Math.max(0.01, threshold - 0.15);
  const hop = hopSamples / sampleRate;
  const duration = sampleCount / sampleRate;
  let start = null;
  const gaps = [];
  const finish = end => {
    if (start !== null && end - start + 1e-9 >= minGapMs / 1000) {
      gaps.push({ start, end, duration: end - start, status: 'needs_word_boundary_review' });
    }
    start = null;
  };
  probabilities.forEach((probability, index) => {
    const time = index * hop;
    if (probability < releaseThreshold && start === null) start = time;
    else if (probability >= threshold && start !== null) finish(time);
  });
  finish(duration);
  return { threshold, releaseThreshold, minGapMs, hopSeconds: hop, duration, candidates: gaps };
}

export function analyzeSpeech(input, { ROOT, BIN, run, opts }) {
  if (!input) throw new Error('Bitte eine konkrete Audio- oder Videodatei angeben.');
  const source = fs.realpathSync(path.resolve(input));
  if (!fs.statSync(source).isFile()) throw new Error('Quelle ist keine Datei.');
  const model = path.join(ROOT, 'tools/models/ggml-silero-v6.2.0.bin');
  const modelHash = createHash('sha256').update(fs.readFileSync(model)).digest('hex');
  if (modelHash !== '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987') {
    throw new Error('Silero-Modell weicht vom geprüften Stand ab.');
  }
  const slug = (opts.title || path.parse(source).name).replace(/[^A-Za-z0-9_-]+/g, '-');
  const output = path.join(ROOT, 'analysis', `Silero-${slug}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(output, { recursive: true });
  const wav = path.join(output, 'speech.wav');
  run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-i', source, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
  const probabilities = JSON.parse(run(path.join(BIN, 'silero-probabilities'), [model, wav], ROOT, path.join(output, 'silero.log')));
  const result = nonSpeechCandidates(probabilities);
  const write = (name, data) => fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2) + '\n');
  write('probabilities.json', probabilities);
  write('speech-boundaries.json', {
    source, model: 'Silero VAD 6.2.0', modelHash, engine: 'whisper.cpp 1.9.4 CPU',
    createdAt: new Date().toISOString(), status: 'calibration_only', automaticEditing: false,
    method: 'Raw probabilities, hysteresis, no fixed 200 ms merging. Boundaries are model estimates, not confirmed phonetic boundaries.',
    ...result,
  });
  console.log(JSON.stringify({ output, duration: result.duration, candidates: result.candidates.length, status: 'analysis_only_no_cuts' }));
  return output;
}
