# Bildprüfung der drei Rohvideos, Abschnitt 1

Status: technische Quelldecodierung und ausgewiesene Bildstichproben abgeschlossen. Keine Schnittdatei erstellt. Originale unverändert belassen. Kein Export freigegeben.

## Grundlage und Grenze

DESIGN.md Version 1.12, 526 Zeilen, und CONTENT_WORKFLOW.md Version 1.25, 837 Zeilen, vollständig gelesen. Der erste gemeinsame Leseaufruf wurde in der Ausgabe gekürzt. Deshalb anschließend DESIGN vollständig sowie CONTENT_WORKFLOW in lückenlosen Bereichen 1–300, 301–590 und 591–837 gelesen.

Prüfweg: Originalquelle mit FFmpeg 6.0 und -xerror vollständig decodieren. Bildauswahl beginnt bei 0 und nimmt den ersten Frame mindestens 5 Sekunden nach dem vorigen. FFmpeg autorotiert die Originalquelle. Standbilder werden nur für die Analyse skaliert. Jede Stichprobe hat ihren Original-PTS im sampling-manifest.json. Nebenbei wird die vollständige Tonspur nach null decodiert. Das ist ein technischer Test, keine Hörprüfung.

Kontaktblätter wurden visuell geprüft, dazu gezielt große Einzelbilder. Diese Sichtung ist keine vollständige Wiedergabe aller Bewegungen. Kurze Schärfewechsel, Flackern, Blickwechsel zwischen den Stichproben sowie Schnittanschlüsse sind noch nicht lückenlos geprüft. Kein Qualitätswert und kein automatisches Gütesiegel wurden aus einer unvalidierten Kennzahl abgeleitet.

## IMG_1966.MOV

Beurteilung: Sprechende Einstellungen sind grundsätzlich bildlich nutzbar. Augen, Bart und Stoffstruktur sind in den betrachteten 1080×1920-Einzelbildern deutlich. Die Person ist vom Hintergrund erkennbar getrennt. Die direkte Ausleuchtung hat sichtbare Schatten, aber das Gesicht bleibt lesbar. Starker Wechsel der Nähe zur Kamera und seitliche oder nach unten gerichtete Blicke erfordern gezielte Take-Auswahl.

Konkrete Beobachtungen, Originalzeiten:

- 00:00.000: überwiegend leerer Raum, Person am Rand. Kein geeigneter Anfang für die spätere Fassung.
- 00:20.033, 00:35.035 und 00:40.035: Gesicht und Oberkörper vollständig im Bild, sichtbarer Blick zur Kamera. Das sind bildlich geeignete Kandidaten, keine inhaltliche Take-Freigabe.
- 00:25.033, 01:10.035, 01:30.035, 02:00.037 und 02:35.070: Person teilweise außerhalb des Bilds oder sehr nah am Rand. Wahrscheinlich Umpositionierung, anhand Transkript bestätigen.
- 00:35.035: Kappenoberkante ungefähr y=480 auf 1080×1920. H1 hat Raum. Eine zweizeilige H2 bis etwa y=488 kann die Kappe berühren. Einzeilige, kurze Zusatzinformation ist bildlich günstiger.
- 02:10.070: Kappenoberkante ungefähr y=306. Die feste H1-Fläche y=250 bis y=343–362 würde die Kappe überdecken. H2 überdeckt ebenfalls einen Teil der Kappe. Dieser Take braucht eine bewusste Lösung vor Gestaltung, beispielsweise Auswahl einer weiteren passenden Einstellung. Keine freie Verschiebung der H1 als stiller Ersatz.
- 04:05.073: Gesicht, Lächeln und Daumengeste sichtbar, Kopf sehr nah. Für Outro-Planung konkreten Text und Handbereich prüfen.
- 04:10.073: Bild zeigt Jalousie und Boden während Kamerabewegung. Nicht für den Schlussinhalt verwenden.

Große Belegbilder: detail_035s.jpg, detail_130s.jpg, detail_245s.jpg. Exakte PTS: 35.035, 130.070 und 245.073 Sekunden. Keine zusätzlichen Zooms auf die ohnehin engen Nahaufnahmen, entsprechend DESIGN.md.

## IMG_1967.MOV

Beurteilung: Die betrachteten Sprechbilder bieten brauchbare Schärfe und verständlichen Blickkontakt. Abstände und Kopfpositionen wechseln. Dazwischen gibt es deutliches Umpositionieren und Wegsehen. Eine bloße automatische Pausenentfernung reicht deshalb nicht zur Auswahl zusammenhängender, bildlich plausibler Takes.

Konkrete Beobachtungen, Originalzeiten:

