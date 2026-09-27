// Layoutprüfung gegen DESIGN.md 2.0 (Abschnitte 2–15 und Prüfliste 20), Bild für Bild im Browser.
// Projektlokal, damit gemeinsame Prüfskripte anderer Sitzungen unverändert bleiben.
//   node projects/Fast-30-Design2-2026-09-27/check-design20.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const project = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(project, '../..');
const plan = JSON.parse(fs.readFileSync(path.join(project, 'theme-plan.json')));
const faces = JSON.parse(fs.readFileSync(path.join(project, 'review/source-faces.json')));
const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
let report;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(project, 'index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  report = await page.evaluate(({ plan, faces, step }) => {
    const errors = [], warnings = [], seen = new Set();
    const add = (list, type, d = {}) => { const k = type + JSON.stringify({ ...d, time: undefined }); if (seen.has(k) || list.length > 300) return; seen.add(k); list.push({ type, ...d }); };
    const err = (t, d) => add(errors, t, d), warn = (t, d) => add(warnings, t, d);
    const tl = window.__timelines.root;
    const cs = el => getComputedStyle(el);
    const R = (el, pad = 0) => { const b = el.getBoundingClientRect(); return { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad }; };
    const U = els => { const r = els.map(e => e.getBoundingClientRect()); const x = Math.min(...r.map(b => b.x)), y = Math.min(...r.map(b => b.y)); return { x, y, w: Math.max(...r.map(b => b.right)) - x, h: Math.max(...r.map(b => b.bottom)) - y }; };
    const meet = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const vis = el => { for (let e = el; e && e.id !== 'root'; e = e.parentElement) { const s = cs(e); if (s.visibility !== 'visible' && e.classList.contains('clip')) return false; if (s.display === 'none' || +s.opacity < 0.001) return false; } return cs(el).visibility === 'visible'; };
    // 4: Schriften geladen, keine Ersatzschrift.
    for (const f of ['900 64px "ABI Archivo"', '800 64px "ABI Archivo"', '700 24px "ABI Archivo"', '400 140px "ABI Gochi"']) if (!document.fonts.check(f)) err('font_missing', { font: f });
    for (const img of document.images) if (!img.complete || !img.naturalWidth) err('missing_asset', { src: img.getAttribute('src') });
    // Box eines Elements mit sichtbarer Kontur bzw. Schatten/Ring.
    const box = el => {
      const k = el.dataset.kind;
      if (k === 'h1') return R(el.querySelector('.h1'), 8);
      if (k === 'h2') return R(el.querySelector('.h2'));
      if (k === 'kapitel') { const u = U([...el.querySelectorAll('.kap-num,.kap-title')]); return { x: u.x - 7, y: u.y - 7, w: u.w + 14, h: u.h + 14 }; }
      if (k === 'pillen') { const ps = [...el.querySelectorAll('.pill')].filter(p => +cs(p).opacity > 0.001); if (!ps.length) return null; const u = U(ps); return { x: u.x - 3, y: u.y - 3, w: u.w + 6, h: u.h + 6 }; }
      if (k === 'schlagwort') { const u = U([el.querySelector('.sw-word'), el.querySelector('.sw-lines')]); return { x: u.x - 11, y: u.y - 11, w: u.w + 22, h: u.h + 22 }; }
      if (k === 'randnotiz') { const ls = [...el.querySelectorAll('.note-line')].filter(l => +cs(l).opacity > 0.001); if (!ls.length) return null; const u = U(ls); return { x: u.x - 8, y: u.y - 4, w: u.w + 16, h: u.h + 8 }; }
      if (k === 'grafik') { const b = R(el.querySelector('.card')); return { x: b.x, y: b.y, w: b.w + 12, h: b.h + 12 }; }
      if (k === 'caption') return R(el.querySelector('.cap-line'), 6);
      if (k === 'follow') return R(el.querySelector('.follow'), 5);
      if (k === 'outro-card' || k === 'balken') return R(el, 3);
      return null;
    };
    const LAYER = new Set(['h1', 'h2', 'kapitel', 'pillen', 'schlagwort', 'randnotiz', 'balken', 'grafik', 'follow', 'outro-card']);
    const CENTER = { h1: '.h1', h2: '.h2', kapitel: '.kap', schlagwort: '.sw-word', caption: '.cap-line', follow: '.follow' };
    const BLUE = 'rgb(94, 170, 238)', WHITE = 'rgb(255, 255, 255)';
    const heads = t => { const f = faces.reduce((b, x) => Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b); return Math.abs(f.time - t) > 0.26 ? [] : f.faces.map(q => ({ x: q.x - 0.12 * q.width, y: q.y - 0.5 * q.height, w: 1.24 * q.width, h: 1.5 * q.height })); };
    const inGreen = t => (plan.grafiken || []).some(g => t >= g.start && t < g.end);
    const frames = Math.ceil(plan.duration * 30);
    let maxLayers = 0, capFrames = 0;
    for (let f = 0; f < frames; f += step) {
      const t = f / 30; tl.seek(t, false);
      const active = [];
      for (const el of document.querySelectorAll('.clip[data-kind]')) {
        if (!vis(el)) continue;
        const k = el.dataset.kind; if (k === 'gs-bg') continue;
        const b = box(el); if (!b || b.w < 1) continue;
        active.push({ id: el.id, k, b, el });
        // 2: gesperrte Zonen, Konturen/Schatten eingerechnet. Obere Zone (bis y 900) nutzbar x 108–972.
        if (b.y < 249.5 || b.y + b.h > 1660.5 || b.x < 89.5) err('gesperrte_zone', { id: el.id, t, b });
        if (b.y + b.h > 900.5 && b.x + b.w > 930.5) err('aktionsleiste', { id: el.id, t, b }); // rechts von x 930 unterhalb von y 900
        if (b.y < 900 && k !== 'caption' && (b.x < 107.5 || b.x + b.w > 972.5) && !(k === 'outro-card')) err('obere_zone_breite', { id: el.id, t, b });
        // 2: Mittelachse x = 540.
        if (CENTER[k]) { const c = R(el.querySelector(CENTER[k])); if (Math.abs(c.x + c.w / 2 - 540) > 0.75) err('mittelachse', { id: el.id, t, center: +(c.x + c.w / 2).toFixed(2) }); }
        if (k === 'pillen' && el.dataset.layout === 'row') { const u = U([...el.querySelectorAll('.pill')]); if (Math.abs(u.x + u.w / 2 - 540) > 0.75) err('mittelachse', { id: el.id, t }); }
        // 7: Untertitel einzeilig, ≤ 780 px, genau ein Wort blau.
        if (k === 'caption') {
          capFrames++;
          const line = el.querySelector('.cap-line'), ws = [...line.children];
          if (R(line).w + 12 > 780.5) err('untertitel_breite', { id: el.id, w: R(line).w + 12 });
          if (new Set(ws.map(s => Math.round(s.getBoundingClientRect().top))).size !== 1) err('untertitel_umbruch', { id: el.id });
          const blue = ws.filter(s => cs(s).color === BLUE).length; if (blue !== 1) err('untertitel_blau', { id: el.id, t, blue });
          if (Math.abs(R(line).y - 1280) > 0.75 && Math.abs(el.getBoundingClientRect().top - 1280) > 0.75) err('untertitel_position', { id: el.id, y: el.getBoundingClientRect().top });
        }
      }
      // 1: höchstens zwei Textebenen zusätzlich zum Untertitel.
      const layers = active.filter(a => LAYER.has(a.k));
      maxLayers = Math.max(maxLayers, layers.length);
      if (layers.length > 2) err('drei_textebenen', { t, ids: layers.map(a => a.id) });
      // Keine Überlappung zwischen Einblendungen (Untertitel, Karte ausgenommen, wenn die Person davor steht).
      for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) { const a = active[i], b = active[j]; if (meet(a.b, b.b)) err('ueberlappung', { a: a.id, b: b.id, t }); }
      // Kopf/Kappe: Pillen und Randnotiz blockierend (9, 12), übrige obere Elemente als Hinweis.
      if (!inGreen(t)) for (const h of heads(t)) for (const a of active) if (meet(a.b, h)) { if (['pillen', 'randnotiz'].includes(a.k)) err('kopf_verdeckt', { id: a.id, t }); else if (!['caption', 'follow', 'outro-card', 'h1'].includes(a.k)) warn('kopf_beruehrt', { id: a.id, t: +t.toFixed(2), kopfOben: Math.round(h.y), elementUnten: Math.round(a.b.y + a.b.h) }); }
    }
    // 5: Einstieg ab dem ersten Frame vollständig, ohne Animation.
    tl.seek(0, false);
    for (const el of document.querySelectorAll('[data-einstieg]')) { const s = cs(el), m = new DOMMatrix(s.transform); if (s.visibility !== 'visible' || +s.opacity < 0.999 || m.f !== 0 || m.a !== 1) err('einstieg_frame0', { id: el.id }); }
    const h1 = document.querySelector('#einstieg-h1 .h1'); if (Math.abs(R(h1).y - 250) > 1) warn('einstieg_oberkante', { y: R(h1).y });
    // 6: Größen der H1-Zeilen (≤ 160, Zeile inkl. Kontur ≤ 864), H2-Fläche ≤ 780.
    for (const el of document.querySelectorAll('[data-kind=h1] .ln')) { const fs = parseFloat(cs(el).fontSize); if (fs > 160) err('h1_groesse', { fs }); if (R(el).w + 16 > 864.5) err('h1_breite', { w: R(el).w + 16 }); }
    for (const el of document.querySelectorAll('[data-kind=h2] .h2')) { if (el.offsetWidth > 780.5) err('h2_breite', { id: el.parentElement.id, w: el.offsetWidth }); if (el.querySelectorAll('.ln').length > 2) err('h2_zeilen', { id: el.parentElement.id }); }
    for (const el of document.querySelectorAll('.kap')) if (el.offsetWidth + 14 > 864.5) err('kapitel_breite', { w: el.offsetWidth });
    // 3/18: Farben. Pink nur Schlagwort-Unterstreichung und Durchstreichen; keine Emojis.
    const allowed = new Set(['rgb(17, 17, 17)', WHITE, 'rgb(246, 241, 233)', BLUE, 'rgb(255, 138, 194)', 'rgb(248, 249, 251)', 'rgb(22, 24, 28)', 'rgb(122, 126, 134)', 'rgb(222, 225, 231)', 'rgba(0, 0, 0, 0)', 'none']);
    for (const el of document.querySelectorAll('#root *')) {
      const s = cs(el); if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO' || el.tagName === 'IMG' || el.closest('.oc-icon')) continue;
      for (const p of ['color', 'backgroundColor', 'fill', 'stroke', 'webkitTextStrokeColor', 'borderTopColor']) { const v = s[p]; if (!v || v.startsWith('url(') || allowed.has(v)) continue; if (p === 'borderTopColor' && s.borderTopWidth === '0px') continue; if (p === 'color' && el.closest('svg') && !(el.tagName === 'text')) continue; err('farbe', { el: el.tagName + '#' + el.id + '.' + el.className?.baseVal ?? el.className, p, v }); }
      if (['fill', 'stroke', 'backgroundColor', 'color'].some(p => s[p] === 'rgb(255, 138, 194)') && !el.closest('.sw-lines,.note-strike')) err('pink_ausserhalb', { el: el.tagName + '#' + el.id });
    }
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(document.getElementById('root').textContent)) err('emoji');
    // 4: Gochi Hand nur für Zahlen (Kapitel, Pillen, Randnotiz, Akronym).
    for (const el of document.querySelectorAll('#root *')) if (cs(el).fontFamily.includes('Gochi') && el.children.length === 0 && el.textContent.trim() && !/^[\d.,]+$/.test(el.textContent.trim())) err('gochi_nicht_zahl', { text: el.textContent });
    // 14: Outro.
    const o = plan.outro; tl.seek(o.start + 2, false);
    const card = document.getElementById('outro-card'), cb = R(card);
    if (Math.abs(cb.x - 90) > 0.2 || Math.abs(cb.y + cb.h - 1660) > 0.2 || Math.abs(cb.w - 700) > 0.2 || Math.abs(cb.h - 237) > 0.2) err('outro_karte', { cb });
    const cnt = [...document.querySelectorAll('.cnt')].find(x => cs(x).visibility === 'visible')?.textContent, fill = new DOMMatrix(cs(document.getElementById('oc-fill')).transform).a;
    if (cnt !== o.followers.toLocaleString('de-DE') || Math.abs(fill - o.followers / 10000) > 1e-4) err('outro_zaehler', { cnt, fill });
    const fb = R(document.querySelector('#follow .follow')); if (Math.abs(fb.y - 250) > 1) warn('follow_oberkante', { y: fb.y });
    const handles = [...card.querySelectorAll('.oc-handle')].map(h => h.textContent); if (JSON.stringify(handles) !== JSON.stringify(['@itsabidullahabi', '@abidullahabi', '@abidullahabi', 'Abdullah Bachtari'])) err('handles', { handles });
    for (const el of card.querySelectorAll('.oc-head,.oc-track,.oc-grid')) { const b = R(el); if (b.x < cb.x + 21.9 || b.x + b.w > cb.x + cb.w - 21.9 || b.y + b.h > cb.y + cb.h - 21.9) err('outro_innenabstand', { cls: el.className, b }); }
    // 11: Grafik-Karte x 150, y 270, Breite 780.
    for (const g of plan.grafiken || []) { tl.seek(g.start + 0.5, false); const b = R(document.querySelector('#' + g.id + ' .card')); if (Math.abs(b.x - 150) > 0.5 || Math.abs(b.y - 270) > 0.5 || Math.abs(b.w - 780) > 0.5) err('grafik_karte', { b }); if (!document.getElementById(g.id + '-person')) err('grafik_person_fehlt'); }
    return { designVersion: plan.designVersion, framesChecked: Math.ceil(frames / step), step, maxLayers, capFrames, errors, warnings };
  }, { plan, faces, step: Number(process.env.STEP || 1) });
} finally { await browser.close(); }
const html = fs.statSync(path.join(project, 'index.html')).mtime.toISOString();
report.blocking = report.errors.length; report.checkedAt = new Date().toISOString(); report.indexHtml = html;
fs.writeFileSync(path.join(project, 'review/layout-check.json'), JSON.stringify(report, null, 2) + '\n');
const byType = a => Object.entries(a.reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {}));
console.log(JSON.stringify({ frames: report.framesChecked, maxLayers: report.maxLayers, blocking: report.blocking, fehler: byType(report.errors), hinweise: byType(report.warnings), beispiele: report.errors.slice(0, 12) }, null, 1));
if (report.blocking) process.exitCode = 1;
