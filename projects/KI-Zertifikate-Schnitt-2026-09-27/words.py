import json,sys
def load_words(path, offset):
    j=json.load(open(path)); words=[]
    for seg in j['transcription']:
        for t in seg['tokens']:
            tx=t['text']
            if tx.startswith('[_') : continue
            tt=offset+t['t_dtw']/100 if t['t_dtw']>=0 else None
            if tx.startswith(' ') or not words:
                words.append({'w':tx.strip(),'t':tt,'p':t['p'],'a':offset+t['offsets']['from']/1000,'b':offset+t['offsets']['to']/1000})
            else:
                words[-1]['w']+=tx; words[-1]['p']=min(words[-1]['p'],t['p']); words[-1]['b']=offset+t['offsets']['to']/1000
    return words
