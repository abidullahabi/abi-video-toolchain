"""Kalibriert jeden Anschluss einzeln nach der Silero-Messung des Schnitts (Abschnitt 5:
schneiden, messen, nachjustieren). Schreibt adjust.json (Zusatz je Stueckkante in Sekunden)."""
import json, sys
FR = 1/30
edl = json.load(open('edl.json')); sig = json.load(open(sys.argv[1]))
sel = {r['id']: r for r in json.load(open('selection.json'))['ranges']}
adj = json.load(open('adjust.json')) if len(sys.argv) < 3 else {'lead': {}, 'tail': {}}
p = edl['pieces']
for j, m in enumerate(sig['junctionGapsMs']):
    a, b = p[j], p[j+1]
    lead = a['end'] - a['speech'][1]; tail = b['speech'][0] - b['start']
    hardA = sel[a['range']].get('hardEnd') and abs(a['end'] - sel[a['range']]['b']) < 1e-3
    hardB = sel[b['range']].get('hardStart') and abs(b['start'] - sel[b['range']]['a']) < 1e-3
    L, T = str(j), str(j+1)
    if m < 64:
        if not hardB and (hardA or tail <= lead + 0.015): adj['tail'][T] = adj['tail'].get(T, 0) + FR
        elif not hardA: adj['lead'][L] = adj['lead'].get(L, 0) + FR
    elif m > 96:
        if tail - FR >= 0.040 and not hardB and tail >= lead: adj['tail'][T] = adj['tail'].get(T, 0) - FR
        elif lead - FR >= 0.024 and not hardA: adj['lead'][L] = adj['lead'].get(L, 0) - FR
        elif tail - FR >= 0.040 and not hardB: adj['tail'][T] = adj['tail'].get(T, 0) - FR
json.dump(adj, open('adjust.json', 'w'), indent=1)
print('lead', {k: round(v, 3) for k, v in adj['lead'].items() if abs(v) > 1e-6})
print('tail', {k: round(v, 3) for k, v in adj['tail'].items() if abs(v) > 1e-6})
