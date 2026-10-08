/* BlueLinx onCENTER Standard Dealer sheet, effective 2026-07-13. */
(function(root){
'use strict';
const source = [
  {
    "id": 87000,
    "sku": "BLX-EWP-001",
    "item": "onCENTER BLI 40 - 2 1/2\" x 11 7/8\"",
    "size": "2 1/2\" x 11 7/8\"",
    "group": "I-Joists",
    "stockStatus": "Special Order",
    "stockUnitCost": 3.16,
    "jobLotCost": 3.36,
    "uom": "LF",
    "weight": 2.9,
    "piecesPerUnit": 33
  },
  {
    "id": 87001,
    "sku": "BLX-EWP-002",
    "item": "onCENTER BLI 40 - 2 1/2\" x 14\"",
    "size": "2 1/2\" x 14\"",
    "group": "I-Joists",
    "stockStatus": "Special Order",
    "stockUnitCost": 3.37,
    "jobLotCost": 3.63,
    "uom": "LF",
    "weight": 3.3,
    "piecesPerUnit": 33
  },
  {
    "id": 87002,
    "sku": "BLX-EWP-003",
    "item": "onCENTER BLI 40 - 2 1/2\" x 16\"",
    "size": "2 1/2\" x 16\"",
    "group": "I-Joists",
    "stockStatus": "Yulee",
    "stockUnitCost": 3.64,
    "jobLotCost": 3.82,
    "uom": "LF",
    "weight": 3.6,
    "piecesPerUnit": 33
  },
  {
    "id": 87003,
    "sku": "BLX-EWP-004",
    "item": "onCENTER BLI 65 - 3 1/2\" x 11 7/8\"",
    "size": "3 1/2\" x 11 7/8\"",
    "group": "I-Joists",
    "stockStatus": "Yulee",
    "stockUnitCost": 3.42,
    "jobLotCost": 3.66,
    "uom": "LF",
    "weight": 3.5,
    "piecesPerUnit": 23
  },
  {
    "id": 87004,
    "sku": "BLX-EWP-005",
    "item": "onCENTER BLI 65 - 3 1/2\" x 14\"",
    "size": "3 1/2\" x 14\"",
    "group": "I-Joists",
    "stockStatus": "Yulee",
    "stockUnitCost": 3.65,
    "jobLotCost": 3.9,
    "uom": "LF",
    "weight": 3.8,
    "piecesPerUnit": 23
  },
  {
    "id": 87005,
    "sku": "BLX-EWP-006",
    "item": "onCENTER BLI 65 - 3 1/2\" x 16\"",
    "size": "3 1/2\" x 16\"",
    "group": "I-Joists",
    "stockStatus": "Yulee",
    "stockUnitCost": 3.9,
    "jobLotCost": 4.19,
    "uom": "LF",
    "weight": 4.0,
    "piecesPerUnit": 23
  },
  {
    "id": 87006,
    "sku": "BLX-EWP-007",
    "item": "onCENTER BLI 80 - 3 1/2\" x 14\"",
    "size": "3 1/2\" x 14\"",
    "group": "I-Joists",
    "stockStatus": "Special Order",
    "stockUnitCost": 4.2,
    "jobLotCost": 4.49,
    "uom": "LF",
    "weight": 3.9,
    "piecesPerUnit": 24
  },
  {
    "id": 87007,
    "sku": "BLX-EWP-008",
    "item": "onCENTER BLI 80 - 3 1/2\" x 16\"",
    "size": "3 1/2\" x 16\"",
    "group": "I-Joists",
    "stockStatus": "Yulee",
    "stockUnitCost": 4.37,
    "jobLotCost": 4.68,
    "uom": "LF",
    "weight": 4.1,
    "piecesPerUnit": 24
  },
  {
    "id": 87008,
    "sku": "BLX-EWP-009",
    "item": "1 3/4\" x 7 1/4\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 7 1/4\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 4.03,
    "jobLotCost": 4.35,
    "uom": "LF",
    "weight": 4.2,
    "piecesPerUnit": 25
  },
  {
    "id": 87009,
    "sku": "BLX-EWP-010",
    "item": "1 3/4\" x 9 1/4\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 9 1/4\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 4.94,
    "jobLotCost": 5.33,
    "uom": "LF",
    "weight": 4.2,
    "piecesPerUnit": 25
  },
  {
    "id": 87010,
    "sku": "BLX-EWP-011",
    "item": "1 3/4\" x 9 1/2\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 9 1/2\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 5.24,
    "jobLotCost": 5.66,
    "uom": "LF",
    "weight": 4.2,
    "piecesPerUnit": 25
  },
  {
    "id": 87011,
    "sku": "BLX-EWP-012",
    "item": "1 3/4\" x 11 1/4\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 11 1/4\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 5.97,
    "jobLotCost": 6.71,
    "uom": "LF",
    "weight": 5.4,
    "piecesPerUnit": 20
  },
  {
    "id": 87012,
    "sku": "BLX-EWP-013",
    "item": "1 3/4\" x 11 7/8\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 11 7/8\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 6.64,
    "jobLotCost": 7.15,
    "uom": "LF",
    "weight": 5.4,
    "piecesPerUnit": 20
  },
  {
    "id": 87013,
    "sku": "BLX-EWP-014",
    "item": "1 3/4\" x 14\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 14\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 8.04,
    "jobLotCost": 8.4,
    "uom": "LF",
    "weight": 6.4,
    "piecesPerUnit": 15
  },
  {
    "id": 87014,
    "sku": "BLX-EWP-015",
    "item": "1 3/4\" x 16\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 16\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 9.21,
    "jobLotCost": 9.61,
    "uom": "LF",
    "weight": 7.3,
    "piecesPerUnit": 15
  },
  {
    "id": 87015,
    "sku": "BLX-EWP-016",
    "item": "1 3/4\" x 18\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 18\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 10.32,
    "jobLotCost": 10.77,
    "uom": "LF",
    "weight": 8.2,
    "piecesPerUnit": 10
  },
  {
    "id": 87016,
    "sku": "BLX-EWP-017",
    "item": "1 3/4\" x 20\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 20\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 11.5,
    "jobLotCost": 12.01,
    "uom": "LF",
    "weight": 8.2,
    "piecesPerUnit": 10
  },
  {
    "id": 87017,
    "sku": "BLX-EWP-018",
    "item": "1 3/4\" x 24\" onCENTER LVL 2.1E",
    "size": "1 3/4\" x 24\"",
    "group": "LVL Beams",
    "stockStatus": "Yulee",
    "stockUnitCost": 13.78,
    "jobLotCost": 14.37,
    "uom": "LF",
    "weight": 10.9,
    "piecesPerUnit": 10
  },
  {
    "id": 87018,
    "sku": "BLX-EWP-019",
    "item": "1 1/8\" x 11 7/8\" x 12' OSB Rimboard SE",
    "size": "1 1/8\" x 11 7/8\" x 12'",
    "group": "Rimboard",
    "stockStatus": "Yulee",
    "stockUnitCost": 36.96,
    "jobLotCost": 38.76,
    "uom": "EA",
    "weight": 3.6,
    "piecesPerUnit": 40
  },
  {
    "id": 87019,
    "sku": "BLX-EWP-020",
    "item": "1 1/8\" x 14\" x 12' OSB Rimboard SE",
    "size": "1 1/8\" x 14\" x 12'",
    "group": "Rimboard",
    "stockStatus": "Yulee",
    "stockUnitCost": 42.6,
    "jobLotCost": 44.64,
    "uom": "EA",
    "weight": 4.2,
    "piecesPerUnit": 30
  },
  {
    "id": 87020,
    "sku": "BLX-EWP-021",
    "item": "1 1/8\" x 16\" x 12' OSB Rimboard SE",
    "size": "1 1/8\" x 16\" x 12'",
    "group": "Rimboard",
    "stockStatus": "Yulee",
    "stockUnitCost": 46.44,
    "jobLotCost": 48.72,
    "uom": "EA",
    "weight": 4.8,
    "piecesPerUnit": 30
  },
  {
    "id": 87021,
    "sku": "BLX-EWP-022",
    "item": "1 1/4\" x 16\" x 16' LSL Rimboard",
    "size": "1 1/4\" x 16\" x 16'",
    "group": "Rimboard",
    "stockStatus": "Yulee",
    "stockUnitCost": 94.4,
    "jobLotCost": 99.04,
    "uom": "EA",
    "weight": 6.1,
    "piecesPerUnit": 24
  },
  {
    "id": 87022,
    "sku": "BLX-EWP-023",
    "item": "1 1/4\" x 20\" x 16' LSL Rimboard",
    "size": "1 1/4\" x 20\" x 16'",
    "group": "Rimboard",
    "stockStatus": "Yulee",
    "stockUnitCost": 128.16,
    "jobLotCost": 134.4,
    "uom": "EA",
    "weight": 7.7,
    "piecesPerUnit": 16
  },
  {
    "id": 87023,
    "sku": "BLX-EWP-024",
    "item": "3 1/2\" x 11 7/8\" J12 TrimJoist",
    "size": "3 1/2\" x 11 7/8\"",
    "group": "TrimJoist Open Web",
    "stockStatus": "Special Order",
    "stockUnitCost": 5.72,
    "jobLotCost": 5.85,
    "uom": "LF",
    "weight": 4.85,
    "piecesPerUnit": 13
  },
  {
    "id": 87024,
    "sku": "BLX-EWP-025",
    "item": "3 1/2\" x 14\" J14 TrimJoist",
    "size": "3 1/2\" x 14\"",
    "group": "TrimJoist Open Web",
    "stockStatus": "Special Order",
    "stockUnitCost": 5.75,
    "jobLotCost": 5.9,
    "uom": "LF",
    "weight": 5.15,
    "piecesPerUnit": 13
  },
  {
    "id": 87025,
    "sku": "BLX-EWP-026",
    "item": "3 1/2\" x 16\" J16 TrimJoist",
    "size": "3 1/2\" x 16\"",
    "group": "TrimJoist Open Web",
    "stockStatus": "Yulee",
    "stockUnitCost": 5.78,
    "jobLotCost": 5.95,
    "uom": "LF",
    "weight": 5.35,
    "piecesPerUnit": 13
  },
  {
    "id": 87026,
    "sku": "BLX-EWP-027",
    "item": "3 1/2\" x 18\" J18 TrimJoist",
    "size": "3 1/2\" x 18\"",
    "group": "TrimJoist Open Web",
    "stockStatus": "Special Order",
    "stockUnitCost": 6.2,
    "jobLotCost": 6.53,
    "uom": "LF",
    "weight": 5.6,
    "piecesPerUnit": 13
  },
  {
    "id": 87027,
    "sku": "BLX-EWP-028",
    "item": "3 1/2\" x 20\" J20 TrimJoist",
    "size": "3 1/2\" x 20\"",
    "group": "TrimJoist Open Web",
    "stockStatus": "Special Order",
    "stockUnitCost": 6.4,
    "jobLotCost": 6.75,
    "uom": "LF",
    "weight": 5.85,
    "piecesPerUnit": 13
  },
  {
    "id": 87028,
    "sku": "BLX-EWP-029",
    "item": "3 1/2\" x 11 7/8\" x 8' Kneewall",
    "size": "3 1/2\" x 11 7/8\" x 8'",
    "group": "TrimJoist Kneewall",
    "stockStatus": "Special Order",
    "stockUnitCost": 40.16,
    "jobLotCost": 40.96,
    "uom": "EA",
    "weight": 4.85,
    "piecesPerUnit": 13
  },
  {
    "id": 87029,
    "sku": "BLX-EWP-030",
    "item": "3 1/2\" x 14\" x 8' Kneewall",
    "size": "3 1/2\" x 14\" x 8'",
    "group": "TrimJoist Kneewall",
    "stockStatus": "Special Order",
    "stockUnitCost": 40.48,
    "jobLotCost": 41.36,
    "uom": "EA",
    "weight": 5.15,
    "piecesPerUnit": 13
  },
  {
    "id": 87030,
    "sku": "BLX-EWP-031",
    "item": "3 1/2\" x 16\" x 8' Kneewall",
    "size": "3 1/2\" x 16\" x 8'",
    "group": "TrimJoist Kneewall",
    "stockStatus": "Yulee",
    "stockUnitCost": 40.8,
    "jobLotCost": 41.76,
    "uom": "EA",
    "weight": 5.35,
    "piecesPerUnit": 13
  },
  {
    "id": 87031,
    "sku": "BLX-EWP-032",
    "item": "3 1/2\" x 18\" x 8' Kneewall",
    "size": "3 1/2\" x 18\" x 8'",
    "group": "TrimJoist Kneewall",
    "stockStatus": "Special Order",
    "stockUnitCost": 41.52,
    "jobLotCost": 42.64,
    "uom": "EA",
    "weight": 5.6,
    "piecesPerUnit": 13
  },
  {
    "id": 87032,
    "sku": "BLX-EWP-033",
    "item": "3 1/2\" x 20\" x 8' Kneewall",
    "size": "3 1/2\" x 20\" x 8'",
    "group": "TrimJoist Kneewall",
    "stockStatus": "Special Order",
    "stockUnitCost": 42.48,
    "jobLotCost": 43.44,
    "uom": "EA",
    "weight": 5.85,
    "piecesPerUnit": 13
  }
];
const category = 'Beams & Engineered Wood';
const D = root.document;
const money = n => '$' + Number(n).toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const availability = p => p.stockStatus === 'Yulee' ? 'Supplier stock — Yulee' : 'Special order';
const unit = p => p.uom === 'LF' ? '/ LF' : '/ each';
let activeId = null;
function mount(){
  if(root.NWBeams || typeof products === 'undefined') return;
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem('ns_edits') || '{}'); } catch(e) {}
  source.forEach(p => {
    if(products.some(x => x.sku === p.sku)) return;
    const notes = availability(p) + '. BlueLinx costs effective 7/13/2026: stock units ' + money(p.stockUnitCost) + ' ' + unit(p) + '; job lot ' + money(p.jobLotCost) + ' ' + unit(p) + '. Subject to stock lengths and prior sale; confirm availability and special-order lead time.';
    products.push({...p, category, isBlueLinx:true, isLumber:true, onHand:null, cost:p.jobLotCost, fixedRetail:null,
      description:availability(p) + ' · Cost ' + unit(p) + ' · BlueLinx', notes, ...(edits[p.id] || {})});
  });
  const selectedCat = D.getElementById('sel-cat').value;
  populateCatDropdown();
  D.getElementById('sel-cat').value = selectedCat;
  buildCatPills('cat-pills',setCatFilter);
  buildCatPills('admin-pills',setAdminFilter);
  D.getElementById('prod-count').textContent = products.length + ' products total';

  const tab = D.createElement('button');
  tab.id='tab-beams'; tab.className='tab'; tab.textContent='Beams';
  tab.onclick = () => { renderTable(); root.showPage('beams',tab); };
  D.getElementById('tab-lumber').after(tab);
  const page=D.createElement('div'); page.className='page'; page.id='page-beams';
  page.innerHTML='<h2>BlueLinx · Beams &amp; Engineered Wood</h2><p style="margin:10px 0;color:#6b5a3a">33 products · Costs effective July 13, 2026 · Supplier stock is at Yulee, not Norwood on-hand inventory.</p><p style="margin-bottom:14px">Choose an item to quote. Job-lot cost is the default; stock-unit cost is available for qualifying unit purchases. Confirm stock lengths, availability and special-order lead times with BlueLinx.</p><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px"><label>Product type <select id="beams-group"><option value="">All types</option>'+[...new Set(source.map(p=>p.group))].map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label><label>Availability <select id="beams-stock"><option value="">All</option><option value="Yulee">Supplier stock — Yulee</option><option value="Special Order">Special order</option></select></label></div><div style="overflow-x:auto"><table style="width:100%"><thead><tr><th>Product / size</th><th>Availability</th><th>Stock-unit cost</th><th>Job-lot cost</th><th>Unit</th><th></th></tr></thead><tbody id="beams-rows"></tbody></table></div>';
  D.querySelector('.page').before(page);
  D.getElementById('beams-group').onchange=renderTable;
  D.getElementById('beams-stock').onchange=renderTable;
  function renderTable(){
    const group=D.getElementById('beams-group').value, stock=D.getElementById('beams-stock').value;
    D.getElementById('beams-rows').innerHTML=products.filter(p=>p.isBlueLinx&&(!group||p.group===group)&&(!stock||p.stockStatus===stock)).map(p=>'<tr><td style="padding:12px 8px">'+esc(p.item)+'<br><small>'+esc(p.group)+'</small></td><td>'+esc(availability(p))+'</td><td>'+money(p.stockUnitCost)+'</td><td>'+money(p.cost)+'</td><td>'+unit(p)+'</td><td><button class="btn btn-g" data-beam="'+p.id+'">Quote</button></td></tr>').join('');
    D.querySelectorAll('[data-beam]').forEach(b=>b.onclick=()=>root.quickAdd(Number(b.dataset.beam)));
  }
  renderTable();

  const panel=D.createElement('div'); panel.id='beam-config'; panel.className='hidden';
  panel.style.cssText='padding:12px;margin:10px 0;background:#eef5fa;border:1px solid #c2d7e5;border-radius:6px';
  panel.innerHTML='<label>BlueLinx cost basis <select id="beam-basis"><option value="job">Job lot</option><option value="stock">Stock units</option></select></label><label id="beam-length-label" style="margin-left:12px">Length per piece (ft) <input id="beam-length" type="number" min="0.01" step="any" placeholder="Enter length" style="width:120px"></label><div id="beam-rate" style="margin-top:8px"></div><small>Quantity is pieces. Confirm available lengths before ordering. Stock-unit pricing requires a qualifying unit purchase.</small>';
  D.getElementById('product-preview').before(panel);
  D.getElementById('beam-basis').onchange=()=>root.showPreview();
  D.getElementById('beam-length').oninput=()=>root.showPreview();
  const originalRetail=root.calcRetail;
  root.calcRetail=function(cost,gm,fixed,p){
    if(p&&p.isBlueLinx) return Math.round(Number(cost)/(1-gm)*100)/100;
    return originalRetail.apply(this,arguments);
  };
  function configured(p){
    const basis=D.getElementById('beam-basis').value;
    const rate=basis==='stock'?p.stockUnitCost:p.cost;
    const length=p.uom==='LF'?Number(D.getElementById('beam-length').value):1;
    if(!Number.isFinite(length)||length<=0) return null;
    return {...p,cost:Math.round(rate*length*100)/100, fixedRetail:null, uom:'EA',
      item:p.item+(p.uom==='LF'?" x "+length+" ft":''),
      sourceUom:p.uom, lengthFeet:p.uom==='LF'?length:null, blueLinxRate:rate, blueLinxBasis:basis,
      description:p.description+' · '+(basis==='stock'?'Stock units':'Job lot')+' · '+money(rate)+' '+unit(p),
      size:'',notes:p.notes};
  }
  const originalPreview=root.showPreview;
  root.showPreview=function(){
    if(!selProd||!selProd.isBlueLinx){panel.classList.add('hidden');return originalPreview.apply(this,arguments);}
    const p=selProd;
    if(activeId!==p.id){activeId=p.id;D.getElementById('beam-basis').value='job';D.getElementById('beam-length').value='';}
    panel.classList.remove('hidden');
    D.getElementById('beam-length-label').style.display=p.uom==='LF'?'':'none';
    const q=configured(p);
    if(q) selProd=q;
    try { originalPreview.apply(this,arguments); } finally { selProd=p; }
    const basis=D.getElementById('beam-basis').value;
    const rate=basis==='stock'?p.stockUnitCost:p.cost;
    D.getElementById('beam-rate').textContent=availability(p)+' · Cost '+money(rate)+' '+unit(p)+(q?' · '+money(q.cost)+' cost per piece':' · Enter length to price a piece');
    D.getElementById('prev-stock').textContent=availability(p);
    D.getElementById('prev-stock').className=p.stockStatus==='Yulee'?'stock-in':'stock-out';
    D.getElementById('prev-cost').textContent=q?'Cost: '+money(q.cost)+' / piece':'Cost: '+money(rate)+' / LF';
    if(!q){D.getElementById('prev-price').textContent='Enter length';D.getElementById('ext-preview').textContent='';}
    D.getElementById('add-btn').disabled=!q;
  };
  const originalCatalog=root.renderCatalog;
  root.renderCatalog=function(){
    const result=originalCatalog.apply(this,arguments);
    D.querySelectorAll('#prod-grid .pcard').forEach(card=>{
      const match=(card.getAttribute('onclick')||'').match(/quickAdd\((\d+)\)/);
      const p=match&&products.find(x=>x.id===Number(match[1]));
      if(!p||!p.isBlueLinx)return;
      const price=card.querySelector('.pcard-price');
      if(price) price.textContent=money(root.calcRetail(p.cost,.30,null,p))+' '+unit(p);
      const note=D.createElement('div');note.className='lsize';
      note.textContent=availability(p)+' · Job lot · 30% GM';
      card.querySelector('.pcard-body').appendChild(note);
    });
    return result;
  };
  const originalQuickAdd=root.quickAdd;
  root.quickAdd=function(id){
    const p=products.find(x=>x.id===id);
    if(!p||!p.isBlueLinx) return originalQuickAdd.apply(this,arguments);
    root.showPage('quote',D.getElementById('tab-quote'));
    D.getElementById('sel-cat').value=p.category;root.onCat();
    D.getElementById('sel-grp').value=p.group;root.onGrp();
    D.getElementById('sel-item').value=p.item;root.onItem();
  };
  const originalHide=root.hidePreview;
  root.hidePreview=function(){panel.classList.add('hidden');activeId=null;return originalHide.apply(this,arguments);};
  const originalAdd=root.addLine;
  root.addLine=function(){
    if(!selProd||!selProd.isBlueLinx) return originalAdd.apply(this,arguments);
    const p=selProd,q=configured(p);
    const qty=Number(D.getElementById('qty-in').value);
    if(!q||!Number.isInteger(qty)||qty<1){D.getElementById('ext-preview').textContent='Enter a positive length and whole-number piece quantity.';return;}
    selProd=q;
    try { originalAdd.apply(this,arguments); } finally { selProd=p; }
    root.showPreview();
  };
  root.NWBeams={source,configured};
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',mount);else mount();
})(window);
