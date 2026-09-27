#!/usr/bin/env python3
"""Wandelt eine Clip-Anordnung (pieces mit clip/fromSeg/toSeg/from/to) in das EDL-Format von
storyline/build-storyline.py um. Aufruf: python3 plan-to-edl.py plan.json ../storyline/edl-NAME.json"""
import json
import sys

plan = json.load(open(sys.argv[1]))
plan = plan.get('final', plan)
items = []
for p in plan['pieces']:
    for s in range(p['fromSeg'], p['toSeg'] + 1):
        items.append({'seg': s,
                      'from': p['from'] if s == p['fromSeg'] else 'start',
                      'to': p['to'] if s == p['toSeg'] else 'end',
                      'text': p['text'] if s == p['fromSeg'] else '',
                      'clip': p['clip']})
json.dump({'sections': [{'name': 'Abdullahs Auswahl, neu geordnet', 'items': items, 'dropped': []}],
           'removed': plan.get('removed', []), 'changes': plan.get('changes', [])},
          open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
print(len(plan['pieces']), 'Teile,', len(items), 'Abschnitte')
