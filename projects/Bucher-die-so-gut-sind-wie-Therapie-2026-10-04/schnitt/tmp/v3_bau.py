#!/usr/bin/env python3
# Baut selection.json v3 aus tmp/selection-v2-planer.json + Bereichsliste (nur Zeiten/Flags/Text), warum/entfernt werden spaeter ergaenzt
import json, sys, copy
D='/Users/abi/Projekte/abi-video-toolchain/projects/Bucher-die-so-gut-sind-wie-Therapie-2026-10-04/schnitt'
v2=json.load(open(f'{D}/tmp/selection-v2-planer.json'))
spec=json.load(open(f'{D}/tmp/v3_spec.json'))
old={r['id']:r for r in v2['ranges']}
rs=[]
for s in spec['ranges']:
    r=copy.deepcopy(old.get(s.get('von', s['id']), {}))
    for k in ('hardStart','hardEnd','keepInner','endHold'):
        r.pop(k,None)
    r.update({k:v for k,v in s.items() if k!='von'})
    rs.append(r)
v3=copy.deepcopy(v2); v3['ranges']=rs
v3['entfernt']=v2['entfernt']+spec.get('entfernt',[])
v3['entfernt'].sort(key=lambda e:e['von'])
if 'gegenhoeren' in spec: v3['gegenhoeren']=spec['gegenhoeren']
if 'hinweise' in spec: v3['hinweise']=spec['hinweise']
if 'fassung' in spec: v3['fassung']=spec['fassung']
prev=0
for r in rs:
    assert r['a']<r['b'] and r['a']>=prev, r['id']; prev=r['b']
json.dump(v3,open(f'{D}/selection.json','w'),indent=1,ensure_ascii=False)
print('Bereiche',len(rs))
