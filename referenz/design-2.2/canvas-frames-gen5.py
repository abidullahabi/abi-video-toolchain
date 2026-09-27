import json, os
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'canvas','project')
BLAU='#5EAAEE'; PINK='#FF8AC2'; TINTE='#111111'; OFF='#F6F1E9'
FONTLINK='<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&amp;family=Gochi+Hand&amp;display=swap" rel="stylesheet">'
KIDPATH="M 156 30 C 122 8, 58 14, 30 50 C 4 84, 18 146, 76 166 C 126 184, 204 168, 218 116 C 228 74, 202 32, 150 22 C 114 16, 78 22, 56 38 C 48 44, 42 52, 40 60"
KIDPROPS=None
KIDLOGIC=None
NOLOGIC="""class Component extends DCLogic {
  renderVals() {
    return {};
  }
}"""
def page(title, body, props=None, logic=NOLOGIC, w=1080, h=1920):
    logic=logic or NOLOGIC
    dp=dict(props or {}); dp["$preview"]={"width":w,"height":h}
    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTLINK}
<style>
body{{margin:0}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(dp,ensure_ascii=False)}'>
{logic}
</script>
</body>
</html>
"""
def frame(img, inner, bg=TINTE, imgstyle=''):
    im=f'  <img src="/_blob/{img}" alt="" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover{imgstyle}">\n' if img else ''
    return f'<div style="position: relative; width: 1080px; height: 1920px; overflow: hidden; background: {bg}; font-family: \'Archivo\', sans-serif">\n{im}{inner}</div>'
def stroke(px): return f'-webkit-text-stroke: {px}px {TINTE}; paint-order: stroke fill'
def subtitle(pre, hit, post=''):
    p=(pre+' ') if pre else ''; q=(' '+post) if post else ''
    return f'  <div style="position: absolute; left: 0; top: 1280px; width: 1080px; text-align: center; font-size: 64px; font-weight: 800; line-height: 1.12; color: #FFFFFF; {stroke(12)}">{p}<span style="color: {BLAU}">{hit}</span>{q}</div>\n'
def kidnum(num, font="Gochi Hand", weight="400", size=140):
    return f'''<div style="font-family: '{font}', cursive; font-weight: {weight}; font-size: {size}px; line-height: 1; color: {BLAU}; {stroke(14)}; transform: rotate(-4deg); flex-shrink: 0">{num}</div>'''
def heading(title, num=None, **kw):
    n=(kidnum(num,**kw)+'\n    ') if num else ''
    g=28 if num else 0
    return f'''<div style="display: flex; justify-content: center; align-items: center; gap: {g}px">
    {n}<div style="font-weight: 900; font-size: 64px; line-height: 1.1; word-spacing: 6px; color: #FFFFFF; {stroke(12)}">{title}</div>
  </div>'''
def topblock(inner, top=270, gap=30):
    return f'  <div style="position: absolute; left: 0; top: {top}px; width: 1080px; display: flex; flex-direction: column; align-items: center; gap: {gap}px">\n  {inner}\n  </div>\n'
def chip(label, mark=None, kid=True, dx=0, rot=0, size=54):
    if mark is None:
        dot=f'<div style="width: 26px; height: 26px; margin: 0 6px 0 10px; box-sizing: border-box; border-radius: 50%; background: {BLAU}; border: 3px solid {TINTE}; flex-shrink: 0"></div>'
        pad='8px 32px 10px 14px'
    else:
        ff="font-family: 'Gochi Hand', cursive; font-weight: 400; font-size: 48px" if kid else "font-weight: 900; font-size: 28px"
        dot=f'<div style="width: 56px; height: 56px; box-sizing: border-box; border-radius: 50%; background: {BLAU}; border: 3px solid {TINTE}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; {ff}; line-height: 1; color: {TINTE}">{mark}</div>'
        pad='8px 32px 10px 12px'
    return f'''<div style="display: flex; align-items: center; gap: 14px; padding: {pad}; border-radius: 999px; border: 5px solid #FFFFFF; box-shadow: 0 0 0 3px {TINTE}, inset 0 0 0 3px {TINTE}; transform: translateX({dx}px) rotate({rot}deg)">
        {dot}
        <div style="font-weight: 800; font-size: {size}px; line-height: 1.1; color: #FFFFFF; {stroke(10)}">{label}</div>
      </div>'''
def chips_v(items, gap=18):
    return f'<div style="display: flex; flex-direction: column; align-items: center; gap: {gap}px">\n      ' + '\n      '.join(items) + '\n    </div>'
def chips_h(labels, size=42):
    cs=[f'<div style="padding: 6px 24px 8px; border-radius: 999px; border: 5px solid #FFFFFF; box-shadow: 0 0 0 3px {TINTE}, inset 0 0 0 3px {TINTE}; font-weight: 800; font-size: {size}px; line-height: 1.1; color: #FFFFFF; {stroke(9)}; transform: rotate({r}deg)">{l}</div>' for l,r in zip(labels,[-2,1.5,-1,2])]
    return '<div style="display: flex; justify-content: center; gap: 16px">\n      ' + '\n      '.join(cs) + '\n    </div>'
def h1(lines, size, stroke_px=16):
    ls=''.join(f'<div>{l}</div>' for l in lines)
    return f'<div style="display: flex; flex-direction: column; align-items: center; font-weight: 900; font-stretch: 125%; font-size: {size}px; line-height: 1.02; color: #FFFFFF; {stroke(stroke_px)}">{ls}</div>'
def h2marker(lines, size=58, kontur=False):
    ls=''.join(f'<div>{l}</div>' for l in lines)
    ks=(' '+stroke(10)) if kontur else ''
    return f'<div style="display: flex; flex-direction: column; align-items: center; padding: 8px 28px 14px; border-radius: 12px; background: {BLAU}; transform: rotate(-2deg); font-weight: 800; font-size: {size}px; line-height: 1.12; color: #FFFFFF;{ks}">{ls}</div>'

FILES={}
kp=KIDPROPS
# F1 Einstieg
FILES['G1_Einstieg']=page('G · Einstieg', frame('908c199cabbf78a1b63913c89c9048fc',
    topblock(h1(['FAST 30'],156)+'\n    '+h2marker(['10 Lektionen für','mein 20-jähriges Ich']), top=250, gap=24)
    + subtitle('erwachsen','werden','in')))
# F2 Kapitel
FILES['G2_Kapitel']=page('G · Kapitel', frame('9190b55dc6b90ecf8fa87e6f1df20744',
    topblock(heading('Keiner rettet dich','6.'), top=300) + subtitle('dass','jemand','kommt')), kp, KIDLOGIC)
# F5 Aufzaehlung
FILES['G5_Aufzaehlung']=page('G · Aufzählung', frame('7a1800083164a85bdf536297fbb1d896',
    topblock(heading('Die großen Drei','3.')+'\n    '+chips_v([chip('Stadt','1',dx=-44,rot=-2),chip('Umfeld','2',dx=40,rot=1.5),chip('Partner','3',dx=-16,rot=-1)]), top=270, gap=34)
    + subtitle('und','meist')), kp, KIDLOGIC)
FILES['G1b_Einstieg_ohne_Kontur']=page('G · Einstieg, H2 ohne Kontur', frame('908c199cabbf78a1b63913c89c9048fc',
    topblock(h1(['FAST 30'],156)+'\n    '+h2marker(['10 Lektionen für','mein 20-jähriges Ich'],kontur=False), top=250, gap=24)
    + subtitle('erwachsen','werden','in')))
FILES['W1b_Bewerbung_ohne_Kontur']=page('Bewerbungsgespräch · Einstieg, H2 ohne Kontur', frame('09f8ca3aa706662de72ea8bb74a933e7',
    topblock(h1(['BEWERBUNGS-','GESPRÄCH'],84,14)+'\n    '+h2marker(['So bereitest du dich vor'],kontur=False), top=250, gap=26)
    + subtitle('Das','Vorbereiten','ist')))
# V1 Bewerbung Einstieg
FILES['W1_Bewerbung_Einstieg']=page('Übertragung · Bewerbungsgespräch · Einstieg', frame('09f8ca3aa706662de72ea8bb74a933e7',
    topblock(h1(['BEWERBUNGS-','GESPRÄCH'],84,14)+'\n    '+h2marker(['So bereitest du dich vor']), top=250, gap=26)
    + subtitle('Das','Vorbereiten','ist')))
# V2 Bewerbung Kapitel
FILES['W2_Bewerbung_Kapitel']=page('Übertragung · Bewerbungsgespräch · Kapitel', frame('664e651e3e701d6510f34238f4f68b1b',
    topblock(heading('Selbstvorstellung','1.')+'\n    '+chips_v([chip('Werdegang',dx=-36,rot=-2),chip('Projekte',dx=34,rot=1.5),chip('Uni',dx=-10,rot=-1)],gap=12), top=255, gap=24)
    + subtitle('deinen','Werdegang','zu')), kp, KIDLOGIC)
# V3 CV Einstieg
FILES['W3_CV_Einstieg']=page('Übertragung · Lügen im CV · Einstieg', frame('b9c92d07dc774a789ae3386bd2f76a86',
    topblock(h1(['LÜGEN IM CV'],97,14), top=270) + subtitle('Natürlich','lügst','du')))
# V4 CV ART
FILES['W4_CV_Aufzaehlung']=page('Übertragung · Lügen im CV · Aufzählung', frame('ce7ba4edd67c886feb0c7bfa4dafde47',
    topblock(heading('Mein ART-Framework')+'\n    '+chips_v([chip('Action','A',dx=-60,rot=-2,size=50),chip('Result','R',dx=20,rot=1.5,size=50),chip('Transformation','T',dx=-8,rot=-1,size=50)],gap=10), top=250, gap=20)
    + subtitle('Das steht für','Action.')), kp, KIDLOGIC)
# V5 Karriere Data
FILES['W5_Karriere_Data']=page('Übertragung · Karrierebereiche · Kapitel mit Liste', frame('00b4744e02b02d398411eec13445290f',
    topblock(heading('Data','2.')+'\n    '+chips_h(['Science','Analytics','Engineering']), top=250, gap=22)
    + subtitle('','Data','Analytics,')), kp, KIDLOGIC)
# V6 Karriere Cyber
FILES['W6_Karriere_Cyber']=page('Übertragung · Karrierebereiche · Kapitel', frame('33e1931609c45b56e2d9abaaff962d46',
    topblock(heading('Cyber Security','4.'), top=250) + subtitle('schützt du','Systeme')), kp, KIDLOGIC)


import re
def from_e(name, repl):
    src=open(os.path.join(OUT,name)).read()
    for a,b in repl: 
        assert a in src, a
        src=src.replace(a,b)
    src=re.sub(r"data-props='[^']*'", "data-props='"+json.dumps({"$preview":{"width":1080,"height":1920}})+"'", src)
    src=re.sub(r"renderVals\(\) \{[^}]*\}", "renderVals() {\n    return {};\n  }", src)
    assert '{{accent}}' not in src
    return src
FILES['G3_Bild']=from_e('E3_Bild.dc.html',[('<title>E · Bild und Green Screen</title>','<title>G · Bild und Green Screen</title>'),('<span style="color: {{accent}}">wenn</span>','<span style="color: '+BLAU+'">wenn</span>'),('{{accent}}',BLAU)])
FILES['G4_Schlagwort']=from_e('E4_Schlagwort.dc.html',[('<title>E · Schlagwort</title>','<title>G · Schlagwort</title>'),('{{accent}}',PINK)])
FILES['G3_Bild']=FILES['G3_Bild'].replace('id="sge3"','id="sgg3"').replace('url(#sge3)','url(#sgg3)')


def sw(name,hexv,border=False):
    b=f' border: 3px solid {TINTE};' if border else ''
    return f"""      <div style="width: 284px; display: flex; align-items: center; gap: 16px">
        <div style="width: 72px; height: 72px; flex-shrink: 0; box-sizing: border-box; border-radius: 18px; background: {hexv};{b}"></div>
        <div style="display: flex; flex-direction: column; gap: 4px"><div style="font-size: 26px; font-weight: 800">{name}</div><div style="font-size: 22px; font-weight: 600">{hexv}</div></div>
      </div>"""
def acc(name,hexv,role,uses):
    return f"""      <div style="width: 438px; display: flex; flex-direction: column; gap: 10px">
        <div style="width: 438px; height: 110px; box-sizing: border-box; border-radius: 22px; background: {hexv}; border: 3px solid {TINTE}; display: flex; align-items: center; padding: 0 28px; font-weight: 900; font-stretch: 125%; font-size: 44px; color: {TINTE}">{role}</div>
        <div style="font-size: 28px; font-weight: 800">{name} · {hexv}</div>
        <div style="font-size: 24px; font-weight: 600; line-height: 1.3">{uses}</div>
      </div>"""
def sec(t):
    return f'<div style="align-self: flex-start; padding-bottom: 4px; border-bottom: 8px solid {BLAU}; font-size: 28px; font-weight: 800; letter-spacing: 4px">{t}</div>'
def struck(text, size=46):
    return f'''<div style="position: relative; align-self: flex-start">
        <div style="font-weight: 800; font-size: {size}px; line-height: 1.3; word-spacing: 4px; color: #FFFFFF; {stroke(8)}">{text}</div>
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" style="position: absolute; left: -8px; top: calc(54% - 10px); width: calc(100% + 16px); height: 20px; overflow: visible">
          <path d="M 1 12 C 22 7, 48 14, 72 9 S 94 11, 99 7" style="fill: none; stroke: {TINTE}; stroke-width: 11px; stroke-linecap: round; vector-effect: non-scaling-stroke"/>
          <path d="M 1 12 C 22 7, 48 14, 72 9 S 94 11, 99 7" style="fill: none; stroke: {PINK}; stroke-width: 5px; stroke-linecap: round; vector-effect: non-scaling-stroke"/>
        </svg>
      </div>'''
def noteline(parts, size=46, numsize=58):
    out=[]
    for kind,t in parts:
        if kind=='n': out.append(f'<span style="font-family: \'Gochi Hand\', cursive; font-size: {numsize}px; line-height: 1; color: {BLAU}; {stroke(10)}">{t}</span>')
        else: out.append(f'<span style="font-weight: 800; font-size: {size}px; line-height: 1.2; word-spacing: 4px; color: #FFFFFF; {stroke(8)}">{t}</span>')
    return '<div style="display: flex; align-items: baseline; gap: 12px">'+''.join(out)+'</div>'
FILES['R1_Randnotiz']=page('Punkt 5 · Randnotiz Vorher und Nachher', frame('e1b5755cb3e9b8c580e90ec7eb3da2f9',
    topblock(h1(['LÜGEN IM CV'],97,14), top=270)
    + f"""  <div style="position: absolute; left: 585px; top: 430px; width: 345px; display: flex; flex-direction: column; gap: 4px">
      {struck('Betreuung von')}
      {struck('Social Media')}
      <div style="height: 22px"></div>
      {noteline([('n','10'),('w','Kanäle')])}
      {noteline([('n','+15 %'),('w','Follower')])}
      {noteline([('w','in'),('n','90'),('w','Tagen')])}
      {noteline([('n','+20 %'),('w','Budget')])}
  </div>
