# ABI Video-Toolchain: Wegweiser für Claude und Codex

Dieser Text steht wortgleich in `CLAUDE.md` (liest Claude Code) und `AGENTS.md` (liest Codex). Wer ihn ändert, ändert beide Dateien im selben Commit.

**Sprache Deutsch.** Abdullah soll keine technischen Befehle selbst eingeben müssen.

## Orte

| Was | Wo |
|---|---|
| Werkzeuge, Vorlagen, Projekte (dieses Repo) | `/Users/abi/Projekte/abi-video-toolchain`, Git-Remote `github.com/abidullahabi/abi-video-toolchain` (privat) |
| Alter Pfad, nur noch Verweis | `~/.codex/.chatgpt-projects/g-p-6aa14d0e0a2c8191a0b34dc2c8f4b18f/content-workflow` ist ein Symlink auf dieses Repo, damit alte absolute Pfade in Projektdateien weiter stimmen. Der Stand vor dem Umzug liegt daneben in `content-workflow.vor-umzug-2026-09-27`. Neue Pfade immer mit dem neuen Ort schreiben. |
| Videoablage und maßgebliche Anleitung | `/Users/abi/Library/CloudStorage/GoogleDrive-abdullahbachtari@gmail.com/Meine Ablage/50_Projekte/Social Media` |

Lege keine Projektordner in Google Drive an. Render- und Zwischendateien bleiben in `projects/`.

## Maßgeblich sind zwei Dateien im Drive-Ordner `Social Media/80_Anleitung`

- `CONTENT_WORKFLOW.md`: Verfahren, harte Regeln, Export, Ablage, Posting. **Lies sie vor jeder Arbeit an einem Video.** Die harten Regeln stehen gleich am Anfang.
- `DESIGN.md`: allein maßgeblich für das Aussehen. Lies sie vor jeder Gestaltung.

Diese Datei enthält **keine eigenen Gestaltungswerte** und keine Regeln, die dort schon stehen. Bei Widersprüchen gelten `CONTENT_WORKFLOW.md` und `DESIGN.md`. Die Arbeitsanleitung nennt an manchen Stellen „Codex“ als ausführenden Agenten; das ist eine Rollenbezeichnung und meint die jeweils arbeitende KI.

## Zwei KIs nebeneinander

### Pro Video

1. Vor Beginn: `node pruefungen.mjs kollision "<Quelldatei>"`. Meldet die Prüfung eine laufende Bearbeitung, nicht anfangen und Abdullah fragen.
2. Direkt danach in `projects/<Projekt>/workflow.json` eintragen:
   `"bearbeitung": {"agent": "claude" | "codex", "aufgabe": "<kurz>", "begonnen": "<ISO-Zeit>", "status": "in_arbeit"}`
3. Am Ende `bearbeitung.status` setzen: `"fertig"`, `"angehalten"` (mit Stand) oder `"abgebrochen"`.

### Werkzeugcode (alles außerhalb von `projects/`)

1. Vor jeder Änderung `werkzeug-status.json` lesen. Steht dort `"status": "in_arbeit"` mit einem anderen `agent`, nichts ändern und Abdullah fragen.
2. Dann setzen: `{"status": "in_arbeit", "agent": "claude" | "codex", "zweig": "<Zweig>", "seit": "<ISO-Zeit>", "aufgabe": "<kurz>"}`. Nach Abschluss `"status": "frei"` mit Agent, Zweig und Zeit. Die Datei wird **nie gelöscht**, nur überschrieben.
3. Geändert wird auf einem eigenen Zweig: `claude/<thema>` oder `codex/<thema>`, **in einem eigenen Arbeitsordner**: `git worktree add ../abi-video-toolchain-<thema> -b claude/<thema>`. Der Hauptordner `~/Projekte/abi-video-toolchain` bleibt auf `main`, denn dort laufen die Videos der anderen Sitzungen. `tools`, `node_modules` und `analysis` im Arbeitsordner sind Verweise auf den Hauptordner. Videoprojekte bleiben im gemeinsamen `projects/` des Hauptordners; die Werkzeuge im Arbeitsordner lesen und schreiben dort.
4. In `main` kommt eine Änderung erst nach bestandenem Test und **nur, solange kein Render läuft** (Render-Sperre `mitRenderSperre` in `projekte.mjs`, Abdullah 06.11.2026). Offene `bearbeitung.status: "in_arbeit"` sperren das Werkzeug nicht mehr; die Warnung bei zwei Sitzungen am selben Rohvideo (`pruefungen.mjs kollision`) bleibt. Den Test im Commit nennen. Danach kann der Arbeitsordner geschlossen werden (`git worktree remove`, nur wenn alles committet ist; Abdullah entscheidet, wie bei jeder Löschung).
5. **Arbeitskopie kurz halten:** Videos laufen immer aus dem Hauptordner auf `main`. Ein Arbeitsordner entsteht nur für eine Änderung am Werkzeug und wird nach dem Test noch am selben Tag zurückgeführt.

