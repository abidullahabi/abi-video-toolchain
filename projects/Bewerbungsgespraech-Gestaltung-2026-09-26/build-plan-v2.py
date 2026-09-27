#!/usr/bin/env python3
"""Schreibt theme-plan.json (ohne Untertitel; die setzt assemble-full-video.mjs) und caption-edit-plan.json.
Alle Zeiten in Sekunden der 1,1-fachen Fassung (media.mp4, v2 92,366 s; bis 85,0 s bildgleich zu v1), aus den Wortanfaengen der
Untertitelerkennung (word-alignment-turbo) abgelesen. Designwerte nach DESIGN.md 1.12.
"""
import json

DUR = 92.366
OUTRO = 85.5  # Karte steht ab 87,35 s genau 5,0 s (DESIGN.md 11.6)
H2_TOP = {72: 382, 66: 375, 60: 368, 56: 363}

sections = [
    {"id": "einstieg", "text": "Bewerbungsgespräch", "start": 0, "end": 14.86, "fontSize": 66},
    {"id": "vorab", "text": "Vorab: Spickzettel", "start": 14.86, "end": 29.37, "fontSize": 72},
    {"id": "punkt1", "text": "1. Selbstvorstellung", "start": 29.37, "end": 51.07, "fontSize": 72},
    {"id": "punkt2", "text": "2. Das Unternehmen", "start": 51.07, "end": 63.2, "fontSize": 72},
    {"id": "gegenueber", "text": "Dein Gesprächspartner", "start": 63.24, "end": 69.2, "fontSize": 66},
    {"id": "punkt3", "text": "3. Eigene Rückfragen", "start": 69.22, "end": 81.9, "fontSize": 72},
    {"id": "punkt4", "text": "4. Kritische Momente", "start": 81.91, "end": OUTRO, "fontSize": 72},
]

def h2(id, text, start, end, h1size=72, **kw):
    lines = text if isinstance(text, list) else [text]
    return {"id": id, "kind": "support", "lines": lines, "start": start, "end": end, "fontSize": 46, "top": H2_TOP[h1size], **kw}

overlays = [
    h2("vorbereiten-h2", "So bereitest du dich vor", 0, 6.35, 66),
    h2("vier-h2", "Immer dieselben 4 Dinge", 12.45, 14.8, 66),
    h2("app-h2", "Digital in einer App", 17.7, 21.8),
    h2("ueben-h2", "Vorher üben!", 34.7, 36.35, transitionOut="cut"),
    h2("minuten-h2", "3 bis 7 Minuten", 36.35, 38.3, transitionIn="cut"),
    h2("geschichte-h2", "Erzähl eine Geschichte", 49.15, 51.0),
    h2("machen-h2", "Was machen sie?", 52.6, 54.9, transitionOut="cut"),
    h2("werte-h2", "Welche Werte?", 54.9, 57.9, transitionIn="cut"),
    h2("passt-h2", "Warum passt du zu uns?", 58.3, 63.1),
    h2("linkedin-h2", "Auf LinkedIn stalken", 66.15, 69.1, 66),
    h2("fragen-h2", "Haben Sie noch Fragen?", 70.1, 72.1),
    h2("vorher-h2", "Vorher vorbereiten", 73.4, 75.2, transitionOut="cut"),
    h2("feedback-h2", "Feedbackkultur?", 75.2, 76.62, transitionIn="cut", transitionOut="cut"),
    h2("entwicklung-h2", "Entwicklung?", 76.62, 78.24, transitionIn="cut", transitionOut="cut"),
    h2("fehler-h2", "Fehlerkultur?", 78.24, 79.55, transitionIn="cut", transitionOut="cut"),
    h2("alltag-h2", "Konkret: Arbeitsalltag", 79.55, 81.85, transitionIn="cut"),
]

def note(id, left, items, end):
    """Liste im freien Raum ueber dem Kopf: jede Zeile erscheint mit dem gesprochenen Wort und ist
    blau, solange Abdullah sie nennt (DESIGN.md 9a Hervorhebung)."""
    lines = []
    for i, (text, at) in enumerate(items):
        nxt = items[i + 1][1] if i + 1 < len(items) else None
        lines.append({"text": text, "at": at, "active": [[at, nxt if nxt else min(end, at + 1.2)]]})
    return {"id": id, "start": items[0][1], "end": end, "left": left, "top": 390, "lines": lines}

