/* Keep Inventory inside the pricing tool; load it only when selected. */
(function(root){
'use strict';
var D=root.document;
function openInventory(){root.showPage('inventory',D.getElementById('tab-inventory'));}
function mount(){
  var first=D.querySelector('.page');if(!first||D.getElementById('page-inventory'))return;
  var page=D.createElement('div');page.id='page-inventory';page.className='page';
  page.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><strong>Inventory Manager</strong><a href="inventory.html?v=20261002-inv-fallback" target="_blank" rel="noopener" style="font-size:12px;color:#195e94">Open separately</a></div><iframe id="norwood-inventory-frame" title="Norwood Inventory Manager" allow="camera" style="display:block;width:100%;height:calc(100vh - 190px);min-height:580px;border:1px solid #d7dedf;border-radius:9px;background:#f5f7fa"></iframe>';
  first.parentNode.insertBefore(page,first);
  var pictures=D.createElement('div');pictures.id='page-door-pictures';pictures.className='page';
  pictures.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><button class="btn btn-g" id="pictures-back-to-quote">Back to quote</button><a href="door-pictures.html" target="_blank" rel="noopener" style="font-size:14px;color:#195e94">Open pictures separately</a></div><iframe id="norwood-door-pictures-frame" title="Norwood Door Picture Library" allow="clipboard-write" style="display:block;width:100%;height:calc(100vh - 190px);min-height:580px;border:1px solid #d7dedf;border-radius:9px;background:#f4f3ef"></iframe>';
  first.parentNode.insertBefore(pictures,first);
  D.getElementById('pictures-back-to-quote').onclick=function(){root.showPage('quote',D.getElementById('tab-quote'));};
  var show=root.showPage;
  root.showPage=function(name,button){show(name,button);if(name==='door-pictures'){var picturesFrame=D.getElementById('norwood-door-pictures-frame');if(!picturesFrame.getAttribute('src'))picturesFrame.src='door-pictures.html?embedded=1&v=20261003-transparent-glass';}if(name==='inventory'){var frame=D.getElementById('norwood-inventory-frame');if(!frame.getAttribute('src'))frame.src='inventory.html?embedded=1&v=20261002-inv-fallback';}};
  root.NWNavigation={openInventory:openInventory};
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',mount);else mount();
})(window);

/* Load the engineered-wood category on every existing pricing-tool entry point. */
(function(){var s=document.createElement('script');s.src='norwood-beams.js?v=20261008-bluelinx';document.head.appendChild(s);})();

/* Quick, read-only lookup based on the current in-app product catalog. */
(function(root){
'use strict';
var D=root.document;
function esc(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function catalog(){
 var list=[];try{if(Array.isArray(products))list=products.slice();}catch(e){}
 var ids=new Set(list.map(function(p){return String(p.id);}));
 try{var edits=JSON.parse(localStorage.getItem('ns_edits')||'{}');Object.keys(edits).forEach(function(id){var p=edits[id];if(p && /^SO-/.test(String(p.sku||''))&&!ids.has(String(p.id))){list.push(Object.assign({},p,{lookupSource:'Saved custom item'}));ids.add(String(p.id));}});}catch(e){}
 try{var quotes=JSON.parse(localStorage.getItem('ns_quotes')||'[]');if(Array.isArray(quotes))quotes.forEach(function(q){if(!q||!Array.isArray(q.lines))return;q.lines.forEach(function(p){if(!p||!(p.isCustom||p.sku==='CUSTOM'||p.sku==='SO-DOOR'))return;list.push(Object.assign({},p,{lookupSource:'Previous quote '+(q.quoteNum||'')+' · '+(q.date||'date unavailable')+' — verify cost'}));});});}catch(e){}
 return list;
}
function options(el, values, first){var old=el.value;el.innerHTML='<option value="">'+first+'</option>'+values.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');if(values.indexOf(old)!==-1)el.value=old;}
function sorted(values){return Array.from(new Set(values.filter(Boolean))).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});}
function mount(){
 var nav=D.querySelector('.nav'), first=D.querySelector('.page');if(!nav||!first||D.getElementById('page-price-list'))return;
 var tab=D.createElement('button');tab.className='tab';tab.id='tab-price-list';tab.textContent='💲 Price List';tab.title='Look up catalog prices';tab.onclick=function(){root.showPage('price-list',tab);refresh();};
 var anchor=D.getElementById('tab-inventory');nav.insertBefore(tab,anchor||null);
 var page=D.createElement('div');page.id='page-price-list';page.className='page';page.innerHTML='<section style="background:white;padding:20px;border-radius:10px"><h2 style="margin:0 0 6px">Price List</h2><p style="margin:0 0 16px;color:#526173">Quick lookup: prices are cost plus 30%, before tax. Door options and custom configurations require a quote. Items without a cost are marked for verification.</p><div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"><label>Category<br><select id="pl-category" style="min-width:190px;padding:9px"><option value="">All categories</option></select></label><label>Type<br><select id="pl-group" style="min-width:190px;padding:9px"><option value="">All types</option></select></label><label>Search<br><input id="pl-search" type="search" placeholder="Item, size or SKU" style="min-width:220px;padding:9px"></label></div><div id="pl-count" aria-live="polite" style="margin-bottom:10px;color:#526173"></div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:9px;border-bottom:2px solid #ddd">Item / size</th><th style="padding:9px;border-bottom:2px solid #ddd">Category / type</th><th style="padding:9px;border-bottom:2px solid #ddd">Unit</th><th style="padding:9px;border-bottom:2px solid #ddd">Price</th></tr></thead><tbody id="pl-results"></tbody></table></div></section>';
 first.parentNode.insertBefore(page,first);
 var cat=D.getElementById('pl-category'),group=D.getElementById('pl-group'),search=D.getElementById('pl-search');
 function refresh(){var list=catalog();options(cat,sorted(list.map(function(p){return String(p.category||'Other');})),'All categories');var filtered=list.filter(function(p){return !cat.value||String(p.category||'Other')===cat.value;});options(group,sorted(filtered.map(function(p){return String(p.group||'');})),'All types');var q=search.value.trim().toLowerCase();filtered=filtered.filter(function(p){return (!group.value||p.group===group.value)&&(!q||[p.item,p.name,p.description,p.size,p.sku,p.category,p.group].join(' ').toLowerCase().indexOf(q)!==-1);});D.getElementById('pl-count').textContent=filtered.length+' item'+(filtered.length===1?'':'s')+' found';D.getElementById('pl-results').innerHTML=filtered.map(function(p){var cost=Number(p.cost),valid=p.cost!==null&&p.cost!==''&&Number.isFinite(cost)&&cost>0;var price=valid?'$'+(Math.round((cost*1.3+Number.EPSILON)*100)/100).toFixed(2):'Cost unavailable — verify price';return '<tr><td style="padding:9px;border-bottom:1px solid #eee"><strong>'+esc(p.item||p.name||'Unnamed item')+'</strong>'+(p.size?' · '+esc(p.size):'')+(p.sku?'<br><small>SKU '+esc(p.sku)+'</small>':'')+(p.lookupSource?'<br><small>'+esc(p.lookupSource)+'</small>':'')+'</td><td style="padding:9px;border-bottom:1px solid #eee">'+esc(p.category||'Other')+(p.group?'<br><small>'+esc(p.group)+'</small>':'')+'</td><td style="padding:9px;border-bottom:1px solid #eee">'+esc(p.uom||'each')+'</td><td style="padding:9px;border-bottom:1px solid #eee;white-space:nowrap">'+esc(price)+'</td></tr>';}).join('')||'<tr><td colspan="4" style="padding:16px">No matching items found.</td></tr>';}
 cat.onchange=function(){group.value='';refresh();};group.onchange=refresh;search.oninput=refresh;
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',mount);else mount();
})(window);
