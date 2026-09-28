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
  const r = await fetch(`${API}${pfad}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { text: text.slice(0, 500) }; }
  return { status: r.status, ok: r.ok, data };
}

const CONTENT_TYPES = {'.mp4':'video/mp4','.mov':'video/quicktime','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};

export async function uploadToZernio(file, token) {
  const bytes = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) throw Error('Unbekanntes Dateiformat: ' + ext);

  // Der Dateiname wandert in den Objektschlüssel. Umlaute und Leerzeichen
  // vermeiden, damit die vorsignierte URL nicht an der Kodierung scheitert.
  const safeName = path.basename(file, ext).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') + ext;

  // Mit Upload-Token (MCP media_generate_upload_link) oder, ohne Token, mit dem API-Schlüssel aus dem Schlüsselbund.
  const presignResponse = token
    ? await fetch(`${API}/media/upload/presign?token=${encodeURIComponent(token)}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({filename: safeName, contentType}) })
    : await fetch(`${API}/media/presign`, { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${zernioSchluessel() ?? ''}`}, body: JSON.stringify({filename: safeName, contentType, size: bytes}) });
  if (!presignResponse.ok) throw Error(`Presign fehlgeschlagen (${presignResponse.status}): ${await presignResponse.text()}`);
  const presign = await presignResponse.json();
  if (!presign.uploadUrl || !presign.publicUrl) throw Error('Presign ohne uploadUrl/publicUrl: ' + JSON.stringify(presign));

  const data = fs.readFileSync(file);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: {'Content-Type': contentType, 'Content-Length': String(bytes)},
    body: data,
  });
  if (!put.ok) throw Error(`Upload fehlgeschlagen (${put.status}): ${await put.text()}`);

  // Gegenprobe: die öffentliche URL muss die Datei in voller Länge ausliefern.
  const head = await fetch(presign.publicUrl, {method: 'HEAD'});
  const served = Number(head.headers.get('content-length'));
  if (!head.ok) throw Error(`Hochgeladene Datei nicht abrufbar (${head.status}).`);
  if (served !== bytes) throw Error(`Längen weichen ab: hochgeladen ${bytes}, ausgeliefert ${served}.`);

  return {publicUrl: presign.publicUrl, key: presign.key, filename: safeName, bytes, sha256, contentType, verifiedServedBytes: served};
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
