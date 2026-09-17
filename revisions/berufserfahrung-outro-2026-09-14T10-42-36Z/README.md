# ABI Content-Workflow

Die maßgebliche Anleitung ist [CONTENT_WORKFLOW.md](</Users/abi/Desktop/Social Media/Content_Videos/CONTENT_WORKFLOW.md>).

Sie enthält den am 13.09.2026 angenommenen Schnitt und Textstil, die tatsächlichen Ergebnisse des Referenzvideos, technische Arbeitsschritte, Dateipfade und eine kopierbare Startanweisung für neue Chats. Für neue Aufnahmen diese Anleitung zuerst vollständig lesen.

## Freigegebener Standard

- Länge, Inhalt und Tempo beibehalten. Pausen- und Füllwortentfernung nur bei ausdrücklichem Schnittauftrag, dann nach den dokumentierten 0,7-Sekunden-Regeln.
- Neue Aufnahmen: native iPhone-Kamera, Übertragung per AirDrop. Kein CapCut-Aufnahme- oder CapCut-Cloud-Schritt. Originaldatei und tatsächliche Metadaten prüfen.
- H1: ab 0:00 vollständig sichtbar, ohne Einblendanimation. Zugehörige Einstiegs-H2 ebenfalls sofort zeigen. Arial Bold, weiß auf Blau #349feb. H2: weiß mit schwarzer Kontur, ohne Hintergrundkästen. Kontextbezogene Logo-Einblendungen und die angenommene YouTube-Wischanimation künftig häufiger einsetzen.
- Untertitel: dieselbe Schriftfamilie, 56 px bei 1080 × 1920, y=1280. Genau eine Zeile, höchstens drei Wörter. Nur das aktuell gesprochene Wort blau.
- Zooms: nur auf das Video, dezent, Rücksprünge an vorhandenen Schnitten. Texte bleiben fest.
- Tempo: zuerst vollständig bei 1,0 exportieren. Für das lange Referenzvideo wurde danach 1,1 gewählt. Das ist kein pauschaler Standard für alle Videos.
- Danger Zone: Texte und Logos einschließlich Kontur in x=180–900 und y=300–1500 halten. Alle Gruppen an x=540 zentrieren. H1 startet normalerweise bei y=320. Auch Animationen prüfen.
- Vorhandene Upload-Basis aus dem Buffer-Workflow: 1080 × 1920p30, H.264, SDR/BT.709, Ziel 12 Mbit/s, AAC-LC 120 kbit/s und unter 300 MB. Originale erhalten.

## Verwendeter technischer Weg

1. Aufnahme und Metadaten prüfen. Bei reiner Gestaltung die unveränderte Quelle bzw. den freigegebenen Schnitt verwenden und Schritte 2–3 überspringen. Nur bei beauftragten Kürzungen mit `workflow.mjs analyze-cut` untersuchen.
2. Einen überprüften `cuts.json`-Plan erstellen. Diesen Schritt übernimmt die Analyse nicht automatisch.
3. Mit `export-cut` den Schnitt exportieren und prüfen.
4. Ein neues Gestaltungsprojekt mit dem freigegebenen Schnitt, `theme-plan.json` und passender Tondatei vorbereiten.
5. Mit `transcribe-words --speech-model turbo` Wortdaten erzeugen und unklare Stellen prüfen. Den derzeit im Hilfsskript enthaltenen Fachwortschatz an das neue Video anpassen.
6. Mit `assemble-full-video.mjs` Wortuntertitel und Gestaltung zusammenstellen.
7. Mit `preview-html` die Vorschau zeigen und mit `render-html` vollständig exportieren. Die automatische Freizonen- und Zentrierungsprüfung in `check-theme-layout.mjs` muss bestehen.
8. Falls ausdrücklich gewünscht, zuerst das endgültige Tempo festlegen und Bild und Ton gemeinsam anpassen.
9. Erst danach die Upload-Datei erstellen. `finalize-buffer-video.py` gilt für die aktuellen Gestaltungsprojekte bei unverändertem Tempo und unverändertem Schnitt. Bei Tempo- oder Schnittänderungen dasselbe Exportprofil mit der bereits passend geschnittenen und synchronisierten Tonspur anwenden.

Die genaue Bedienung, Voraussetzungen und Grenzen stehen in der Hauptanleitung. `prepare`, `compose`, `render` und `preview` gehören zur früheren Vorlage und sind nicht der freigegebene Weg. `preview-cut` nur für reine Schnitt- oder fertig zusammengesetzte Tempo-Projekte verwenden, da es die HTML-Vorschau neu schreibt.

## Abschluss vor dem Posten