"""
    + subtitle('Betreuung von','10')))

FILES['R2_Sprechblase']=page('Punkt 5 · Sprechblase', frame('2bec18fdee7deabddcc0d312a8d04c85',
    f"""  <div style="position: absolute; left: 90px; top: 1100px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px">
    <div style="max-width: 620px; box-sizing: border-box; padding: 12px 20px 14px; border-radius: 22px 22px 22px 6px; background: {BLAU}; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}; font-weight: 800; font-size: 36px; line-height: 1.2; color: #FFFFFF">Yo, hab da mal ne Frage zum CV</div>
    <div style="display: flex; gap: 9px; align-items: center; padding: 16px 20px; border-radius: 22px 22px 22px 6px; background: #FFFFFF; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.55"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.3"></div>
    </div>
  </div>
"""
    + subtitle('mich,','schreib','mir eine')))

FILES['R2b_Sprechblase_oben']=page('Punkt 5 · Sprechblase oben', frame('2bec18fdee7deabddcc0d312a8d04c85',
    f"""  <div style="position: absolute; left: 90px; top: 300px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px">
    <div style="max-width: 620px; box-sizing: border-box; padding: 12px 20px 14px; border-radius: 22px 22px 22px 6px; background: {BLAU}; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}; font-weight: 800; font-size: 36px; line-height: 1.2; color: #FFFFFF">Yo, hab da mal ne Frage zum CV</div>
    <div style="display: flex; gap: 9px; align-items: center; padding: 16px 20px; border-radius: 22px 22px 22px 6px; background: #FFFFFF; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.55"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.3"></div>
    </div>
  </div>
