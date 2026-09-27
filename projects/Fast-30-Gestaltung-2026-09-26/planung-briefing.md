# Planungsbriefing: Gestaltung v1 „Fast 30“

Projektordner: dieses Verzeichnis. Video: Abdullahs eigener Schnitt, 200,867 s, 1080 × 1920, sehr eng geschnitten (kaum Pausen). Länge, Tempo, Reihenfolge und Inhalt bleiben unverändert. Es wird nur gestaltet.

## Quellen, die du lesen musst

1. `words-raw.txt`: vollständiges Transkript, jedes Wort mit Startzeit in Sekunden (`Wort@Zeit`), eine Zeile je Satz. Einige Erkennungsfehler werden in den Untertiteln korrigiert (siehe `caption-edit-plan.json`), die Zeiten bleiben.
2. `/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media/Content_Creation/Anleitung/DESIGN.md`: verbindlicher Designstandard 1.12 (Abschnitte 0 bis 12 lesen).
3. `review/faces-summary.txt`: Gesichtsposition je Sekunde (1080 × 1920). Kopf samt Kappe reicht etwa eine halbe Gesichtshöhe über die Gesichtsoberkante.
4. `review/cut-points.json`: Bildsprünge (Schnitte) in Sekunden.
5. Textbreiten misst du so: `node measure.mjs "Text" 72` (Arial Bold, Ergebnis in px). Nicht schätzen.

## Abdullahs Auftrag für diese Fassung (26.09.2026, wörtlich sinngemäß)

- „Achte darauf, dass du nicht überall so viele H1-Überschriften machst. Die H1-Überschriften sind quasi die Punkte, die ich aufzähle. Wenn ich eine Aufzählung mache, bitte das in der H2.“
- „Das Design gerne anpassen oder anderes verwenden. Soll sich am aktuellen Stand orientieren, aber wenn coole Animationen möglich sind, gerne.“
- „Ziel ist es nicht, das Video voll zu klatschen mit Animationen, sondern dafür zu sorgen, dass H1 und H2 nicht zu sprunghaft sind. Feedback: Das lenkt sehr vom Gesagten ab. Deshalb dürfen mehr Animationen verwendet werden statt springender Überschriften.“
- Frühere Rückmeldung am selben Tag (anderes Video): weniger große blaue Überschriften.

## Konkrete Wünsche zu Stellen

1. Beziehungen: bei „Ich hätte mir ehrlich gesagt ein paar Beziehungen auch sparen können …“ (ab 66,87 s) eine H2. Wortlaut noch offen (Rückfrage läuft). Plane einen Platzhalter `overlays` mit id `beziehungen-h2`, Zeile 1 „Einige Beziehungen hätte ich mir sparen können“ ist zu breit, also sinnvoll kürzen oder zweizeilig; Zeile 2 = Platzhalter „[Zusatz folgt]“.
2. Stadt: wenn es ums Umziehen in eine andere Stadt geht („Am besten ziehst du auch eine andere Stadt“, 39,12 bis 40,42 s, ggf. etwas länger stehen lassen), kurz eine Grußzeile „Grüße gehen raus an [Name]“ mit kleiner Indien-Flagge dahinter. Name noch offen. Plane einen Platzhalter mit id `gruss` (Typ H2 oder Randnotiz neben dem Kopf, Abdullah: „als H2 kurz einblenden oder zusätzlich einfach daneben“).
3. Finanzen (Punkt 7, Investieren, 129 bis 147,5 s): „Finger weg von Kreditkarte, Leasing, Dispo“ einblenden. Das spricht Abdullah nicht, es ist Zusatztext. Aufzählung.
4. Punkt 10 „Glaub an etwas“: Ergänzung „… oder steh für etwas ein“ einblenden.

## Verfügbare Elemente (bereits gebaut)

- H1 (`sections`): blaue Fläche oben, Größenstufe 72/66/60/56 nach Breite (Textbreite ≤ 736 px, messen!). Neu in dieser Fassung: Folgen zwei H1 lückenlos aufeinander (Ende = Start der nächsten), wechselt die H1 nicht mehr per Aus- und Einblenden, sondern morpht: Die Fläche bleibt stehen, ändert ihre Breite, der neue Text rollt hinein. Deshalb sollen die H1 lückenlos aneinanderliegen.
- H2 (`overlays`): 46 px weiß mit Kontur, max. 560 px je Zeile, max. 2 Zeilen, unter der H1. Neu: `parts` für Aufzählungen in einer Zeile. Alle Punkte stehen von Anfang an da, der gerade besprochene leuchtet hellblau (`active`-Zeitfenster). Oder `lineAt`: Zeilen erscheinen nacheinander.
- Randnotiz (`notes`, DESIGN 9a): linksbündig neben dem Kopf, Zeilen erscheinen am gesprochenen Wort, rote Durchstreichung (`strikeAt`), Hervorhebung (`accentWord`, `active`). Seite = wo neben dem Kopf Platz ist (siehe faces-summary). Oberkante ≥ 390 (bzw. 60 px unter einer H2), Ende oberhalb y 1280, nie über Gesicht oder Kopf.
- Großes Wort (`bigwords`): ein Wort oder zwei sehr groß in blauer Fläche an der H1-Position, ploppt mit Überschwingen auf; H1/H2 blenden währenddessen kurz aus. Für die stärksten Aussagen. Dazu passt ein harter Punch-Zoom (`zooms` mit `punch: true`, scale 1,08 bis 1,12).
- Zooms: langsame Fahrten scale 1,03 bis 1,055 über 2 bis 6 s, Rücksprung an einem Schnitt (cut-points). Nicht bei sehr nahen Einstellungen.
- Untertitel und Outro (Folgen nicht vergessen + Fortschrittskarte, Followerstand 4.254) baue ich selbst. Das Outro läuft auf den letzten Sätzen und endet mit dem Video (200,867 s); plane `outroStart` zwischen 193,4 und 195,5 s. Ab dann keine H1/H2/Notizen mehr.
- Keine Sprechblase (Abdullah fordert nicht zu DM/Kommentar auf), keine Logos.

## Harte Regeln

- H1 ab dem allerersten Frame (start = 0) für den Einstieg, sonst nur je Punkt (1 bis 10) und für den Schluss. Nummeriert nach der Reihenfolge im Video („1. …“). Keine weiteren H1.
- H2 nur für Aufzählungen und die vier Wünsche oben, nie als Pflichtzeile.
- Keine zwei Elemente am selben Platz gleichzeitig; H2 und Randnotiz nicht übereinander.
- Nichts in gesperrte Zonen (y < 250, y > 1660, x < 90, x > 930).
- Zeiten an den tatsächlich gesprochenen Wörtern ausrichten (words-raw.txt). Ein Element erscheint mit dem Wort, das es auslöst.
- Maß halten: Animationen dort, wo sie das Gesagte verstärken. Lieber wenige starke Momente als viele.
- Texte auf Deutsch, Abdullahs Ton (locker, direkt). Grobe Wörter in Einblendungen vermeiden.
