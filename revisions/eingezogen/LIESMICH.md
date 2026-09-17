# Eingezogene Werkzeuge

## check-cut-seams.py — eingezogen am 16.09.2026

Von Abdullah freigegeben in der Nachbesprechung, Punkt 2.

**Warum:** Der Tonteil misst Schnittnähte mit einer Pegelschwelle
(`quiet + (loud - quiet) * 0.35`). Genau diese Art Messung hat sich als
untauglich erwiesen — sie zählt Atem als Sprache. Ersetzt durch die
Silero-Signaturprüfung aus Punkt 1, die am Kalibriersatz aus fünf
abgenommenen und zwei verworfenen Fassungen validiert ist.

Das Skript wurde ausserdem von nichts aufgerufen: kein Verweis in der
Arbeitsanleitung, keinem Skript, keinem Projektstand. Ein ungeprüftes
Prüfwerkzeug ohne Aufrufer ist keine Absicherung, sondern eine Einladung,
die falsche Zahl zu zitieren.

**Was dabei verloren geht und nicht verloren gehen darf:** Der *Bildteil*
ist nicht ersetzt. Er vergleicht Standbilder 0,05 s vor und nach jeder Naht,
lässt die unteren 38 Prozent des Bildes aussen vor, weil dort die Untertitel
wechseln, und meldet Sprünge ab dem 1,6-fachen des Medians. Er prüft damit,
ob Abdullah zwischen zwei Anläufen sichtbar anders sitzt — ein echter
Fehlerfall bei Talking-Head-Schnitten, den sonst nichts abdeckt.

Diese Fähigkeit steht als offener Punkt im Änderungsstapel. Beim
Wiederaufbau gilt die Regel aus Punkt 2: erst am Kalibriersatz zeigen,
dass sie einen bekannten guten von einem bekannten schlechten Fall trennt,
dann fest in den Ablauf einhängen. Nicht wieder als Skript ohne Aufrufer.

## pruefe-bildnaht.py — gebaut und sofort eingezogen, 16.09.2026

Gebaut als Ersatz fuer den Bildteil von `check-cut-seams.py`, den Abdullah
freigegeben hatte. Beim Validieren am Kalibriersatz stellte sich heraus: **Das
Problem, das sie erkennen soll, tritt in diesem Material nicht auf.**

Gemessen an Abdullahs abgenommenem Schnitt `0916.mp4`:

| Kennzahl | gute Naehte | Gegenfall (Bilder 20-35 s auseinander) | trennt? |
|---|---|---|---|
| mittlere Helligkeitsabweichung | 1,70 – 5,73 | 4,02 – 7,01 | **nein**, vollstaendige Ueberlappung |
| beste Verschiebung in Pixeln | 0,0 | 0,0 | **nein**, kein Unterschied messbar |

Abdullah sitzt zwischen zwei Anlaeufen still, die Kamera steht fest, der
Hintergrund ist unbewegt. Es gibt keinen Bildsprung. Die Helligkeitskennzahl
misst ausserdem Licht und Rauschen statt Position — derselbe Fehlertyp wie die
Pegelschwelle aus Nachbesprechung Punkt 2.

**Wieder hervorholen, wenn:** Abdullah Kamera, Standort oder Sitzposition
aendert, freihand filmt, oder ein Schnitt beim Ansehen springt. Dann zuerst
einen bekannten schlechten Fall aufnehmen und die Schwelle daran setzen —
nicht umgekehrt.

## Vier Auslieferungsskripte — eingezogen, 16.09.2026

`deliver-social-outro.py`, `deliver-berufserfahrung-outro.py`,
`deliver-handle-correction.py`, `finish-linkedin-delivery.py`

Ersetzt durch **einen** Schritt: `ausliefern.mjs` im Hauptordner.

**Warum:** Alle vier taten dasselbe — Exportbericht lesen, `fullyDecoded` und
VMAF pruefen, Pruefsumme gegen den Bericht vergleichen, eine Kopie ueber eine
Nebendatei anlegen und verifizieren, den Projektstand nachfuehren. Jede
Korrektur hatte ein eigenes Skript bekommen, statt dass es einen Schritt mit
Parametern gab.

**Und alle vier waren tot:** Sie zeigen auf
`/Users/abi/Desktop/Social Media/Content_Videos`, einen Pfad, den es seit
Langem nicht mehr gibt. 55 Projektdateien verweisen noch auf Pfade darunter.

Die Logik ist in `ausliefern.mjs` erhalten, einschliesslich der guten Teile:
niemals ungeprueft ueberschreiben, erst Nebendatei und dann umbenennen, jede
Kopie per SHA-256 gegen die Quelle pruefen.

`archive-scheduled-corrections.py` und `update-posting-dates.py` bleiben
vorerst liegen — sie tun etwas anderes (Notion- und Terminpflege) und sind
nicht Teil der Auslieferung.
