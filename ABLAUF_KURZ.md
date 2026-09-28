# Kurzablauf: Rohvideo → eingeplanter Post (DESIGN.md 2.2)

**Ziel: ein 60-s-Video in etwa 20 min für KI und Rechner zusammen, höchstens 30 min, ohne Abdullahs Prüfzeit.** Diese Seite reicht für einen normalen Durchlauf. Arbeitsort: `~/Projekte/abi-video-toolchain`. `DRIVE` = `…/Social Media/Content_Creation`.

Jeder Befehl unten schreibt Start und Ende in `projects/<P>/logs/zeiten.json`.

## 0. Regeln für jeden Durchlauf (Gesamtauftrag Tempo, 27.09.2026)

**Lesen.** Nur diese Seite und `DESIGN.md`. `CONTENT_WORKFLOW.md` nur bei Unklarheit, dann gezielt den Abschnitt. Bilder prüfst du über Kontaktblätter (`review/storyboard.jpg`, `review/kontaktblatt.jpg`), nicht über Serien von Einzelbildern.

**Planung.** Ein Planer schreibt `design-plan.json`, danach prüft ein Prüfer. Keine Agentenschwärme, keine Mehrfachentwürfe mit Bewertung und Synthese (Fast 30: 11 Agenten, 27,5 min).

**Zeitbudget je Schritt (60 s Video).** Ist ein Schritt doppelt so lang wie sein Budget oder dauert eine Fehlersuche länger als 10 min: anhalten und Abdullah kurz melden (was hakt, was du vorschlägst). Nicht weiter basteln.

| Schritt | Budget |
|---|---|
| 1 Auftrag und Vorprüfung | 1 min |
| 2 Projekt vorbereiten (Kamerabild, Ton, Wörter, Gesichter) und Transkript prüfen | 4 min |
| 3 Plan: Entwurf, Planer, Prüfer | 6 min |
| 4 Storyboard (mit Zwischenbildern) und Freigabepaket | 2 min |
| 5 Bauen (Render, Export, Prüfungen) | 4 min |
| 6 Freigabepaket Video | 1 min |
| 7 Auslieferung und Notion | 2 min |

**Abnahme.**
- Abdullah bekommt das Storyboard. Bei eigenem Schnitt zusätzlich eine Vorschau in halber Auflösung (`node workflow.mjs vorschau "<P>"`), weil er Anschlüsse und Timing nur im Bewegtbild beurteilen kann.
- Bitte ihn, seine Rückmeldung gesammelt in **einer** Nachricht zu schicken. Einzelne Nachbesserungsrunden nach fertigem Render kosteten beim Bewerbungsgespräch rund 100 min.
- Den finalen Build darfst du im Hintergrund starten, während er die Vorschau ansieht. Ändert er etwas, rechnet der nächste Build nur die betroffenen Abschnitte neu.
- **Eingeplant wird nie vor seinem OK.** Auch ein „soll am Termin X raus“ ist keine Freigabe einer Fassung, die er noch nicht gesehen hat.

**Ende.** Keine Stille vor dem CTA. Der letzte Satz endet knapp nach dem Wort, der CTA folgt ohne Pause. Schluss, bevor die Geste endet (Daumen sinkt, Lacher ist vorbei), bei einem Anhang etwa 0,8 s nach dem letzten Wort.

**Arbeitsspeicher.** Vor jedem Render prüft das Werkzeug den verfügbaren Speicher. Reicht er nicht für zwei Render-Prozesse, hält es an und meldet das. Dann bittest du Abdullah kurz, Programme zu schließen, statt mit einem Prozess doppelt so lange zu rendern.

**Löschordner.** Löschbares nur nach ~/Löschbar. Keine anderen Löschordner, keine Fristen. INHALT.md dort aktuell halten.

**Werkzeugcode.** Wer Werkzeugcode ändert, arbeitet in einem eigenen Arbeitsordner (git worktree), siehe `CLAUDE.md`. Videoprojekte bleiben im gemeinsamen `projects/` des Hauptordners.

**Freigaben.** Folgende Befehle kann Abdullah einmalig über `/permissions` freigeben, damit ein Durchlauf ohne Rückfragen läuft. Die KI schlägt die Liste nur vor und trägt sie nie selbst ein.

