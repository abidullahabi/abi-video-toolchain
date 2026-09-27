// Standbilder der Komposition zu bestimmten Zeiten (Sichtprüfung). Aufruf: node snap-klar.mjs <präfix> t1 t2 ...
// Chrome spielt kein ProRes: Für Grafik-Stellen wird das Einzelbild der Personenebene per ffmpeg als PNG eingesetzt.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const project = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(project, '../..');
const [prefix, ...times] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(path.join(project, 'theme-plan.json')));
const outDir = path.join(project, 'review/stills'); fs.mkdirSync(outDir, { recursive: true });
const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920 });
await page.goto(pathToFileURL(path.join(project, 'index.html')).href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
for (const t of times.map(Number)) {
  const g = (plan.grafiken || []).find(g => t >= g.start && t < g.end);
  let still = null;
  if (g && fs.existsSync(path.join(project, g.person))) {
    still = path.join(outDir, `_person-${t.toFixed(2)}.png`);
    execFileSync(path.join(root, 'tools/bin/ffmpeg'), ['-v', 'error', '-y', '-ss', (t - g.start).toFixed(4), '-i', path.join(project, g.person), '-frames:v', '1', '-pix_fmt', 'rgba', still]);
  }
  await page.evaluate(async (t, gid, still) => {
    const v = document.getElementById('footage'); v.currentTime = t; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); });
    window.__timelines.root.seek(t, false);
    document.querySelectorAll('.snap-person').forEach(x => x.remove());
    if (gid && still) { const img = document.createElement('img'); img.className = 'snap-person'; img.src = still; img.style.cssText = 'position:absolute;inset:0;width:1080px;height:1920px'; document.getElementById(gid + '-person').after(img); await img.decode(); }
  }, t, g?.id, still ? pathToFileURL(still).href : null);
  await page.screenshot({ path: path.join(outDir, `${prefix}-${t.toFixed(2)}.png`) });
}
await browser.close(); console.log('ok', times.length);
