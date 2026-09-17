# Funktionsprüfung am 11. September 2026

Getestet wurde eine eigens erzeugte deutsche Sprachaufnahme mit eingebauten Pausen und einem neutralen Testbild. Es handelt sich nicht um eine Aufnahme des Nutzers.

- Auto-Editor, FFmpeg, FFprobe, Whisper und HyperFrames starten erfolgreich.
- Whisper wurde mit CPU und Apple-Metal-Beschleunigung getestet.
- Das deutsche Testvideo wurde von 12,20 auf 8,97 Sekunden gekürzt.
- 3,23 Sekunden wurden entfernt. Alle drei gesprochenen Sätze sind im Transkript enthalten.
- Vier Untertitelabschnitte wurden erzeugt.
- Eine animierte Überschrift und eine weitere animierte Texteinblendung wurden gerendert.
- Der abschließende Export enthält Video in 1080 × 1920 und eine Tonspur.
- Dauer und vollständige Decodierbarkeit wurden vom Workflow geprüft.
- Der Audiovergleich zwischen Schnittentwurf und Export zeigt eine Korrelation über 0,999 und keinen messbaren Versatz bei einer Suchauflösung von 0,5 ms.
- Zwei gerenderte Bilder wurden visuell auf Lesbarkeit, Platzierung und das Umschalten der Einblendungen geprüft.
- HyperFrames meldet für die abschließende Komposition keine Lint-Fehler oder Warnungen. Im abschließenden Renderprotokoll gibt es ebenfalls keine Warnungen oder Fehler.
- Vier automatisierte Tests für SRT-Zeitangaben, überlappende Untertitel, sichere Textausgabe und Einblendungszeiten bestanden.

Abschließendes Testprojekt: `projects/testaufnahme-2026-09-11T16-49-26-047Z-da77/`.

Testvideo: `exports/final-2026-09-11T16-50-36-402Z.mp4` innerhalb dieses Projekts.

Noch offen: Test mit echtem Kameramaterial, Beurteilung natürlicher Sprechpausen und leiser Wörter, persönliche Gestaltung, Prüfung von HDR-Farben bei einer entsprechenden Aufnahme. Eine technische Funktionsprüfung belegt noch keine gute Schnittentscheidung für jedes Video.
