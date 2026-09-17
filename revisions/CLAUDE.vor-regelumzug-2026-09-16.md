# ABI Content-Workflow: Dauerkontext

Dieses Verzeichnis enthält die Werkzeuge für Abdullah Bachtaris Social-Media-Videos (TikTok, Instagram Reels, YouTube Shorts, 9:16).

**Sprache Deutsch.** Abi soll keine technischen Befehle selbst eingeben müssen.

## Zwei Orte, nicht vermischen

**Hier, Toolchain und Projekte:** Skripte, Binaries, Sprachmodelle, `projects/`.

**Videoablage und maßgebliche Anleitung:**
`/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation`

Dort liegen `CONTENT_WORKFLOW.md` (verbindliche Arbeitsanleitung), `CLAUDE_CODE_SETUP.md` (Einrichtung), und die Stufenordner `01_Rohvideos`, `02_Bearbeitete_Videos`, `03_Bereit_zum_Posten`, `04_Gepostet`, `Archiv`.

Lege keine Projektordner in Google Drive an. Render- und Zwischendateien bleiben hier.

## Maßgebliche Quelle

`CONTENT_WORKFLOW.md` im Drive-Ordner ist die verbindliche Arbeitsanleitung. Bei Widersprüchen gilt sie. **Lies sie, bevor du an einem Video arbeitest.**

Die Datei nennt an mehreren Stellen „Codex" als ausführenden Agenten — das ist eine Rollenbezeichnung und meint dich. Schreibe diese Stellen nicht um.

`CLAUDE_CODE_SETUP.md` regelt nur die Einrichtung. Bei Widersprüchen zu CONTENT_WORKFLOW.md gilt letztere.

`AGENTS.md` in diesem Ordner ist eine frühere Codex-Datei und verweist auf den überholten Pfad `Desktop/Social Media/Content_Videos`. Nicht als maßgeblich verwenden.

## Harte Regeln, immer

- **Nichts löschen.** Abi entscheidet jede Löschung selbst. Verschieben und Umbenennen sind erlaubt. Überholte Stände kommen nach `Archiv/Vorversionen`, nie in `02_Bearbeitete_Videos` liegen lassen.
- **Länge, Tempo, Inhalt und Sprachstil erhalten.** Kürzen oder Beschleunigen nur bei ausdrücklichem Auftrag für dieses eine Video. Eine Gestaltungsaufgabe ist kein Schnittauftrag.
- **Keine Musik, kein B-Roll, keine bildfüllenden Grafiken.** Die Originalaufnahme und ihr Hintergrund bleiben sichtbar.
- **Einstiegsüberschrift ab Frame 0** vollständig sichtbar, ohne Einblendanimation. Am exportierten ersten Frame prüfen, nicht am Plan.
- **Danger Zone:** Textbereich x=180 bis 900, y=300 bis 1500, jede Gruppe auf x=540 zentriert, auch während jeder Animation.
- **Untertitel:** eine Zeile, höchstens drei Wörter, nur das aktuell gesprochene Wort in `#349feb`.
- **`04_Gepostet` belegt keine Veröffentlichung.** Dateien landen dort auf Abis Wunsch schon nach der Zernio-Einplanung. Setze einen Notion-Eintrag nie allein wegen des Ordners auf POSTED.
- **Google Drive lädt Dateien nur bei Bedarf.** Ein sichtbarer Dateiname belegt keinen Download. Vor der Verarbeitung prüfen: `head -c 100 "DATEI" > /dev/null`. Schlägt das fehl, Datei erst offline verfügbar machen.
- **Keine Datei ungeprüft überschreiben.** Kopien per SHA-256 vergleichen.
- **Referenzprojekte unter `projects/` unverändert lassen.** Neue Läufe und Rendertests immer in neuen Projektordnern.
- **Nichts neu installieren oder aktualisieren,** ohne belegt zu haben, dass es fehlt. Neue Whisper- oder ffmpeg-Versionen können Wortzeiten und Exportwerte verändern.
- **Abi veröffentlicht und gibt frei.** Du planst nach seiner Freigabe ein, postest aber nichts eigenmächtig und meldest nichts als fertig, was du nicht geprüft hast.

## Offene Punkte, Stand 15.09.2026

- HyperFrames 0.8.34 rendert Arial/Helvetica als Inter, aber `assemble-full-video.mjs` misst Untertitelbreiten mit Arial Bold. Die Entscheidung liegt bei Abi. Bis dahin Schrift und Messung nicht eigenmächtig ändern.
- `projects/Rendertest-ClaudeCode-2026-09-15T07-59-06Z` ist eine Funktionsprobe, kein Posting-Projekt.

## Videoproduktion

Für einen kompletten Durchlauf von der Rohaufnahme bis zur Einplanung: `/video`.
