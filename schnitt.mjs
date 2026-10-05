// Schnitt nach Auftrag als allgemeine Befehle (Standard seit 04.10.2026: Abis „nahezu perfekter Schnitt“ bei
// „Bücher die so gut sind wie Therapie“; die Skripte von dort liegen verallgemeinert in schnitt/).
//
//   schnitt-analyse  Ton 16 kHz, Bildzeitstempel, Silero, Whisper ganzer Ton, Einzelstücke turbo und small (mit Cache)
//   schnitt-woerter  Wörter mit Rohzeit aus den Einzelstücken          (schnitt/words.py)
//   schnitt-pegel    Pegelverlauf als Zeichenzeile                     (schnitt/env.py)
//   schnitt-naht     zwei Rohzeit-Stücke zusammensetzen und erkennen   (schnitt/naht.py)
//   schnitt-plan     selection.json → schnitt.json                     (schnitt/plan-edl.py, danach schnitt/straffen2.py)
//
// Alles im Projekt unter <Projekt>/schnitt/ (Rohzeit), Ergebnis <Projekt>/schnitt.json. Die Schwellen und Regeln stehen
// unverändert in den Python-Skripten; hier nur Ablauf, Cache und Ausgabe.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { schritt, zeit, pruefsumme, hash } from './projekte.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SKRIPTE = path.join(ROOT, 'schnitt');
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const FPS = 30;
const R = v => Math.round(v * FPS) / FPS;   // wie vorbereiten.mjs (behalten)
const komma = (v, n = 2) => v.toFixed(n).replace('.', ',');

// Python-Skript aus schnitt/ ausführen. ausgabe: 'zeigen' (direkt durchreichen) oder 'zurück' (als Text).
export function py(skript, args, { ausgabe = 'zurück' } = {}) {
  const r = spawnSync('python3', [path.join(SKRIPTE, skript), ...args.map(String)], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ausgabe === 'zeigen' ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
  if (r.error || r.status !== 0) throw Error(`schnitt/${skript} fehlgeschlagen: ${r.error?.message || r.status}\n${(r.stderr || r.stdout || '').slice(-3000)}`);
  return r.stdout || '';
}

function pruefeDateien(P, dateien, hinweis) {
  const fehlt = dateien.filter(f => !fs.existsSync(path.join(P, f)));
  if (fehlt.length) throw Error(`Es fehlt: ${fehlt.join(', ')}. ${hinweis}`);
}

// ---------- 1. schnitt-analyse ----------
export async function schnittAnalyse(P, { BIN, run }) {
  const meta = J(path.join(P, 'workflow.json'));
  const src = meta.source;
  if (!src || !fs.existsSync(src)) throw Error(`workflow.json: "source" fehlt oder ist nicht erreichbar: ${src}`);
  const S = path.join(P, 'schnitt'), A = path.join(S, 'analysis');
  fs.mkdirSync(A, { recursive: true });
  const uhr = () => new Date().toLocaleTimeString('de-DE');
  const melde = (n, r) => console.log(`${n}: ${r.uebersprungen ? 'unverändert, übersprungen' : 'fertig'} (${uhr()})`);

  // Ton 16 kHz mono aus der Quelle. Erst in eine Zwischendatei, dann umbenennen (ersetzt auch einen Verweis, statt durch ihn zu schreiben).
  melde('Ton 16 kHz', await schritt(P, 'schnitt-analyse: ton', { eingaben: [src], werte: { v: 1 }, ausgaben: ['schnitt/speech.wav'] }, () => {
    const tmp = path.join(S, `speech.unfertig-${process.pid}.wav`);
    run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-y', '-i', src, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', tmp]);
    fs.renameSync(tmp, path.join(S, 'speech.wav'));
  }));

  // Echte Bildzeitstempel (iPhone-Aufnahmen sind nicht exakt 30 fps), aufsteigend wie sort -g.
  melde('Bildzeitstempel', await schritt(P, 'schnitt-analyse: bildzeitstempel', { eingaben: [src], werte: { v: 1 }, ausgaben: ['schnitt/analysis/video-pts.txt'] }, () => {
    const out = run(path.join(BIN, 'ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', src]);
    const z = out.split('\n').map(s => s.trim()).filter(Boolean).sort((a, b) => Number(a) - Number(b));
    fs.writeFileSync(path.join(A, 'video-pts.txt'), z.join('\n') + '\n');
  }));

  // Silero (node workflow.mjs analyze-speech), Ergebnis ins Projekt kopieren.
  melde('Silero', await schritt(P, 'schnitt-analyse: silero', { eingaben: ['schnitt/speech.wav'], werte: { v: 1 }, ausgaben: ['schnitt/analysis/speech-boundaries.json'] }, async () => {
    const { analyzeSpeech } = await import('./silero-review.mjs');
    const out = analyzeSpeech(path.join(S, 'speech.wav'), { ROOT, BIN, run, opts: { title: path.basename(P).slice(0, 60) } });
    fs.copyFileSync(path.join(out, 'speech-boundaries.json'), path.join(A, 'speech-boundaries.json'));
    fs.writeFileSync(path.join(A, 'silero-path.txt'), JSON.stringify({ output: out, candidates: J(path.join(A, 'speech-boundaries.json')).candidates.length }) + '\n');
  }));

  // Whisper über den ganzen Ton, wörtlich: -mc 0 (kein Kontext), -et 100 und -lpt -100 (nichts verwerfen).
  melde('Whisper ganzer Ton', await schritt(P, 'schnitt-analyse: whisper ganzer ton', { eingaben: ['schnitt/speech.wav'], werte: { v: 1, modell: 'large-v3-turbo-q5_0', args: '-l de -mc 0 -et 100 -lpt -100 -dtw large.v3.turbo -nfa' }, ausgaben: ['schnitt/analysis/detection-full.json', 'schnitt/analysis/detection-full.txt', 'schnitt/analysis/detection-full.srt'] }, () => {
    run(path.join(BIN, 'whisper-cli'), ['-m', path.join(ROOT, 'tools/models/ggml-large-v3-turbo-q5_0.bin'), '-f', 'speech.wav', '-l', 'de', '-mc', '0', '-et', '100', '-lpt', '-100', '-ojf', '-otxt', '-osrt', '-of', 'analysis/detection-full', '-dtw', 'large.v3.turbo', '-nfa', '-t', '8'], S, path.join(A, 'detection-full.log'));
  }));

  // Einzelstücke je Silero-Sprechstück mit Füllwort-Prompt, zwei Modelle zum Gegenprüfen. Ausgabe (Zeiten und Text je Stück) in asr-<modell>.log.
  // analysis/chunks.json schreiben beide (gleich), deshalb keine Ausgabe im Cache-Sinn.
  for (const m of ['turbo', 'small']) {
    melde(`Einzelstücke ${m}`, await schritt(P, `schnitt-analyse: einzelstücke ${m}`, { eingaben: ['schnitt/speech.wav', 'schnitt/analysis/speech-boundaries.json', path.join(SKRIPTE, 'chunk-asr.py')], werte: { v: 1, modell: m, dauer: meta.sourceDuration ?? null }, ausgaben: [`schnitt/analysis/asr-${m}/summary.json`, `schnitt/analysis/asr-${m}.log`] }, () => {
      fs.writeFileSync(path.join(A, `asr-${m}.log`), py('chunk-asr.py', [P, m]));
    }));
  }
  const n = J(path.join(A, 'chunks.json')).length, sil = J(path.join(A, 'speech-boundaries.json')).candidates.length;
  console.log(`Analyse fertig: ${sil} Silero-Lücken, ${n} Sprechstücke. Wörtlich: schnitt/analysis/asr-turbo.log, asr-small.log, detection-full.txt.`);
  console.log(`Weiter: Planer schreibt schnitt/selection.json (Prüfer prüft), dann node workflow.mjs schnitt-plan "${P}".`);
}

