// Planentwurf aus Transkript und Wortzeiten (Gesamtauftrag Tempo, Phase 7, 28.09.2026).
//
//   node workflow.mjs planentwurf "<Projekt>"
//
// Schreibt design-plan.json (oder design-plan.entwurf.json, wenn es schon einen Plan gibt). Der Planer prüft und
// ergänzt danach nur noch; alles Unsichere steht in "_offen". Erkannt werden:
// - Einstieg aus dem Titel (H1), Standzeit bis zum ersten Kapitel bzw. bis zum Ende des ersten Satzes (DESIGN.md 5),
// - Kapitel aus Zählwörtern („Punkt Nummer 1“, „Zweitens“, „der dritte Punkt“, „das erste Zertifikat“), fortlaufend,
// - Pillen aus gesprochenen Aufzählungen: eine innere Zählung, die im Kapitel neu bei eins beginnt, oder „A, B und C“,
// - Zoomfahrten nach DESIGN.md 15 (endet an Schnittpunkt oder Themenwechsel, nie über einen Schnitt hinweg),
// - Outro-Beginn (Aufruf „Folgen nicht vergessen“ o. ä., Standzeit 4–5 s) und Sprechblase bei Kommentar/DM-Aufruf.
import fs from 'node:fs';
import path from 'node:path';
import { readTimedWords } from './assemble-full-video.mjs';
import { planZooms22 } from './theme-composition-design22.mjs';
import { schreibeVorher, tempoVonMedia, vorbereitetMit } from './schnitt.mjs';

const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const r2 = x => Math.round(x * 100) / 100;
const ZAHL = { eins: 1, erste: 1, ersten: 1, erstes: 1, erster: 1, erstens: 1, zwei: 2, zweite: 2, zweiten: 2, zweites: 2, zweiter: 2, zweitens: 2, drei: 3, dritte: 3, dritten: 3, drittes: 3, dritter: 3, drittens: 3,
  vier: 4, vierte: 4, vierten: 4, viertes: 4, vierter: 4, viertens: 4, fünf: 5, fünfte: 5, fünften: 5, fünftens: 5, sechs: 6, sechste: 6, sechsten: 6, sechstens: 6, sieben: 7, siebte: 7, siebten: 7, siebtens: 7,
  acht: 8, achte: 8, achten: 8, achtens: 8, neun: 9, neunte: 9, neunten: 9, neuntens: 9, zehn: 10, zehnte: 10, zehnten: 10, zehntens: 10 };
