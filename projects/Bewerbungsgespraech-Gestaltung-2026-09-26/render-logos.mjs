// Rendert die offiziellen Logos 1:1 in Anzeigegroesse (Hoehe 112 px = H1-Flaeche bei 72 px) als PNG mit Transparenz.
// Quelle bleibt unveraendert in assets/quellen; Herkunft und Pruefsummen in assets/logos.json.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
const project = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(project, '../..');
const H = 112;
const logos = [
  { name: 'notion', src: 'assets/quellen/notion/notion-logo-block-sticker-white.svg', w: 381, h: 396,
    herkunft: { seite: 'https://www.notion.so/Media-Kit-205535b1d9c4440497a3d7a2ac096286 (Notion Official, Media Kit)', paket: 'NotionLogoFiles.zip', datei: 'notion-logo-block-sticker-white.svg (Block-Logo als Sticker mit weißem Rand)' } },
  { name: 'onenote', src: 'assets/quellen/onenote_48x1.svg', w: 48, h: 48,
    herkunft: { seite: 'Microsoft Office Brand Icons (Fluent/Fabric CDN)', download: 'https://res-1.cdn.office.net/files/fabric-cdn-prod_20240129.001/assets/brand-icons/product/svg/onenote_48x1.svg', hinweis: 'Offizielles Microsoft-Produkticon mit eigenem Farbverlauf; unverändert.' } },
  { name: 'linkedin', src: 'assets/quellen/linkedin-in-blue.png', w: 635, h: 540,
    herkunft: { seite: 'https://brand.linkedin.com/downloads', download: 'https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/logos/in-logo.zip', datei: 'in-logo/LI-In-Bug.png', abgerufen: '2026-09-14 (aus Projekt Luegen-in-CV übernommen)' } },
];
const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out = { erzeugt: 'render-logos.mjs', hoehe: H, logos: {} };
try {
  for (const l of logos) {
    const width = Math.round(H * l.w / l.h);
    const page = await browser.newPage(); await page.setViewport({ width, height: H, deviceScaleFactor: 1 });
    const html = path.join(project, `review/logo-${l.name}.html`);
    fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><img src="${pathToFileURL(path.join(project, l.src)).href}" style="display:block;width:${width}px;height:${H}px"></body></html>`);
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    const file = path.join(project, `assets/logo-${l.name}.png`);
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width, height: H } });
    fs.unlinkSync(html); await page.close();
    out.logos[l.name] = { datei: `logo-${l.name}.png`, breite: width, hoehe: H, sha256: sha(file), quelle: l.src, quelleSha256: sha(path.join(project, l.src)), ...l.herkunft };
  }
} finally { await browser.close(); }
out.pakete = { 'NotionLogoFiles.zip': sha(path.join(project, 'assets/quellen/NotionLogoFiles.zip')), 'onenote_48x1.svg': sha(path.join(project, 'assets/quellen/onenote_48x1.svg')) };
out.abgerufen = '2026-09-26';
out.auftrag = 'Abdullah am 26.09.2026: „die offiziellen Logos von Notion, OneNote und LinkedIn mit herunterladen“';
fs.writeFileSync(path.join(project, 'assets/logos.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.logos).map(([k, v]) => [k, `${v.breite}x${v.hoehe}`]))));