// ---------- 2. Hilfsbefehle für Planer und Prüfer ----------
export function schnittWoerter(P, von, bis, modell = 'turbo') {
  if (!(Number(bis) > Number(von))) throw Error('Bitte <von> <bis> in Sekunden Rohzeit angeben.');
  if (!['turbo', 'small'].includes(modell)) throw Error('Modell: turbo oder small.');
  pruefeDateien(P, [`schnitt/analysis/asr-${modell}/summary.json`], 'Zuerst node workflow.mjs schnitt-analyse ausführen.');
  py('words.py', [P, von, bis, modell], { ausgabe: 'zeigen' });
}
export function schnittPegel(P, bereiche) {
  if (!bereiche.length || bereiche.some(b => !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(b))) throw Error('Bitte Bereiche als <von>:<bis> in Sekunden Rohzeit angeben, z. B. 59.4:59.7');
  pruefeDateien(P, ['schnitt/speech.wav'], 'Zuerst node workflow.mjs schnitt-analyse ausführen.');
  py('env.py', [P, ...bereiche], { ausgabe: 'zeigen' });
}
export function schnittNaht(P, zahlen) {
  if (zahlen.length !== 4 || zahlen.some(z => !Number.isFinite(Number(z)))) throw Error('Bitte vier Rohzeiten angeben: <a1> <b1> <a2> <b2>.');
  pruefeDateien(P, ['schnitt/speech.wav'], 'Zuerst node workflow.mjs schnitt-analyse ausführen.');
  py('naht.py', [P, ...zahlen], { ausgabe: 'zeigen' });
}