### Sichern

Nach jedem fertigen Video und nach jeder Werkzeugänderung: `git add <eigene Pfade>`, `git commit`, `git push`. Nie `git add -A`: Mehrere Sitzungen schreiben im selben Repo, sonst landet fremde, laufende Arbeit im eigenen Commit (passiert am 27.09.2026). Was versioniert wird, regelt `.gitignore` (Skripte, Vorlagen, Plan- und Wortdaten; keine Medien, Modelle, Binaries, Caches).

## Vorlagen und Designversion

`workflow.json` jedes Projekts nennt `designVersion`. `render-html` wählt danach Vorlage und Layoutprüfung. Alte Projekte behalten ihre Vorlage; ein neues Projekt bekommt die Version, die in `DESIGN.md` gerade gilt.

| designVersion | Vorlage | Prüfung |
|---|---|---|
| 2.2 | `theme-composition-design22.mjs` | `check-design22.mjs` |
| 1.11, 1.12 | `theme-composition-design111.mjs` | `check-design111.mjs` |
| 1.9 | `theme-composition-design19.mjs` | `check-design19.mjs` |
| ohne | `theme-composition.mjs` | `check-theme-layout.mjs` |

Schriften liegen in `templates/fonts/`, Modelle in `tools/models/` mit Herkunftsdatei und Prüfsumme (`*provenance*.json`).

## Schutzprüfungen

```
node pruefungen.mjs kollision    "<Quelldatei>"      # arbeitet eine andere Sitzung daran?
node pruefungen.mjs auslieferung "<Projektordner>"   # liegt ein sauberer Gestaltungsbericht vor?
node workflow.mjs doctor                             # Werkzeuge und Modelle vorhanden?
node toolstack.mjs pruefen                           # Werkzeugversionen, Updates, Abstürze (Herkunft und Update-Verfahren: toolstack.json)
```

Referenzprojekte aus `CONTENT_WORKFLOW.md` Abschnitt 12 nie ändern und nie darüber rendern.

## Frühere Fassungen

`revisions/CLAUDE.vor-regelumzug-2026-09-16.md`, `revisions/CLAUDE.vor-zwei-ki-regeln-2026-09-27.md` und `revisions/AGENTS.vor-zwei-ki-regeln-2026-09-27.md`. Sie gelten nicht mehr.

## Videoproduktion

Für einen kompletten Durchlauf von der Rohaufnahme bis zur Einplanung: `/video` (Claude Code) bzw. `ABLAUF_KURZ.md`. Ziel: 60 s Video in etwa 20 min für KI und Rechner, höchstens 30 min.

Kurz die Regeln aus `ABLAUF_KURZ.md` Abschnitt 0, die für jede KI gelten:

- Lesen: nur `ABLAUF_KURZ.md` und `DESIGN.md`; `CONTENT_WORKFLOW.md` nur bei Unklarheit. Kontaktblätter statt Serien von Einzelbildern.
- Planung: ein Planer, dann ein Prüfer. Keine Agentenschwärme.
- Zeitbudget je Schritt. Doppelt überschritten oder Fehlersuche über 10 min: anhalten und Abdullah kurz melden.
- Eingeplant wird nie vor Abdullahs OK. Seine Rückmeldung gesammelt in einer Nachricht erbitten.
- Vor jedem Render den freien Arbeitsspeicher prüfen (das Werkzeug tut es); reicht er nicht für zwei Prozesse, Abdullah bitten, Programme zu schließen.
- Löschbares nur nach ~/Löschbar. Keine anderen Löschordner, keine Fristen. INHALT.md dort aktuell halten.
- Rendern und Exportieren laufen unter einer rechnerweiten Render-Sperre (`~/Library/Caches/abi-video-toolchain/render-sperre`): immer nur ein Render gleichzeitig, auch über Sitzungen und Arbeitsordner hinweg. Wartet ein Befehl auf die Sperre, sagt er, auf wen.
