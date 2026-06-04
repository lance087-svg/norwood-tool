#!/usr/bin/env python3
"""
Norwood lumber price updater.
Usage: python3 update_lumber_prices.py <pine_pdf> <spruce_pdf> <index.html>
Parses the Wholesale Building Products Pine + Spruce price sheets and updates
cost/pricePerM for lumber & plywood items in the pricing tool, plus the banner date.
Prints a summary. Exit 0 on success.
"""
import sys, re, json, datetime
import pdfplumber

def num(s):
    s=s.replace('$','').replace(',','').strip()
    try: return float(s)
    except: return None

def parse_pine(path):
    with pdfplumber.open(path) as pdf:
        text=pdf.pages[0].extract_text()
    lines=[l.rstrip() for l in text.split('\n')]
    sheet_date=None
    for l in lines:
        m=re.search(r'DATE:\s*([\d.]+)',l)
        if m: sheet_date=m.group(1)
    PT={}; PTGC={}; PT_SINGLE={}; PT_PLY={}; BRITE={}; BRITE_PLY={}
    sec=None; header=None
    LEN=[8,10,12,14,16,18,20,22,24]
    def parse_dim_row(l):
        # e.g. "2x4 208 $755 $720 ..."  -> dim, [prices...]
        m=re.match(r'^(\d+x\d+)\s+\S+\s+(.*)$',l)
        if not m: return None
        dim=m.group(1)
        prices=[num(x) for x in re.findall(r'\$[\d,]+',m.group(2))]
        return dim,prices
    for l in lines:
        ls=l.strip()
        if 'No. 2 GM Lumber .06 MCA' in ls: sec='PT'; continue
        if 'No. 2 GM Lumber .15 MCA' in ls: sec='PTGC'; continue
        if ls.startswith('PT PLYWOOD'): sec='PTPLY'; continue
        if 'BRITE LUMBER' in ls: sec='BRITE'; continue
        if ls.startswith('BRITE PLYWOOD'): sec='BRITEPLY'; continue
        if ls.startswith('Prices subject'): sec=None; continue
        if sec in ('PT','BRITE'):
            if sec=='PT' and ls.startswith('5/4x6'):
                pr=[num(x) for x in re.findall(r'\$[\d,]+',ls)]
                if pr: PT['5/4x6']=dict(zip(LEN,pr))
                continue
            r=parse_dim_row(ls)
            if r:
                dim,prices=r
                d=dict(zip(LEN,prices))
                (PT if sec=='PT' else BRITE)[dim]=d
        if sec=='PTGC':
            if ls.startswith('8x8'):
                pr=[num(x) for x in re.findall(r'\$[\d,]+',ls)]
                if pr: PTGC['8x8']=dict(zip(LEN,pr))
                continue
            r=parse_dim_row(ls)
            if r:
                dim,prices=r; PTGC[dim]=dict(zip(LEN,prices))
            else:
                m=re.match(r'^(1x2|2x2)-(\d+)\'.*?\$?([\d,]+)\s*$',ls)
                if m: PT_SINGLE[f"{m.group(1)}_{m.group(2)}"]=num(m.group(3))
        if sec in ('PTPLY','BRITEPLY'):
            m=re.match(r'^(\d/\d+)\s+CDX.*?Per MSF.*?(\$[\d,]+)(?:\s+(\$[\d,]+)\s+(\$[\d,]+))?',ls)
            if m:
                sz=m.group(1)
                if sec=='PTPLY': PT_PLY[sz]=num(m.group(2))
                else: BRITE_PLY[sz]=num(m.group(2))  # CDX column
    return sheet_date,PT,PTGC,PT_SINGLE,PT_PLY,BRITE,BRITE_PLY

def parse_spruce(path):
    with pdfplumber.open(path) as pdf:
        text=pdf.pages[0].extract_text()
    lines=[l.strip() for l in text.split('\n')]
    SPF={}; SPF_PRECUT={}
    dim=None
    # candidates[(dim,key)] = {'#2':price or None,'PREM':price or None}
    cand={}
    for l in lines:
        m=re.match(r'^(2x\d+)\s+Availability',l)
        if m: dim=m.group(1); continue
        if dim is None: continue
        # precut rows: 92-5/8" / 104-5/8" / 116-5/8"
        mp=re.match(r'^(\d+)-5/8"\s+([#\w]+).*?\s+(OUT|Ready|TODAY|This Week|[\d,]+)\s*$',l)
        ms=re.match(r"^(\d+)'\s+([#\w]+).*?\s+(OUT|Ready|TODAY|This Week|[\d,]+)\s*$",l)
        def grade_price(label, val):
            g='#2' if label.upper().startswith('#2') or label.upper() in ('SEL','SC','SC2') else label.upper()
            return g
        if mp:
            inch=float(mp.group(1))+0.625
            label=mp.group(2); last=mp.group(3)
            price=num(last) if re.match(r'^[\d,]+$',last) else None
            key=('precut',dim,round(inch,3))
            cand.setdefault(key,{})
            g='#2' if label.upper() in('#2','SEL') else ('PREM' if label.upper().startswith('PRE') else label.upper())
            cand[key][g]=price
        elif ms:
            L=int(ms.group(1)); label=ms.group(2); last=ms.group(3)
            price=num(last) if re.match(r'^[\d,]+$',last) else None
            key=('std',dim,L)
            cand.setdefault(key,{})
            g='#2' if label.upper()=='#2' else ('PREM' if label.upper().startswith('PRE') else label.upper())
            cand[key][g]=price
    # resolve: prefer #2 (Ready/price), else PREM; skip if both None
    for key,gr in cand.items():
        price=None
        if gr.get('#2') is not None: price=gr['#2']
        elif gr.get('PREM') is not None: price=gr['PREM']
        if price is None: continue
        kind,dim,k=key
        if kind=='std': SPF.setdefault(dim,{})[k]=price
        else: SPF_PRECUT[(dim,k)]=price
    return SPF,SPF_PRECUT

