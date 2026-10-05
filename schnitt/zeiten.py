"""Zeitumrechnung zwischen zwei Schnittfassungen (Schnittzeit alt → Rohzeit → Schnittzeit neu), gemeinsam für
umstellen.py und kurzpruefungen-neu.py (vorher dreifach kopiert, Vorbild Bücher die so gut sind wie Therapie 04.10.2026).
Plan- und Wortzeiten stehen in der Zeit von media.mp4, also nach dem Tempo: Schnittzeit = Zeit · Tempo."""
import json, math, os

FPS = 30
def R(v): return math.floor(v * FPS + 0.5) / FPS   # wie vorbereiten.mjs (Math.round auf 1/30 s)

def lade(projekt):
    """alt aus schnitt/vorher.json (mit Tempo), neu aus schnitt.json und workflow.json "tempo"."""
    v = json.load(open(os.path.join(projekt, 'schnitt/vorher.json')))
    meta = json.load(open(os.path.join(projekt, 'workflow.json')))
    neu = json.load(open(os.path.join(projekt, 'schnitt.json')))
    return Umrechnung(v['behalten'], float(v.get('tempo', 1)), neu['behalten'], float(meta.get('tempo', 1)))

class Umrechnung:
    def __init__(self, alt, tempo_alt, neu, tempo_neu):
        self.alt = [[R(a), R(b)] for a, b in alt]; self.neu = [[R(a), R(b)] for a, b in neu]
        self.ta, self.tn = tempo_alt, tempo_neu
    def roh(self, t):   # Planzeit alt → Rohzeit
        t = t * self.ta; c = 0
        for a, b in self.alt:
            if t <= c + (b - a) + 1e-9: return a + (t - c)
            c += b - a
        return self.alt[-1][1]
    def drin(self, r): return any(a - 1e-6 <= r <= b + 1e-6 for a, b in self.neu)
    def schnitt(self, r):   # Rohzeit → Schnittzeit neu (Tempo 1); herausgeschnitten: Anfang des nächsten Stücks
        c = 0
        for a, b in self.neu:
            if r < a: return c
            if r <= b: return c + (r - a)
            c += b - a
        return c
    def um(self, t): return round(self.schnitt(self.roh(t)) / self.tn, 2)
