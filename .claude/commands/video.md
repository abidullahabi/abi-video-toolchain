---
description: Kompletter Videodurchlauf von der Rohaufnahme bis zur Zernio-Einplanung
---

# Videodurchlauf

Führe die Schritte in dieser Reihenfolge aus. Für einen normalen Durchlauf reicht `ABLAUF_KURZ.md` im Repo (Befehle je Schritt). Lies dazu `DESIGN.md`; `CONTENT_WORKFLOW.md` nur bei Unklarheit, gezielt den Abschnitt. Diese Datei regelt nur den Ablauf und die Übergabepunkte.

**Ziel: 60 s Video in etwa 20 min für KI und Rechner, höchstens 30 min.** Es gelten die Regeln aus `ABLAUF_KURZ.md` Abschnitt 0, vor allem:

- Zeitbudget je Schritt. Doppelt überschritten oder Fehlersuche über 10 min: anhalten und Abi kurz melden.
- Planung: ein Planer, dann ein Prüfer. Keine Agentenschwärme.
- Kontaktblätter statt Serien von Einzelbildern.
- Vor jedem Render prüft das Werkzeug den Arbeitsspeicher. Reicht er nicht für zwei Prozesse, bitte Abi kurz, Programme zu schließen.
- Fehlen Freigaben für die Standardbefehle, schlag Abi die Liste aus `ABLAUF_KURZ.md` Abschnitt 0 für `/permissions` vor. Trag sie nie selbst ein.

Der Notion-Nachlauf älterer Videos (veröffentlicht? → POSTED) gehört nicht mehr hierher, er ist eine eigene regelmäßige Aufgabe.

Kurzform der Ordner: `DRIVE` steht für
`/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation`

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

## Schritt 3: Produktion (DESIGN.md 2.2)

Standard ist ein reiner Gestaltungsauftrag. Die Aufnahme bleibt in Länge, Tempo und Inhalt unverändert. Einen Pausen- oder Füllwortschnitt nur, wenn Abi ihn für dieses Video ausdrücklich beauftragt hat.

Nach `ABLAUF_KURZ.md` Schritt 2 bis 5:

1. Gestaltungsprojekt mit `designVersion: "2.2"`, Wörter mit `transcribe-words`, Korrekturen und Abmilderungen in `caption-edit-plan.json`, Followerstand in `follower-source.json`.
2. **Plan statt Code:** nur `design-plan.json` (Texte, Zeiten, Elementtyp, Variante). Ein Planer schreibt, ein Prüfer prüft, sonst niemand. Kein videospezifischer Code; fehlt ein Baustein, kommt er in `theme-composition-design22.mjs`.
   Ende: keine Stille vor dem CTA, Schluss, bevor die Geste endet.
3. Bei Grafiken: `node workflow.mjs green-screen "<P>" --review`.
4. `node workflow.mjs storyboard "<P>"` → Kontaktblatt (mit Zwischenbildern der Animationen) und Textliste an Abi. Bei eigenem Schnitt zusätzlich `node workflow.mjs vorschau "<P>"` (halbe Auflösung). Bitte Abi, alle Änderungen gesammelt in einer Nachricht zu schicken. Den finalen Build darfst du im Hintergrund starten, während er ansieht. **Eingeplant wird erst nach seinem OK.**
5. `node workflow.mjs build "<P>"` → ein Master, Upload-Export, Prüfungen, Kontaktblatt (≤ 12 Bilder), `review/build-bericht.json`.

## Schritt 4: Prüfung, harter Abbruchpunkt

`build` prüft per Skript jedes Bild gegen DESIGN.md 2.2 (Prüfliste Abschnitt 20 im Bericht), dekodiert die Datei vollständig, misst VMAF und Tonversatz. Zusätzlich das Kontaktblatt `review/kontaktblatt.jpg` ansehen, nicht über 100 Einzelbilder. Blockierende Befunde: korrigieren, erneut `build`. Übergib niemals ein Video, das durchgefallen ist.

## Schritt 5: Freigabepaket an Abi

Liefere immer genau diese fünf Dinge, kurz und ohne Ausschmückung:

1. **Pfad** zur fertigen MP4
2. **Transkript**, geprüft und wortgetreu
3. **Beschreibung** nach Abschnitt 11, höchstens fünf Hashtags, einer davon exakt `#abidullahabi`
4. **Prüfprotokoll**: die Prüfliste aus `review/build-bericht.json`, je Punkt bestanden, Befund oder offen
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
- Dauer je Schritt (aus logs/zeiten.json):
- Dauer des Durchlaufs:
- Wo musste Abi eingreifen:
- Was hat gehakt:
- Was hat gefehlt in dieser Anleitung:
- Anzahl Korrekturschleifen:
```

Sei hier ehrlich und konkret. Diese Notizen sind die Grundlage für den späteren Skill. Schönfärben macht den Skill schlechter.