def load_inventory(content):
    m=re.search(r'const INVENTORY\s*=\s*\[',content); start=m.end()-1
    i=start;d=0;ins=False;esc=False;q=''
    while i<len(content):
        c=content[i]
        if ins:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==q:ins=False
        else:
            if c in '"\'':ins=True;q=c
            elif c=='[':d+=1
            elif c==']':
                d-=1
                if d==0: return start,i+1,json.loads(content[start:i+1])
        i+=1
    raise RuntimeError("INVENTORY not parsed")

def main():
    pine,spruce,html=sys.argv[1],sys.argv[2],sys.argv[3]
    sheet_date,PT,PTGC,PT_SINGLE,PT_PLY,BRITE,BRITE_PLY=parse_pine(pine)
    SPF,SPF_PRECUT=parse_spruce(spruce)
    content=open(html,encoding='utf-8').read()
    start,end,inv=load_inventory(content)
    def nomtw(dim): a,b=dim.split('x'); return int(a),int(b)
    def bf_dim(t,w,L): return (t*w*L)/12.0
    def bf_pre(t,w,inch): return (t*w*inch)/144.0
    re_std=re.compile(r"^(PT|SYP|SPF) #2 (\d+x\d+) x (\d+)'$")
    re_512=re.compile(r"^PT #2 1x\.256 x (\d+)'$")
    re_single=re.compile(r"^PT #2 (1x2|2x2) x (\d+)'$")
    re_precut=re.compile(r"^SPF #2 (2x[46])(\d+)&5/ x \d+'$")
    re_cdx=re.compile(r'^CDX (\d/\d+)" Plywood$')
    re_ptply=re.compile(r'^PT Plywood (\d/\d+)"$')
    updated=0; skipped=[]
    for it in inv:
        if not (it.get('isLumber') or it.get('group') in ('Dimensional Lumber','Plywood')): continue
        name=it.get('name',''); newM=None; newcost=None
        if re_single.match(name):
            d,L=re_single.match(name).group(1),re_single.match(name).group(2)
            v=PT_SINGLE.get(f"{d}_{L}")
            if v is not None: t,w=nomtw(d); newM=v; newcost=round((v/1000)*bf_dim(t,w,int(L)),2)
            else: skipped.append(name); continue
        elif re_std.match(name):
            sp,dim,L=re_std.match(name).group(1),re_std.match(name).group(2),int(re_std.match(name).group(3))
            t,w=nomtw(dim)
            tbl=None
            if sp=='PT': tbl=PT.get(dim) or PTGC.get(dim)
            elif sp=='SYP': tbl=BRITE.get(dim)
            elif sp=='SPF': tbl=SPF.get(dim)
            if tbl and L in tbl and tbl[L] is not None: newM=tbl[L]; newcost=round((newM/1000)*bf_dim(t,w,L),2)
            else: skipped.append(name); continue
        elif re_512.match(name):
            L=int(re_512.match(name).group(1)); v=PT.get('5/4x6',{}).get(L)
            if v is not None: newM=v; newcost=round((v/1000)*bf_dim(1.25,6,L),2)
            else: skipped.append(name); continue
        elif re_precut.match(name):
            dim,pre=re_precut.match(name).group(1),re_precut.match(name).group(2)
            inch={'92':92.625,'104':104.625,'116':116.625}.get(pre)
            v=SPF_PRECUT.get((dim,inch))
            if v is not None: t,w=nomtw(dim); newM=v; newcost=round((v/1000)*bf_pre(t,w,inch),2)
            else: skipped.append(name); continue
        elif re_cdx.match(name):
            v=BRITE_PLY.get(re_cdx.match(name).group(1))
            if v is not None: newM=v; newcost=round(v*0.032,2)
            else: skipped.append(name); continue
        elif re_ptply.match(name):
            v=PT_PLY.get(re_ptply.match(name).group(1))
            if v is not None: newM=v; newcost=round(v*0.032,2)
            else: skipped.append(name); continue
        else:
            skipped.append(name); continue
        it['cost']=newcost; it['pricePerM']=str(int(newM) if float(newM).is_integer() else newM)
        updated+=1
    # banner date  M.DD.YYYY -> M/DD/YYYY
    disp=None
    if sheet_date:
        parts=sheet_date.strip('.').split('.')
        if len(parts)==3: disp=f"{int(parts[0])}/{parts[1]}/{parts[2]}"
    new_arr=json.dumps(inv,separators=(',',':'),ensure_ascii=False)
    content=content[:start]+new_arr+content[end:]
    if disp:
        content=re.sub(r'(id="lumber-price-date"[^>]*>)Updated [\d/]+(</span>)',
                       rf'\g<1>Updated {disp}\g<2>',content)
        # also any standalone "Updated M/DD/YYYY" within ~ the same banner pattern already covered
    open(html,'w',encoding='utf-8').write(content)
    print(f"sheet_date={sheet_date} banner={disp} updated={updated} skipped={len(skipped)}")
    print("skipped:", ", ".join(sorted(set(skipped))))
if __name__=='__main__': main()