```
Bash(node workflow.mjs *)
Bash(node ausliefern.mjs *)
Bash(node zernio-upload.mjs *)
Bash(node pruefungen.mjs *)
Bash(node aufraeumen.mjs *)
Bash(tools/bin/ffmpeg *)
Bash(tools/bin/ffprobe *)
Bash(git add *)
Bash(git commit *)
Bash(git push)
```

Die Regeln gelten, wenn der Befehl im Hauptordner `~/Projekte/abi-video-toolchain` läuft. `git add` nur mit eigenen Pfaden, nie `-A`.

## 1. Auftrag und Vorprüfung (≈ 1 min)

1. Rohvideo in `DRIVE/01_Rohvideos`: `JJJJ-MM-TT - Titel.mp4` → Postingtag, 19:00 Europe/Berlin. `Datum offen - …` oder Kameraname → nachfragen, weiterarbeiten.
2. `node workflow.mjs anlegen "<Rohvideo>" --title "<Titel>" [--farbkorrektur A] [--datum JJJJ-MM-TT]`. Prüft Lesbarkeit und Kollision (andere Sitzung an derselben Aufnahme → bricht ab, Abdullah fragen), trägt `bearbeitung` ein und legt **ein** Projekt `projects/<Titel>-<Datum>` an. Gibt es für diese Aufnahme schon ein Projekt (Design 2.2), wird es weiterverwendet. Das Rohvideo wird nicht kopiert.
3. `node workflow.mjs doctor` nur bei neuer Umgebung oder Fehlern.

## 2. Vorbereiten (≈ 1–2 min Rechner, dann Transkript prüfen)

1. `transcription-prompt.txt` nur mit Begriffen aus dieser Aufnahme.
2. Nur bei beauftragtem Schnitt: `schnitt.json` `{"behalten": [[start, ende], …]}` in Sekunden des Rohvideos im selben Projekt. Ende nach Abschnitt 0: keine Stille vor dem CTA, Schluss vor dem Ende der Geste.
3. `node workflow.mjs vorbereiten "<P>"`: Kamerabild `media.mp4` in einem Durchgang aus dem Rohvideo (Schnitt, Farbkorrektur), `speech.wav`, Wörter in **einem** Whisper-Durchgang mit Wortzeiten (bei Schnitt auf dem ungeschnittenen Ton, dann in die Schnittzeit umgerechnet), Gesichter, Schnittpunkte. Jeder Schritt merkt sich die Prüfsummen seiner Eingaben (`logs/cache.json`) und überspringt sich, wenn nichts geändert ist. Nach einer Schnittänderung also einfach erneut aufrufen.
4. Transkript prüfen; Korrekturen und Abmilderungen in `caption-edit-plan.json`.
5. Followerstand: Zernio `accounts_get_follower_stats` (TikTok `6aa6efb9726ebfe037e60cc6`) → `follower-source.json` `{"wert": …, "lastUpdated": …}`.

## 3. Plan (≈ 6 min: Entwurf, ein Planer, ein Prüfer)

1. `node workflow.mjs planentwurf "<P>"` schreibt `design-plan.json` aus Titel, Wortzeiten und Schnittpunkten: Einstieg, Kapitel aus Zählwörtern, Pillen aus gesprochenen Aufzählungen, Zoomfahrten (DESIGN.md 15, nie über einen Schnitt), Outro-Beginn, Sprechblase bei Kommentar-/DM-Aufruf. Was unsicher ist, steht in `_offen`.
2. **Ein Planer** prüft und ergänzt: Kapiteltitel kürzen, H2, Schlagworte (höchstens 2), Grafiken mit Rechenweg, Randnotizen (nur Vorher/Nachher), Logos (Datei nötig), `_offen` abarbeiten und leeren. Elemente nach DESIGN.md 1, Zeiten an Wortstarts aus `word-timing.json`. **Kein Code im Projekt**; fehlt ein Baustein, kommt er in `theme-composition-design22.mjs` (Werkzeugregeln in `CLAUDE.md`).
3. **Ein Prüfer** liest Plan, Transkript und DESIGN.md gegen und meldet Abweichungen; der Planer bessert nach. Keine weiteren Agenten.

## 4. Storyboard und Freigabe (≈ 1 min + Abdullah)