"""
    + subtitle('mich,','schreib','mir eine')))

def bubble(top):
    return f"""  <div style="position: absolute; left: 90px; top: {top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px">
    <div style="max-width: 620px; box-sizing: border-box; padding: 12px 20px 14px; border-radius: 22px 22px 22px 6px; background: {BLAU}; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}; font-weight: 800; font-size: 36px; line-height: 1.2; color: #FFFFFF">Yo, hab da mal ne Frage zum CV</div>
    <div style="display: flex; gap: 9px; align-items: center; padding: 16px 20px; border-radius: 22px 22px 22px 6px; background: #FFFFFF; border: 4px solid {TINTE}; box-shadow: 6px 6px 0 {TINTE}">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.55"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: {TINTE}; opacity: 0.3"></div>
    </div>
  </div>
"""
def profile(name):
    return f"""<div style="display: flex; align-items: center; gap: 10px"><div style="width: 32px; height: 32px; flex-shrink: 0; box-sizing: border-box; border-radius: 8px; background: #D9D9D9; border: 2px solid {TINTE}"></div><div style="font-weight: 700; font-size: 24px; line-height: 1; color: {TINTE}">{name}</div></div>"""
def outro(dark=False):
    bg=TINTE if dark else '#FFFFFF'; fg='#FFFFFF' if dark else TINTE; sub='#A0A0A0' if dark else '#6B6B6B'
    bed='#2A2A2A' if dark else OFF; fill='#FFFFFF' if dark else TINTE; line='#FFFFFF' if dark else TINTE
    frame_css=(f"border: 4px solid #FFFFFF; box-shadow: 0 0 0 3px {TINTE}" if dark else f"border: 5px solid {TINTE}; box-shadow: 10px 10px 0 {TINTE}")
    icon_bg='#3A3A3A' if dark else '#D9D9D9'
    def prof(name):
        return f"""<div style="display: flex; align-items: center; gap: 10px"><div style="width: 32px; height: 32px; flex-shrink: 0; box-sizing: border-box; border-radius: 8px; background: {icon_bg}; border: 2px solid {line}"></div><div style="font-weight: 700; font-size: 24px; line-height: 1; color: {fg}">{name}</div></div>"""
    return f"""  <div style="position: absolute; left: 90px; top: 1432px; width: 700px; box-sizing: border-box; padding: 20px 26px 22px; background: {bg}; {frame_css}; border-radius: 24px; display: flex; flex-direction: column; gap: 14px">
    <div style="display: flex; justify-content: space-between; align-items: baseline">
      <div style="font-weight: 800; font-size: 30px; line-height: 1.1; color: {fg}">Folgen nicht vergessen</div>
      <div style="display: flex; align-items: baseline; gap: 6px"><div style="font-weight: 900; font-stretch: 125%; font-size: 40px; line-height: 1; color: {fg}">4.254</div><div style="font-weight: 700; font-size: 24px; line-height: 1; color: {sub}">/ 10.000</div></div>
    </div>
    <div style="position: relative; height: 24px; box-sizing: border-box; border-radius: 12px; background: {bed}; border: 3px solid {line}; overflow: hidden">
      <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 42.5%; background: {fill}"></div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; column-gap: 16px">
      {prof('@itsabidullahabi')}
      {prof('@abidullahabi')}
      {prof('@abidullahabi')}
      {prof('Abdullah Bachtari')}
    </div>
  </div>