- 00:00.000: leerer Raum. 00:05.000: Eintritt am Bildrand.
- 00:15.000: Blick in die Kamera, Gesicht klar, Kappenoberkante ungefähr y=527. H1 und normale H2 haben hier freie Fläche.
- 01:20.002: deutlich nähere Ansicht, seitlicher Blick. Kappenoberkante ungefähr y=434. H1 passt, zweizeilige H2 kann die Kappe überdecken.
- 02:00.037, 02:05.037 und 02:15.070: Gesicht teilweise außerhalb des Bilds, Nähe zur Kamera oder Körper am Bildrand. Als Zwischenbewegung gegen Transkript abgleichen.
- 02:50.072: Gesicht und Kappe sichtbar verwischt bei Bewegung, Hintergrund vergleichsweise klar. Dieser konkrete Frame ist kein Beleg für dauerhaft falschen Fokus. Einen relevanten Satz an dieser Stelle im Bewegungsverlauf gesondert prüfen.
- 03:45.073: weitere Einstellung mit sichtbarer Zeigegeste und viel Fläche oberhalb des Kopfes.

- 04:40.107 bis 05:15.108: mehrere weitere Sprechbilder mit ganzer Person im Bildausschnitt. Bei 05:20.108 ist die Person bereits rechts aus dem Bild unterwegs.

Große Belegbilder: detail_015s.jpg, detail_080s.jpg, detail_170s.jpg. Exakte PTS: 15.000, 80.0017 und 170.072 Sekunden.

## IMG_1968.MOV

Beurteilung der gesichteten Bilder: Die Hauptteile sind bildlich nutzbar. Gesicht und Kleidung zeigen klare Details. Helligkeit und Hintergrund wirken über die Stichproben ähnlich. Die Kamera steht überwiegend fest. Die Person verändert ihre Nähe und seitliche Position. Das Material verlangt deshalb auch hier eine Auswahl zusammenhängender Aussagen. Ein einziges lückenloses Sprechen lässt sich aus Standbildern nicht belegen.

Konkrete Beobachtungen, Originalzeiten:

- 00:00.000 bis 00:05.000: leerer Raum beziehungsweise Eintritt am Bildrand.
- 00:25.033 und 00:30.033: Hand beziehungsweise Mikrofon dicht an der Kamera. Vorbereitung von Hauptinhalt getrennt beurteilen.
- 00:45.035, 01:00.035 und 01:30.035: ganze Person im vorgesehenen Sprechbild, sichtbarer Blick zur Kamera.
- 01:20.035, 01:25.035, 01:55.037: Blick nach unten. Bei 01:40.037 Hand an der Kappe. Diese Einzelbilder belegen keine Take-Grenze. Gesprochenen Inhalt abgleichen.
- 01:50.003 im größeren Detailbild: Gesicht klar, Kappenoberkante ungefähr y=540. Oberhalb ist Platz für eine einfache H1. Die Hände liegen teilweise in der Untertitelhöhe.
- 02:25.070: Kopf verlässt links teilweise das Bild. 02:30.070, 02:35.070 und 02:45.072: Blick nach unten.
- 03:40.005 im größeren Detailbild: Gesicht klar und Blick nach vorn, Kappenoberkante ungefähr y=550. H1 passt ohne zusätzliche Zooms.

- 03:20.072 und 03:25.072: deutlich nach unten und seitlich gerichteter Blick. 03:30.072 und 03:40.072: wieder Sprechbild. 03:50.073: Person teilweise am rechten Bildrand beim Beenden.

Große Belegbilder: detail_020s.jpg, detail_110s.jpg, detail_220s.jpg. Exakte PTS: 20.000, 110.003 und 220.005 Sekunden.

Die Hinterkamera ist Nutzerangabe. Die betrachteten Gesichtsdetails wirken klar. Ein Qualitätsvorteil gegenüber einer konkret zugeordneten Frontkamera-Aufnahme ist ohne direkten Vergleich nicht belegt. Die einfache Gestaltung passt zum verfügbaren Platz und vermeidet zusätzliche Unruhe. Die vorgesehenen Schnitte sind nach Take-Auswahl in Bewegung auf Körper- und Handsprünge zu prüfen.

## Tatsächlich erfolgte Prüfdeckung

| Datei | Dauer laut Quelle | Vollständiger Bild- und Tondecodetest | Betrachtete 5-s-Frames | Originalzeit der letzten Stichprobe | Große Einzelbilder |
|---|---:|---|---:|---:|---:|
| IMG_1966.MOV | 251,071667 s | Exit 0 | 51 | 250,073 s | 3 |
| IMG_1967.MOV | 321,575000 s | Exit 0 | 65 | 320,108 s | 3 |
| IMG_1968.MOV | 234,038333 s | Exit 0 | 47 | 230,073 s | 3 |

