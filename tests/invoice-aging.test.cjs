const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const NOW = Date.parse('2026-11-12T17:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
function setup(local = [], cloud = []) {
  const dom = new JSDOM(html.slice(html.indexOf('<!-- SAVED QUOTES PAGE -->'), html.indexOf('<!-- LUMBER INVENTORY PAGE -->')));
  const c = {Date:Clock, Intl, document:dom.window.document, getSavedQuotesRaw:()=>local, getSavedQuotes:()=>local.filter(q=>!q.removed), getDeletedQuotes:()=>[], getOrderMeta:()=>({}), updateOweBadge(){}, renderDeletedBin(){}, nsLoadCloudQuotes(){}, nsEsc:s=>String(s ?? ''), __nsCloudAll:cloud, __nsCloudAllAt:NOW};
  c.window = c;
  vm.createContext(c);
  for (const [start,end] of [
    ['function nsPaidFromHistory(', '// ── RETURNS / CREDITS'],
    ['function nsArchiveEligible(', 'function nsShouldShowStorageToast('],
    ['function nsNormName(', '// ── CLOUD SEARCH'],
    ['function nsQuoteMatchesSearch(', 'function nsOpenCloudRecord('],
    ['function renderHistory()', 'function loadQuote(']
  ]) vm.runInContext(html.slice(html.indexOf(start), html.indexOf(end,html.indexOf(start))),c);
  vm.runInContext(fs.readFileSync('norwood-invoice-aging.js','utf8'),c);
  c.NWInvoiceAging.mount();
  return c;
}
function inv(id, extra={}) { return {id, type:'invoice', quoteNum:'INV-'+id, date:'Sep 27, 2026', grand:100, customer:{name:'Test customer'}, lines:[], ...extra}; }

test('45 days is not flagged; 46 days is, using Jacksonville calendar days across DST',()=>{
  const a=setup().NWInvoiceAging;
  assert.equal(a.state(inv(1,{dueDate:'2026-09-28'}),NOW).flagged,false);
  assert.equal(a.state(inv(1,{dueDate:'2026-09-27'}),NOW).days,46);
  assert.equal(a.state(inv(1,{dueDate:'2026-09-27'}),NOW).flagged,true);
  assert.equal(a.state(inv(1,{dueDate:'2026-11-13'}),NOW).flagged,false);
  assert.equal(a.state(inv(1),Date.parse('2026-11-12T04:59:00Z')).flagged,false);
  assert.equal(a.state(inv(1),Date.parse('2026-11-12T05:00:00Z')).flagged,true);
});
test('explicit due dates take priority; invoice date is stable after payment/edit timestamps',()=>{
  const a=setup().NWInvoiceAging;
  assert.equal(a.state(inv(1,{dueDate:'2026-11-01'}),NOW).flagged,false);
  assert.equal(a.state(inv(1,{ops:{dueDate:'2026-11-01'}}),NOW).basis,'due');
  assert.equal(a.state(inv(1,{createdAt:Date.parse('2026-10-10T16:00:00Z')}),NOW).flagged,false);
  assert.equal(a.state(inv(1,{timestamp:NOW}),NOW).days,46);
  assert.equal(a.state(inv(1,{date:'',timestamp:NOW}),NOW).missingDate,true);
  assert.equal(a.state(inv(Date.parse('2026-09-27T16:00:00Z'),{date:''}),NOW).days,46);
  assert.equal(a.day('2026-02-30'),null);
});
test('subtotal includes remaining payments and credits, excludes quotes, paid, removed and zero balances',()=>{
  const c=setup();
  const list=[inv(1,{grand:1000,paymentHistory:[{amount:400}],returnsHistory:[{creditAmount:100}]}),inv(2,{grand:100.10,amountPaid:20}),inv(3,{paymentHistory:[{amount:100}]}),inv(4,{type:'quote'}),inv(5,{removed:true}),inv(6,{grand:0}),inv(7,{returnsHistory:[{creditAmount:100}]}),inv(8,{paymentHistory:[{type:'net30',amount:0}],dueDate:'2026-09-27'})];
  const before=JSON.stringify(list), s=c.NWInvoiceAging.summary(list,NOW);
  assert.equal(s.count,3);assert.equal(s.cents,68010);assert.equal(JSON.stringify(list),before);
});
test('cloud-only older invoices count once; pending local payments and deletion markers win over cached cloud',()=>{
  const a=setup().NWInvoiceAging;
  const list=a.records([inv(1,{amountPaid:100,_syncStatus:'pending'}),inv(2,{removed:true})],[inv('1'),inv(2),inv(3,{grand:25.25}),inv(3,{grand:25.25})]);
  const s=a.summary(list,NOW);assert.equal(s.count,1);assert.equal(s.cents,2525);
});
test('actual history filter, local/cloud flags, all-record subtotal, search reset and reload agree',()=>{
  const local=[inv(1,{grand:1000,paymentHistory:[{amount:400}]}),inv(2,{date:'Sep 28, 2026'}),inv(3,{amountPaid:100})];
  const cloud=[inv(1),inv(4,{grand:25.25}),inv(5,{type:'quote'})];
  const c=setup(local,cloud), D=c.document;
  D.getElementById('history-search').value='no matches';
  D.getElementById('history-period').value='archive';
  c.renderHistory();
  assert.match(D.getElementById('ns-aging-summary').textContent,/2 invoices · Subtotal: \$625.25/);
  D.getElementById('ns-aging-show').click();
  assert.equal(D.getElementById('history-filter').value,'over45');
  assert.equal(D.getElementById('history-period').value,'all');
  assert.equal(D.getElementById('history-search').value,'');
  assert.equal(D.querySelectorAll('.hcard').length,2);
  assert.equal(D.querySelectorAll('.ns-aging-flag').length,2);
  assert.match(D.getElementById('history-list').textContent,/INV-4/);
  assert.doesNotMatch(D.getElementById('history-list').textContent,/INV-2|INV-3|INV-5/);
  // Full payment removes the flag and reduces the subtotal, including after reopening.
  local[0].paymentHistory.push({amount:600});c.renderHistory();
  assert.match(D.getElementById('ns-aging-summary').textContent,/1 invoice · Subtotal: \$25.25/);
  const reopened=setup(JSON.parse(JSON.stringify(local)),cloud);reopened.renderHistory();
  assert.match(reopened.document.getElementById('ns-aging-summary').textContent,/1 invoice · Subtotal: \$25.25/);
});
test('subtotal counts all cloud pages before rendering limit; unavailable cloud cannot look complete',()=>{
  const cloud=Array.from({length:55},(_,i)=>inv(i+1,{grand:10}));
  const c=setup([],cloud);c.NWInvoiceAging.showOverdue();
  assert.equal(c.document.querySelectorAll('.ns-aging-flag').length,50);
  assert.match(c.document.getElementById('ns-aging-summary').textContent,/55 invoices · Subtotal: \$550.00/);
  c.__nsCloudError=true;c.renderHistory();
  assert.match(c.document.getElementById('ns-aging-summary').textContent,/Known subtotal.*Cloud unavailable/s);
});
test('normal history flags both storage sources; overdue rows open the correct existing invoice',()=>{
  const c=setup([inv(1)],[inv(2)]), calls=[];
  c.loadAndPrint=(id,type)=>calls.push(['local',id,type]);
  c.nsOpenCloudRecord=(id,type)=>calls.push(['cloud',id,type]);
  c.renderHistory();
  assert.equal(c.document.querySelectorAll('.ns-aging-flag').length,2);
  c.NWInvoiceAging.showOverdue();
  c.document.querySelectorAll('.ns-aging-open').forEach(button=>button.click());
  assert.deepEqual(calls.sort(),[['cloud',2,'invoice'],['local',1,'invoice']]);
});
