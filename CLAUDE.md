# ABI Content-Workflow: Wegweiser

Dieses Verzeichnis enthält die Werkzeuge für Abdullah Bachtaris Social-Media-Videos (TikTok, Instagram Reels, YouTube Shorts, 9:16).

**Sprache Deutsch.** Abdullah soll keine technischen Befehle selbst eingeben müssen.

## Diese Datei enthält keine Regeln

Die verbindlichen Regeln stehen in der Arbeitsanleitung, nicht hier:

`/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation/Anleitung/CONTENT_WORKFLOW.md`

**Lies sie, bevor du an einem Video arbeitest.** Der Abschnitt „Harte Regeln, immer“ steht gleich am Anfang.

Wenn du dich im Drive-Ordner orientieren willst: `00_START_HIER.md` erklärt dort jede Datei und jeden Stufenordner.

Bis zum 16.09.2026 standen die harten Regeln in dieser Datei. Das war ein Fehler: `CLAUDE.md` liest nur Claude Code automatisch. Wird der Workflow in ein anderes Werkzeug übertragen — und genau das ist Abdullahs Anspruch —, fallen die Regeln lautlos weg. Ausserdem nannte diese Datei vier Gestaltungswerte, die `DESIGN.md` 1.9 längst anders festlegte, darunter eine Untertitelfarbe, die wegen zu geringen Kontrasts verworfen worden war.

**Trage hier keine Regeln und keine Gestaltungswerte ein.** Sie gehören in `CONTENT_WORKFLOW.md`, Gestaltung ausschliesslich in `DESIGN.md`. Die alte Fassung liegt als `revisions/CLAUDE.vor-regelumzug-2026-09-16.md`.

## Zwei Orte, nicht vermischen

**Hier, Werkzeuge und Projekte:** Skripte, Binaries, Sprachmodelle, `projects/`.

**Videoablage und maßgebliche Anleitung:** der Google-Drive-Ordner oben. Dort liegen `CONTENT_WORKFLOW.md`, `DESIGN.md`, `TESTPROTOKOLL.md`, `AENDERUNGSSTAPEL.md` und die Stufenordner `01_Rohvideos`, `02_Bearbeitete_Videos`, `03_Bereit_zum_Posten`, `04_Gepostet`, `Archiv`.

Lege keine Projektordner in Google Drive an. Render- und Zwischendateien bleiben hier.

## Einordnung weiterer Dateien in diesem Ordner

- `DESIGN.md` im Drive-Ordner ist allein maßgeblich für das Aussehen. Bei Widersprüchen zu irgendeiner anderen Quelle gilt sie.
- `Setup/CLAUDE_CODE_SETUP.md` im Drive-Ordner regelt nur die Einrichtung. Bei Widersprüchen zu `CONTENT_WORKFLOW.md` gilt letztere.
- `AGENTS.md` ist eine frühere Codex-Datei und verweist auf den überholten Pfad `Desktop/Social Media/Content_Videos`, den es nicht mehr gibt. Nicht als maßgeblich verwenden.
- Die Arbeitsanleitung nennt an mehreren Stellen „Codex“ als ausführenden Agenten. Das ist eine Rollenbezeichnung und meint dich. Schreibe diese Stellen nicht um.

## Schutzprüfungen vor dem Bauen und vor dem Ausliefern

```
node pruefungen.mjs kollision    "<Quelldatei>"      # arbeitet eine andere Sitzung daran?
node pruefungen.mjs auslieferung "<Projektordner>"   # liegt ein sauberer Gestaltungsbericht vor?
```

Beide lesen nur JSON und sind ohne dieses Skript nachbildbar. Begründung in `CONTENT_WORKFLOW.md` und im Änderungsstapel.

## Offene Punkte

- HyperFrames 0.8.34 rendert Arial/Helvetica als Inter, aber `assemble-full-video.mjs` misst Untertitelbreiten mit Arial Bold. Die Entscheidung liegt bei Abdullah. Bis dahin Schrift und Messung nicht eigenmächtig ändern.
- `projects/Rendertest-ClaudeCode-2026-09-15T07-59-06Z` ist eine Funktionsprobe, kein Posting-Projekt.
- Der Änderungsstapel aus der Nachbesprechung vom 16.09.2026 ist noch nicht vollständig in die Arbeitsanleitung eingearbeitet. Stand siehe `AENDERUNGSSTAPEL.md` im Drive-Ordner.

## Videoproduktion

Für einen kompletten Durchlauf von der Rohaufnahme bis zur Einplanung: `/video`.
