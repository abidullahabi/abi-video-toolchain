# Referenzen für DESIGN.md 2.2 („Klar mit Kante")

Maßgeblich bleibt allein `DESIGN.md` im Drive-Ordner `Content_Creation/Anleitung`. Diese Dateien zeigen nur, wie die abgenommenen Entwürfe technisch gebaut waren.

| Datei | Inhalt |
|---|---|
| `animationen/index.html` | Von Abdullah am 27.09.2026 abgenommene Animationen aller Elemente, als CSS-Keyframes mit den Kurven und Zeiten aus DESIGN.md Abschnitt 15. Das Durchstreichen wird per JS auf die echte Textbreite gesetzt (`fitStrikes()`). |
| `canvas-frames-gen5.py` | Erzeugt die abgenommenen Standbilder (Runde 5). Enthält das CSS jedes Elements: Einstieg, Kapitel, Pillen, Akronym, Schlagwort, Grafik, Randnotiz, Sprechblase, Outro. |
| `rvm_mobilenetv3_fp32.onnx` | Robust Video Matting v1.0.0, github.com/PeterL1n/RobustVideoMatting, Lizenz GPL-3.0. SHA-256 `88d4531297118f595bf2fd60f6f566aec2e559393802d1f436c380f0cbbd2828`. Gehört nach `tools/models/`. |

Robust Video Matting mit onnxruntime: Eingänge `src` (1×3×H×W, 0 bis 1), `r1i` bis `r4i` (Startwert Nullen, danach die Ausgänge `r1o` bis `r4o` des Vorbilds weiterreichen) und `downsample_ratio` 0,25. Ausgänge `fgr`, `pha` und die vier Zustände. Einen Zustand über den ganzen Abschnitt führen, 20 Bilder Vorlauf. Mit diesen Werten entstand Variante C im Vergleich `Claude outputs/Branding/Testvideo/2026-09-27 - Green-Screen-Vergleich.mp4`.

Schriften liegen in `templates/fonts/`: Archivo als variable Schrift (Achsen wght 100 bis 900, wdth 62 bis 125, Version 2.001) und Gochi Hand 1.001, beide SIL OFL, Quelle Google Fonts. Die OFL-Datei von Archivo fehlt noch und muss aus dem Google-Fonts-Paket ergänzt werden.

Testvideo mit dem Design von heute: `Claude outputs/Branding/Testvideo/2026-09-27 - Fast 30 Lektionen - Branding-Test.mp4` im Ordner Social Media.