// ---------- 3. schnitt-plan ----------
// Wurde die jetzige schnitt.json (mit diesem Tempo) schon von vorbereiten verarbeitet? Gleicher Cache-Schlüssel wie
// vorbereiten.mjs „wörter in Schnittzeit“ (eingaben woerter-roh/chunks.json und schnitt.json, werte v 1 und tempo ≠ 1).
export function vorbereitetMit(P, tempo) {
  const cacheDatei = path.join(P, 'logs/cache.json');
  const eingaben = ['woerter-roh/chunks.json', 'schnitt.json'];
  if (!fs.existsSync(cacheDatei) || eingaben.some(f => !fs.existsSync(path.join(P, f)))) return false;
  const alt = J(cacheDatei)['vorbereiten: wörter in Schnittzeit'];
  if (!alt) return false;
  const werte = { v: 1, ...(tempo !== 1 ? { tempo } : {}) };
  return alt.schluessel === hash({ eingaben: eingaben.map(f => [f, pruefsumme(path.join(P, f))]), werte });
}
// Tempo, mit dem media.mp4 zuletzt gebaut wurde (vorbereiten schreibt workflow.json media.tempo nur bei tempo ≠ 1).
export const tempoVonMedia = meta => meta.media ? Number(meta.media.tempo ?? 1) : Number(meta.tempo ?? 1);

// schnitt/vorher.json beschreibt den Stand, zu dem design-plan.json und caption-edit-plan.json passen (für schnitt-umstellen):
// behalten und Tempo von media.mp4, dazu die Zahl der Umrechnungsvermerke in design-plan.json (_umgerechnet).
const umgerechnetZahl = P => { try { return (J(path.join(P, 'design-plan.json'))._umgerechnet || []).length; } catch { return 0; } };
export function schreibeVorher(P, behalten, tempo, extra = {}) {
  const f = path.join(P, 'schnitt.json');
  fs.writeFileSync(path.join(P, 'schnitt/vorher.json'), JSON.stringify({ _quelle: 'Stand, zu dem die Pläne passen (schnitt.json und Tempo von media.mp4); für node workflow.mjs schnitt-umstellen', gesichert: new Date().toISOString(),
    tempo, sha256: pruefsumme(f), umgerechnet: umgerechnetZahl(P), ...extra, behalten }, null, 1) + '\n');
}
// Vor schnitt-plan: bisherige schnitt.json sichern. Stehen Pläne auf einem älteren Stand, der noch nicht umgerechnet ist
// (vorher.json weicht ab und design-plan.json hat seitdem keinen neuen Umrechnungsvermerk), bleibt vorher.json stehen.
export function vorherSichern(P, meta) {
  const f = path.join(P, 'schnitt.json'), ziel = path.join(P, 'schnitt/vorher.json');
  if (!fs.existsSync(f)) return 'keine bisherige schnitt.json (erster Schnitt), nichts gesichert';
  const tempo = tempoVonMedia(meta);
  if (fs.existsSync(ziel) && fs.existsSync(path.join(P, 'design-plan.json'))) {
    const v = J(ziel);
    const gleich = v.sha256 === pruefsumme(f) && Number(v.tempo) === tempo;
    if (!gleich && umgerechnetZahl(P) <= (v.umgerechnet ?? 0)) return `schnitt/vorher.json bleibt: Die Pläne passen noch zum Stand vom ${v.gesichert} (Tempo ${komma(Number(v.tempo), 1)}); schnitt-umstellen steht aus.`;
  }
  schreibeVorher(P, J(f).behalten, tempo, { vorbereitet: vorbereitetMit(P, tempo) });
  return `bisherige schnitt.json mit Tempo ${komma(tempo, 1)} als schnitt/vorher.json gesichert`;
}

export async function schnittPlan(P) {
  pruefeDateien(P, ['schnitt/selection.json', 'schnitt/speech.wav', 'schnitt/analysis/speech-boundaries.json', 'schnitt/analysis/video-pts.txt'], 'Erst schnitt-analyse, dann selection.json vom Planer.');
  const meta = J(path.join(P, 'workflow.json'));
  return zeit(P, 'schnitt-plan', () => {
    console.log(vorherSichern(P, meta));
    console.log(py('plan-edl.py', [P]).trim());
    console.log(py('straffen2.py', [P]).trim());
    const k = J(path.join(P, 'schnitt.json')).behalten.map(([a, b]) => [R(a), R(b)]);
    const dauer = k.reduce((s, [a, b]) => s + b - a, 0), tempo = Number(meta.tempo ?? 1);
    console.log(`Dauer ${komma(dauer)} s bei Tempo 1` + (tempo !== 1 ? `, ${komma(dauer / tempo, 1)} s bei Tempo ${komma(tempo, 1)} (workflow.json)` : '') + `; ${k.length} Stücke.`);
    console.log(`Ergebnis: schnitt.json, schnitt/edl.json, schnitt/straffen2-bericht.json. Weiter: node workflow.mjs vorbereiten "${P}"` + (fs.existsSync(path.join(P, 'design-plan.json')) ? `, danach node workflow.mjs schnitt-umstellen "${P}" (Pläne gibt es schon).` : '.'));
    return { dauer: Math.round(dauer * 1000) / 1000, tempo, dauerMitTempo: Math.round(dauer / tempo * 1000) / 1000, stuecke: k.length };
  });
}