# Spickzettel: sechs Angaben als 3x2-Raster (links x = 150, rechts x = 520), Kopf ab y ~ 670.
spick_end = 29.3
spick_l = note("spick-a", 150, [("Unternehmen", 23.42), ("Stelle", 24.08), ("Gehaltsangabe", 25.2)], spick_end)
spick_r = note("spick-b", 520, [("Gesprächspartner", 26.5), ("Abteilung", 27.72), ("Welcher CV", 28.47)], spick_end)
spick_l["lines"][-1]["active"] = [[25.2, 26.5]]
spick_r["start"] = spick_l["start"]  # beide Spalten gehoeren zu einer Liste
# Die rechte Spalte ist bis zu ihrem ersten Punkt unsichtbar (Zeilen starten bei Deckkraft 0).
selbst_l = note("selbst-a", 150, [("Werdegang", 38.46), ("Projekte", 39.69), ("Uni", 40.64)], 46.35)
selbst_l["lines"][-1]["active"] = [[40.64, 41.4]]
selbst_r = note("selbst-b", 500, [("Warum die Stelle?", 43.46), ("Warum die Firma?", 44.25), ("Wohin willst du?", 45.66)], 46.35)
selbst_r["lines"][-1]["active"] = [[45.66, 46.3]]
selbst_r["start"] = 38.46
notes = [spick_l, spick_r, selbst_l, selbst_r]

bigwords = [
    {"id": "aundo-big", "text": "A UND O", "start": 7.3, "end": 8.4, "fontSize": 150},
    {"id": "freestyle-big", "text": "FREESTYLEN", "start": 33.85, "end": 34.7, "fontSize": 96, "strikeAt": 34.2},
    {"id": "immerja-big", "text": "IMMER JA!", "start": 72.2, "end": 73.3, "fontSize": 124},
]

# Schnittpunkte der 1,1-Fassung (edl-plan.json des Schnittprojekts): Rueckspruenge nur dort.
zooms = [
    {"start": 7.3, "end": 8.4, "scale": 1.12, "punch": True},
    {"start": 8.4, "end": 10.091, "scale": 1.05},
    {"start": 10.091, "end": 14.879, "scale": 1.07},
    {"start": 16.939, "end": 20.606, "scale": 1.06},
    {"start": 20.606, "end": 27.455, "scale": 1.07},
    {"start": 29.333, "end": 32.879, "scale": 1.06},
    {"start": 33.85, "end": 34.7, "scale": 1.12, "punch": True},
    {"start": 35.545, "end": 41.485, "scale": 1.07},
    {"start": 41.485, "end": 45.121, "scale": 1.05},
    {"start": 46.455, "end": 51.121, "scale": 1.07},
    {"start": 51.121, "end": 54.576, "scale": 1.06},
    {"start": 55.848, "end": 59.394, "scale": 1.07},
    {"start": 60.909, "end": 63.242, "scale": 1.05},
    {"start": 63.242, "end": 69.091, "scale": 1.08},
    {"start": 69.091, "end": 72.061, "scale": 1.06},
    {"start": 72.2, "end": 73.242, "scale": 1.12, "punch": True},
    {"start": 73.242, "end": 75.273, "scale": 1.05},
    {"start": 75.273, "end": 78.364, "scale": 1.07},
    {"start": 78.364, "end": 81.939, "scale": 1.06},
    {"start": 81.939, "end": 85.0, "scale": 1.06},
    {"start": 85.0, "end": 89.425, "scale": 1.05},
    {"start": 89.425, "end": DUR, "scale": 1.06},
]
for z in zooms:
    z["origin"] = "42% 28%"

plan = {
    "designVersion": "1.12",
    "title": "Bewerbungsgespräch vorbereiten",
    "duration": DUR,
    "h1Background": "#1668b5",
    "captionAccent": "#5eb3f5",
    "captionFontSize": 56,
    "captionTop": 1280,
    "captionMaxWords": 4,
    "captionMaxWidth": 620,
    "captionPlacementRanges": [{"start": 0, "end": 46.455, "top": 1304, "basis": "DESIGN.md 7: bei naher, tiefer Einstellung darf die Zeile etwas tiefer sitzen. Kinn bis y = 1307 (25,5 / 34,0 / 43,5 s); Wechsel auf 1280 am Schnitt 46,455 s, danach sitzt der Kopf höher."}],
    "sections": sections,
    "overlays": overlays,
    "notes": notes,
    "bigwords": bigwords,
    "bars": [],
    "zooms": zooms,
    "zoomException": True,
    "zoomBasis": "Abdullah am 26.09.2026: „gerne schon die Zoom-Effekte mit verwenden“ (wie bei Angst vor Arbeiten: langsame Fahrten 5-8 % über 2-7 s, Rücksprung an den Schnitten, harte Punch-ins 12 % auf die drei Schlagwörter). 0-6,1 s ohne Zoom, weil Abis Vorschnitt dort schon einen eigenen Punch-in bei 3,06 s enthält.",
    "neueElemente": "Schlagwort (bigwords) und Randnotiz-Liste als 3x2-Raster über dem Kopf. Kopf sitzt in dieser Aufnahme mittig; neben dem Kopf bleiben nur ~200 px, darüber ~280 px ruhige Wand (DESIGN.md 13).",
    "logos": [
        {"id": "notizapps-logo", "start": 19.5, "end": 21.6, "top": 250, "gap": 28,
         "items": [{"src": "assets/logo-notion.png", "width": 108, "height": 112, "alt": "Notion"},
                   {"src": "assets/logo-onenote.png", "width": 112, "height": 112, "alt": "Microsoft OneNote"}],
         "basis": "gesprochen „Notion oder OneNote“ (19,59 / 20,14 s)"},
        {"id": "linkedin-logo", "start": 66.1, "end": 67.9, "top": 250,
         "items": [{"src": "assets/logo-linkedin.png", "width": 132, "height": 112, "alt": "LinkedIn"}],
         "basis": "gesprochen „auf LinkedIn“ (66,22 s)"},
    ],
    "logosHerkunft": "assets/logos.json (Notion Media Kit, Microsoft Office Brand Icons CDN, LinkedIn Brand Downloads); Auftrag Abdullah 26.09.2026",
    "bubbles": [],
    "bubblesGrund": "Keine Aufforderung zu Kommentar oder DM gesprochen (DESIGN.md 0).",
    "outro": {"start": OUTRO, "end": DUR, "followers": 4254, "target": 10000,
              "followersSource": "Zernio accounts_get_follower_stats, TikTok @abidullahabi (6aa6efb9726ebfe037e60cc6), currentFollowers 4254, Datenstand 2026-09-26T05:56:52Z, abgerufen am 26.09.2026 vor dem Bau",
              "standzeitHinweis": "v2: Ende auf Abdullahs Wunsch länger; Karte ab 85,5 s, steht ab 87,35 s genau 5,0 s."},
}
json.dump(plan, open("theme-plan.json", "w"), ensure_ascii=False, indent=2)

