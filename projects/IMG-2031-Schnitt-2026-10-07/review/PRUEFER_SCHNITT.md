# Unabhängige Schnittprüfung IMG_2031

Stand: 07.10.2026. Prüfer: Codex-Unteragent schnitt_werkzeuge_pruefen. Umfang: nur Schnitt, keine Planänderungen durch den Prüfer.

## Ergebnis

Die endgültige Auswahl enthält alle fünf Handlungspunkte aus den vollständig gelesenen Rohtranskripten. Eine notwendige Inhaltskorrektur wurde gemeldet und vom Planer übernommen. Nach dieser Korrektur kein weiterer eindeutiger Inhaltsverlust und kein zusätzlicher eindeutiger Anschlussfehler in der technischen Prüfung erkannt. Das ist keine Hörfreigabe und keine Freigabe zur Veröffentlichung.

Finaler Plan: 56 Intervalle, 55 Nähte, 127.80 Sekunden bei Tempo 1,0.

Schnitt-SHA-256: `15dfa3dc5b8e0679aad19d1a6eed65e4912a550b42613c1262dcbed19162caa9`

Auswahl-SHA-256: `a5a8e6262ffe72d0cfcacecfd24f9868cb9d5ed1a79adfa8c880ac937cc26a45`

## Grundlage und Verfahren

- CONTENT_WORKFLOW.md 1.32, Abschnitte 5 und 8, ABLAUF_KURZ.md.
- Vollständige Rohtranskripte: schnitt/analysis/asr-turbo.log, asr-small.log und detection-full.txt. Alle 55 Rohsprechstücke inhaltlich mit Auswahl und Entfernungen abgeglichen.
- Erstfassung: alle 54 Nähte als kurze PCM-WAVs zusammengesetzt, mit je 5 ms Ein- und Ausblendung pro Teilstück. Zwei lokale Modelle: large-v3-turbo-q5_0 und small. Höchstens drei Prüfprozesse gleichzeitig.
- Endfassung: alle 55 Nähte abgedeckt. Unveränderte Nahtpaare aus Erstprüfung übernommen. Vier veränderte Ausschnitte neu geprüft: erster Hook, zwei Anschlüsse um s35, gekürztes Ende.
- Nahtkontext höchstens 3 s pro Seite. Deshalb beginnen oder enden einzelne Prüftexte mitten im Satz. Vereinzelte Modellauslassungen oder Halluzinationen sind keine bewiesenen Schnittfehler.
- Vollständigen ersten Hook zusätzlich ab Rohzeit 3,0 geprüft. Beide Modelle erkennen vollständig: Diese Dinge machst du in deinen ersten 99 Tagen in deinem neuen Job.
- Die Prüf-WAVs stammen aus dem 16-kHz-Analyse-Ton. Sie bilden die Schnittgrenzen und 5-ms-Fades ab. Die endgültige AAC-MP4 wurde vom Prüfer weder abgehört noch vollständig decodiert. Die abschließende Exportprüfung liegt beim ausführenden Planer.

## Übernommene Korrektur

s35, Rohzeit 177,09 bis 180,83: Der Satz zum aktiven Mitteilen der eigenen Erfolge an die Führungskraft musste erhalten bleiben. Schriftlich dokumentieren ist eine andere Handlung als Erfolge mitteilen. Die erste Auswahl hatte diesen Satz als Dopplung entfernt. Jetzt bleibt er einschließlich beider Anschlüsse erhalten. Turbo bestätigt den Anschluss von der Führungskraft-Passage. Beide Modelle erkennen das Satzende und den folgenden nächsten Tipp.

## Gezielte Anschlussbefunde

- s13 zu s15: Beide Modelle erkennen deine Hilfe an / Genau für die Dinge, in denen du richtig gut bist. Entfernung des Fehlansatzes s14 erzeugt keinen erkannten Satzabbruch.
- s34 ab 172,666667: Beide erkennen den Einstieg Die meisten. Kein erkannter Rest von Führungstrick.
- s42 ab 223,566667: Beide erkennen Der letzte Tipp ist organisatorisch. Kein erkannter Doppelanlauf.
- s47 zu s52: Beide erkennen den vollständigen Anschluss proaktiv und organisiert bist / und du wirkst dann einfach direkt professioneller.
- Kurzer Witz zur toxischen Beziehung bleibt erhalten. s38 ist ungeteilt.
- Erster Hook nun s00 statt s02, identischer Inhalt. Grund Blickrichtung stammt aus der Sichtprüfung des Planers. Ebenso beruht die Bewertung der Schlussgeste auf der Sichtprüfung des Planers, nicht auf einer eigenen Sichtung des Prüfers.

## Offene Gegenhörstellen

1. Rohzeit 226,83 bis 228,57: Pflichtschulungen. Roh-Turbo erkennt Pflichtschulungen, zusammengesetzte Nahtprüfungen liefern Pflichtstudien oder Pflichtschulen, small Flüchtlinge. Wichtige konkrete Handlung ohne alternative Fassung. Erhalten. Ursache der Erkennungsabweichung nicht eindeutig, kein bewiesener Schnittfehler.
2. Rohzeit 274,90 bis 275,68: Folge-Aufruf. Beide Modelle erkennen den erwarteten Ausdruck Folgen nicht eindeutig, unter anderem wollen nicht vergessen oder freue mich vergessen. Diese Unsicherheit besteht schon im Original. Erhalten, keine Sprachreparatur vorgenommen. Der behauptete Wortlaut kann ohne Gegenhören nicht bestätigt werden.

## Grenzen

Tatsächliche Hörprüfung: nicht durchgeführt. In dieser Sitzung ist kein Audio-Perception-Werkzeug verfügbar. ASR, Pegel und Wortvergleiche belegen keine natürliche Satzmelodie, keine subjektive Tonqualität und keine vollständige Wortverständlichkeit. Die zwei Stellen oben bleiben offen. Kein weiterer blockierender technischer Befund aus dieser Prüfung.

## Prüfdateien

- review/pruefer-naehte.json: 54 Nahtprüfungen der Erstfassung.
- review/pruefer-naehte-final.json: 55 Nähte der Endfassung mit Rohgrenzen und Modelltexten, an den finalen Plan per SHA-256 gebunden.
- review/pruefer-start-final.json: vollständiger finaler Hook und erster Anschluss.
- schnitt/tmp/pruefer-naehte/: ausschließlich kurze Prüf-WAVs, keine zweite Vollvideofassung.
