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
 for(const n of ['uniqueLumberProducts','isPlywoodProduct','isLumberPricedProduct','init','getCategoryGM','calcRetail','getLumberProducts','getOnHand','getReorderPoint','getStatus','printCountSheet','renderLumber'])vm.runInContext(fn(n),ctx);
 return {ctx,elements,values};
}
test('November vendor prices convert correctly and preserve configured margins',()=>{
 const {ctx}=app();
 const expected={'5000':[745,3.97,5.67],'5003':[645,6.02,8.60],'5004':[735,7.84,11.20],'5010':[640,3.29,4.70],'5012':[580,3.76,5.37],'5014':[795,6.93,9.90],'9500':[751,24.03,32.04],'9509':[861,27.55,36.73]};
 for(const [sku,[perM,cost,sell]] of Object.entries(expected)){
  const p=inventory.find(p=>p.sku===sku);assert.equal(Number(p.pricePerM),perM);assert.equal(p.cost,cost);
  assert.equal(ctx.calcRetail(cost,ctx.getCategoryGM(p),p.fixedRetail,p),sell);
 }
 assert.equal(inventory.filter(p=>p.wholesaleCostRevision==='2026-11-16-wbp').length,128);
});
test('refresh replaces stale covered costs once and preserves history, stock, unsupported prices',()=>{
 const {ctx,values}=app();
 const spruce=inventory.find(p=>p.sku==='5014'),unsupported=inventory.find(p=>p.sku==='5015');
 values.ns_lumber_price_date='2026-09-08';
 values.ns_edits=JSON.stringify({[spruce.id]:{cost:1,pricePerM:'100',onHand:17,notes:'Keep me'},[unsupported.id]:{cost:99,notes:'Custom'}});
 values.ns_quotes='existing quote/invoice prices';values.ns_lumber_counts='{"5014":22}';ctx.init();
 assert.equal(ctx.products.find(p=>p.sku==='5014').cost,6.93);
 assert.equal(ctx.products.find(p=>p.sku==='5014').pricePerM,'795');
 assert.equal(ctx.products.find(p=>p.sku==='5014').onHand,17);
 assert.equal(ctx.products.find(p=>p.sku==='5014').notes,'Keep me');
 assert.equal(ctx.products.find(p=>p.sku==='5015').cost,99);
 assert.equal(values.ns_quotes,'existing quote/invoice prices');assert.equal(values.ns_lumber_counts,'{"5014":22}');
 const edits=JSON.parse(values.ns_edits);edits[spruce.id].cost=8;values.ns_edits=JSON.stringify(edits);ctx.init();
 assert.equal(ctx.products.find(p=>p.sku==='5014').cost,8);
 assert.equal(ctx.getLumberProducts('ALL').length,143);
});
