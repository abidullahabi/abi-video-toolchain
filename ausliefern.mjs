// Ein Auslieferungsschritt für alle Videos.
//
//   node ausliefern.mjs "<Projektordner>" "<Videotitel>" --datum 2026-09-17
//
// Ersetzt sechs Einmalskripte in revisions/, die alle dasselbe taten — Bericht
// prüfen, Prüfsumme vergleichen, Kopie anlegen, Projektstand nachführen — und
// die alle auf den längst verschwundenen Pfad Desktop/Social Media/Content_Videos
// zeigten. Jede Korrektur hatte ein eigenes Skript bekommen, statt dass es
// einen Schritt mit Parametern gab.
//
// Nichts wird überschrieben und nichts gelöscht. Existiert das Ziel bereits,
// bricht der Schritt ab und nennt beide Prüfsummen.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { auslieferung } from './pruefungen.mjs';

const ABLAGE = '/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

export function ausliefernNach(projekt, titel, datum, { ziel = '03_Bereit_zum_Posten' } = {}) {
  const p = path.resolve(projekt);
  const m = JSON.parse(fs.readFileSync(path.join(p, 'workflow.json'), 'utf8'));

  // 1. Welche Datei überhaupt? Das Zeigerfeld aus Punkt 7, ersatzweise latestExport.
  const quelle = m.aktuell?.datei ?? m.latestExport;
  if (!quelle) throw Error('Weder aktuell noch latestExport gesetzt. Erst exportieren.');
  if (!fs.existsSync(quelle)) throw Error(`Zeigt ins Leere: ${quelle}\nFeld aktuell oder latestExport ist veraltet.`);

  // 2. Auslieferungssperre aus Punkt 5, inklusive Prüfsummenabgleich.
  const frei = auslieferung(p, quelle);
  if (!frei.ok) throw Error('Auslieferung gesperrt: ' + frei.grund);

  // 3. Exportbericht gegenlesen: vollständig decodiert, VMAF über 95, Prüfsumme stimmt.
  const berichtDatei = path.join(p, 'review/final-export-check.json');
  if (!fs.existsSync(berichtDatei)) throw Error('review/final-export-check.json fehlt. Erst finalize-buffer-video.py laufen lassen.');
  const b = JSON.parse(fs.readFileSync(berichtDatei, 'utf8'));
  const istSha = sha(quelle);
  if (!b.fullyDecoded) throw Error('Exportbericht meldet die Datei als nicht vollständig decodiert.');
  if (!(b.vmafMeanVsRenderedMaster > 95)) throw Error(`VMAF ${b.vmafMeanVsRenderedMaster} liegt nicht über 95.`);
  if (b.sha256 !== istSha) throw Error(`Die Datei wurde nach dem Exportbericht verändert.\n  Bericht: ${b.sha256}\n  jetzt:   ${istSha}`);

  // 4. Ziel bestimmen und niemals ungeprüft überschreiben.
  const name = `${datum} - ${titel}.mp4`;
  const zielDatei = path.join(ABLAGE, ziel, name);
  if (fs.existsSync(zielDatei)) {
    const vorhanden = sha(zielDatei);
    if (vorhanden === istSha) return { schon_da: true, datei: zielDatei, sha256: istSha };
    throw Error(`Zieldatei existiert mit anderem Inhalt — nicht überschrieben.\n  dort:  ${vorhanden}\n  hier:  ${istSha}\n  ${zielDatei}`);
  }

  // 5. Erst in eine Nebendatei, dann umbenennen. Ein Abbruch hinterlässt so keine halbe Datei.
  fs.mkdirSync(path.dirname(zielDatei), { recursive: true });
  const temp = zielDatei + '.unfertig';
  fs.copyFileSync(quelle, temp);
  if (sha(temp) !== istSha) { fs.unlinkSync(temp); throw Error('Die Kopie stimmt nicht mit der Quelle überein. Nichts abgelegt.'); }
  fs.renameSync(temp, zielDatei);

  // 6. Projektstand nachführen und Umzug protokollieren.
  m.postingFile = zielDatei;
  m.postingSha256 = istSha;
  m.postingDate = datum;
  fs.writeFileSync(path.join(p, 'workflow.json'), JSON.stringify(m, null, 2) + '\n');

  const protokoll = path.join(ABLAGE, 'Archiv/ZUORDNUNGSPROTOKOLL.md');
  const zeile = `| \`${path.relative(path.dirname(p), quelle)}\` | \`${ziel}/${name}\` | Auslieferung aus ${path.basename(p)} | \`${istSha.slice(0, 16)}…\` |\n`;
  if (fs.existsSync(protokoll)) fs.appendFileSync(protokoll, zeile);

  return { datei: zielDatei, sha256: istSha, aus: path.basename(quelle), vmaf: b.vmafMeanVsRenderedMaster, befunde: frei.befunde, abgenommen: frei.abgenommen };
}

if (process.argv[1]?.endsWith('ausliefern.mjs')) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const [, , projekt, titel] = process.argv;
  const datum = arg('--datum');
  const ziel = arg('--ziel') ?? '03_Bereit_zum_Posten';
  if (!projekt || !titel || !datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    console.error('Aufruf: node ausliefern.mjs "<Projektordner>" "<Videotitel>" --datum JJJJ-MM-TT [--ziel 04_Gepostet]');
    process.exit(2);
  }
  console.log(JSON.stringify(ausliefernNach(projekt, titel, datum, { ziel }), null, 2));
}
