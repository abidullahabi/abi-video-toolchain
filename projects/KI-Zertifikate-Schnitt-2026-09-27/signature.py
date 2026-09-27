import json, statistics, sys
edl=json.load(open('edl.json')); keep=edl['keep']
g=json.load(open(sys.argv[1]))['candidates']
junc=[]; t=0
for k in keep[:-1]:
    t+=k['end']-k['start']; junc.append(t)
res=[]
for j in junc:
    m=[x for x in g if x['start']-0.10<=j<=x['end']+0.10]
    res.append(round(m[0]['duration']*1000) if m else 0)
band=sum(64<=r<=96 for r in res)
print('Anschluesse',len(res),'Median',statistics.median(res),'ms, im Band 64-96:',band,f'({100*band/len(res):.0f} %)')
print('unter 64:',[ (i,r) for i,r in enumerate(res) if r<64])
print('ueber 96:',[ (i,r) for i,r in enumerate(res) if r>96])
long=[x for x in g if x['duration']>0.16 and x['end']<g[-1]['start']]
print('Luecken >160 ms im ganzen Schnitt:',[(round(x['start'],2),round(x['duration']*1000)) for x in long])
json.dump({'junctionGapsMs':res,'median':statistics.median(res),'inBandShare':band/len(res),'longGaps':long},open(sys.argv[2],'w'),indent=1)