"""
def outro_orig():
    def prof(name):
        return f"""<div style="display: flex; align-items: center; gap: 12px"><div style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 7px; background: #C9CCD2"></div><div style="font-weight: 700; font-size: 25px; line-height: 1; color: #16181C">{name}</div></div>"""
    return f"""  <div style="position: absolute; left: 0; top: 250px; width: 1080px; text-align: center; font-weight: 800; font-size: 50px; line-height: 1.15; color: #FFFFFF; {stroke(10)}">Folgen nicht vergessen</div>
  <div style="position: absolute; left: 90px; top: 1423px; width: 700px; height: 237px; box-sizing: border-box; padding: 22px; background: #F8F9FB; border-radius: 20px; display: flex; flex-direction: column">
    <div style="display: flex; justify-content: space-between; align-items: baseline">
      <div style="font-weight: 700; font-size: 36px; line-height: 1; color: #16181C">4.254</div>
      <div style="font-weight: 700; font-size: 26px; line-height: 1; color: #7A7E86">Ziel 10.000</div>
    </div>
    <div style="position: relative; margin-top: 12px; height: 19px; border-radius: 10px; background: #DEE1E7; overflow: hidden">
      <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 42.5%; border-radius: 10px; background: {BLAU}"></div>
    </div>
    <div style="margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 13px; column-gap: 16px">
      {prof('@itsabidullahabi')}
      {prof('@abidullahabi')}
      {prof('@abidullahabi')}
      {prof('Abdullah Bachtari')}
    </div>
  </div>
"""
FILES['R3_Outro']=page('Punkt 5 · Outro wie bisher, mit Archivo', frame('ddb50faeb3f2118db530b58000120dcf',
    outro_orig() + bubble(345) + subtitle('nicht','vergessen.')))

