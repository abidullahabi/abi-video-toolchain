// Layoutprüfung gegen DESIGN.md 2.2 (Abschnitte 1–15, Prüfliste 20), Bild für Bild im Browser.
//   node check-design22.mjs "<Projektordner>"      (STEP=n prüft nur jedes n-te Bild, nur für Entwürfe)
// Schreibt review/layout-check.json. Befunde, die DESIGN.md nicht zweifelsfrei regelt, stehen als Hinweise (warnings).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

export async function checkDesign22(project, { step = 1 } = {}) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const plan = JSON.parse(fs.readFileSync(path.join(project, 'theme-plan.json')));
  const faces = JSON.parse(fs.readFileSync(path.join(project, 'review/source-faces.json')));
  if (!faces.length || faces.some(s => s.error)) throw Error('Gesichtsprüfung unvollständig (review/source-faces.json).');
  const pf = path.join(project, 'review/kopf-profil.json'), profil = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf)).proben : null;
  const exe = execFileSync(process.execPath, [path.join(root, 'node_modules/hyperframes/bin/hyperframes.mjs'), 'browser', 'path'], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' } }).trim();
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  let report;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(project, 'index.html')).href, { waitUntil: 'load' });
    // Schriften ausdrücklich laden: Ohne Kapitelnummer oder Akronym lädt der Browser Gochi nie, und die Prüfung meldete
    // „Schrift fehlt“ (Fehlalarm, Tempo Phase 5). Fehlt die Datei wirklich, schlägt das Laden fehl und der Befund bleibt.
    await page.evaluate(async () => { await Promise.all(['900 64px "ABI Archivo"', '800 64px "ABI Archivo"', '700 24px "ABI Archivo"', '400 140px "ABI Gochi"'].map(f => document.fonts.load(f).catch(() => null))); await document.fonts.ready; });
    report = await page.evaluate(({ plan, faces, profil, step }) => {
      const errors = [], warnings = [], seen = new Set();
      const add = (list, type, d = {}) => { const k = type + JSON.stringify({ ...d, t: undefined, b: undefined }); if (seen.has(k) || list.length > 400) return; seen.add(k); list.push({ type, ...d }); };
      const err = (t, d) => add(errors, t, d), warn = (t, d) => add(warnings, t, d);
      const tl = window.__timelines.root, cs = el => getComputedStyle(el);
      const R = (el, p = 0) => { const b = el.getBoundingClientRect(); return { x: b.x - p, y: b.y - p, w: b.width + 2 * p, h: b.height + 2 * p }; };
      const T = (el, p = 0) => { const b = el.getBoundingClientRect(); return { x: b.x - p, y: b.y, w: b.width + 2 * p, h: b.height }; }; // Text: Kontur nur seitlich
      const UT = (els, p = 0) => { const u = U(els); return { x: u.x - p, y: u.y, w: u.w + 2 * p, h: u.h }; };
      // Tintenkante statt Zeilenbox für Texte an der Sperrgrenze y 250 (H1, „Folgen nicht vergessen"): Grundlinie aus den Schriftmetriken,
      // Glyphenhöhe per measureText, Kontur oben und unten; seitlich wie T. Berücksichtigt die aktuelle Verschiebung (Ausblenden 8 px).
      const cv = document.createElement('canvas').getContext('2d');
      const ink = (el, stroke) => { const s = cs(el), b = el.getBoundingClientRect(); cv.font = `${s.fontWeight} ${s.fontSize} "ABI Archivo"`; cv.fontStretch = parseFloat(s.fontStretch) >= 125 ? 'expanded' : 'normal';
        const m = cv.measureText(el.textContent), lh = parseFloat(s.lineHeight), base = b.top + (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        return { x: b.x - stroke, y: base - m.actualBoundingBoxAscent - stroke, w: b.width + 2 * stroke, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 2 * stroke }; };
      const INK = (els, stroke) => { const r = els.map(e => ink(e, stroke)); const x = Math.min(...r.map(b => b.x)), y = Math.min(...r.map(b => b.y)); return { x, y, w: Math.max(...r.map(b => b.x + b.w)) - x, h: Math.max(...r.map(b => b.y + b.h)) - y }; };
      const U = (els, p = 0) => { const r = els.map(e => e.getBoundingClientRect()); const x = Math.min(...r.map(b => b.x)), y = Math.min(...r.map(b => b.y)); return { x: x - p, y: y - p, w: Math.max(...r.map(b => b.right)) - x + 2 * p, h: Math.max(...r.map(b => b.bottom)) - y + 2 * p }; };
      const meet = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      // Sichtbar, wenn der Inhalt des Clips sichtbar ist (die Vorlage schaltet die Sichtbarkeit am Kind, HyperFrames den Clip).
      // Inhalt mit Deckkraft 0 gilt als nicht gezeigt: die Logo-Einblendung blendet den Inhalt von H1/Kapitel aus (DESIGN.md 14/15), der Rahmen bleibt.
      const shown = el => { const c = el.firstElementChild; if (!c || cs(c).visibility !== 'visible' || +cs(c).opacity < 0.001) return false; for (let e = el; e && e.id !== 'root'; e = e.parentElement) { const s = cs(e); if (s.display === 'none' || +s.opacity < 0.001) return false; } return true; };
      const vis = els => [...els].filter(x => +cs(x).opacity > 0.001);
      // 4: Schriften geladen, keine Ersatzschrift.
      for (const f of ['900 64px "ABI Archivo"', '800 64px "ABI Archivo"', '700 24px "ABI Archivo"', '400 140px "ABI Gochi"']) if (!document.fonts.check(f)) err('schrift_fehlt', { f });
      for (const img of document.images) if (!img.complete || !img.naturalWidth) err('asset_fehlt', { src: img.getAttribute('src') });
      // Sichtbare Box mit Kontur, Ring oder Schatten.
      const box = el => {
        const k = el.dataset.kind, q = s => el.querySelector(s);
        switch (k) {
          case 'h1': return INK([...el.querySelectorAll('.h1 .ln')], 8);
          case 'h2': return R(q('.h2'));
          case 'kapitel': {
            // 17 (Test Buchcover): Cover samt Schatten (12 px im großen Zustand) und die schon sichtbaren Textteile.
            if (el.dataset.buch) { const c = R(q('.buch-cover')), rs = [{ x: c.x - 6, y: c.y - 6, w: c.w + 24, h: c.h + 24 }], t = vis(el.querySelectorAll('.buch-row,.buch-de'));   // Cover: Rand (box-shadow-Spreizung) 6, Schatten 12
              if (t.length) rs.push(UT(t, 7)); const a = q('.buch-autor'); if (a) rs.push(R(a));   // Autor zählt immer (steht an seinem Platz, auch solange die Blende ihn verdeckt)
              const x = Math.min(...rs.map(b => b.x)), y = Math.min(...rs.map(b => b.y)); return { x, y, w: Math.max(...rs.map(b => b.x + b.w)) - x, h: Math.max(...rs.map(b => b.y + b.h)) - y }; }
            return UT([...el.querySelectorAll('.kap-num,.kap-title')], 7);
          }
          case 'pillen': { const p = vis(el.querySelectorAll('.pill-pop')).map(x => x.firstElementChild); return p.length ? U(p, 3) : null; }
          case 'akronym': { const p = [...el.querySelectorAll('.ak-letter'), ...vis(el.querySelectorAll('.ak-pill-pop')).map(x => x.firstElementChild)]; return UT(p, 8); }
          case 'schlagwort': return UT([q('.sw-word'), q('.sw-lines')], 11);
          case 'randnotiz': { const l = vis(el.querySelectorAll('.note-line')); return l.length ? UT(l, 8) : null; }
          case 'balken': return UT([...vis(el.querySelectorAll('.bal-label')), q('.bal-bed')], 5);
          case 'logo': return R(q('.logo'));
          // 17 (Test B-Roll): sichtbare Fotokarten samt Rand und Schatten (12 px) und die gerade sichtbare Orts-Marke (Schatten 6 px).
          case 'bilder': { const rs = vis(el.querySelectorAll('.bild-lage')).map(x => { const c = R(x.firstElementChild); return { x: c.x, y: c.y, w: c.w + 12, h: c.h + 12 }; });
            for (const o of vis(el.querySelectorAll('.bild-ort'))) { const c = R(o); rs.push({ x: c.x, y: c.y, w: c.w + 6, h: c.h + 6 }); }
            if (!rs.length) return null; const x = Math.min(...rs.map(b => b.x)), y = Math.min(...rs.map(b => b.y)); return { x, y, w: Math.max(...rs.map(b => b.x + b.w)) - x, h: Math.max(...rs.map(b => b.y + b.h)) - y }; }
          case 'grafik': { const b = R(q('.card')); return { x: b.x, y: b.y, w: b.w + 12, h: b.h + 12 }; }
          case 'caption': return T(q('.cap-line'), 6);
          case 'follow': return INK([q('.follow')], 5);
          case 'outro-card': return R(el);
          case 'bubble': { const p = vis(el.querySelectorAll('.msg-pop,.ind-pop')).map(x => x.firstElementChild); return p.length ? U(p, 0) && (b => ({ x: b.x, y: b.y, w: b.w + 6, h: b.h + 6 }))(U(p)) : null; }
        }
        return null;
      };
      const LAYER = new Set(['h1', 'h2', 'kapitel', 'pillen', 'akronym', 'schlagwort', 'randnotiz', 'balken', 'logo', 'grafik', 'follow', 'outro-card', 'bubble', 'bilder']);
      const CENTER = { h1: '.h1', h2: '.h2', kapitel: '.kap', schlagwort: '.sw-word', caption: '.cap-line', follow: '.follow', logo: '.logo', akronym: '.ak-row' };
      const BLUE = 'rgb(94, 170, 238)', WHITE = 'rgb(255, 255, 255)';
      // Wie die Vorlage: Oberkante aus der Maske, seitlich Gesicht ± 30 % (Krempe).
      const faceAt = t => faces.find(f => Math.abs(f.time - t) < 0.01);
      const kopfBox = (q, t) => { if (!profil) return { x: q.x - 0.12 * q.width, y: q.y - 0.5 * q.height, w: 1.24 * q.width, h: 1.5 * q.height }; const f = (faceAt(t)?.faces || [])[0]; const l = f ? Math.max(q.x, f.x - 0.3 * f.width) : q.x, r = f ? Math.min(q.x + q.width, f.x + 1.3 * f.width) : q.x + q.width; return { x: l - 4, y: q.y - 4, w: Math.max(0, r - l) + 8, h: q.height + 8 }; };
      // Seit 27.09.2026 (Tempo) misst die Personenmaske nur an den Einblendungsstellen; sonst gilt die Schätzung aus den Gesichtern.
      const near = (arr, t) => arr?.length ? arr.reduce((b, x) => Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b) : null;
      const schaetzung = q => ({ x: q.x - 0.12 * q.width, y: q.y - 0.5 * q.height, w: 1.24 * q.width, h: 1.5 * q.height });
      const heads = t => { const p = near(profil, t); if (p && Math.abs(p.time - t) <= 0.26) return (p.faces || []).map(q => kopfBox(q, p.time)); const f = near(faces, t); return !f || Math.abs(f.time - t) > 0.26 ? [] : (f.faces || []).map(schaetzung); };
      const green = t => (plan.grafiken || []).some(g => t >= g.start && t < g.end);
      const frames = Math.ceil(plan.duration * 30); let maxLayers = 0, capFrames = 0;
      for (let f = 0; f < frames; f += step) {
        const t = f / 30; tl.seek(t, false);
        const act = [];
        for (const el of document.querySelectorAll('.clip[data-kind]')) {
          const k = el.dataset.kind; if (k === 'gs-bg' || !shown(el)) continue;
          const b = box(el); if (!b || b.w < 1) continue;
          act.push({ id: el.id, k, b });
          // 2: gesperrte Zonen samt Kontur, Schatten und Animation; obere Zone (bis y 900) nutzbar x 108–972.
          // Ausnahme nur für das Ausblenden (DESIGN.md 15: 0,18 s, 8 px nach oben): unter 20 % Gesamtdeckkraft ist das Element praktisch
          // unsichtbar; eine H1 an y = 250 kreuzt die Linie sonst zwangsläufig im letzten Ausblendschritt.
          let deck = 1; for (let e = el; e && e.id !== 'root'; e = e.parentElement) deck *= +cs(e).opacity; deck *= +cs(el.firstElementChild).opacity;
          // Ausblenden (DESIGN.md 15: letzte 0,18 s, 8 px nach oben): Ein Element mit Oberkante 250 (DESIGN.md 5/6) kreuzt die
          // Linie dabei zwangsläufig; nur die Oberkante ist in dieser Zeit ausgenommen (Tempo Phase 5, Fehlalarm H2 allein).
          const ende = +el.dataset.start + +el.dataset.duration, ausblenden = t >= ende - 0.19 && t < ende;
          if ((deck >= 0.2 && !ausblenden && b.y < 249.5) || b.y + b.h > 1660.5 || b.x < 89.5) err('gesperrte_zone', { id: el.id, t: +t.toFixed(2), b });
          if (deck >= 0.2 && b.y + b.h > 900.5 && b.x + b.w > 930.5) err('aktionsleiste', { id: el.id, t: +t.toFixed(2), b });
          if (deck >= 0.2 && b.y < 900 && !['caption', 'outro-card', 'bubble'].includes(k) && (b.x < 107.5 || b.x + b.w > 972.5)) err('obere_zone', { id: el.id, t: +t.toFixed(2), b });
          if (CENTER[k]) { const c = R(el.querySelector(CENTER[k])); if (Math.abs(c.x + c.w / 2 - 540) > 0.75) err('mittelachse', { id: el.id, mitte: +(c.x + c.w / 2).toFixed(2) }); }
          if (k === 'pillen' && el.dataset.layout === 'row') { const c = [...el.children], l = Math.min(...c.map(x => x.offsetLeft)), r = Math.max(...c.map(x => x.offsetLeft + x.offsetWidth)); if (Math.abs((l + r) / 2 - 540) > 0.75) err('mittelachse', { id: el.id, mitte: (l + r) / 2 }); }
          if (k === 'caption') {
            capFrames++;
            const line = el.querySelector('.cap-line'), ws = [...line.children].filter(s => s.tagName === 'SPAN' && s.id);
            if (R(line).w + 12 > 780.5) err('untertitel_breite', { id: el.id, w: Math.round(R(line).w + 12) });
            if (new Set(ws.map(s => Math.round(s.getBoundingClientRect().top))).size !== 1) err('untertitel_umbruch', { id: el.id });
            const blue = ws.filter(s => cs(s).color === BLUE).length; if (blue !== 1) err('untertitel_blau', { id: el.id, t: +t.toFixed(2), blue });
            if (Math.abs(el.getBoundingClientRect().top - 1280) > 0.75) err('untertitel_position', { id: el.id });
          }
        }
        // DESIGN.md 14: Die Sprechblase läuft parallel zum Outro (y = 345 unter „Folgen nicht vergessen“) und zählt dann nicht als eigene Ebene.
        const layers = act.filter(a => LAYER.has(a.k) && !(a.k === 'bubble' && act.some(x => x.k === 'follow'))); maxLayers = Math.max(maxLayers, layers.length);
        // 1: höchstens zwei Textebenen zusätzlich zum Untertitel.
        const ausnahme = (plan.h2 || []).find(h => h.ausnahme && t >= h.start && t < h.end);
        if (layers.length > 2) (ausnahme ? warn : err)(ausnahme ? 'ausnahme_drei_textebenen' : 'drei_textebenen', { t: +t.toFixed(2), ids: layers.map(a => a.id), ...(ausnahme ? { grund: ausnahme.ausnahme } : {}) });
        for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) if (meet(act[i].b, act[j].b)) err('ueberlappung', { a: act[i].id, b: act[j].id, t: +t.toFixed(2) });
        // 8: H2 und Pillen nie gleichzeitig unter einem Kapitel.
        if (act.some(a => a.k === 'h2' && !a.id.startsWith('einstieg')) && act.some(a => a.k === 'pillen') && act.some(a => a.k === 'kapitel')) (ausnahme ? warn : err)(ausnahme ? 'ausnahme_h2_und_pillen' : 'h2_und_pillen', { t: +t.toFixed(2) });
        // 9/12: Pillen und Randnotiz nie über Kopf/Kappe; andere obere Elemente als Hinweis.
        if (!green(t)) for (const h of heads(t)) for (const a of act) if (meet(a.b, h)) { if (['pillen', 'randnotiz'].includes(a.k)) err('kopf_verdeckt', { id: a.id, t: +t.toFixed(2) }); else if (!['caption', 'follow', 'outro-card', 'h1'].includes(a.k)) warn('kopf_beruehrt', { id: a.id, t: +t.toFixed(2), kopfOben: Math.round(h.y), unten: Math.round(a.b.y + a.b.h) }); }
      }
      // 5: Einstieg am ersten Frame vollständig, ohne Animation.
      tl.seek(0, false);
      for (const el of document.querySelectorAll('[data-einstieg]')) { const s = cs(el), m = new DOMMatrix(s.transform); if (cs(el.firstElementChild).visibility !== 'visible' || +s.opacity < 0.999 || Math.abs(m.f) > 0.01 || Math.abs(m.a - 1) > 1e-4) err('einstieg_frame0', { id: el.id }); }
      const eh1 = R(document.querySelector('#einstieg-h1 .h1')); if (Math.abs(eh1.y - 250 - (plan.einstieg.h1.versatz || 0)) > 1) warn('einstieg_oberkante', { y: eh1.y });   // Versatz: Umlautpunkte samt Kontur unter y = 250
      const eh2 = document.querySelector('#einstieg-h2 .h2'); if (eh2) { const d = document.querySelector('#einstieg-h2').getBoundingClientRect().top - document.querySelector('#einstieg-h1').getBoundingClientRect().bottom; if (Math.abs(d - 24) > 1) err('einstieg_h2_abstand', { d }); }
      // 6/8/9/10: Größen und Breiten.
      for (const el of document.querySelectorAll('.h1 .ln')) { if (parseFloat(cs(el).fontSize) > 160) err('h1_groesse'); if (R(el).w + 16 > 864.5) err('h1_breite', { w: R(el).w + 16 }); }
      for (const el of document.querySelectorAll('.h2')) { if (el.offsetWidth > 780.5) err('h2_breite', { id: el.parentElement.id, w: el.offsetWidth }); if (el.querySelectorAll('.ln').length > 2) err('h2_zeilen', { id: el.parentElement.id }); }
      for (const el of document.querySelectorAll('.kap')) if (el.offsetWidth + 14 > 864.5) err('kapitel_breite', { id: el.parentElement.id, w: el.offsetWidth + 14 });
      for (const el of document.querySelectorAll('[data-kind=pillen][data-layout=row]')) { const w = [...el.children].reduce((s, c) => s + c.firstElementChild.offsetWidth + 6, 0) + 16 * (el.children.length - 1); if (w > 864.5) err('pillen_reihe_breite', { id: el.id, w }); }
      for (const el of document.querySelectorAll('.sw-word')) { const fs = parseFloat(cs(el).fontSize); if (fs < 120 || fs > 160) err('schlagwort_groesse', { fs }); if (el.offsetWidth + 18 > 864.5) err('schlagwort_breite', { w: el.offsetWidth + 18 }); }
      // 8: H2 während eines Kapitels 24 px unter der Unterkante der Kapitelgruppe (Zahl eingeschlossen).
      for (const h of plan.h2 || []) { const k = (plan.kapitel || []).find(k => k.start < h.end && k.end > h.start); if (!k || h.ausnahme) continue; tl.seek(Math.min(h.end - 0.2, h.start + 0.5), false); const kb = R(document.querySelector('#' + k.id + ' .kap')); const top = document.getElementById(h.id).getBoundingClientRect().top; if (Math.abs(top - (kb.y + kb.h + 24)) > 3) warn('h2_unter_kapitel', { id: h.id, soll: Math.round(kb.y + kb.h + 24), ist: Math.round(top) }); }
      // 3/18: Farben. Pink nur Schlagwort und Durchstreichen, Emojis und offizielle Logos ausgenommen.
      const ok = new Set(['rgb(17, 17, 17)', WHITE, 'rgb(246, 241, 233)', BLUE, 'rgb(255, 138, 194)', 'rgb(248, 249, 251)', 'rgb(22, 24, 28)', 'rgb(122, 126, 134)', 'rgb(222, 225, 231)', 'rgba(0, 0, 0, 0)', 'none', 'rgb(0, 0, 0)']);
      for (const el of document.querySelectorAll('#root *')) {
        if (['VIDEO', 'AUDIO', 'IMG', 'SCRIPT'].includes(el.tagName) || el.closest('.emoji,.oc-icon')) continue;
        const s = cs(el);
        for (const p of ['color', 'backgroundColor', 'fill', 'stroke', 'webkitTextStrokeColor', 'borderTopColor']) { const v = s[p]; if (!v || v.startsWith('url(') || ok.has(v)) continue; if (p === 'borderTopColor' && s.borderTopWidth === '0px') continue; err('farbe', { el: el.tagName + (el.id ? '#' + el.id : '') + '.' + (el.getAttribute('class') || ''), p, v }); }
        if (['fill', 'stroke', 'backgroundColor', 'color'].some(p => s[p] === 'rgb(255, 138, 194)') && !el.closest('.sw-lines,.note-strike')) err('pink_ausserhalb', { el: el.tagName + '#' + el.id });
      }
      // 3: Emojis ohne Kontur, so groß wie der umgebende Text.
      for (const e of document.querySelectorAll('.emoji')) { if (parseFloat(cs(e).webkitTextStrokeWidth) > 0) err('emoji_kontur'); if (Math.abs(parseFloat(cs(e).fontSize) - parseFloat(cs(e.parentElement).fontSize)) > 0.5) err('emoji_groesse'); }
      // 4: Gochi Hand nur für Zahlen im Inhalt und Akronym-Buchstaben.
      for (const el of document.querySelectorAll('#root *')) if (cs(el).fontFamily.includes('Gochi') && !el.children.length && el.textContent.trim() && !el.classList.contains('ak-letter') && !/^[\d.,+−%\s-]+$/.test(el.textContent.trim())) err('gochi_nicht_zahl', { text: el.textContent });
      // 14: Outro.
      const o = plan.outro; tl.seek(Math.min(o.start + 2, plan.duration - 0.05), false);
      const card = document.getElementById('outro-card'), cb = R(card);
      if (Math.abs(cb.x - 90) > 0.2 || Math.abs(cb.y + cb.h - 1660) > 0.2 || Math.abs(cb.w - 700) > 0.2 || Math.abs(cb.h - 237) > 0.2) err('outro_karte', { cb });
      const cnt = [...document.querySelectorAll('.cnt')].find(x => cs(x).visibility === 'visible')?.textContent, fill = new DOMMatrix(cs(document.getElementById('oc-fill')).transform).a;
      if (cnt !== o.followers.toLocaleString('de-DE') || Math.abs(fill - o.followers / 10000) > 1e-4) err('outro_zaehler', { cnt, fill });
      if (Math.abs(R(document.querySelector('#follow .follow')).y - 250) > 1.5) warn('follow_oberkante', { y: R(document.querySelector('#follow .follow')).y });
      const handles = [...card.querySelectorAll('.oc-handle')].map(h => h.textContent); if (JSON.stringify(handles) !== JSON.stringify(['@itsabidullahabi', '@abidullahabi', '@abidullahabi', 'Abdullah Bachtari'])) err('handles', { handles });
      for (const el of card.querySelectorAll('.oc-head,.oc-bed,.oc-grid')) { const b = R(el); if (b.x < cb.x + 21.9 || b.x + b.w > cb.x + cb.w - 21.9 || b.y < cb.y + 21.9 || b.y + b.h > cb.y + cb.h - 21.9) err('outro_innenabstand', { cls: el.className }); }
      const standzeit = plan.duration - (o.start + 1.85); if (standzeit < 4 - 1e-3 || standzeit > 5 + 1e-3) warn('outro_standzeit', { s: +standzeit.toFixed(2) });
      // 11: Grafik-Karte x 150, y 270, Breite 780; Personenebene vorhanden.
      for (const g of plan.grafiken || []) { tl.seek(g.start + 0.5, false); const b = R(document.querySelector('#' + g.id + ' .card')); if (Math.abs(b.x - 150) > 0.5 || Math.abs(b.y - 270) > 0.5 || Math.abs(b.w - 780) > 0.5) err('grafik_karte', { b }); if (g.person && !document.getElementById(g.id + '-person')) err('grafik_person_fehlt', { id: g.id }); }
      // 10: höchstens zwei Schlagworte, Standzeit 0,8–1,3 s.
      if ((plan.schlagworte || []).length > 2) err('schlagworte_anzahl');
      return { designVersion: plan.designVersion, kopfQuelle: profil ? 'Personenmaske' : 'Schätzung', framesChecked: Math.ceil(frames / step), step, maxLayers, capFrames, errors, warnings };
    }, { plan, faces, profil, step });
  } finally { await browser.close(); }
  report.blocking = report.errors.length; report.checkedAt = new Date().toISOString();
  report.themePlan = fs.statSync(path.join(project, 'theme-plan.json')).mtime.toISOString(); report.indexHtml = fs.statSync(path.join(project, 'index.html')).mtime.toISOString();
  fs.writeFileSync(path.join(project, 'review/layout-check.json'), JSON.stringify(report, null, 2) + '\n');
  const byType = a => Object.fromEntries(Object.entries(a.reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {})));
  console.log(JSON.stringify({ bilder: report.framesChecked, maxEbenen: report.maxLayers, blockierend: report.blocking, fehler: byType(report.errors), hinweise: byType(report.warnings), beispiele: report.errors.slice(0, 10) }, null, 1));
  if (report.blocking) throw Error('Designprüfung 2.2: ' + report.blocking + ' Abweichungen.');
  return report;
}

if (process.argv[1]?.endsWith('check-design22.mjs')) {
  checkDesign22(path.resolve(process.argv[2]), { step: Number(process.env.STEP || 1) }).catch(e => { console.error(e.message); process.exitCode = 1; });
}