const NOMEN = /^(punkt|punkte|tipp|tipps|lektion|lektionen|fehler|schritt|regel|grund|zertifikat|kurs|ding|dinge|frage|sache|mythos|trick|hack|buch|app|tool|thema|jahr)$/i;
const norm = t => t.toLowerCase().replace(/[.,!?:;…"„“]/g, '');
const satzEnde = t => /[.!?…]$/.test(t);

// Zählereignisse: {i: Wortindex des ersten Worts der Wendung, n, stark: ob sicher ein Aufzählungspunkt}
function zaehlungen(w) {
  const ev = [];
  for (let i = 0; i < w.length; i++) {
    const t = norm(w[i].text), t1 = norm(w[i + 1]?.text || ''), t2 = norm(w[i + 2]?.text || ''), prev = norm(w[i - 1]?.text || '');
    // „Punkt Nummer 1“, „Punkt 3“, „Nummer 2“, „Tipp 4“
    if ((t === 'punkt' || t === 'tipp' || t === 'lektion' || t === 'fehler' || t === 'schritt' || t === 'regel') && (t1 === 'nummer' ? /^\d+$|^[a-zäöü]+$/.test(t2) && (+t2 || ZAHL[t2]) : +t1 || ZAHL[t1])) {
      const n = t1 === 'nummer' ? (+t2 || ZAHL[t2]) : (+t1 || ZAHL[t1]); ev.push({ i, n, stark: true }); i += t1 === 'nummer' ? 2 : 1; continue;
    }
    if (t === 'nummer' && prev !== 'punkt' && (+t1 || ZAHL[t1])) { ev.push({ i, n: +t1 || ZAHL[t1], stark: true }); i++; continue; }
    // „Erstens,“ „Zweitens.“ (Adverb am Satzanfang oder nach „und“)
    if (/^[a-zäöü]+tens$/.test(t) && ZAHL[t]) { ev.push({ i, n: ZAHL[t], stark: true, adverb: true }); continue; }
    // „der/die/das/zum erste(n) Punkt/Zertifikat …“, „und das Dritte“
    if (/^(der|die|das|zum|zur|den|dem)$/.test(t) && ZAHL[t1] && !/^[0-9]/.test(t1) && /^(erst|zweit|dritt|viert|fünft|sechst|siebt|acht|neunt|zehnt)/.test(t1)) {
      const nomen = NOMEN.test(t2) || NOMEN.test(norm(w[i + 3]?.text || '')) || /^[A-ZÄÖÜ]/.test(w[i + 1].text) || w.slice(i + 2, i + 9).some(x => /^punkte?$/.test(norm(x.text)));
      if (nomen) { ev.push({ i, n: ZAHL[t1], stark: true }); i++; continue; }
    }
  }
  return ev;
}

function titelAb(w, i, max = 4) {
  // Wörter nach der Zählwendung bis zum Satzende, ohne Füllwörter am Anfang.
  const fuell = /^(ist|sind|war|und|also|natürlich|halt|ja|dann|so|schon|nummer|punkt|punkte|das|der|die|zertifikat|tipp|lektion|ding|dinge|erstens|zweitens|drittens|viertens|fünftens|kommen|wir|zum|,)$/i;
  const out = [];
  for (let k = i; k < w.length && out.length < max; k++) {
    const t = w[k].text.replace(/[.,!?:;…]+$/, '');
    if (!out.length && (fuell.test(norm(t)) || ZAHL[norm(t)] || /^\d+$/.test(t))) { if (satzEnde(w[k].text) && k > i) break; continue; }
    out.push(t);
    if (/[.,!?:;…]$/.test(w[k].text)) break;
  }
  const s = out.join(' ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

export function planentwurf(project) {
  const meta = J(path.join(project, 'workflow.json')), duration = meta.cutDuration;
  const { timed: w } = readTimedWords(project, duration);
  const offen = [];
  const cutFile = path.join(project, 'review/cut-points.json'), cuts = fs.existsSync(cutFile) ? J(cutFile).cuts.map(c => c.time) : [];
  const facesFile = path.join(project, 'review/source-faces.json'), faces = fs.existsSync(facesFile) ? J(facesFile) : [];
  const saetze = [0, ...w.map((x, i) => satzEnde(x.text) ? i + 1 : -1).filter(i => i > 0 && i < w.length)];

  // Outro: Aufruf zum Folgen; Standzeit 4–5 s nach 1,85 s Aufbau (DESIGN.md 15) → spätestens 6,1 s vor Schluss.
  const ctaIdx = w.findIndex((x, i) => /^folg/i.test(norm(x.text)) && /(nicht|mir|vergessen)/.test(norm(w[i + 1]?.text || '') + norm(w[i + 2]?.text || '')) || (norm(x.text) === 'follow'));
  const ziel = Math.min(ctaIdx >= 0 ? w[saetze.filter(s => s <= ctaIdx).at(-1) ?? ctaIdx].start : duration, duration - 6.1);
  const satzStarts = saetze.map(i => w[i]?.start).filter(t => t != null && t <= ziel);
  let outroStart = satzStarts.filter(t => t >= ziel - 3).at(-1) ?? w.filter(x => x.start <= ziel).at(-1)?.start ?? ziel;
  outroStart = r2(outroStart);
  if (ctaIdx < 0) offen.push('Kein „Folgen nicht vergessen“ gefunden: Outro-Beginn geschätzt (6,1 s vor Schluss).');

  // Kapitel aus fortlaufenden Zählungen; eine innere Zählung, die wieder bei 1 beginnt, wird zur Pillen-Aufzählung.
  const ev = zaehlungen(w), kap = [], innen = [];
  let erwartet = 1, innenErwartet = 0;
  for (const e of ev) {
    if (w[e.i].start >= outroStart) break;
    if (e.n === erwartet && !(innenErwartet && e.n === innenErwartet)) { kap.push(e); erwartet++; innenErwartet = 0; }
    else if (kap.length && e.n === 1 && erwartet > 2) { innen.push({ ...e, kap: kap.length - 1, liste: kap.length - 1 }); innenErwartet = 2; }
    else if (innenErwartet && e.n === innenErwartet) { innen.push({ ...e, kap: kap.length - 1, liste: kap.length - 1 }); innenErwartet = e.n >= 3 ? 0 : innenErwartet + 1; }   // höchstens drei Pillen
    else if (e.stark && !innenErwartet && e.n > erwartet && e.n <= erwartet + 2 && kap.length) {
      // Nummer übersprungen (gesprochen ohne Zählwort, z. B. „Und hier nochmal ein paar praktische Tipps“): übernehmen, Lücke melden.
      for (let n = erwartet; n < e.n; n++) offen.push(`Kapitel ${n}. ohne Zählwort: Beginn zwischen ${w[kap.at(-1).i].start} und ${w[e.i].start} s von Hand setzen.`);
      kap.push(e); erwartet = e.n + 1;
    }
  }
  if (kap.length === 1) { offen.push(`Nur eine Zählung gefunden (${w[kap[0].i].text} bei ${w[kap[0].i].start} s): nicht als Kapitel übernommen.`); kap.length = 0; }
  // Leerer Titel (etwa „zum dritten Punkt schon.“): erste Wörter des nächsten Satzes als Vorschlag.
  const naechsterSatz = i => saetze.find(s => s > i) ?? i;
  const kapitel = kap.map((e, k) => ({ id: `k${k + 1}`, nummer: `${e.n}.`, titel: titelAb(w, e.i) || titelAb(w, naechsterSatz(e.i)), start: r2(w[e.i].start), end: null }));
  kapitel.forEach((k, j) => { k.end = r2((kapitel[j + 1]?.start ?? outroStart) - 0.2); });
  for (const k of kapitel) if (k.titel.split(' ').length > 3 || !k.titel) offen.push(`Kapitel ${k.nummer} Titel kürzen/prüfen: „${k.titel}“`);

  const einstiegEnde = r2(kapitel.length ? kapitel[0].start - 0.26 : (w[saetze[1] ?? 0]?.start ?? 3) - 0.05);
  const h1 = (meta.title || '').replace(/\s*\(.*?\)\s*/g, ' ').trim().toLocaleUpperCase('de-DE');
  if (!h1) offen.push('Kein Titel in workflow.json: Einstiegs-H1 fehlt.');

  // Pillen: innere Zählungen je Kapitel (höchstens drei, DESIGN.md 9), sonst „A, B und C“ in einem Satz.
  const pillen = [];
  for (const [k, liste] of Object.entries(Object.groupBy(innen, e => e.kap))) {
    const kk = kapitel[k]; if (!kk) continue;
    const items = liste.slice(0, 3).map(e => ({ text: titelAb(w, e.i + 1, 3), at: r2(w[e.i].start) }));
    pillen.push({ id: `p${+k + 1}`, kapitel: kk.id, nummeriert: true, anordnung: 'auto', items, end: kk.end });
    offen.push(`Pillen ${kk.nummer}: Texte kürzen (höchstens 3 Wörter): ${items.map(i => '„' + i.text + '“').join(', ')}`);
  }
  // Gesprochene Aufzählung: mindestens drei kurze Glieder (1–3 Wörter, mit einem Nomen), getrennt durch Kommas oder
  // „und/oder“ („Stadt, Umfeld und Partner“, „an Allah, an Gott, an das Universum“). Höchstens drei Pillen (DESIGN.md 9).
  const PRON = /^(Ich|Du|Er|Sie|Es|Wir|Ihr|Und|Aber|Wenn|Das|Der|Die|Den|Dem|Hier|Da|So|Also|Oh|Okay)$/;
  const kurz = g => g.length >= 1 && g.length <= 3 && g.some(x => /^[A-ZÄÖÜ]/.test(x.text) && !PRON.test(x.text.replace(/[.,!?:;…]+$/, '')));
  for (let s = 0; s < saetze.length; s++) {
    const satz = w.slice(saetze[s], saetze[s + 1] ?? w.length), seg = [];
    let cur = [];
    for (const x of satz) {
      if (/^(und|oder)$/i.test(norm(x.text))) { if (cur.length) seg.push(cur); cur = []; continue; }
      cur.push(x);
      if (/[,:]$/.test(x.text)) { seg.push(cur); cur = []; }
    }
    if (cur.length) seg.push(cur);
    for (let i = 0; i < seg.length; i++) {
      let j = i; while (j < seg.length && kurz(seg[j])) j++;
      if (j - i >= 3) {
        const items = seg.slice(i, i + 3).map(g => ({ text: g.map(x => x.text.replace(/[.,!?:;…]+$/, '')).join(' '), at: r2(g[0].start) }));
        const t0 = items[0].at, kk = kapitel.find(k => t0 >= k.start && t0 < k.end);
        if (!kk || pillen.some(p => p.kapitel === kk.id)) offen.push(`Aufzählung bei ${t0} s${kk ? ' (Kapitel hat schon Pillen)' : ' ohne Kapitel'}: ${items.map(x => x.text).join(' / ')} → Pillen oder H2?`);
        else pillen.push({ id: `p-${kk.id}`, kapitel: kk.id, nummeriert: false, anordnung: 'auto', items, end: kk.end });
        i = j;
      }
    }
  }

  // Sprechblase nur bei Aufforderung zu Kommentar oder DM (DESIGN.md 1).
  const sprechblasen = [];
  const dm = w.findIndex((x, i) => /^(kommentar|kommentare|dm|nachricht)$/i.test(norm(x.text)) && w.slice(Math.max(0, i - 4), i).some(y => /^(schreib|schreibt|lass|hinterlass)/i.test(norm(y.text))));
  if (dm >= 0) {
    const start = r2(w[saetze.filter(s => s <= dm).at(-1) ?? dm].start);
    const text = /\bvs\.?\b/i.test(meta.title || '') ? meta.title.replace(/\s*\(.*?\)/g, '').replace(/\s+vs\.?\s+/i, ' oder ').trim() + '?' : 'Deine Frage?';
    sprechblasen.push({ text, start: Math.max(start, r2(w[dm].start - 1.5)) });
    offen.push(`Sprechblase: Text „${text}“ ist ein Vorschlag, bitte zur Aufnahme passend formulieren.`);
  }
  // Marken und Plattformen: Logo nur mit Datei (DESIGN.md 14), deshalb nur als offener Punkt.
  const marken = w.filter(x => /^(linkedin|instagram|tiktok|youtube|google|anthropic|claude|chatgpt|openai|excel|notion)$/i.test(norm(x.text)));
  for (const m of marken.slice(0, 5)) offen.push(`Marke genannt: ${m.text} bei ${m.start} s → Logo-Einblendung? (Datei nötig)`);

  // Zoomfahrten (DESIGN.md 15): Rücksprung an Schnittpunkten und Themenwechseln, nie über einen Schnitt hinweg.
  const faceWidth = t => { if (!faces.length) return 0; const f = faces.reduce((b, x) => Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b); return Math.max(0, ...(f.faces || []).map(q => q.width)); };
  const zooms = planZooms22({ resets: [...cuts, ...kapitel.map(k => k.start), outroStart], blocked: [[outroStart, duration]], faceWidth, closeFrom: 420, duration });
  offen.push('Zoomfahrten sind aus Schnittpunkten und den erkannten Kapiteln berechnet. Änderst du Kapitel oder H1, lösche "zooms"; storyboard berechnet sie dann neu (DESIGN.md 15).');
  if (zooms.length < duration / 15) offen.push(`Nur ${zooms.length} Zoomfahrten: wenige Schnittpunkte/Themenwechsel. Weitere nur an echten Übergängen (DESIGN.md 15).`);

  const plan = {
    _quelle: `planentwurf.mjs ${new Date().toISOString()} aus word-timing (${w.length} Wörter), ${cuts.length} Schnittpunkten und Titel „${meta.title}“. Planer prüft und ergänzt.`,
    _offen: offen,
    einstieg: { h1, end: einstiegEnde },
    kapitel, h1: [], h2: [], pillen, akronyme: [], schlagworte: [], grafiken: [], randnotizen: [], lebensbalken: [], logos: [],
    sprechblasen, outroStart, zooms, nahaufnahmeAbBreite: 420,
  };
  const ziel2 = fs.existsSync(path.join(project, 'design-plan.json')) ? 'design-plan.entwurf.json' : 'design-plan.json';
  fs.writeFileSync(path.join(project, ziel2), JSON.stringify(plan, null, 1) + '\n');
  // Neuer Plan auf einer Schnittfassung: Planstand (schnitt.json, Tempo von media.mp4) für schnitt-umstellen festhalten.
  if (ziel2 === 'design-plan.json' && fs.existsSync(path.join(project, 'schnitt.json'))) {
    fs.mkdirSync(path.join(project, 'schnitt'), { recursive: true });
    const t = tempoVonMedia(meta);
    schreibeVorher(project, JSON.parse(fs.readFileSync(path.join(project, 'schnitt.json'), 'utf8')).behalten, t, { vorbereitet: vorbereitetMit(project, t), angelegtVon: 'planentwurf' });
  }
  return { datei: path.join(project, ziel2), kapitel: kapitel.length, pillen: pillen.length, zooms: zooms.length, sprechblasen: sprechblasen.length, outroStart, offen };
}
