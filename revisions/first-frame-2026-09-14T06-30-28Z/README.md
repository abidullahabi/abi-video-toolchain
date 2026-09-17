# ABI Content-Workflow

Die maßgebliche Anleitung ist [CONTENT_WORKFLOW.md](</Users/abi/Desktop/Social Media/Content_Videos/CONTENT_WORKFLOW.md>).

Sie enthält den am 13.09.2026 angenommenen Schnitt und Textstil, die tatsächlichen Ergebnisse des Referenzvideos, technische Arbeitsschritte, Dateipfade und eine kopierbare Startanweisung für neue Chats. Für neue Aufnahmen diese Anleitung zuerst vollständig lesen.

## Freigegebener Standard

- Schnitt: Pausen ab 0,7 Sekunden, −35 dB, je 0,10 Sekunden Schutzabstand zur Sprache. Anfang, Ende und kurze Pegelimpulse separat prüfen. Füllwörter nur im Satzkontext entfernen.
- H1: Arial Bold, weiß auf Blau #349feb. H2: weiß mit schwarzer Kontur, ohne Hintergrundkästen. Kontextbezogene Logo-Einblendungen und die angenommene YouTube-Wischanimation künftig häufiger einsetzen.
- Untertitel: dieselbe Schriftfamilie, 56 px bei 1080 × 1920, y=1280. Genau eine Zeile, höchstens drei Wörter. Nur das aktuell gesprochene Wort blau.
- Zooms: nur auf das Video, dezent, Rücksprünge an vorhandenen Schnitten. Texte bleiben fest.
- Tempo: zuerst vollständig bei 1,0 exportieren. Für das lange Referenzvideo wurde danach 1,1 gewählt. Das ist kein pauschaler Standard für alle Videos.
- Danger Zone: Texte und Logos einschließlich Kontur in x=180–900 und y=300–1500 halten. Alle Gruppen an x=540 zentrieren. H1 startet normalerweise bei y=320. Auch Animationen prüfen.
- Ausgabe für Buffer Web: 1080 × 1920p30, H.264, SDR/BT.709, Ziel 12 Mbit/s, AAC-LC 120 kbit/s und unter 300 MB. Originale erhalten.

## Verwendeter technischer Weg

1. Mit `workflow.mjs analyze-cut` die Aufnahme untersuchen.
2. Einen überprüften `cuts.json`-Plan erstellen. Diesen Schritt übernimmt die Analyse nicht automatisch.
3. Mit `export-cut` den Schnitt exportieren und prüfen.
4. Ein neues Gestaltungsprojekt mit dem freigegebenen Schnitt, `theme-plan.json` und passender Tondatei vorbereiten.
5. Mit `transcribe-words --speech-model turbo` Wortdaten erzeugen und unklare Stellen prüfen. Den derzeit im Hilfsskript enthaltenen Fachwortschatz an das neue Video anpassen.
6. Mit `assemble-full-video.mjs` Wortuntertitel und Gestaltung zusammenstellen.
7. Mit `preview-html` die Vorschau zeigen und mit `render-html` vollständig exportieren. Die automatische Freizonen- und Zentrierungsprüfung in `check-theme-layout.mjs` muss bestehen.
8. Falls ausdrücklich gewünscht, zuerst das endgültige Tempo festlegen und Bild und Ton gemeinsam anpassen.
9. Erst danach die Buffer-Datei erstellen. `finalize-buffer-video.py` gilt für die aktuellen Gestaltungsprojekte bei unverändertem Tempo und unverändertem Schnitt. Bei Tempo- oder Schnittänderungen dasselbe Exportprofil mit der bereits passend geschnittenen und synchronisierten Tonspur anwenden.

Die genaue Bedienung, Voraussetzungen und Grenzen stehen in der Hauptanleitung. `prepare`, `compose`, `render` und `preview` gehören zur früheren Vorlage und sind nicht der freigegebene Weg. `preview-cut` nur für reine Schnitt- oder fertig zusammengesetzte Tempo-Projekte verwenden, da es die HTML-Vorschau neu schreibt.

## Abschluss vor dem Posten

Die aktuelle freigegebene Upload-Datei in `03_Bereit_zum_Posten/<Videoordner>/` kopieren und per SHA-256 prüfen. Aus dem geprüften Transkript eine ausführliche, natürliche Beschreibung nach den Nutzerbeispielen erstellen. Höchstens fünf Hashtags, immer exakt #abidullahabi. Die Beschreibung im passenden Notion-Eintrag ergänzen, zurücklesen und erst bei vollständigem Paket auf Ready to Post setzen. Die vollständigen Regeln stehen in Abschnitt 11 der Hauptanleitung.

## Ablage

[Content_Videos](</Users/abi/Desktop/Social Media/Content_Videos>) enthält Originale, Bearbeitungsstände, Dateien zum Posten und bestätigte veröffentlichte Videos in vier getrennten Ordnern. Die bearbeitbaren technischen Projekte bleiben zusätzlich unter `projects/` in diesem Arbeitsverzeichnis.

Keine automatische Veröffentlichung. Abdullah postet selbst. Eine abgenommene MP4 ist noch kein bestätigtes Posting. Die aktuellen ausführlichen Beschreibungsbeispiele sind maßgeblich. Höchstens fünf Hashtags einschließlich #abidullahabi verwenden.
