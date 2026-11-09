// Lädt eine fertige Videodatei nach Zernio, ohne Browser und ohne Abis Zutun.
//
// Hintergrund: Die MCP-Werkzeuge von Zernio bieten nur den Browser-Upload an,
// weil die Zernio-Dokumentation davon ausgeht, ein KI-Client könne keine Dateien
// auf dem Rechner lesen. Das trifft hier nicht zu. Die beiden naheliegenden
// HTTP-Wege scheitern an Größengrenzen:
//
//   POST /api/v1/media/upload         -> 413, FUNCTION_PAYLOAD_TOO_LARGE (~4,5 MB)
//   POST /api/v1/media/upload-direct  -> 401, zudem auf 25 MB begrenzt
//
// Tragfähig ist der Presign-Weg: Zernio stellt eine vorsignierte Cloudflare-R2-URL
// aus, die Datei geht per PUT direkt an den Speicher und umgeht damit die
// Serverless-Grenze vollständig. 75 MB laufen so ohne Beanstandung durch.
//
// Aufruf:
//   node zernio-upload.mjs <datei> --token <upload-token>
//
// Das Token stammt aus dem MCP-Werkzeug media_generate_upload_link und gilt
// eine Stunde. Ausgabe ist JSON mit publicUrl, die posts_create als media_urls
// entgegennimmt.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';

const API = 'https://zernio.com/api/v1';