edits = {"replaceFromReview": [], "corrections": [
    {"from": 1.2, "to": 1.9, "before": "wurde", "after": "wurdest du", "basis": "Erkennungsdurchgang auf der Quelle (ohne DTW) liest „jetzt wurdest du zum Bewerbungsgespräch“; Satzbau. Gesprochen verschliffen."},
    {"from": 11.9, "to": 12.4, "before": "demselben", "after": "denselben", "basis": "Erster Erkennungsdurchgang auf der Quelle: „denselben“; Satzbau (mit denselben vier Dingen)."},
    {"from": 24.1, "to": 24.4, "before": "du", "after": "du dich", "basis": "Beide Erkennungsdurchgänge auf der Quelle: „auf welche Stelle du dich beworben hast“."},
    {"from": 30.8, "to": 31.2, "before": "Fragen", "after": "Frage", "basis": "Satzbau „wird immer die Frage kommen“; Lesart „Fragen“ in allen Durchgängen, Endung vermutlich Bindung zu „kommen“. Mildes Glätten, Originaltranskript unverändert."},
    {"from": 49.0, "to": 49.45, "before": "antworte", "after": "antwortest du", "basis": "Beide Erkennungsdurchgänge auf der Quelle: „antwortest du am besten mit einer Geschichte“."},
    {"from": 71.2, "to": 71.45, "before": "sie", "after": "Sie", "basis": "Höflichkeitsform in der zitierten Frage „Haben Sie noch Fragen?“."},
    {"from": 72.9, "to": 73.2, "before": "ja", "after": "ja.", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 73.2, "to": 73.5, "before": "und", "after": "Und", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 75.0, "to": 75.3, "before": "vor", "after": "vor.", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 76.5, "to": 76.7, "before": "aus,", "after": "aus?", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 76.7, "to": 76.9, "before": "welche", "after": "Welche", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 78.05, "to": 78.3, "before": "man,", "after": "man?", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 78.35, "to": 78.55, "before": "wie", "after": "Wie", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 79.4, "to": 79.6, "before": "aus,", "after": "aus?", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 79.6, "to": 79.8, "before": "also", "after": "Also", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 81.7, "to": 81.95, "before": "fragen", "after": "fragen.", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 84.8, "to": 85.0, "before": "vor,", "after": "vor.", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 85.0, "to": 85.2, "before": "die", "after": "Die", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 88.7, "to": 89.0, "before": "bist", "after": "bist.", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 89.9, "to": 90.2, "before": "natürlich", "after": "natürlich:", "basis": "Satzzeichen wie im Untertiteldurchgang v1 derselben Stelle (bildgleich); der v2-Durchgang setzte hier keine Satzenden."},
    {"from": 90.5, "to": 90.7, "before": "voll", "after": "Folgen", "basis": "Abis fester Abschluss „Folgen nicht vergessen“; Whisper hört in allen Durchgängen „voll“."},
    {"from": 90.9, "to": 91.2, "before": "vergessen", "after": "vergessen.", "basis": "Satzende."},
]}
json.dump(edits, open("caption-edit-plan.json", "w"), ensure_ascii=False, indent=2)
print("ok")