G0=f"""<div style="position: relative; width: 1080px; height: 1920px; box-sizing: border-box; padding: 90px 90px; background: {OFF}; color: {TINTE}; font-family: 'Archivo', sans-serif; display: flex; flex-direction: column; gap: 48px; overflow: hidden">
  <div style="display: flex; align-items: center; gap: 32px">
    <div style="width: 132px; height: 132px; flex-shrink: 0; border-radius: 28px; background: {TINTE}; transform: rotate(-3deg); display: flex; align-items: center; justify-content: center; font-weight: 900; font-stretch: 125%; font-size: 80px; line-height: 1; color: {BLAU}">G</div>
    <div style="display: flex; flex-direction: column; gap: 12px">
      <div style="font-weight: 900; font-stretch: 125%; font-size: 70px; line-height: 1">Klar mit Kante</div>
      <div style="font-size: 30px; font-weight: 700">Blau ordnet · Pink betont stark</div>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 24px">
    {sec('BASIS')}
    <div style="display: flex; gap: 24px">
{sw('Tinte',TINTE)}
{sw('Weiß','#FFFFFF',True)}
{sw('Off-White',OFF,True)}
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 24px">
    {sec('AKZENTE')}
    <div style="display: flex; gap: 24px">
{acc('Blau',BLAU,'ordnet','H2-Fläche, Kapitelzahlen, Trefferwort im Untertitel, Punkte in den Pillen, Diagrammlinien')}
{acc('Pink',PINK,'betont','Nur bei klarer, eindeutiger Betonung, zum Beispiel die Unterstreichung beim Schlagwort')}
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 20px">
    {sec('SCHRIFT')}
    <div style="display: flex; flex-direction: column; gap: 4px">
      <div style="font-size: 24px; font-weight: 700">Archivo Expanded Black · H1 in Großbuchstaben</div>
      <div style="font-weight: 900; font-stretch: 125%; font-size: 84px; line-height: 1.1">FAST 30 ÄÖÜ</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 4px">
      <div style="font-size: 24px; font-weight: 700">Archivo ExtraBold · Untertitel, H2, Kapitel und Randnotiz</div>
      <div style="font-size: 58px; font-weight: 800; line-height: 1.15">das ist der Punkt · ß €</div>
    </div>
    <div style="display: flex; align-items: center; gap: 36px">
      <div style="font-size: 24px; font-weight: 700">Gochi Hand · Zahlen</div>
      <div style="font-family: 'Gochi Hand', cursive; font-size: 104px; line-height: 1; color: {BLAU}; {stroke(12)}">1. 2. 3. 6.</div>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 20px">
    {sec('REGELN')}
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 29px; font-weight: 700; line-height: 1.28">
      <div>1. Schrift weiß. Auf dem Video mit schwarzer Kontur, auf der blauen Fläche ohne.</div>
      <div>2. Untertitel weiß, das Trefferwort blau, ohne Box.</div>
      <div>3. H1 so groß wie möglich, höchstens 80 % der Bildbreite. Lange Titel zweizeilig.</div>
      <div>4. Zahlen und Akronyme blau in Kinderschrift, ohne Kreis.</div>
      <div>5. Pink nur für starke, eindeutige Betonung.</div>
      <div>6. Höchstens zwei Textebenen gleichzeitig.</div>
    </div>
  </div>
</div>"""
FILES['G0_Kit']=page('G · Kit Klar mit Kante', G0)

# ART alternative: big letters, one pill
def bigletters(letters, active):
    out=[]
    for i,(l,r) in enumerate(zip(letters,[-4,3,-2,2])):
        col=BLAU if i==active else '#FFFFFF'
        out.append(f'<div style="font-family: \'Gochi Hand\', cursive; font-size: 230px; line-height: 0.95; color: {col}; {stroke(16)}; transform: rotate({r}deg)">{l}</div>')
    return '<div style="display: flex; justify-content: center; align-items: flex-end; gap: 64px">\n      '+'\n      '.join(out)+'\n    </div>'
FILES['W7_CV_Alternative']=page('Übertragung · Lügen im CV · Alternative', frame('ce7ba4edd67c886feb0c7bfa4dafde47',
    topblock(bigletters(['A','R','T'],0)+'\n    '+chips_h(['Action · was du genau machst'],size=46), top=240, gap=18)
    + subtitle('Das steht für','Action.')))

for n,s in FILES.items():
    open(os.path.join(OUT,n+'.dc.html'),'w').write(s)
print('\n'.join(FILES))
