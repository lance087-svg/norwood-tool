const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0);return html.slice(start,html.indexOf('\n}',start)+2);}
const start=html.indexOf('const INVENTORY = ');
const inventory=JSON.parse(html.slice(start+'const INVENTORY = '.length,html.indexOf('];',start)+1));
function app(products=inventory.map(p=>({...p,item:p.name}))){
 const elements={}; const values={ns_lumber_price_date:'2026-09-08',ns_tlc_price_date:'2026-08-31',ns_fj_board_price_date:'2026-09-09'};
 const ctx=vm.createContext({products,SEED:[],INVENTORY:inventory,manualGM:null,lumberFilter:'ALL',console,
 localStorage:{getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;}},
 document:{getElementById:id=>elements[id]??(elements[id]={innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}})},
 populateCatDropdown(){},buildCatPills(){},setCatFilter(){},setAdminFilter(){},showPage(){},nsEsc:s=>s});
 for(const n of ['uniqueLumberProducts','isPlywoodProduct','init','getCategoryGM','calcRetail','getLumberProducts','getOnHand','getReorderPoint','getStatus','printCountSheet','renderLumber'])vm.runInContext(fn(n),ctx);
 return {ctx,elements,values};
}
test('143 unique lumber SKUs; repeated inputs never triple counts or merge species',()=>{
 const list=inventory.filter(p=>p.category==='Lumber');
 const {ctx}=app([...list,...list,...list]);
 const out=ctx.getLumberProducts('ALL');
 assert.equal(out.length,143);assert.equal(new Set(out.map(p=>p.sku)).size,143);
 assert.ok(out.some(p=>p.sku==='3000'));assert.ok(out.some(p=>p.sku==='4000'));assert.ok(out.some(p=>p.sku==='5000'));
 assert.deepEqual(Array.from(out,p=>p.onHand),list.map(p=>p.onHand));
});
test('repeated count-sheet generation replaces rows, with exactly one count box per SKU',()=>{
 const list=inventory.filter(p=>p.category==='Lumber');const {ctx,elements}=app([...list,...list,...list]);
 ctx.printCountSheet('ALL');ctx.printCountSheet('ALL');
 const output=elements['count-sheet-content'].innerHTML;
 assert.equal((output.match(/class="count-box"/g)||[]).length,143);
 assert.equal((output.match(/data-count-sku="3000"/g)||[]).length,1);
 assert.match(output,/Pressure Treated \(PT\)/);assert.match(output,/Untreated Southern Yellow Pine/);assert.match(output,/Spruce \/ Pine \/ Fir/);
 ctx.printCountSheet('PT');assert.equal((elements['count-sheet-content'].innerHTML.match(/class="count-box"/g)||[]).length,70);
});
test('WBP MSF conversion and 30% markup are consistent across all five verified sheets',()=>{
 const {ctx}=app();const expected={'9500':[751,24.03,31.24],'9501':[834,26.69,34.70],'9502':[1042,33.34,43.34],'9509':[861,27.55,35.82],'9510':[1202,38.46,50.00]};
 for(const [sku,[msf,cost,retail]] of Object.entries(expected)){
  const p=inventory.find(p=>p.sku===sku);assert.equal(p.cost,Math.round(msf*.032*100)/100);assert.equal(p.cost,cost);assert.equal(p.fixedRetail,retail);
  assert.equal(ctx.calcRetail(p.cost,ctx.getCategoryGM(p),999,p),retail);
 }
 const p=inventory.find(p=>p.sku==='9500');assert.equal(ctx.calcRetail(30,ctx.getCategoryGM(p),31.24,p),39);
 ctx.manualGM=.30;assert.equal(ctx.calcRetail(p.cost,.30,p.fixedRetail,p),34);
});
test('unknown costs and non-plywood pricing stay unchanged',()=>{
 const {ctx}=app();const birch=inventory.find(p=>p.sku==='9505'),pt=inventory.find(p=>p.sku==='3000');
 assert.equal(ctx.calcRetail(birch.cost,.30,birch.fixedRetail,birch),17);
 assert.equal(ctx.calcRetail(pt.cost,.30,pt.fixedRetail,pt),6);
 assert.equal(ctx.getCategoryGM(pt),.30);
});
test('one-time price refresh preserves stock, notes and unrelated edits',()=>{
 const {ctx,values}=app();values.ns_edits=JSON.stringify({'2463':{cost:1,fixedRetail:99,onHand:17,notes:'Keep me'},'2197':{cost:7.11}});
 values.ns_lumber_counts=JSON.stringify({'9500':22});values.ns_quotes='existing history';
 ctx.init();let edits=JSON.parse(values.ns_edits);assert.equal(edits['2463'].cost,24.03);assert.equal(edits['2463'].fixedRetail,31.24);assert.equal(edits['2463'].onHand,17);assert.equal(edits['2463'].notes,'Keep me');assert.equal(edits['2197'].cost,7.11);assert.equal(values.ns_lumber_counts,'{"9500":22}');assert.equal(values.ns_quotes,'existing history');
 edits['2463'].cost=30;values.ns_edits=JSON.stringify(edits);ctx.init();assert.equal(ctx.products.find(p=>p.sku==='9500').cost,30);
});

test('lumber display recalculates markup when cost changes despite a stale fixed price',()=>{
 const p={...inventory.find(p=>p.sku==='9500'),cost:30,fixedRetail:99};
 const {ctx,elements}=app([p]);ctx.renderLumber();
 assert.match(elements['lumber-tbody'].innerHTML,/\$39</);assert.match(elements['lumber-tbody'].innerHTML,/30% markup/);
});

test('screenshot regression: three saved copies of SKU 9507 become one inventory/count row',()=>{
 const {ctx,values,elements}=app();
 const birch=inventory.find(p=>p.sku==='9507');
 values.ns_edits=JSON.stringify({'2468':{...birch,item:birch.name},'2469':{...birch,item:birch.name}});
 values.ns_lumber_counts=JSON.stringify({'9507':18});
 ctx.init();
 assert.equal(ctx.products.filter(p=>p.sku==='9507').length,1);
 assert.equal(ctx.getOnHand(ctx.products.find(p=>p.sku==='9507')),18);
 ctx.printCountSheet('ALL');
 assert.equal((elements['count-sheet-content'].innerHTML.match(/data-count-sku="9507"/g)||[]).length,1);
 assert.equal(values.ns_lumber_counts,'{"9507":18}');
 assert.ok(JSON.parse(values.ns_edits)['2468']);
});
