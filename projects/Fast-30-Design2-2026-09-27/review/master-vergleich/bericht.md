# Textkanten: JPEG-Master (MP4) gegen verlustfreie Aufnahme (entspricht dem ProRes-Weg) — 27.09.2026

Tempo-Auftrag Punkt 3b. Referenz: verlustfreie Browseraufnahme (PNG) derselben Bilder, so wie der ProRes-Weg sie speichert.
Verglichen: JPEG-Master `exports/final-2026-09-27T15-49-00-047Z.mp4` (HyperFrames: JPEG q80, x264 CRF 15) und die daraus erzeugte Upload-Datei `Fast-30_v1.mp4` (11,45 Mbit/s).

| Zeit | Ausschnitt | SSIM JPEG-Master | SSIM Upload |
|---|---|---|---|
| 0,5 s | H1/H2 Einstieg | 0,926 | 0,921 |
| 53,5 s | Kapitel, Pillen, H2 | 0,953 | 0,947 |
| 197,5 s | untere Bildhälfte | 0,971 | 0,965 |

Die Zahlen sind durch das Hintergrundvideo verfälscht (Browser-Dekodierung gegen HyperFrames-Extraktion, BT.601-Kodierung des Masters) und nicht als Textmaß zu lesen.
Maßgeblich ist die Sichtprüfung `zoom-0.5.png` (3-fach, Punkt für Punkt; oben verlustfrei, Mitte JPEG-Master, unten Upload): Die Kanten der H1 mit 8-px-Kontur sind in Originalgröße nicht unterscheidbar, bei 3-facher Vergrößerung minimal weicher.

**Entscheidung:** `renderMaster: "mp4"` für Design 2.2. Spart gegenüber ProRes rund die Hälfte der Renderzeit (ProRes gestern 263 ms/Bild, heute MP4 137 ms/Bild mit 1 Prozess) und 8,9 GB Masterdatei je Fassung. Endgültig bestätigt, wenn Abdullah den Test auf dem Handy ansieht (DESIGN.md 20 Punkt 12).
