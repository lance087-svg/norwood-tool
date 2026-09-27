/* ============================================================
   Norwood Door Renderer — door-render.js  (build 2026-09-27)
   Draws a clean elevation of a door from the line's spec:
   single / double / single + 2 sidelights, panel style or lite,
   hand + swing viewed from OUTSIDE, mini plan-view swing diagram.
   Hooks: imgHTML() fallback for door lines, print thumbnail,
   "🖼 Door image" button + modal (PNG download / copy / share).
   ============================================================ */
(function(){
  'use strict';
  var NS = window.NSDoorRender = {};

  /* ---------- parsing ---------- */
  function num(x){ x=parseFloat(x); return isNaN(x)?null:x; }
  // "3/0 x 6/8", "3-0x6-8", "36 x 80", "36x80", "3068", "2868" -> {w,h} inches
  NS.parseSize = function(s){
    if(!s) return null; s=String(s).replace(/["'”’]/g,'').trim();
    var m;
    if((m=s.match(/(\d)\s*[\/\-]\s*(\d{1,2})\s*[xX×]\s*(\d)\s*[\/\-]\s*(\d{1,2})/))) return {w:+m[1]*12+ +m[2], h:+m[3]*12+ +m[4]};
    if((m=s.match(/(\d{2,3})(?:\.\d+)?\s*[xX×]\s*(\d{2,3})/))){ var w=+m[1],h=+m[2]; if(w>=20&&w<=96&&h>=70&&h<=100) return {w:w,h:h}; }
    if((m=s.match(/\b([2-6])([0-9])([6-8])([0-9])\b/))){ return {w:+m[1]*12+ +m[2], h:+m[3]*12+ +m[4]}; }
    return null;
  };
  // Build a render spec from a quote line (or product).
  NS.specFromLine = function(l){
    l=l||{}; var ds=l.doorSpec||{};
    var txt=[l.item,l.description,l.size,l.group,l.category,ds.nominalSize,ds.netSize].filter(Boolean).join(' ');
    var t=txt.toLowerCase();
    var size = NS.parseSize(ds.netSize)||NS.parseSize(ds.nominalSize)||NS.parseSize(l.size)||NS.parseSize(l.item)||NS.parseSize(l.description);
    var isDoor = !!l.doorSpec || /door|prehung|slab|unit\b|entry|french|craftsman|shaker|6[- ]panel|lite\b/.test(t);
    if(!isDoor) return null;
    var spec={};
    // config
    var cfg = (ds.renderConfig||'').toLowerCase();
    if(!cfg){
      if(/sidel|1\/0\s*x\s*3\/0\s*x\s*1\/0|12\s*x\s*36\s*x\s*12/.test(t)) cfg='sidelights';
      else if(/double|french|\b5\/0|\b6\/0|\b5-0|\b6-0|\b5\/4|\b60\s*x|\b64\s*x|\b72\s*x|\bdbl\b/.test(t) || (size&&size.w>=56)) cfg='double';
      else cfg='single';
    }
    spec.config=cfg;
    // size: for doubles the parsed size is the unit width; per leaf = w/2
    if(size){ spec.height=size.h; spec.width = (cfg==='double' && size.w>=56)? size.w/2 : (cfg==='sidelights' && size.w>=50 ? size.w-24 : size.w); }
    else { spec.height=80; spec.width=36; spec.sizeGuess=true; }
    // lite / style
    var lite=(ds.renderLite||'').toLowerCase();
    if(!lite){
      if(/full[- ]?lite|flush\s*gl|\bfull\b.*(glass|lite)|french|15[- ]lite|1[- ]lite\b/.test(t)) lite='full';
      else if(/3\/4[- ]?lite|three.quarter/.test(t)) lite='3/4';
      else if(/half[- ]?lite|1\/2[- ]?lite|\b9[- ]lite|fan[- ]?lite/.test(t)) lite='half';
      else if(/\b(3|4|6)[- ]lite|craftsman/.test(t)) lite='craftsman';
      else if(/oval|decorative/.test(t)) lite='oval';
      else lite='none';
    }
    spec.lite=lite;
    var style=(ds.renderStyle||'').toLowerCase();
    if(!style){
      if(/6[- ]panel|six[- ]panel/.test(t)) style='6-panel';
      else if(/shaker|2[- ]panel\s*(square|shaker)|flat[- ]panel/.test(t)) style='shaker';
      else if(/craftsman|3[- ]panel/.test(t)) style='craftsman';
      else if(/2[- ]panel|two[- ]panel|arch/.test(t)) style='2-panel';
      else if(/flush|smooth\b(?!.*panel)/.test(t)) style='flush';
      else style='6-panel';
    }
    spec.style=style;
    // hand & swing (residential: stand outside, hinges on your right = RH)
    var hand=(ds.hand||'').toUpperCase();
    if(!/^(LH|RH)$/.test(hand)){ hand = /\b(lh|left)/.test(t)?'LH':/\b(rh|right)/.test(t)?'RH':'RH'; if(!/\b(lh|rh|left|right)/.test(t)) spec.handGuess=true; }
    else hand = hand.slice(0,2);
    spec.hand=hand;
    var swing=(ds.swing||'').toLowerCase();
    if(!/in|out/.test(swing)){ swing=/outswing|\bos\b|out[- ]swing/.test(t)?'outswing':'inswing'; }
    else swing=/out/.test(swing)?'outswing':'inswing';
    spec.swing=swing;
    spec.exterior = !/interior/.test(t) || /exterior/.test(t);
    spec.finish = /black/.test(t)?'#2b2b2b':/(oak|wood|stain|mahogany|fir|cherry)/.test(t)?'#b57a3f':'#fdfdfb';
    spec.label = l.item||'';
    return spec;
  };

  /* ---------- drawing ---------- */
  function rr(x,y,w,h,fill,stroke,sw){ return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(sw||1.5)+'"/>'; }
  function panel(x,y,w,h,dark){ var ink=dark?'#3a3a3a':'#777', inner=dark?'#4a4a4a':'#bbb'; return rr(x,y,w,h,dark?'rgba(0,0,0,.18)':'#f3f3ef',ink)+rr(x+7,y+7,w-14,h-14,'none',inner,1); }
  function glass(x,y,w,h,kind){
    var o=rr(x,y,w,h,'#cfe4f2','#6b8fa6',2)+rr(x+5,y+5,w-10,h-10,'none','#fff',1.5);
    o+='<line x1="'+(x+w*.12)+'" y1="'+(y+h*.1)+'" x2="'+(x+w*.42)+'" y2="'+(y+h*.5)+'" stroke="#fff" stroke-width="5" opacity=".55"/>';
    if(kind==='grid'){ var cols=3, rows=Math.max(3,Math.round(h/(w/cols))); for(var i=1;i<cols;i++) o+='<line x1="'+(x+w*i/cols)+'" y1="'+y+'" x2="'+(x+w*i/cols)+'" y2="'+(y+h)+'" stroke="#fff" stroke-width="3"/>'; for(var j=1;j<rows;j++) o+='<line x1="'+x+'" y1="'+(y+h*j/rows)+'" x2="'+(x+w)+'" y2="'+(y+h*j/rows)+'" stroke="#fff" stroke-width="3"/>'; }
    return o;
  }
  function panelsFor(style,x,y,w,h,dark){
    var r=[];
    if(style==='6-panel'){ [[.14,.30],[.56,.30]].forEach(function(c){ [[.06,.16],[.27,.28],[.60,.28]].forEach(function(rw){ r.push(panel(x+c[0]*w,y+rw[0]*h,c[1]*w,rw[1]*h,dark)); }); }); }
    else if(style==='2-panel'){ r.push(panel(x+.14*w,y+.06*h,.72*w,.38*h,dark),panel(x+.14*w,y+.50*h,.72*w,.42*h,dark)); }
    else if(style==='shaker'){ r.push(panel(x+.12*w,y+.06*h,.76*w,.86*h,dark)); }
    else if(style==='craftsman'){ r.push(panel(x+.12*w,y+.30*h,.76*w,.62*h,dark)); }
    return r.join('');
  }
  function leaf(x,y,w,h,spec,hingeRight,active){
    var dark = spec.finish!=='#fdfdfb';
    var o=rr(x,y,w,h,spec.finish,'#444',2.5);
    var lite=spec.lite;
    if(lite==='full'){ o+=glass(x+w*.13,y+h*.05,w*.74,h*.88,'grid'==(spec.grid?'grid':'') ? 'grid':''); }
    else if(lite==='3/4'){ o+=glass(x+w*.13,y+h*.05,w*.74,h*.62,''); o+=panel(x+.14*w,y+.72*h,.30*w,.20*h,dark)+panel(x+.56*w,y+.72*h,.30*w,.20*h,dark); }
    else if(lite==='half'){ o+=glass(x+w*.13,y+h*.05,w*.74,h*.44,''); o+=panel(x+.14*w,y+.55*h,.30*w,.37*h,dark)+panel(x+.56*w,y+.55*h,.30*w,.37*h,dark); }
    else if(lite==='craftsman'){ o+=glass(x+w*.13,y+h*.05,w*.74,h*.22,'grid'); o+=panelsFor('craftsman',x,y,w,h,dark); }
    else if(lite==='oval'){ o+='<ellipse cx="'+(x+w/2)+'" cy="'+(y+h*.42)+'" rx="'+(w*.30)+'" ry="'+(h*.34)+'" fill="#cfe4f2" stroke="#6b8fa6" stroke-width="2"/>'; }
    else { o+=panelsFor(spec.style,x,y,w,h,dark); }
    // hinges
    var hx = hingeRight ? x+w-5 : x+1;
    [.10,.50,.90].forEach(function(f){ o+='<rect x="'+hx+'" y="'+(y+h*f-16)+'" width="4" height="32" fill="#8c8c86"/>'; });
    if(active!==false){ var kx = hingeRight ? x+w*.09 : x+w*.91; o+='<circle cx="'+kx+'" cy="'+(y+h*.52)+'" r="7" fill="#b5b5ae" stroke="#666" stroke-width="1.5"/><circle cx="'+kx+'" cy="'+(y+h*.45)+'" r="4.5" fill="#b5b5ae" stroke="#666" stroke-width="1.5"/>'; }
    return o;
  }
  function ft(inches){ return Math.floor(inches/12)+'/'+(inches%12); }

  NS.svg = function(spec, opts){
    opts=opts||{}; var compact=!!opts.compact;
    var S=5.5, jamb=4, pad=compact?12:90;
    var dw=spec.width*S, dh=spec.height*S, sw=12*S;
    var cfg=spec.config;
    var parts = cfg==='double'?['leafL','leafR'] : cfg==='sidelights'?['sl','door','sl'] : ['door'];
    var widths = parts.map(function(p){ return p==='sl'?sw:dw; });
    var total = widths.reduce(function(a,b){return a+b;},0) + jamb*(parts.length+1);
    var planH = compact?0:(dw*0.45+125);
    var W=Math.max(total+2*pad, compact?0:560), H=compact?(dh+jamb*2+pad*2):(dh+jamb*2+pad+planH+22);
    var o=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(0)+' '+H.toFixed(0)+'" width="'+W.toFixed(0)+'" height="'+H.toFixed(0)+'" font-family="Helvetica, Arial, sans-serif">'];
    o.push('<rect width="100%" height="100%" fill="#fff"/>');
    var ox=(W-total)/2+jamb, oy=pad+(compact?0:0);
    o.push(rr(ox-jamb,oy-jamb,total,dh+jamb*2,'#e9e9e6','#8a8a85',2));
    var hingeRight = spec.hand==='RH';
    var x=ox, doorX=null;
    parts.forEach(function(p,i){
      if(p==='sl'){ o.push(rr(x,oy,sw,dh,'#fafaf8','#555',2)); o.push(glass(x+sw*.15,oy+dh*.06,sw*.7,dh*.86,'')); x+=sw+jamb; }
      else if(p==='door'){ doorX=x; o.push(leaf(x,oy,dw,dh,spec,hingeRight,true)); x+=dw+jamb; }
      else if(p==='leafL'){ doorX=x; o.push(leaf(x,oy,dw,dh,spec,false, !hingeRight)); x+=dw; }
      else if(p==='leafR'){ o.push('<rect x="'+(x-2)+'" y="'+oy+'" width="4" height="'+dh+'" fill="#9a9a94"/>'); o.push(leaf(x,oy,dw,dh,spec,true, hingeRight)); x+=dw+jamb; }
    });
    o.push('<rect x="'+(ox-jamb)+'" y="'+(oy+dh)+'" width="'+total+'" height="'+(jamb+6)+'" fill="#9a9a94"/>');
    if(!compact){
      // plan-view swing diagram (viewer = OUTSIDE at bottom)
      var L=dw*0.45, cx=W/2, sy = spec.swing==='inswing' ? oy+dh+jamb+50+L : oy+dh+jamb+40;
      var dbl = cfg==='double';
      var px = hingeRight? cx+(dbl?L:L/2) : cx-(dbl?L:L/2);
      var fx = hingeRight? px-L : px+L;
      o.push('<line x1="'+(cx-L*1.3)+'" y1="'+sy+'" x2="'+(cx+L*1.3)+'" y2="'+sy+'" stroke="#bbb" stroke-width="1"/>');
      var oy2 = spec.swing==='inswing'? sy-L : sy+L;
      var sweep = ((spec.swing==='inswing')===hingeRight)?1:0;
      function arc(px,fx,dashed){ o.push('<line x1="'+px+'" y1="'+sy+'" x2="'+fx+'" y2="'+sy+'" stroke="#333" stroke-width="4"/>'); o.push('<path d="M '+fx+' '+sy+' A '+L+' '+L+' 0 0 '+sweep+' '+px+' '+oy2+'" fill="none" stroke="#1E70B8" stroke-width="2" stroke-dasharray="'+(dashed?'6 5':'6 5')+'"/>'); o.push('<line x1="'+px+'" y1="'+sy+'" x2="'+px+'" y2="'+oy2+'" stroke="#1E70B8" stroke-width="2.5"/><circle cx="'+px+'" cy="'+sy+'" r="4" fill="#333"/>'); }
      arc(px,fx,false);
      if(dbl){ var px2 = hingeRight? cx-L : cx+L, fx2 = hingeRight? px2+L : px2-L; sweep=1-sweep; o.push('<g opacity=".45">'); arc(px2,fx2,true); o.push('</g>'); sweep=1-sweep; }
      o.push('<text x="'+cx+'" y="'+(spec.swing==='inswing'?sy-L-8:sy-8)+'" text-anchor="middle" font-size="12" fill="#666">INSIDE</text>');
      o.push('<text x="'+cx+'" y="'+(spec.swing==='outswing'?sy+L+18:sy+18)+'" text-anchor="middle" font-size="12" fill="#666">OUTSIDE (you)</text>');
      o.push('<text x="'+cx+'" y="'+(spec.swing==='outswing'?sy+L+36:sy+36)+'" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E70B8">'+spec.hand+' '+spec.swing.toUpperCase()+(dbl?' · active leaf':'')+'</text>');
      // header
      var cfgTxt = cfg==='double'?'Double '+ft(spec.width*2)+' x '+ft(spec.height) : cfg==='sidelights'? ft(spec.width)+' x '+ft(spec.height)+' + 2 sidelights' : ft(spec.width)+' x '+ft(spec.height);
      var styleTxt = spec.lite==='none' ? spec.style : (spec.lite==='craftsman'?'Craftsman lite':spec.lite+' lite');
      o.push('<text x="'+W/2+'" y="'+(oy-40)+'" text-anchor="middle" font-size="20" font-weight="bold" fill="#1E70B8">'+esc(cfgTxt+'  ·  '+styleTxt+'  ·  '+spec.hand+' '+spec.swing)+'</text>');
      o.push('<text x="'+W/2+'" y="'+(oy-18)+'" text-anchor="middle" font-size="12" fill="#666">Viewed from OUTSIDE · hinges on your '+(hingeRight?'right':'left')+' · illustration, not to scale'+(spec.sizeGuess?' · size not confirmed':'')+'</text>');
      o.push('<text x="'+(W-20)+'" y="'+(H-12)+'" text-anchor="end" font-size="11" fill="#999">Norwood Supply · 904-768-6818</text>');
    }
    o.push('</svg>'); return o.join('');
  };
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  NS.dataUri = function(svg){ return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); };
  NS.thumb = function(l, px){ var s=NS.specFromLine(l); if(!s) return ''; px=px||46; return '<img src="'+NS.dataUri(NS.svg(s,{compact:true}))+'" style="width:'+px+'px;height:'+Math.round(px*1.3)+'px;object-fit:contain;background:#fff;border-radius:4px;border:1px solid #d5c8a8;flex-shrink:0" alt="door">'; };

  /* ---------- PNG / share ---------- */
  NS.toPng = function(svg, scale, cb){
    var img=new Image(); var m=svg.match(/width="(\d+)" height="(\d+)"/); var w=+m[1], h=+m[2]; scale=scale||2;
    img.onload=function(){ var c=document.createElement('canvas'); c.width=w*scale; c.height=h*scale; var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height); c.toBlob(function(b){ cb(b,c); },'image/png'); };
    img.src=NS.dataUri(svg);
  };

  /* ---------- modal ---------- */
  var cur=null;
  function ensureModal(){
    if(document.getElementById('nsdr-modal')) return;
    var d=document.createElement('div'); d.id='nsdr-modal'; d.className='hidden';
    d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px';
    d.innerHTML='<div style="background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:96vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.35)">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee"><div style="font-weight:800;color:#1E70B8;font-size:16px">🖼 Door image</div><button onclick="NSDoorRender.close()" style="border:0;background:#f2f2f2;border-radius:8px;padding:6px 12px;font-size:16px;cursor:pointer">✕</button></div>'
      +'<div id="nsdr-controls" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:#faf7f0;border-bottom:1px solid #eee;font-size:12px"></div>'
      +'<div id="nsdr-img" style="padding:12px;text-align:center;background:#fff"></div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-top:1px solid #eee;background:#fafafa">'
      +'<button onclick="NSDoorRender.share()" style="flex:1;min-width:140px;background:#1E70B8;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer">📤 Send / Share</button>'
      +'<button onclick="NSDoorRender.copy()" style="flex:1;min-width:120px;background:#2e7d32;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer">📋 Copy image</button>'
      +'<button onclick="NSDoorRender.download()" style="flex:1;min-width:120px;background:#555;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer">⬇️ Download PNG</button>'
      +'</div><div id="nsdr-msg" style="padding:0 16px 12px;font-size:12px;color:#666"></div></div>';
    d.addEventListener('click',function(e){ if(e.target===d) NS.close(); });
    document.body.appendChild(d);
  }
  function sel(id,label,opts,val){ return '<label style="display:flex;flex-direction:column;gap:2px;font-weight:700;color:#6b5a3a">'+label+'<select data-k="'+id+'" onchange="NSDoorRender.change(this)" style="padding:5px 6px;border:1px solid #d5c8a8;border-radius:6px;font-size:12px;background:#fff">'+opts.map(function(o){ var v=o[0],t=o[1]; return '<option value="'+v+'"'+(v===val?' selected':'')+'>'+t+'</option>'; }).join('')+'</select></label>'; }
  NS.open = function(lineId){
    ensureModal();
    var arr=(typeof lines!=='undefined'&&Array.isArray(lines))?lines:(window.lines||[]);
    var l = arr.find(function(x){ return x.lineId===lineId; });
    if(!l){ return; }
    cur={line:l, spec:NS.specFromLine(l)||{config:'single',width:36,height:80,style:'6-panel',lite:'none',hand:'RH',swing:'inswing',finish:'#fdfdfb'}};
    var s=cur.spec;
    var widths=[24,28,30,32,34,36].map(function(w){ return [String(w),ft(w)+' ('+w+'")']; });
    var heights=[[ '80','6/8 (80")'],['84','7/0 (84")'],['96','8/0 (96")']];
    document.getElementById('nsdr-controls').innerHTML =
      sel('config','Unit',[['single','Single'],['double','Double'],['sidelights','Single + 2 sidelights']],s.config)
      +sel('width',s.config==='double'?'Leaf width':'Door width',widths,String(Math.round(s.width)))
      +sel('height','Height',heights,String(Math.round(s.height)))
      +sel('style','Panel style',[['6-panel','6-panel'],['2-panel','2-panel'],['shaker','Shaker'],['craftsman','Craftsman'],['flush','Flush']],s.style)
      +sel('lite','Glass',[['none','None'],['half','Half lite'],['3/4','3/4 lite'],['full','Full lite'],['craftsman','Craftsman 3-lite'],['oval','Oval / decorative']],s.lite)
      +sel('hand','Hand (from outside)',[['RH','Right hand'],['LH','Left hand']],s.hand)
      +sel('swing','Swing',[['inswing','Inswing'],['outswing','Outswing']],s.swing);
    NS.redraw();
    document.getElementById('nsdr-modal').classList.remove('hidden');
    document.getElementById('nsdr-msg').textContent = s.handGuess ? '⚠ Hand was not in the spec — check it before sending.' : '';
  };
  NS.change = function(el){
    var k=el.getAttribute('data-k'), v=el.value; var s=cur.spec;
    if(k==='width'||k==='height') s[k]=+v; else s[k]=v;
    // persist the corrections onto the line's doorSpec so the print + thumbnail follow
    var l=cur.line; l.doorSpec=l.doorSpec||{};
    if(k==='config') l.doorSpec.renderConfig=v; if(k==='style') l.doorSpec.renderStyle=v; if(k==='lite') l.doorSpec.renderLite=v;
    if(k==='hand') l.doorSpec.hand=v; if(k==='swing') l.doorSpec.swing=v;
    if(k==='width'||k==='height'||k==='config'){ var w=Math.round(s.config==='double'?s.width*2:s.width); l.doorSpec.nominalSize = ft(w)+' x '+ft(Math.round(s.height)); }
    s.handGuess=false; s.sizeGuess=false;
    NS.redraw(); if(typeof renderLines==='function') renderLines();
    document.getElementById('nsdr-msg').textContent='Saved to this line\'s door spec.';
  };
  NS.redraw = function(){ cur.svg=NS.svg(cur.spec); document.getElementById('nsdr-img').innerHTML='<img src="'+NS.dataUri(cur.svg)+'" style="max-width:100%;height:auto;max-height:64vh">'; };
  NS.close = function(){ var m=document.getElementById('nsdr-modal'); if(m) m.classList.add('hidden'); };
  function fname(){ var l=cur.line; return 'Norwood-door-'+String(l.item||'door').replace(/[^a-z0-9]+/gi,'-').slice(0,40)+'.png'; }
  function msg(t){ document.getElementById('nsdr-msg').textContent=t; }
  NS.download = function(){ NS.toPng(cur.svg,2,function(blob){ var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fname(); document.body.appendChild(a); a.click(); a.remove(); msg('Downloaded '+a.download); }); };
  NS.copy = function(){ NS.toPng(cur.svg,2,function(blob){ if(navigator.clipboard&&window.ClipboardItem){ navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(function(){ msg('Copied — paste it into a text or email.'); },function(){ msg('Copy blocked by the browser — use Download instead.'); }); } else msg('Copy not supported here — use Download.'); }); };
  NS.share = function(){ NS.toPng(cur.svg,2,function(blob){ var f=new File([blob],fname(),{type:'image/png'}); var l=cur.line; var text='Norwood Supply — '+(l.item||'door')+'\nNorwood Supply · 904-768-6818'; if(navigator.canShare&&navigator.canShare({files:[f]})){ navigator.share({files:[f],title:'Door from Norwood Supply',text:text}).then(function(){ msg('Shared.'); }).catch(function(){}); } else { NS.download(); msg('Share sheet not available on this device — the PNG was downloaded; attach it to your text or email.'); } }); };

  /* ---------- hooks into the quote builder ---------- */
  NS.btnHTML = function(l){ if(!NS.specFromLine(l)) return ''; return ' <button onclick="NSDoorRender.open('+l.lineId+')" title="Door image to send the customer" style="font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid #9cc0de;background:#eaf3fb;cursor:pointer;color:#1E70B8;vertical-align:middle">🖼 Door image</button>'; };
  NS.printImg = function(l){
    if(l.imageUrl) return '<img src="'+l.imageUrl+'" style="width:46px;height:46px;object-fit:cover;border-radius:4px;border:1px solid #d5c8a8;flex-shrink:0" loading="lazy">';
    return NS.thumb(l,46);
  };
  // imgHTML fallback: door lines with no photo get the drawing instead of the generic icon
  function wrapImg(){
    if(typeof window.imgHTML!=='function' || window.imgHTML.__nsdr) return;
    var orig=window.imgHTML;
    var w=function(p){ if(!p.imageUrl && p.lineId!==undefined){ var s=NS.specFromLine(p); if(s) return '<img src="'+NS.dataUri(NS.svg(s,{compact:true}))+'" style="width:100%;height:100%;object-fit:contain;background:#fff;display:block">'; } return orig(p); };
    w.__nsdr=true; window.imgHTML=w;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wrapImg); else wrapImg();
})();
