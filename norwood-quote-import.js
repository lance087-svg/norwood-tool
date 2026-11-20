/* ============================================================================
   NORWOOD SUPPLY — Vendor Quote Importer  (companion patch)
   Adds an "Import Vendor Quote" button to BOTH the Quote Builder (next to
   Custom Item) and the PO Builder. Reads a pasted quote or an uploaded PDF,
   parses the line items, and drops them in — into the quote as custom items
   (cost + your margin) or into the PO at vendor cost.
   Validated on Dyke (web + tabular), Woodgrain, Weyerhaeuser, BlueLinx, Logan,
   Millwork Sales, U.S. Lumber, and TLC plain-text emails.
   ============================================================================ */
(function(){
  var PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // ── PARSER ─────────────────────────────────────────────────────────────────
  function detectVendor(t){
    var s=t.toLowerCase();
    if(s.indexOf('dyke')>-1)return['dyke','Dyke'];
    if(s.indexOf('woodgrain')>-1)return['woodgrain','Woodgrain'];
    if(s.indexOf('weyerhaeuser')>-1)return['weyerhaeuser','Weyerhaeuser'];
    if(s.indexOf('bluelinx')>-1)return['bluelinx','BlueLinx'];
    if(s.indexOf('logan lumber')>-1)return['logan','Logan Lumber'];
    if(s.indexOf('millwork sales')>-1)return['millworksales','Millwork Sales'];
    if(s.indexOf('u.s. lumber')>-1||s.indexOf('us lumber')>-1)return['uslumber','U.S. Lumber'];
    if(s.indexOf('tlc')>-1)return['tlc','TLC Millwork'];
    return['generic','Unknown vendor'];
  }
  var PRICE=/(\d[\d,]*\.\d{2,4})/g;
  function num(x){return parseFloat(String(x).replace(/,/g,''))||0;}
  function cleanLines(t){return t.replace(/\r/g,'').split('\n').map(function(l){return l.replace(/\s+/g,' ').trim();}).filter(function(l){return l.length;});}
  function isStop(l){return /^(sub ?total|total|invoice total|qty shipped total|lines total|notes?|special\/production|all orders|all eligible|thank you|for all special|fuel surcharge|approval|https?:|image product)/i.test(l);}

  function parseGeneric(text){
    var lines=cleanLines(text), items=[], cur=null;
    var startRe=/^(\d+(?:\.\d+)?)\s+([A-Za-z]{1,4}\b)?\s*(.*)$/;
    var codeRe=/\b(zz_[A-Za-z]+_\d+|[A-Z]{2,}[A-Z0-9]{3,}|\d{6,})\b/;
    function push(){ if(cur&&(cur.qty||cur.amount||cur.code)) items.push(cur); cur=null; }
    for(var i=0;i<lines.length;i++){
      var l=lines[i];
      if(isStop(l)){ push(); continue; }
      var prices=l.match(PRICE);
      var m=l.match(startRe);
      if(m && prices){
        push();
        var qty=num(m[1]), uom=(m[2]||'').toUpperCase(), rest=m[3]||'';
        var code=''; var cm=l.match(codeRe); if(cm)code=cm[1];
        var unit=0, amount=num(prices[prices.length-1]);
        var upm=l.match(/(\d[\d,]*\.\d{2,4})\s*\/\s*[A-Za-z]/);
        if(upm)unit=num(upm[1]); else if(prices.length>=2)unit=num(prices[0]); else if(qty)unit=+(amount/qty).toFixed(4);
        var desc=rest.replace(codeRe,'').replace(PRICE,'').replace(/\/\s*[A-Za-z]{1,4}/g,'').replace(/\s{2,}/g,' ').trim();
        cur={qty:qty,uom:uom,code:code,unit:unit,amount:amount,desc:desc};
      } else if(cur){
        if(!/^(weight:|cubes?:|vendor prod:|cust#|sign for|lead time|page \d)/i.test(l)){ cur.desc=(cur.desc?cur.desc+' ':'')+l; }
        else { var vp=l.match(/vendor prod:\s*(\S+)/i); if(vp&&!cur.code)cur.code=vp[1]; }
      }
    }
    push(); return items;
  }
  function parseDyke(text){
    var lines=cleanLines(text), items=[], cur=null;
    function push(){ if(cur){cur.desc=(cur.desc||'').replace(/\s{2,}/g,' ').trim(); items.push(cur);} cur=null; }
    var anchor=/\$([\d,]+\.\d{2})\s*x\s*(\d+)\s*\$([\d,]+\.\d{2})/;
    if(lines.some(function(l){return anchor.test(l);})){
      for(var i=0;i<lines.length;i++){ var l=lines[i]; var m=l.match(anchor);
        if(m){ push();
          var before=l.slice(0,m.index).replace(/^item\s*\d+\s*/i,'').trim();
          cur={code:'',qty:num(m[2]),uom:'EA',unit:num(m[1]),amount:num(m[3]),desc:before};
        } else if(cur){
          if(/^(subtotal|total|approval|for warranty|https?:|image product)/i.test(l)){ push(); continue; }
          cur.desc=(cur.desc?cur.desc+' ':'')+l.replace(/^item\s*\d+\s*/i,'');
        }
      }
      push(); return items;
    }
    for(var j=0;j<lines.length;j++){ var ln=lines[j];
      var mm=ln.match(/^\d+\s+(zz_\S+)\s+(.*?)\s+(\d+)\s+ea\s+([\d,]+\.\d+)\s+\w+\s+([\d,]+\.\d+)\s*$/i);
      if(mm){ push(); cur={code:mm[1],desc:mm[2],qty:num(mm[3]),uom:'EA',unit:num(mm[4]),amount:num(mm[5])}; continue; }
      if(/^\d+\s+(special|production|verify)/i.test(ln)){ push(); continue; }
      if(cur && !isStop(ln) && !/^\d+\s/.test(ln)) cur.desc+=' '+ln;
    }
    push(); return items;
  }
  function parseWoodgrain(text){
    var lines=cleanLines(text), items=[], cur=null;
    function push(){ if(cur)items.push(cur); cur=null; }
    for(var i=0;i<lines.length;i++){ var l=lines[i];
      if(/lines? total|qty shipped total/i.test(l)){ push(); continue; }
      var m=l.match(/^\d+\s+(\S+)\s+(\d+)\s+.*?\s+([A-Z]{2})\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s*$/);
      if(m){ push(); cur={code:m[1],qty:num(m[2]),uom:m[3],unit:num(m[4]),amount:num(m[5]),desc:''}; continue; }
      if(cur){ var vp=l.match(/vendor prod:\s*(\S+)/i); if(vp){cur.code=cur.code||vp[1];continue;}
        if(/^(weight:|cubes?:|page \d)/i.test(l))continue;
        if(!isStop(l)) cur.desc=(cur.desc?cur.desc+' ':'')+l; }
    }
    push(); return items;
  }
  function parseWeyerhaeuser(text){
    var lines=cleanLines(text), items=[];
    for(var i=0;i<lines.length;i++){ var l=lines[i];
      var m=l.match(/^\d+\s+(\d{6,8})\s+(.*?)\s+(\d+)\s+(EA|PC|BOX|LF|MBF|PCS)\s+.*?([\d,]+\.\d+)\s*\/\s*[A-Za-z]+\s+([\d,]+\.\d+)\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/);
      if(m) items.push({code:m[1],desc:m[2],qty:num(m[3]),uom:m[4],unit:num(m[5]),amount:num(m[6])});
    }
    return items;
  }
  function parseQuote(text){
    var d=detectVendor(text), v=d[0], items;
    if(v==='dyke')items=parseDyke(text);
    else if(v==='woodgrain')items=parseWoodgrain(text);
    else if(v==='weyerhaeuser')items=parseWeyerhaeuser(text);
    else items=parseGeneric(text);
    if(!items.length) items=parseGeneric(text);
    items.forEach(function(it){ it.desc=(it.desc||'').replace(/\s{2,}/g,' ').trim(); if(!it.unit&&it.qty&&it.amount)it.unit=+(it.amount/it.qty).toFixed(4); if(!it.amount&&it.unit&&it.qty)it.amount=+(it.unit*it.qty).toFixed(2); });
    return {vendor:v,label:d[1],items:items};
  }

  // ── PDF text extraction ──────────────────────────────────────────────────
  function ensurePDFJS(cb){
    if(window.pdfjsLib){ cb(); return; }
    var s=document.createElement('script'); s.src=PDFJS_URL;
    s.onload=function(){ try{pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;}catch(e){} cb(); };
    s.onerror=function(){ cb(new Error('pdfjs')); };
    document.head.appendChild(s);
  }
  function pdfToText(file, cb){
    ensurePDFJS(function(err){
      if(err){ cb(err); return; }
      file.arrayBuffer().then(function(buf){
        pdfjsLib.getDocument({data:buf}).promise.then(function(pdf){
          var pages=[], n=1;
          function nextPage(){
            if(n>pdf.numPages){ cb(null, pages.join('\n')); return; }
            pdf.getPage(n).then(function(page){ page.getTextContent().then(function(tc){
              var its=tc.items.map(function(i){return {s:i.str,x:i.transform[4],y:i.transform[5]};});
              its.sort(function(a,b){return b.y-a.y || a.x-b.x;});
              var rows=[],cy=null,cur=[];
              its.forEach(function(i){ if(cy===null||Math.abs(i.y-cy)>3){ if(cur.length)rows.push(cur); cur=[]; cy=i.y;} cur.push(i);});
              if(cur.length)rows.push(cur);
              pages.push(rows.map(function(r){return r.sort(function(a,b){return a.x-b.x;}).map(function(i){return i.s;}).join(' ').replace(/\s+/g,' ').trim();}).filter(Boolean).join('\n'));
              n++; nextPage();
            });});
          }
          nextPage();
        }).catch(function(){ cb(new Error('read')); });
      });
    });
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  var ROWS=[], MODE='quote', sourcePDF=null, importSession=0;
  function css(){
    if(document.getElementById('nqi-style'))return;
    var st=document.createElement('style'); st.id='nqi-style';
    st.textContent=
      '#nqi-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:none;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}'+
      '#nqi-ov.on{display:flex}'+
      '.nqi-card{background:#fff;border-radius:12px;width:100%;max-width:880px;box-shadow:0 12px 48px rgba(0,0,0,.3);overflow:hidden;font-family:system-ui,sans-serif}'+
      '.nqi-h{background:#E65100;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}'+
      '.nqi-h h3{margin:0;font-size:16px}'+
      '.nqi-x{background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:15px}'+
      '.nqi-b{padding:16px 20px}'+
      '.nqi-b textarea{width:100%;min-height:120px;border:1.5px solid #e0d5c0;border-radius:8px;padding:11px;font-size:12.5px;font-family:ui-monospace,Menlo,monospace;resize:vertical;outline:none;background:#fdf9f3;box-sizing:border-box}'+
      '.nqi-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:11px}'+
      '.nqi-btn{border:none;border-radius:7px;padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}'+
      '.nqi-o{background:#E65100;color:#fff}.nqi-g{background:#2d6a30;color:#fff}.nqi-gh{background:#fff;color:#555;border:1.5px solid #e0d5c0}'+
      '.nqi-badge{display:inline-block;background:#eaf4fd;color:#1E70B8;border:1.5px solid #bcdcf7;border-radius:20px;padding:4px 13px;font-size:12px;font-weight:700;margin:12px 0 8px}'+
      '.nqi-badge.warn{background:#fff8e8;color:#8B6914;border-color:#e8c850}'+
      '.nqi-margin{display:inline-flex;align-items:center;gap:7px;background:#fdf9f3;border:1.5px solid #e0d5c0;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:600}'+
      '.nqi-margin input{width:52px;border:1.5px solid #e0d5c0;border-radius:5px;padding:4px 7px;font-size:13px;font-weight:700;text-align:right;font-family:inherit;outline:none}'+
      '.nqi-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}'+
      '.nqi-tbl th{background:#1E70B8;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:6px 7px;text-align:left;white-space:nowrap}'+
      '.nqi-tbl th.r{text-align:right}'+
      '.nqi-tbl td{border-bottom:1px solid #eee4d2;padding:2px 4px}'+
      '.nqi-tbl input{width:100%;border:1px solid transparent;border-radius:4px;padding:5px 6px;font-size:12px;font-family:inherit;background:transparent;outline:none;box-sizing:border-box}'+
      '.nqi-tbl input:hover{border-color:#e5dcc8;background:#fff}.nqi-tbl input:focus{border-color:#E65100;background:#fff}'+
      '.nqi-tbl input.q{width:46px;text-align:center}.nqi-tbl input.m{width:76px;text-align:right}'+
      '.nqi-tbl td.r{text-align:right;color:#2d6a30;font-weight:600;white-space:nowrap;font-size:12px;padding-right:8px}'+
      '.nqi-del{background:none;border:none;color:#c04040;cursor:pointer;font-size:14px}'+
      '.nqi-tot{text-align:right;font-size:13px;margin-top:10px;font-weight:700}'+
      '.nqi-hint{font-size:11.5px;color:#8a7a5a;margin-top:6px;line-height:1.5}';
    document.head.appendChild(st);
  }
  function buildOverlay(){
    if(document.getElementById('nqi-ov'))return;
    css();
    var ov=document.createElement('div'); ov.id='nqi-ov';
    ov.innerHTML=
      '<div class="nqi-card">'+
        '<div class="nqi-h"><h3>📄 Import Vendor Quote</h3><button class="nqi-x" onclick="NQI.close()">✕</button></div>'+
        '<div class="nqi-b">'+
          '<textarea id="nqi-src" placeholder="Paste a TLC email or a copied vendor quote here… or use Upload PDF."></textarea>'+
          '<div class="nqi-row">'+
            '<button class="nqi-btn nqi-o" onclick="NQI.read()">Read Quote</button>'+
            '<span style="color:#9baab8;font-size:12px;font-weight:600">or</span>'+
            '<button class="nqi-btn nqi-gh" onclick="document.getElementById(\'nqi-pdf\').click()">⬆ Upload Quote PDF</button>'+
            '<input type="file" id="nqi-pdf" accept="application/pdf" style="display:none" onchange="NQI.pdf(event)">'+
          '</div>'+
          '<div id="nqi-result" style="display:none">'+
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'+
              '<div id="nqi-badge" class="nqi-badge">—</div>'+
              '<div class="nqi-margin" id="nqi-marginbox">Margin <input type="number" id="nqi-margin" value="40" min="0" max="90" step="1" oninput="NQI.tot()">%</div>'+
            '</div>'+
            '<div style="overflow-x:auto"><table class="nqi-tbl"><thead><tr id="nqi-thead"></tr></thead><tbody id="nqi-tbody"></tbody></table></div>'+
            '<div class="nqi-tot" id="nqi-tot"></div>'+
            '<div class="nqi-row">'+
              '<button class="nqi-btn nqi-g" id="nqi-add" onclick="NQI.add()">✓ Add</button>'+
              '<button class="nqi-btn nqi-gh" onclick="NQI.close()">Cancel</button>'+
            '</div>'+
            '<div class="nqi-hint" id="nqi-hint"></div>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov) NQI.close(); });
  }
  function openImport(mode){
    MODE=mode||'quote'; buildOverlay();
    importSession++;
    sourcePDF=null;
    document.getElementById('nqi-add').disabled=false;
    document.getElementById('nqi-src').value='';
    document.getElementById('nqi-result').style.display='none';
    ROWS=[];
    document.getElementById('nqi-marginbox').style.display = (MODE==='quote')?'inline-flex':'none';
    document.getElementById('nqi-add').textContent = (MODE==='quote')?'✓ Add to Quote':'✓ Add to PO';
    document.getElementById('nqi-hint').textContent = (MODE==='quote')
      ? 'Every cell is editable. Lines come in as custom items at the margin above — adjust per line in the quote after.'
      : 'Every cell is editable. Lines drop into the PO at the vendor cost shown.';
    document.getElementById('nqi-ov').classList.add('on');
    document.getElementById('nqi-src').focus();
  }
  function closeImport(){ importSession++; var o=document.getElementById('nqi-ov'); if(o)o.classList.remove('on'); }
  function readText(){ var t=(document.getElementById('nqi-src').value||'').trim(); if(!t){ alert('Paste a quote first.'); return; } render(parseQuote(t)); }
  function readPDF(ev){
    var f=ev.target.files[0]; if(!f)return;
    ev.target.value='';
    var session=++importSession;
    sourcePDF=null;
    document.getElementById('nqi-result').style.display='none';
    pdfToText(f, function(err, text){
      if(session!==importSession)return;
      if(err){ alert('Could not read that PDF — try copy/paste instead.'); return; }
      sourcePDF=f;
      document.getElementById('nqi-src').value=text;
      render(parseQuote(text));
    });
  }
  function esc(s){return String(s).replace(/"/g,'&quot;');}
  function marginDec(){ var m=num(document.getElementById('nqi-margin').value); m=Math.min(90,Math.max(0,m)); return m/100; }
  function retailOf(cost){ var g=marginDec(); return g<0.999? Math.round(cost/(1-g)) : cost; }
  var resultVendor;
  function render(res){
    resultVendor = res.vendor;
    ROWS=res.items.map(function(it){return {qty:it.qty||1,uom:it.uom||'EA',code:it.code||'',desc:it.desc||'',cost:it.unit||0};});
    var badge=document.getElementById('nqi-badge');
    if(!ROWS.length){ badge.className='nqi-badge warn'; badge.textContent='Couldn\u2019t find line items — edit the paste or add manually'; }
    else { badge.className='nqi-badge'; badge.textContent='Detected: '+res.label+'  ·  '+ROWS.length+' line'+(ROWS.length>1?'s':''); }
    var thead=document.getElementById('nqi-thead');
    thead.innerHTML='<th style="width:26px"></th><th>Qty</th><th>UOM</th><th>Vendor Code</th><th>Description</th><th class="r">Unit Cost</th>'+(MODE==='quote'?'<th class="r">Retail</th>':'');
    document.getElementById('nqi-result').style.display='block';
    drawRows();
  }
  function drawRows(){
    document.getElementById('nqi-tbody').innerHTML=ROWS.map(function(r,i){
      return '<tr>'+
        '<td style="text-align:center"><button class="nqi-del" onclick="NQI.del('+i+')">\u2715</button></td>'+
        '<td><input class="q" value="'+esc(r.qty)+'" onchange="NQI.upd('+i+',\'qty\',this.value)"></td>'+
        '<td><input style="width:50px" value="'+esc(r.uom)+'" onchange="NQI.upd('+i+',\'uom\',this.value)"></td>'+
        '<td><input style="width:112px" value="'+esc(r.code)+'" onchange="NQI.upd('+i+',\'code\',this.value)"></td>'+
        '<td><input value="'+esc(r.desc)+'" onchange="NQI.upd('+i+',\'desc\',this.value)"></td>'+
        '<td style="text-align:right"><input class="m" value="'+Number(r.cost).toFixed(2)+'" onchange="NQI.upd('+i+',\'cost\',this.value)"></td>'+
        (MODE==='quote'?'<td class="r" id="nqi-rt'+i+'"></td>':'')+
      '</tr>';
    }).join('');
    tot();
  }
  function upd(i,k,v){ if(k==='qty'||k==='cost')ROWS[i][k]=num(v); else ROWS[i][k]=v; tot(); }
  function del(i){ ROWS.splice(i,1); drawRows(); }
  function tot(){
    var tc=0;
    ROWS.forEach(function(r,i){ tc+=r.cost*r.qty; if(MODE==='quote'){ var el=document.getElementById('nqi-rt'+i); if(el)el.textContent='$'+retailOf(r.cost).toFixed(2); } });
    var el=document.getElementById('nqi-tot'); if(el){ el.textContent = (MODE==='quote'?'Total cost: $'+tc.toFixed(2):'Total cost: $'+tc.toFixed(2)) + '  ·  '+ROWS.length+' line'+(ROWS.length===1?'':'s'); }
  }
  function titleFrom(r){ return r.code ? r.code : (String(r.desc).split(/[,;]/)[0].slice(0,60) || 'Vendor Item'); }
  function uid(){ return Date.now()+Math.floor(Math.random()*100000); }

  async function addToQuote(){
    if(typeof lines==='undefined'){ alert('Open the Quote Builder first.'); return; }
    if(!ROWS.length){ alert('Nothing to add.'); return; }
    var builderFiles=nsBuilderVendorQuotes;
    if(sourcePDF){
      var session=importSession;
      var button=document.getElementById('nqi-add');
      button.disabled=true;
      try {
        var attachment=await nsStoreVendorQuote(sourcePDF);
        if(session!==importSession || builderFiles!==nsBuilderVendorQuotes)return;
        builderFiles.push(attachment);
      } catch(error) {
        if(session===importSession) alert('Could not save the original PDF. Please try again. You can also reopen the importer and paste the quote text.');
        return;
      } finally {
        if(session===importSession)button.disabled=false;
      }
    }
    var g=marginDec();
    var vendorQuoteSource = ['dyke', 'tlc'].includes(resultVendor)
      ? {vendor: resultVendor, recordedAt: new Date().toISOString()}
      : undefined;
    ROWS.forEach(function(r){
      var unit = g<0.999 ? Math.round(r.cost/(1-g)) : r.cost;
      lines.push({id:uid(),sku:(r.code||'CUSTOM'),item:titleFrom(r),category:'Special Order',group:'Custom',size:'',description:r.desc,cost:r.cost,vendorQuoteSource:vendorQuoteSource ? {...vendorQuoteSource, unitCost:r.cost} : undefined,onHand:null,uom:(r.uom||'EA'),isCustom:true,imageUrl:'',qty:r.qty,retail:unit,gm:g,lineId:uid()});
    });
    if(typeof renderLines==='function') renderLines();
    if(typeof renderSummary==='function') renderSummary();
    var n=ROWS.length; closeImport();
    if(typeof showToast==='function') showToast('✅ '+n+' line'+(n>1?'s':'')+' added to quote','#2d6a30');
  }
  function addToPO(){
    if(typeof poItems==='undefined'){ alert('Open the PO builder first (📦 Create PO), then import.'); return; }
    if(!ROWS.length){ alert('Nothing to add.'); return; }
    ROWS.forEach(function(r){
      poItems.push({include:true,item:titleFrom(r),size:'',description:r.desc,sku:r.code,qty:r.qty,unitCost:r.cost,poIdx:poItems.length,isImported:true});
    });
    if(typeof renderPOItems==='function') renderPOItems();
    var n=ROWS.length; closeImport();
    if(typeof showToast==='function') showToast('✅ '+n+' line'+(n>1?'s':'')+' added to PO','#2d6a30');
  }
  function add(){ if(MODE==='quote') addToQuote(); else addToPO(); }

  window.NQI={ open:openImport, close:closeImport, read:readText, pdf:readPDF, upd:upd, del:del, add:add, tot:tot };

  // ── Inject buttons (mirrors norwood-patch.js's proven .add-row approach) ────
  function injectQuoteBtn(tries){
    tries=tries||0;
    if(document.getElementById('nqi-qbtn')) return;
    var addRow=document.querySelector('.add-row');
    if(!addRow){ if(tries<30) setTimeout(function(){injectQuoteBtn(tries+1);},500); return; }
    var b=document.createElement('button');
    b.id='nqi-qbtn'; b.type='button'; b.className='btn';
    b.textContent='📄 Import Vendor Quote';
    b.style.cssText='background:#E65100;color:#fff;white-space:nowrap;';
    b.onclick=function(){ openImport('quote'); };
    addRow.appendChild(b);
  }
  function injectPOBtn(){
    var list=document.getElementById('po-items-list');
    if(!list || document.getElementById('nqi-pobtn')) return;
    var b=document.createElement('button');
    b.id='nqi-pobtn'; b.type='button'; b.innerHTML='📄 Import Vendor Quote';
    b.style.cssText='display:block;width:100%;margin:0 0 10px;padding:10px;border:1.5px dashed #E65100;background:#fff6ef;color:#E65100;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
    b.onclick=function(){ openImport('po'); };
    list.parentNode.insertBefore(b, list);
  }
  function injectAll(){ injectQuoteBtn(); injectPOBtn(); }
  function init(){
    injectAll();
    if(typeof window.showPOBuilder==='function' && !window._nqiHooked){
      var _spb=window.showPOBuilder;
      window.showPOBuilder=function(){ var r=_spb.apply(this,arguments); setTimeout(injectPOBtn,30); return r; };
      window._nqiHooked=true;
    }
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
  // keep re-checking for a bit in case the quote view renders late or re-renders
  var _nqiTicks=0, _nqiTimer=setInterval(function(){ injectAll(); if(++_nqiTicks>20) clearInterval(_nqiTimer); }, 800);
})();

var nsBuilderVendorQuotes = [];

function nsMergeVendorQuotes(existing, incoming) {
  return Array.from(new Map([...(existing || []), ...(incoming || [])]
    .map(file => [file.path, file])).values());
}

function nsAccessVendorQuote(mode, operation) {
  return new Promise(function(resolve, reject) {
    const open = indexedDB.open('ns_vendor_quote_files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('pdfs');
    open.onerror = () => reject(open.error);
    open.onsuccess = function() {
      const db = open.result;
      const tx = db.transaction('pdfs', mode);
      const request = operation(tx.objectStore('pdfs'));
      tx.oncomplete = function() { db.close(); resolve(request.result); };
      tx.onabort = function() { db.close(); reject(tx.error); };
    };
  });
}

async function nsStoreVendorQuote(file) {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('Choose a PDF file.');
  }
  const path = crypto.randomUUID();
  const pdf = new Blob([file], {type: 'application/pdf'});
  await nsAccessVendorQuote('readwrite', store => store.put({name: file.name, pdf}, path));
  return {path};
}

function nsUpdateInvoiceInternal(id, update) {
  const records = getSavedQuotesRaw();
  const invoice = records.find(q => q.id === id && q.type === 'invoice' && !q.removed);
  if (!invoice) throw new Error('This invoice is no longer available.');
  if (!update(invoice)) return invoice;
  invoice.timestamp = Math.max(Date.now(), (Number(invoice.timestamp) || 0) + 1);
  saveQuotesToStorage(records, true);
  if (nsLastQuoteWriteFailed) throw new Error('Save failed. Please try again.');
  return invoice;
}

function nsRenderInvoiceInternal(reset) {
  const id = currentInvoiceRecordId;
  const invoice = getSavedQuotes().find(q => q.id === id && q.type === 'invoice');
  const costPanel = document.getElementById('inv-internal-costs');
  const filePanel = document.getElementById('inv-vendor-quotes');
  costPanel.hidden = filePanel.hidden = !invoice;
  if (!invoice) return;
  if (reset) costPanel.open = filePanel.open = false;
  const form = document.getElementById('inv-cost-form');
  const items = invoice.lines || [];
  form.innerHTML = items.length ? items.map((line, i) =>
    '<label style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px">' +
    '<span>' + nsEsc(line.item) + (line.size ? ' (' + nsEsc(line.size) + ')' : '') +
    ' · Qty ' + nsEsc(line.qty) + ' · Unit cost</span>' +
    '<input aria-label="Unit cost for line ' + (i + 1) + '" type="number" required min="0" step="0.01" inputmode="decimal" style="width:110px" value="' +
    Number(line.cost || 0).toFixed(2) + '"></label>'
  ).join('') + '<button class="btn btn-g" type="submit">Save Internal Costs</button>' : 'No line items.';
  form.onsubmit = function(event) {
    event.preventDefault();
    const costs = Array.from(form.querySelectorAll('input'), input => input.valueAsNumber);
    try {
      const updated = nsUpdateInvoiceInternal(id, function(record) {
        if (JSON.stringify(record.lines) !== JSON.stringify(items)) {
          throw new Error('The invoice lines changed. Review the latest costs and try again.');
        }
        let changed = false;
        record.lines.forEach(function(line, i) {
          if (costs[i] === Number(Number(line.cost || 0).toFixed(2))) return;
          line.cost = costs[i];
          line.gm = line.retail > 0 ? (line.retail - line.cost) / line.retail : 0;
          line.invoiceCostEdited = true;
          changed = true;
        });
        if (!changed) return false;
        record.cost = record.lines.reduce((total, line) => total + (Number(line.cost) || 0) * line.qty, 0);
        record.profit = record.grand - record.cost;
        return true;
      });
      lines = updated.lines.map(line => ({...line}));
      renderLines();
      renderSummary();
      nsRenderInvoiceInternal(false);
      showToast('Internal costs saved', '#2d6a30');
    } catch (error) {
      nsRenderInvoiceInternal(false);
      showToast(error.message, '#a5251a');
    }
  };

  const files = document.getElementById('inv-vendor-files');
  files.replaceChildren();
  const vendorQuotes = invoice.vendorQuotes || [];
  if (!vendorQuotes.length) files.textContent = 'No vendor quote attached.';
  vendorQuotes.forEach(function(file) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-gh';
    button.style.margin = '0 8px 8px 0';
    button.textContent = 'Open Vendor Quote';
    button.disabled = true;
    const localFile = nsAccessVendorQuote('readonly', store => store.get(file.path));
    localFile.then(function(document) {
      if (!document) {
        button.textContent = 'Vendor quote saved on another browser';
        return;
      }
      button.textContent = 'Open ' + document.name;
      button.disabled = false;
      button.onclick = function() {
        const url = URL.createObjectURL(document.pdf);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
    }).catch(function() { button.textContent = 'Could not read this vendor quote'; });
    files.appendChild(button);
  });

  const upload = document.getElementById('inv-vendor-file');
  upload.onchange = async function() {
    const file = upload.files[0];
    upload.value = '';
    if (!file) return;
    upload.disabled = true;
    try {
      const attachment = await nsStoreVendorQuote(file);
      const updated = nsUpdateInvoiceInternal(id, function(record) {
        record.vendorQuotes = nsMergeVendorQuotes(record.vendorQuotes, [attachment]);
        return true;
      });
      if (id === currentInvoiceRecordId) {
        nsBuilderVendorQuotes = updated.vendorQuotes.slice();
        nsRenderInvoiceInternal(false);
      }
      showToast('Vendor quote attached to ' + updated.quoteNum, '#2d6a30');
    } catch (error) {
      showToast('Could not attach the vendor quote. ' + error.message, '#a5251a');
    } finally {
      upload.disabled = false;
    }
  };
}


(function wireInvoiceInternal() {
  const printContent = document.getElementById('invoice-content');
  if (!printContent) return;
  printContent.insertAdjacentHTML('beforebegin', `<div class="no-print" style="margin-bottom:14px">
      <details id="inv-internal-costs" style="padding:10px 16px;margin-bottom:8px;border:1px solid #e0d5c0;border-radius:7px">
        <summary style="cursor:pointer;font-weight:700">Internal Costs</summary>
        <form id="inv-cost-form" style="margin-top:10px"></form>
      </details>
      <details id="inv-vendor-quotes" style="padding:10px 16px;border:1px solid #e0d5c0;border-radius:7px">
        <summary style="cursor:pointer;font-weight:700">Vendor Quotes</summary>
        <div id="inv-vendor-files" style="margin:10px 0"></div>
        <label>Attach vendor quote PDF <input id="inv-vendor-file" type="file" accept="application/pdf,.pdf"></label>
      </details>
    </div>`);

  const resetBuilder = window.doNewQuote;
  window.doNewQuote = function() {
    nsBuilderVendorQuotes = [];
    return resetBuilder.apply(this, arguments);
  };

  const loadBuilder = window.loadIntoBuilder;
  window.loadIntoBuilder = function(id) {
    const record = getSavedQuotes().find(q => q.id === id);
    const result = loadBuilder.apply(this, arguments);
    if (record) nsBuilderVendorQuotes = (record.vendorQuotes || []).slice();
    return result;
  };

  const saveBuilder = window.saveCurrentQuote;
  window.saveCurrentQuote = function(type) {
    const number = type === 'invoice' ? currentInvNum : quoteNum;
    const saveRecords = window.saveQuotesToStorage;
    const previous = getSavedQuotes().find(q => q.quoteNum === number);
    // Enrich the record before the app's ordinary local save and cloud sync.
    window.saveQuotesToStorage = function(records) {
      const record = records.find(q => q.type === type && q.quoteNum === number);
      if (record) {
        const files = nsMergeVendorQuotes(previous && previous.vendorQuotes, nsBuilderVendorQuotes);
        if (files.length) record.vendorQuotes = files;
        if (type === 'invoice' && previous) {
          ['invoicedBy', 'invoicedAt', 'fromQuoteNum', 'history', 'returnsHistory'].forEach(function(key) {
            if (previous[key] !== undefined) record[key] = previous[key];
          });
          if (record.returnsHistory) recomputePayment(record);
        }
      }
      return saveRecords.apply(this, arguments);
    };
    try {
      return saveBuilder.apply(this, arguments);
    } finally {
      window.saveQuotesToStorage = saveRecords;
    }
  };

  const updateLines = window.recalcLines;
  const setMargin = window.setManualGM;
  let explicitReprice = false;
  window.recalcLines = function() {
    const preserved = currentInvNum && !explicitReprice
      ? lines.filter(line => line.invoiceCostEdited).map(line => [line, line.retail, line.gm]) : [];
    updateLines.apply(this, arguments);
    preserved.forEach(function([line, retail, gm]) {
      line.retail = retail;
      line.gm = gm;
    });
  };
  window.setManualGM = function() {
    explicitReprice = true;
    try { return setMargin.apply(this, arguments); }
    finally { explicitReprice = false; }
  };

  const showInvoice = window.nsShowInvoiceNow;
  window.nsShowInvoiceNow = function() {
    const result = showInvoice.apply(this, arguments);
    nsRenderInvoiceInternal(true);
    return result;
  };
})();