Die aktuelle freigegebene Upload-Datei in `03_Bereit_zum_Posten/JJJJ-MM-TT - Videotitel.mp4` kopieren und per SHA-256 prüfen. Aus dem geprüften Transkript eine ausführliche, natürliche Beschreibung nach den Nutzerbeispielen erstellen. Höchstens fünf Hashtags, immer exakt #abidullahabi. Die Beschreibung im passenden Notion-Eintrag ergänzen, zurücklesen und erst bei vollständigem Paket auf Ready to Post setzen. Die vollständigen Regeln stehen in Abschnitt 11 der Hauptanleitung.

## Ablage

[Content_Videos](</Users/abi/Desktop/Social Media/Content_Videos>) enthält Originale, Bearbeitungsstände, Dateien zum Posten und bestätigte veröffentlichte Videos in vier getrennten Ordnern. Die bearbeitbaren technischen Projekte bleiben zusätzlich unter `projects/` in diesem Arbeitsverzeichnis.

Keine automatische Veröffentlichung. Abdullah postet selbst. Eine abgenommene MP4 ist noch kein bestätigtes Posting. Die aktuellen ausführlichen Beschreibungsbeispiele sind maßgeblich. Höchstens fünf Hashtags einschließlich #abidullahabi verwenden.

## Ergänzungen aus dem Nutzerfeedback

- Originalaufnahme und Hintergrund bleiben sichtbar. Keine bildfüllenden Grafikflächen und vorerst kein zusätzliches B-Roll. Kleine Logos und einzelne Textblasen dürfen kurz direkt auf der Aufnahme erscheinen, etwa „Hey Abi, ich habe eine Frage“. Keine Musik. Soundeffekte nur punktuell zur passenden Animation. Nichts aus dem Consulting-Experiment übernehmen.
- Vor der Übergabe den ersten codierten Frame der MP4 prüfen. Die Hauptüberschrift muss bei 0:00 vollständig lesbar sein. Die Layoutprüfung enthält zusätzlich eine Prüfung der Einstiegstexte.
- Zernio wurde laut Nutzer am 14.09.2026 als erfolgreich verwendeter Veröffentlichungsweg gemeldet. Nicht automatisch Buffer voraussetzen. Der Nutzer veröffentlicht selbst. Der Tag dieser Rückmeldung ist nicht automatisch das Veröffentlichungsdatum.

- Grobe Ausdrücke in finalen Untertiteln und neuen Texten sinngemäß mild und bei passendem Kontext leicht humorvoll formulieren. Originaltranskript wortgetreu erhalten, redaktionelle Ersetzungen mit Zeit, Vorher/Nachher und Nutzergrundlage gesondert speichern. Untertitel bleiben maximal drei Wörter. Bestehenden gesprochenen Ton nicht automatisch ersetzen. Bereits gepostete Videos nicht rückwirkend ändern.
- Sichtbare Videoablage flach, keine Unterordner je Video. Finale Dateien `JJJJ-MM-TT - Videotitel.mp4`: in 03 geplantes Datum, in 04 tatsächlicher Postingtag. Beim bestätigten Posting verschieben und entsprechend umbenennen. Projekt-/Exportdatum nicht als Postingdatum ausgeben. Fehlende Termine erfragen, vorläufig höchstens „Datum offen - Videotitel.mp4“. Die interne technische Projektablage bleibt separat. Pfade nachführen und Umzüge mit Prüfsummen dokumentieren.

- Einheitliches Outro, präzisiert am 14.09.2026: alle vier Social-Profile gleichzeitig mit „Road to 10K“ auf Blau, „Folgen nicht vergessen“ auf Rot und Fragen-/Kommentar-/DM-Hinweis. Keine zwei nacheinander wechselnden Einblendungen. Gemeinsame kompakte Übersicht unter den Untertiteln, zwei Reihen, zwei Spalten, sanftes gemeinsames Aufploppen. Gesicht und Danger Zone freihalten.
- Bestätigte Profile: YouTube @itsabidullahabi, TikTok @abdullahabi, Instagram @abdullahabi, LinkedIn Abdullah Bachtari. Die unterschiedlichen Schreibweisen erhalten. Pflicht-Hashtag weiterhin #abidullahabi.
- Wiederverwendbarer Outro-Baustein: social-outro.mjs mit buildSocialOutro(start, end). Alte Outro-Elemente gezielt ersetzen. Die vier offiziellen lokalen Assets übernehmen. theme-plan.json einschließlich socialCtas/outroGroup dauerhaft speichern. check-theme-layout.mjs prüft gleiche Zeiten, vier Profile, Icon-Ladung und alle Bewegungsphasen.
- Postingkorrektur vom 14.09.2026: Karrierebereiche tatsächlich am 13.09. gepostet, Consulting am 14.09. morgens gepostet. Berufserfahrung noch nicht veröffentlicht, voraussichtlich am 15.09.2026. Deshalb Ready to Post und in 03_Bereit_zum_Posten. Erst nach Bestätigung nach 04_Gepostet verschieben. Notion-Status und Datumsfelder sind entsprechend korrigiert.