`node workflow.mjs storyboard "<P>"`: Kopfprofil nur an den Einblendungsstellen (Personenmaske, halbe Auflösung), `review/storyboard.jpg` mit einem Standbild je Einblendung bei voller Sichtbarkeit **und einem Zwischenbild mitten in jeder Animation**, `review/storyboard.txt` mit Zeiten und Texten. Die Animationsprüfung vergleicht Zwischen- und Endzustand jedes Elements; gleichen sie sich, meldet sie `BEFUND … Animation übersprungen` → erst beheben.

Beides Abdullah zeigen (bei eigenem Schnitt zusätzlich `node workflow.mjs vorschau "<P>"`, halbe Auflösung) und um **eine** gesammelte Rückmeldung bitten. Korrekturen nur in `design-plan.json`, dann erneut `storyboard`. Den finalen Build darfst du im Hintergrund starten, während er ansieht.

## 5. Bauen (≈ 2–3 min für 60 s, nach Korrekturen weniger)

`node workflow.mjs build "<P>"`: Plan zusammensetzen, Designprüfung Bild für Bild, Lint, **Render in Abschnitten von 10 s** (nur geänderte Abschnitte, parallel nach freiem Speicher, rechnerweite Render-Sperre, Nahtprüfung), `exports/master.mp4`, Upload-Export `exports/upload.mp4` nach Abschnitt 10 (x264 medium, VMAF an Stichproben, Tonabgleich), Kontaktblatt (≤ 12 Bilder), Bericht `review/build-bericht.json`. Reicht der Speicher nicht für zwei Render-Prozesse, hält der Befehl an → Abdullah bitten, Programme zu schließen. Lange Läufe von Anfang an im Hintergrund starten: Ein Befehl, der erst nach dem Zeitlimit in den Hintergrund wandert, läuft mit niedrigster Priorität weiter.

## 6. Freigabepaket an Abdullah

Pfad zur MP4 (`exports/upload.mp4`), geprüftes Transkript, Beschreibung in `beschreibung.txt` (höchstens 5 Hashtags, einer `#abidullahabi`), Prüfliste aus `build-bericht.json` (DESIGN.md 20), Frage nach Freigabe. Warten. **Eingeplant wird nie vor seinem OK.** Korrekturen: Plan ändern, erneut `build`; nur betroffene Abschnitte werden neu gerendert, die lokale Fassung wird überschrieben (CONTENT_WORKFLOW 1.28). Liegt eine gezeigte Fassung im Drive, kommt sie nach `Archiv/Vorversionen`.

## 7. Nach der Freigabe, ohne Rückfrage (≈ 2 min)

1. `node ausliefern.mjs "<P>" "<Titel>" --datum JJJJ-MM-TT [--zeit 19:00]` erledigt alles in einem Rutsch mit dem Zernio-API-Schlüssel aus dem Schlüsselbund (Eintrag `zernio-api-key`):
   - Auslieferungssperre, Drive-Ablage mit Prüfsumme,
   - Upload mit Längenprobe, Zernio-Prüfung, Einplanung für Instagram und TikTok (ein Beitrag, Europe/Berlin), Status „scheduled“ gegengelesen. Ein Termin in der Vergangenheit wird abgelehnt, weil Zernio sonst sofort veröffentlicht. Die Anfrage-ID steht im Projekt, eine Wiederholung erzeugt keinen Doppelpost.
   - Datei nach `04_Gepostet`, Rohvideo nach `Archiv/Rohvideos` (Zuordnungsprotokoll), Videomaterial nach `~/Löschbar`, `bearbeitung.status: "fertig"`, `git add`/`commit`/`push` des Projekts.
   Vorher prüfen, ohne etwas anzulegen: derselbe Befehl mit `--probe`.
2. Notion „Master Contentplanung": Beschreibung ablegen, zurücklesen, Status Ready to Post, Post-ID eintragen.
3. Abdullah melden: Ablageort, Zernio-ID, geplante Zeit, frei gewordene GB. Dauer je Schritt aus `logs/zeiten.json` ins Testprotokoll.

Ohne Schlüssel (Ersatzweg): Upload-Token über `media_generate_upload_link`, `node ausliefern.mjs … --token <token>`, dann `posts_create_post` über `call_tool` mit `review/zernio-post.json` (erst `dry_run`, bei Abbruch erst `posts_list`), dann `node ausliefern.mjs "<P>" --post-id <id>`.

## Nicht Teil des Durchlaufs

Der Notion-Nachlauf älterer Videos (veröffentlicht? → POSTED, Datei umbenennen) ist eine eigene regelmäßige Aufgabe und gehört nicht mehr in `/video`.
