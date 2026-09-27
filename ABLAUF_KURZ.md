# Kurzablauf: Rohvideo → eingeplanter Post (DESIGN.md 2.2)

Ziel: 60 s Video in etwa 30 min, ohne Abdullahs Prüfzeit. Diese Seite reicht für einen normalen Durchlauf. `CONTENT_WORKFLOW.md` und `DESIGN.md` (Drive, `Content_Creation/Anleitung`) sind maßgeblich und werden **nur bei Unklarheit** nachgelesen. Arbeitsort: `~/Projekte/abi-video-toolchain`. `DRIVE` = `…/Social Media/Content_Creation`.

Jeder Befehl unten schreibt Start und Ende in `projects/<P>/logs/zeiten.json`.

## 1. Auftrag und Vorprüfung (≈ 2 min)

1. Rohvideo in `DRIVE/01_Rohvideos`: `JJJJ-MM-TT - Titel.mp4` → Postingtag, 19:00 Europe/Berlin. `Datum offen - …` oder Kameraname → nachfragen, weiterarbeiten.
2. `head -c 100 "<Rohvideo>" > /dev/null` (Drive lädt bei Bedarf), dann `node pruefungen.mjs kollision "<Rohvideo>"`. Treffer → nicht anfangen, fragen.
3. `node workflow.mjs doctor`

## 2. Projekt, Schnitt, Wörter (≈ 8 min)

1. Nur bei beauftragtem Schnitt: `node workflow.mjs analyze-cut "<Rohvideo>"` → `cuts.json` prüfen → `node workflow.mjs export-cut "<Schnittprojekt>"`. Sonst bleibt die Aufnahme unverändert.
2. Gestaltungsprojekt unter `projects/<Titel>-<Datum>`: `media.mp4` (Schnitt oder Aufnahme, bei blassem Licht mit Farbkorrektur A aus DESIGN.md 16), `speech.wav` (mono, 16 kHz), `workflow.json` mit `designVersion: "2.2"`, `cutDuration`, `renderMaster`, `bearbeitung: {agent, aufgabe, begonnen, status: "in_arbeit"}`.
3. `transcription-prompt.txt` nur mit Begriffen aus dieser Aufnahme. `node workflow.mjs transcribe-words "<P>" --speech-model turbo`. Unsichere Stellen: `transcription-review-chunks.json` + `--review`, Korrekturen und Abmilderungen in `caption-edit-plan.json`.
4. Followerstand: Zernio `accounts_get_follower_stats` (TikTok `6aa6efb9726ebfe037e60cc6`) → `follower-source.json` `{"wert": …, "lastUpdated": …}`.
5. Gesichter: `review/source-faces.json` (`check-face-placement.swift`), Schnittpunkte `review/cut-points.json`.

## 3. Plan (≈ 8 min, hoher Denkaufwand)

`design-plan.json` schreiben, **kein Code im Projekt**. Elemente und Einsatz nach DESIGN.md 1: `einstieg`, `kapitel`, `h1`, `h2` (`unter`: `einstieg` | `kapitel:<id>` | `h1:<id>` | `allein`), `pillen`, `akronyme`, `schlagworte` (höchstens 2), `grafiken` (mit Rechenweg), `randnotizen` (nur Vorher/Nachher), `lebensbalken`, `logos`, `sprechblasen` (nur bei Aufforderung zu Kommentar/DM), `outroStart` (Standzeit 4–5 s). Zeiten an Wortstarts aus `word-timing.json`. Fehlt ein Baustein: in `theme-composition-design22.mjs` einbauen (Werkzeugregeln in `CLAUDE.md`), nie ins Projekt.

Bei Grafiken: `node workflow.mjs green-screen "<P>" --review` (Personenebene je Abschnitt und `review/kopf-profil.json`).

## 4. Storyboard und Freigabe (≈ 2 min + Abdullah)

`node workflow.mjs storyboard "<P>"` → `review/storyboard.jpg` (ein Standbild je Einblendung bei voller Sichtbarkeit) und `review/storyboard.txt` (Zeiten, Texte). Beides Abdullah zeigen. Korrekturen nur in `design-plan.json`, dann erneut `storyboard`. **Gerendert wird erst nach seinem OK.**

## 5. Bauen, einmal (≈ 8 min für 60 s)

`node workflow.mjs build "<P>"`: Plan zusammensetzen, Designprüfung Bild für Bild, genau ein Master, Upload-Export nach Abschnitt 10, Decodier- und VMAF-Prüfung, Kontaktblatt mit höchstens 12 Bildern, Bericht `review/build-bericht.json`. Bei blockierenden Befunden bricht er ab und nennt sie. Kontaktblatt und Bericht ansehen, nicht über 100 Einzelbilder.

## 6. Freigabepaket an Abdullah

Pfad zur MP4, geprüftes Transkript, Beschreibung (höchstens 5 Hashtags, einer `#abidullahabi`), Prüfliste aus `build-bericht.json` (DESIGN.md 20), Frage nach Freigabe. Warten. Korrekturen → Fassung nach `DRIVE/Archiv/Vorversionen`, zurück zu Schritt 3.

## 7. Nach der Freigabe, ohne Rückfrage (≈ 4 min)

1. `node ausliefern.mjs "<P>" "<Titel>" --datum JJJJ-MM-TT`
2. Notion „Master Contentplanung": Beschreibung ablegen, zurücklesen, Status Ready to Post.
3. `node zernio-upload.mjs "<Datei>" --token <token> --projekt "<P>"`, dann `posts_create_post` (Instagram + TikTok, ein Beitrag, `scheduled_for` mit Offset, `timezone` Europe/Berlin; vorher `dry_run`). Bei Verbindungsabbruch erst `posts_list` prüfen. Post-ID in Projekt und Notion.
4. Datei nach `04_Gepostet` (Abdullahs Festlegung), Rohvideo nach `Archiv/Rohvideos`, Zwischenstände nach `Archiv/Vorversionen`, jeweils mit Prüfsumme ins Zuordnungsprotokoll.
5. `node aufraeumen.mjs "<P>" [Schnittprojekt]` → Größe und „löschbar ab" melden. Nichts löschen.
6. `bearbeitung.status: "fertig"`, `git add`, `git commit`, `git push`. Dauer je Schritt aus `logs/zeiten.json` ins Testprotokoll.

## Nicht Teil des Durchlaufs

Der Notion-Nachlauf älterer Videos (veröffentlicht? → POSTED, Datei umbenennen) ist eine eigene regelmäßige Aufgabe und gehört nicht mehr in `/video`.
