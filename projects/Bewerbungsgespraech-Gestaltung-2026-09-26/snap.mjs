// Standbilder der Komposition zu bestimmten Zeiten (Sichtprüfung). Aufruf: node snap.mjs out-prefix t1 t2 ...
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const project = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(project, '../..');
const [prefix, ...times] = process.argv.slice(2);
const html = process.env.HTML || 'index.html';
const executablePath = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920 });
await page.goto(pathToFileURL(path.join(project, html)).href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
for (const t of times.map(Number)) {
  await page.evaluate(async t => { const v = document.getElementById('footage'); v.currentTime = t; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); }); window.__timelines.root.seek(t, false); }, t);
  await page.screenshot({ path: path.join(project, 'review', `${prefix}-${t.toFixed(2)}.png`) });
}
await browser.close(); console.log('ok', times.length);
