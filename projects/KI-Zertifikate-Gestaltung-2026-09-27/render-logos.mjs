// Rendert die offiziellen Logos 1:1 in Anzeigegroesse als PNG mit Transparenz (Muster: Bewerbungsgespraech-Gestaltung).
// Quellen unveraendert in assets/quellen; Herkunft und Pruefsummen in assets/logos.json.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
const project = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(project, '../..');
const PK = { seite: 'https://www.anthropic.com/news → „Download press kit“ (https://anthropic.com/press-kit)', paket: 'anthropic-press-kit.zip (https://www-cdn.anthropic.com/ae59ca4ca194dac9c9dc3bc78c5829468cb0e8af.zip)' };
const logos = [
  { name: 'anthropic', src: 'assets/quellen/anthropic-logo-slate.svg', w: 590, h: 68, H: 76, herkunft: { ...PK, datei: 'Anthropic logos/1 Anthropic logo/SVG/Anthropic logo - Slate.svg' } },
  { name: 'claude', src: 'assets/quellen/claude-logo-slate.svg', w: 9156, h: 2000, H: 100, herkunft: { ...PK, datei: 'Claude logos/1 Claude logo/SVG/Claude logo - Slate.svg' } },
  { name: 'google', src: 'assets/quellen/GoogleG_FullColor_RGB-ohne-Schutzraum.png', w: 920, h: 940, H: 104, herkunft: { seite: 'https://partnermarketinghub.withgoogle.com/brands/google/branding-guidelines/how-to-show-googles-brand/ (Nachfolger about.google/brand-resource-center, „Google G – Digital“)', datei: 'GoogleG_FullColor_RGB.png (2820×2820), nur der transparente Schutzraum abgeschnitten (Alpha-Begrenzung), Form und Seitenverhältnis unverändert', hinweis: 'Vollfarbiges Google G, unverändert; Google: nicht verändern, auf hellem Grund, nicht in Marketingmaterial – hier redaktionelle Nennung des Kurses' } },
];
const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out = { erzeugt: 'render-logos.mjs', logos: {} };
try {
  for (const l of logos) {
    const H = l.H, width = Math.round(H * l.w / l.h);
    const page = await browser.newPage(); await page.setViewport({ width, height: H, deviceScaleFactor: 1 });
    const html = path.join(project, `review/logo-${l.name}.html`);
    fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><img src="${pathToFileURL(path.join(project, l.src)).href}" style="display:block;width:${width}px;height:${H}px"></body></html>`);
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    const file = path.join(project, `assets/logo-${l.name}.png`);
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width, height: H } });
    fs.renameSync(html, path.join(project, `review/logo-${l.name}.html.txt`)); await page.close();
    out.logos[l.name] = { datei: `assets/logo-${l.name}.png`, breite: width, hoehe: H, sha256: sha(file), quelle: l.src, quelleSha256: sha(path.join(project, l.src)), ...l.herkunft };
  }
} finally { await browser.close(); }
out.pakete = { 'anthropic-press-kit.zip': sha(path.join(project, 'assets/quellen/anthropic-press-kit.zip')) };
out.abgerufen = '2026-09-27';
out.auftrag = 'Abdullah am 27.09.2026: „Bitte erst mal die Logos suchen“ (Anthropic, Claude, Google)';
fs.writeFileSync(path.join(project, 'assets/logos.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.logos).map(([k, v]) => [k, `${v.breite}x${v.hoehe}`]))));