// Seit 28.09.2026: API-Schlüssel im macOS-Schlüsselbund (Eintrag „zernio-api-key“, von Abdullah angelegt). Er wird nur
// zur Laufzeit gelesen und nie ausgegeben oder gespeichert. Ohne Schlüssel bleibt der Weg über das MCP-Upload-Token.
export function zernioSchluessel() {
  try { return execFileSync('security', ['find-generic-password', '-s', 'zernio-api-key', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; }
  catch { return null; }
}
export async function zernioApi(pfad, { method = 'GET', body, headers = {} } = {}) {
  const key = zernioSchluessel();
  if (!key) throw Error('Kein Zernio-API-Schlüssel im Schlüsselbund (Eintrag „zernio-api-key“).');
  const r = await mitUrsache(`Zernio ${method} ${pfad}`, () => fetch(`${API}${pfad}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }));
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { text: text.slice(0, 500) }; }
  return { status: r.status, ok: r.ok, data };
}

const CONTENT_TYPES = {'.mp4':'video/mp4','.mov':'video/quicktime','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};

// „fetch failed“ allein sagt nichts. Die eigentliche Ursache (ECONNRESET, UND_ERR_HEADERS_TIMEOUT …) steht in e.cause.
export function ursache(e) {
  const c = e?.cause;
  return c ? `${e.message} (${[c.code, c.message].filter(Boolean).join(': ')})` : String(e?.message ?? e);
}
async function mitUrsache(was, f) {
  try { return await f(); } catch (e) { throw Error(`${was}: ${ursache(e)}`, { cause: e }); }
}

// PUT an die vorsignierte URL, gestreamt mit node:https statt fetch (09.11.2026).
// Grund: Der München-Vlog (233 MB) brach am 09.11. zweimal mit „fetch failed“ ab, einmal nach knapp 5 min.
// Node-fetch (undici) wartet höchstens 300 s auf die Antwort-Kopfzeilen, und die Zeit läuft schon während des
// Hochladens; bei langsamer Leitung reicht das für 200 MB und mehr nicht. Außerdem lag die ganze Datei im Speicher.
// Hier gilt keine Gesamtzeit, nur eine Leerlaufgrenze: Fließen LEERLAUF_MS lang keine Daten, wird abgebrochen.
const LEERLAUF_MS = Number(process.env.ZERNIO_LEERLAUF_MS) || 120e3;   // Umgebungsvariable nur für Tests
export function hochladen(url, file, bytes, contentType, fortschritt) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('http:') ? http : https).request(url, { method: 'PUT', headers: { 'Content-Type': contentType, 'Content-Length': String(bytes) } }, res => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', d => { if (text.length < 2000) text += d; });
      res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text }));
      res.on('error', reject);
    });
    req.setTimeout(LEERLAUF_MS, () => req.destroy(Object.assign(Error(`${LEERLAUF_MS / 1000} s keine Daten übertragen`), { code: 'LEERLAUF' })));
    req.on('error', reject);
    const lesen = fs.createReadStream(file, { highWaterMark: 1 << 20 });
    let gesendet = 0, gemeldet = 0;
    lesen.on('data', c => { gesendet += c.length; if (fortschritt && gesendet - gemeldet >= bytes / 10) { gemeldet = gesendet; fortschritt(gesendet, bytes); } });
    pipeline(lesen, req).catch(reject);
  });
}

async function presignHolen(token, safeName, contentType, bytes) {
  const r = token
    ? await mitUrsache('Presign', () => fetch(`${API}/media/upload/presign?token=${encodeURIComponent(token)}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({filename: safeName, contentType}) }))
    : await mitUrsache('Presign', () => fetch(`${API}/media/presign`, { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${zernioSchluessel() ?? ''}`}, body: JSON.stringify({filename: safeName, contentType, size: bytes}) }));
  if (!r.ok) throw Error(`Presign fehlgeschlagen (${r.status}): ${await r.text()}`);
  const presign = await r.json();
  if (!presign.uploadUrl || !presign.publicUrl) throw Error('Presign ohne uploadUrl/publicUrl: ' + JSON.stringify(presign));
  return presign;
}

export async function uploadToZernio(file, token, { versuche = 3, fortschritt = (n, g) => console.error(`  Upload ${Math.round(100 * n / g)} %`) } = {}) {
  const bytes = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) throw Error('Unbekanntes Dateiformat: ' + ext);

  // Der Dateiname wandert in den Objektschlüssel. Umlaute und Leerzeichen
  // vermeiden, damit die vorsignierte URL nicht an der Kodierung scheitert.
  const safeName = path.basename(file, ext).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') + ext;

  // Prüfsumme gestreamt, ohne die Datei ganz in den Speicher zu laden.
  const h = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), h);
  const sha256 = h.digest('hex');

  // Bis zu drei Versuche, jeder mit frischer vorsignierter URL. Ein PUT an R2 überschreibt nur das eigene Objekt,
  // ein abgebrochener Versuch hinterlässt höchstens eine unbenutzte Datei im Zwischenspeicher, keinen Beitrag.
  const fehler = [];
  for (let v = 1; v <= versuche; v++) {
    try {
      const presign = await presignHolen(token, safeName, contentType, bytes);
      const t0 = Date.now();
      const put = await hochladen(presign.uploadUrl, file, bytes, contentType, fortschritt);
      if (!put.ok) throw Error(`Upload fehlgeschlagen (${put.status}): ${put.text.slice(0, 300)}`);
      const sekunden = Math.round((Date.now() - t0) / 1000);

      // Gegenprobe: die öffentliche URL muss die Datei in voller Länge ausliefern.
      const head = await mitUrsache('Gegenprobe', () => fetch(presign.publicUrl, {method: 'HEAD'}));
      const served = Number(head.headers.get('content-length'));
      if (!head.ok) throw Error(`Hochgeladene Datei nicht abrufbar (${head.status}).`);
      if (served !== bytes) throw Error(`Längen weichen ab: hochgeladen ${bytes}, ausgeliefert ${served}.`);

      return {publicUrl: presign.publicUrl, key: presign.key, filename: safeName, bytes, sha256, contentType, verifiedServedBytes: served, versuch: v, sekunden};
    } catch (e) {
      fehler.push(`Versuch ${v}: ${ursache(e)}`);
      if (v < versuche) { console.error(`  ${fehler.at(-1)}. Neuer Versuch in ${5 * v} s.`); await new Promise(r => setTimeout(r, 5000 * v)); }
    }
  }
  throw Error(`Upload nach ${versuche} Versuchen gescheitert:\n  ${fehler.join('\n  ')}`);
}

if (process.argv[1]?.endsWith('zernio-upload.mjs') && process.argv[2] === '--konten') {
  // Nur lesend: prüft den Schlüssel und zeigt die verbundenen Konten (ohne den Schlüssel).
  const r = await zernioApi('/accounts');
  if (!r.ok) { console.error(`Zernio antwortet ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`); process.exit(1); }
  const konten = r.data.accounts ?? r.data.data ?? r.data;
  console.log(`Schlüssel gültig. ${konten.length} Konten:`);
  for (const k of konten) console.log(`  ${k.platform.padEnd(10)} ${k._id}  ${k.username ?? k.displayName ?? ''}`);
  process.exit(0);
}

if (process.argv[1]?.endsWith('zernio-upload.mjs')) {
  const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const file = process.argv[2];
  const token = arg('--token') ?? process.env.ZERNIO_UPLOAD_TOKEN;
  const projekt = arg('--projekt');
  const ohnePruefung = process.argv.includes('--ohne-pruefung');

  if (!file || !token || (!projekt && !ohnePruefung)) {
    console.error('Aufruf: node zernio-upload.mjs <datei> --token <upload-token> --projekt <projektordner>');
    console.error('\n--projekt ist Pflicht. Vor dem Upload wird geprüft, ob das Projekt einen');
    console.error('sauberen, aktuellen Gestaltungsbericht hat (Nachbesprechung Punkt 5).');
    console.error('Nur wenn Abdullah das ausdrücklich will: --ohne-pruefung.');
    process.exit(2);
  }

  // Auslieferungssperre. Ein Gate ohne legitimen Ausnahmeweg wird umgangen —
  // deshalb gibt es --ohne-pruefung, aber sichtbar und benannt.
  if (ohnePruefung) {
    console.error('WARNUNG: Auslieferungssperre übersprungen (--ohne-pruefung). Es ist nicht belegt,');
    console.error('dass diese Datei aus einem geprüften Gestaltungsprojekt stammt.\n');
  } else {
    const { auslieferung } = await import('./pruefungen.mjs');
    const r = auslieferung(projekt, path.resolve(file));
    if (!r.ok) {
      console.error('Upload gesperrt: ' + r.grund);
      process.exit(1);
    }
    console.error(`Gestaltungsbericht geprüft: ${r.befunde} Befunde, davon ${r.abgenommen} abgenommen, 0 blockierend.`);
    console.error(`Datei ist bitgleich zu ${r.herkunft.export}.\n`);
  }

  console.log(JSON.stringify(await uploadToZernio(path.resolve(file), token), null, 2));
}