Insgesamt 163 zeitlich verteilte Standbilder und 9 größere Einzelbilder betrachtet. Die letzten knapp 1,0 / 1,47 / 3,97 Sekunden der jeweiligen Aufnahme liegen nach der letzten regelmäßigen Bildstichprobe. Sie wurden technisch decodiert, aber nicht vollständig visuell betrachtet. Das Testverfahren ist in analyseframes.py gespeichert. decode-and-sampling.log und sampling-manifest.json liegen in jedem IMG-Unterordner. Die kompletten betrachteten Kontaktblätter heißen view_01.jpg bis view_03.jpg, bei IMG_1967 bis view_04.jpg. Die zusätzlich erzeugten contact_*.jpg sind nicht als eigener zusätzlicher Prüfdurchgang zu zählen.

## Eigene Gegenprüfung

- Nach gekürzter Toolausgabe die betroffenen Anleitungen erneut vollständig und lückenlos gelesen. Keine Vollständigkeit aus einer gekürzten Ausgabe abgeleitet.
- Decodierung bis Dateiende und tatsächlicher Rückgabecode jedes Prozesses geprüft. Der Decodetest ist getrennt von der visuellen Stichprobe und von nicht erfolgter Hörprüfung dokumentiert.
- Bei Kappenüberdeckung nicht allein aufs Gesicht geschaut. Konkrete 1080×1920-Einzelbilder mit DESIGN.md abgeglichen.
- Pauschale Aussage zur Eignung der oberen Textfläche korrigiert. IMG_1966 bei 02:10.070 hat ausdrücklich einen Konflikt mit der festen H1-Position.
- Aussage zur ähnlichen Einstellung im dritten Film präzisiert. Ähnlicher Kamerastandort und Hintergrund belegen weder ununterbrochenen Blickkontakt noch einen einzigen fehlerfreien Take.
- Keine Körperbewegung oder geschlossene Augen in einem Einzelbild automatisch als misslungener Take behandelt. Abgleich mit vollständigem gesprochenen Satz bleibt Voraussetzung.
- Keine nicht validierte Schärfezahl oder Bildnahtschwelle zum Qualitätsbeleg gemacht. Die eingezogene automatische Bildnahtprüfung wurde nicht verwendet.
- Keine Hörprüfung, Publikumswirkung oder Front-/Hinterkamera-Überlegenheit behauptet.

## Für die nächste Phase offen

Nach redaktioneller Take-Auswahl die vorgesehenen konkreten Schnittanschlüsse im Bewegungsverlauf prüfen. Kopfposition, Blickrichtung, Gesten und Mikrofonhaltung dürfen nicht mitten in einer Geste unmotiviert springen. Durchgehende vollständige Sätze bevorzugen. Der Schnitt ist hier noch nicht gebaut.

Die erste Auswahl mit dem Textlayout abgleichen. Bei enger Nahaufnahme keine zusätzlichen Zooms. Bei IMG_1966 reicht die feste obere Textfläche in einigen Takes nicht für H1/H2 ohne Kappenüberdeckung. Für die ersten beiden Filme Namen, Kosten und Zeitaufwand daher kurz und zeitlich gestaffelt planen. Der tatsächliche Animationsentwurf und seine vollständigen Phasen wurden noch nicht erstellt oder freigegeben.

Hörkontrolle, Wortvollständigkeit, Sprechlückenkalibrierung, Exportprüfung und Plattformdarstellung liegen außerhalb dieses Bildstichprobenberichts.

## Zusatzabgleich mit den vom Hauptagenten genannten Kandidaten

- IMG_1967 74–88 s: 80,002 s enthält die oben dokumentierte knappe Kappenhöhe für H2.
- IMG_1967 148–169 s: 155,070 s zeigt Hinauslehnen nach links, 165,072 s Blick nach unten. Belege: sample_032.jpg und sample_034.jpg. Die sichtbare Bewegungsunschärfe bei 170,072 s liegt knapp hinter diesem Kandidatenblock.
- IMG_1968 131–142 s: der Block endet vor dem deutlich nach links herausgelehnten Bild bei 145,070 s.
- IMG_1968 218–226 s: 220,005 s ist als Sprechbild brauchbar. 225,073 s zeigt schon Blick nach unten mit gedrehter Haltung. Exakten Schluss in Bewegung und mit Wortlaut festlegen.

Diese Kandidatenintervalle stammen vom Hauptagenten und wurden hier nicht redaktionell festgelegt oder exportiert.
