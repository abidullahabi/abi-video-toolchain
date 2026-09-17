---
description: Kompletter Videodurchlauf von der Rohaufnahme bis zur Zernio-Einplanung
---

# Videodurchlauf

Führe die Schritte in dieser Reihenfolge aus. Lies zuerst `CONTENT_WORKFLOW.md` im Drive-Ordner vollständig, sie ist die maßgebliche Anleitung. Diese Datei regelt nur den Ablauf und die Übergabepunkte.

Kurzform der Ordner: `DRIVE` steht für
`/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation`

## Schritt 0: Nachlauf der offenen Videos

Bevor du ein neues Video anfasst, räume die alten auf.

1. Lies `CONTENT_WORKFLOW.md` ENTSCHEIDUNGEN.md und die Notion-Datenbank „Master Contentplanung".
2. Für jedes Video mit Status Ready to Post, dessen geplantes Postingdatum durch ist: prüfe, ob es tatsächlich veröffentlicht wurde.
3. Ist es veröffentlicht: Notion auf POSTED mit dem tatsächlichen Datum, Datei nach `DRIVE/04_Gepostet/JJJJ-MM-TT - Titel.mp4` mit dem tatsächlichen Datum im Namen.
4. Ist es nicht veröffentlicht oder unklar: nichts ändern, Abi fragen.

Melde das Ergebnis in zwei bis drei Zeilen, dann weiter.

## Schritt 1: Auftrag aus dem Dateinamen lesen

Neue Rohvideos liegen in `DRIVE/01_Rohvideos` nach diesem Muster:

```
JJJJ-MM-TT - Titel.mp4
```

Das Datum ist der gewünschte Postingtag. Die Uhrzeit ist fest **19:00 Uhr Europe/Berlin**. Der Titel ist der Videotitel für Dateinamen und Notion.

Heißt die Datei `Datum offen - Titel.mp4`, frage nach dem Datum und erfinde keins. Die restliche Bearbeitung kann währenddessen laufen.

Trägt eine Datei noch einen Kameranamen, frage nach Titel und Datum.

Bearbeite nur das Video, das Abi meint. Verarbeite nie ungefragt alle wartenden Rohvideos mit.

## Schritt 2: Zugriff und Werkzeuge prüfen

1. Ist die Rohdatei vollständig lesbar? `head -c 100 "DATEI" > /dev/null`
2. `node workflow.mjs doctor`
3. Auflösung, Bildrate, Ausrichtung, Dauer, Codec, Farbraum, HDR/SDR und Ton der tatsächlichen Datei prüfen.

Stimmt etwas nicht, melde es und höre auf. Arbeite nicht auf einer Datei, die du nicht vollständig lesen konntest.

## Schritt 3: Produktion

Standard ist ein reiner Gestaltungsauftrag. Die Aufnahme bleibt in Länge, Tempo und Inhalt unverändert. Führe einen Pausen- oder Füllwortschnitt nur aus, wenn Abi ihn für dieses Video ausdrücklich beauftragt hat.

Nach `CONTENT_WORKFLOW.md` Abschnitt 9 B bis D:

1. Neues Gestaltungsprojekt unter `projects/` anlegen, Referenzprojekte unverändert lassen.
2. Transkribieren, Wortzeiten bestimmen, unsichere Stellen gegenprüfen. Den Whisper-Wortschatz in `word-captions.mjs` an dieses Video anpassen, nicht die alten Fachbegriffe übernehmen.
3. Themen, H1 und H2 aus dem tatsächlich gesprochenen Inhalt ableiten. Keine Zeiten oder Themen aus anderen Videos kopieren.
4. Einstiegs-H1 und zugehörige H2 mit `start: 0`, volle Deckkraft, keine Einblendanimation.
5. Passende Logo-Einblendungen und einzelne Textblasen an inhaltlich passenden Stellen, nach Abschnitt 6 und 6b.
6. Gemeinsames Social-Outro über `buildSocialOutro(start, end)`, alle vier Profile gleichzeitig.
7. Dezente Zooms.
8. Grobe Ausdrücke in den finalen Untertiteln nach Abschnitt 7 abmildern und die Abweichungen gegen das wortgetreue Originaltranskript dokumentieren.
9. `render-html`, danach Upload-Export nach Abschnitt 10.

## Schritt 4: Prüfung, harter Abbruchpunkt

Prüfe die tatsächliche Exportdatei, nicht den Plan:

- erster codierter Frame bei 0:00, Einstiegsüberschrift vollständig sichtbar und lesbar
- Danger Zone und Zentrierung über alle Animationsphasen
- Outro: alle vier Profile gleichzeitig, Handles exakt, nichts verdeckt
- Untertitel: eine Zeile, höchstens drei Wörter, höchstens ein blaues Wort, keine Überlappungen
- Länge und Tempo entsprechen der Vorlage
- Bild und Ton synchron, Stimme verständlich, keine Musik
- Datei vollständig decodierbar, 1080 × 1920, 30 fps

Fällt ein Punkt durch, korrigiere ihn und prüfe erneut. Übergib niemals ein Video, das durchgefallen ist, auch nicht mit Hinweis.

## Schritt 5: Freigabepaket an Abi

Liefere immer genau diese fünf Dinge, kurz und ohne Ausschmückung:

1. **Pfad** zur fertigen MP4
2. **Transkript**, geprüft und wortgetreu
3. **Beschreibung** nach Abschnitt 11, höchstens fünf Hashtags, einer davon exakt `#abidullahabi`
4. **Prüfprotokoll** als Liste mit den Punkten aus Schritt 4, je Punkt bestanden oder Befund
5. **Die Frage**, ob Abi freigibt oder Korrekturen nennt

Warte hier. Plane nichts ein, bevor Abi freigegeben hat.

Nennt Abi Korrekturen: verschiebe die bisherige Fassung nach `DRIVE/Archiv/Vorversionen`, arbeite die Punkte ein und durchlaufe Schritt 4 und 5 erneut.

## Schritt 6: Nach der Freigabe, ohne weitere Rückfrage

1. Datei nach `DRIVE/03_Bereit_zum_Posten/JJJJ-MM-TT - Titel.mp4`, Quelle und Kopie per SHA-256 vergleichen.
2. Notion-Eintrag in „Master Contentplanung" über Titel und Inhalt eindeutig zuordnen, Beschreibung im Abschnitt „Beschreibung & Hashtags" ablegen, Seite erneut lesen und prüfen, Status auf Ready to Post.
3. Über Zernio für **Instagram und TikTok** auf das Postingdatum, 19:00 Uhr, einplanen. Zernio-ID protokollieren.
4. Auf Abis Wunsch wandert die Datei danach bereits nach `04_Gepostet`. Der Status in Notion bleibt Ready to Post.

Melde: Ablageort, Notion-Link, Zernio-ID, geplante Zeit. Mehr nicht.

## Schritt 7: Testprotokoll

Solange dieser Ablauf in der Erprobung ist, hänge nach jedem Durchlauf an `DRIVE/TESTPROTOKOLL.md` einen Block an:

```
## JJJJ-MM-TT - Titel
- Dauer des Durchlaufs:
- Wo musste Abi eingreifen:
- Was hat gehakt:
- Was hat gefehlt in dieser Anleitung:
- Anzahl Korrekturschleifen:
```

Sei hier ehrlich und konkret. Diese Notizen sind die Grundlage für den späteren Skill. Schönfärben macht den Skill schlechter.
