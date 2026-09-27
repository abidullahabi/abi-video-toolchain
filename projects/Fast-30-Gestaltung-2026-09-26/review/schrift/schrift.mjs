// Schriftproben: gleiches Bild, gleiche Texte (H1, H2-Aufzählung, Untertitel) in verschiedenen Schriften, verlustfrei (PNG).
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../../..');
const fonts = [
  ['Arial Bold (aktuell)', '"ABI Arial Bold"', 800, 700, 800],
  ['Helvetica Neue Bold', '"Helvetica Neue"', 700, 700, 700],
  ['Avenir Next Heavy / Bold', '"Avenir Next"', 800, 700, 800],
  ['DIN Alternate Bold', '"DIN Alternate"', 700, 700, 700],
  ['Futura Bold', '"Futura"', 700, 700, 700],
];
const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8' }).trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920 });
for (const [i, [label, family, w1, w2, wc]] of fonts.entries()) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:"ABI Arial Bold";src:url("../../assets/arial-bold.ttf")}
  body{margin:0;width:1080px;height:1920px;background:url("hintergrund.png");position:relative;color:#fff;font-family:${family}}
  .h1{position:absolute;top:250px;left:0;width:1080px;display:flex;justify-content:center}
  .h1 span{display:inline-block;padding:12px 22px 14px;border-radius:12px;background:#1668b5;font-size:72px;line-height:1.2;font-weight:${w1};white-space:nowrap}
  .h2{position:absolute;top:382px;left:0;width:1080px;text-align:center;font-size:46px;line-height:1.15;font-weight:${w2};-webkit-text-stroke:5px #000;paint-order:stroke fill}
  .cap{position:absolute;top:1280px;left:0;width:1080px;height:92px;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:${wc};-webkit-text-stroke:6px #000;paint-order:stroke fill}
  .a{color:#5eb3f5}</style></head><body>
  <div class="h1"><span>3. Die großen Drei</span></div>
  <div class="h2"><span class="a">Stadt</span> · Umfeld · Partner</div>
  <div class="cap"><span class="a">Erstens,</span>&nbsp;wo du wohnst</div></body></html>`;
  const fs = await import('node:fs'); const f = path.join(here, `probe-${i}.html`); fs.writeFileSync(f, html); await page.goto('file://' + f, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, `probe-${i}.png`) });
}
await browser.close(); console.log('ok');
