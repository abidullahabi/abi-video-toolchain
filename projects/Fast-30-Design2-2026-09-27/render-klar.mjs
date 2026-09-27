// Render wie workflow.mjs render-html (gleiche HyperFrames-Argumente), aber mit der projektlokalen Prüfung gegen DESIGN.md 2.0.
//   node projects/Fast-30-Design2-2026-09-27/render-klar.mjs [--draft]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(project, '../..');
const HF = path.join(ROOT, 'node_modules/hyperframes/bin/hyperframes.mjs'), BIN = path.join(ROOT, 'tools/bin');
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', PATH: `${BIN}:${process.env.PATH}` };
const run = (exe, args, log) => { const r = spawnSync(exe, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 28 }); fs.writeFileSync(path.join(project, 'logs', log), (r.stdout || '') + (r.stderr || '')); if (r.status) throw Error(`${path.basename(exe)} ${args[0]} fehlgeschlagen, siehe logs/${log}`); return r.stdout; };
const draft = process.argv.includes('--draft');
const meta = JSON.parse(fs.readFileSync(path.join(project, 'workflow.json')));
fs.mkdirSync(path.join(project, 'logs'), { recursive: true });
run(process.execPath, [path.join(project, 'check-design20.mjs')], '04-layout-check.log');
run(process.execPath, [HF, 'lint', project], '05-lint.log');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const prores = meta.renderMaster === 'prores' && !draft;
const out = path.join(project, 'exports', `${draft ? 'entwurf' : 'final'}-${stamp}.${prores ? 'mov' : 'mp4'}`);
const args = [HF, 'render', project, '--output', out, '--fps', '30', '--quality', draft ? 'draft' : 'high', '--workers', '1', '--sdr', '--low-memory-mode'];
if (prores) args.push('--format', 'mov');
const t0 = Date.now();
run(process.execPath, args, '06-render.log');
const probe = JSON.parse(run(path.join(BIN, 'ffprobe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out], '06b-probe.log'));
const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
if (!v || !a || v.width !== 1080 || v.height !== 1920 || Math.abs(+probe.format.duration - meta.cutDuration) > 0.25) throw Error('Exportprüfung: Format, Tonspur oder Dauer stimmt nicht.');
run(path.join(BIN, 'ffmpeg'), ['-v', 'error', '-xerror', '-i', out, '-f', 'null', '-'], '07-decode.log');
meta.status = 'exported'; meta.latestExport = out; meta.exportedAt = new Date().toISOString(); meta.renderMinuten = Math.round((Date.now() - t0) / 600) / 100;
fs.writeFileSync(path.join(project, 'workflow.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`Export geprüft: ${out} (${meta.renderMinuten} min)`);
