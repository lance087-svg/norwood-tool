const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const core=require('../norwood-operations.js');
const po={id:15112,poNum:'PO-15112',status:'Sent',items:[{item:'Treated lumber',sku:'SAMPLE-24-8',qty:300,unitCost:5.75}]};
const details={at:'2026-09-30T14:00:00Z',eventId:'arrival-1',by:'Lance',date:'2026-09-30',notes:'20 still outstanding; 5 damaged.'};
const received=core.receipt(po,[{received:280,damaged:5}],details);
assert.deepEqual(core.stats(received,0),{ordered:300,received:280,outstanding:20,damaged:5,accepted:275});
assert.equal(received.status,'Issues');assert.equal(received.receiving.items[0].status,'Partial');assert.equal(po.receiving,undefined);assert.equal(received.receiving.history.length,1);
assert.deepEqual(core.stockPlan(received),[{i:0,sku:'SAMPLE-24-8',qty:275,accepted:275}]);
assert.equal(core.stats({...po,receiving:{items:{0:{qtyReceived:300,status:'Not Received'}}}},0).received,0);
for(const count of [{received:301,damaged:0},{received:280,damaged:281},{received:-1,damaged:0},{received:280,damaged:-1},{received:NaN,damaged:0}])assert.throws(()=>core.receipt(po,[count],details));
const complete=core.receipt(received,[{received:300,damaged:0}],{...details,eventId:'arrival-2'});assert.equal(core.totals(complete).outstanding,0);assert.equal(complete.status,'Complete');
assert.equal(core.invoiceIssues(received,{id:'v1',number:'VI-1',lines:[{qty:275,price:5.75}]}).length,0);
assert.equal(core.invoiceIssues(received,{id:'v1',number:'VI-1',lines:[{qty:300,price:6}]}).length,2);
const billed={...received,vendorInvoices:[{id:'v1',number:'VI-1',lines:[{qty:200,price:5.75}]}]};assert.equal(core.invoiceIssues(billed,{id:'v2',number:'VI-2',lines:[{qty:80,price:5.75}]}).length,1);
assert.equal(core.invoiceIssues(billed,billed.vendorInvoices[0]).length,0);
for(const [d,expect] of [['2026-10-01','Current'],['2026-09-30','Current'],['2026-09-29','1–30 days'],['2026-08-30','31–60 days'],['2026-07-01','61+ days'],['','Due date needed']])assert.equal(core.aging(d,'2026-09-30'),expect);
const html='<div class="header"><nav class="nav"><button id="tab-quote" class="tab">Quote Builder</button><button class="tab">Saved Quotes</button></nav></div><div class="main"><div class="page active" id="page-quote"></div><div class="page" id="page-polog"><div id="mock-po-log"></div></div></div><div id="mock-status"></div>';
const dom=new JSDOM(html,{url:'https://isolated.test/',runScripts:'outside-only'}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
w.eval(fs.readFileSync(__dirname+'/mock-host.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../norwood-operations.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const doc=w.document,tick=()=>new Promise(r=>setTimeout(r,5));
function fill(name,val){doc.querySelector('[name="'+name+'"]').value=val}
async function save(){doc.querySelector('#ops-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();}
function action(a,id){const b=[...doc.querySelectorAll('[data-action="'+a+'"]')].find(b=>id==null||b.dataset.id===String(id));assert.ok(b,'Missing '+a+' '+id);b.click()}
(async()=>{
 assert.equal(w.NWTestDB.writes.length,0,'Opening must be read only');w.NWOperations.show('purchasing');assert.equal(w.NWTestDB.writes.length,0);
 action('receive',15112);fill('received-0','280');fill('damaged-0','5');doc.querySelector('[name="received-0"]').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(doc.querySelector('[data-outstanding="0"]').textContent,'20');await save();assert.equal(doc.querySelector('#ops-dialog'),null);assert.equal(w.getPOLog()[0].receiving.items[0].qtyOutstanding,20);
 w.NWOperations.show('inventory');assert.equal(doc.querySelectorAll('[data-action="ack"]').length,1);action('ack');await tick();assert.ok(w.getPOLog()[0].receiving.history[0].acknowledgedAt);
 await w.NWOperations.postStock(15112,'Lance');assert.equal(w.NWTestDB.docs['norwood/sample-lumber'].qoh,375);await assert.rejects(()=>w.NWOperations.postStock(15112,'Lance'),/No new accepted/);assert.equal(w.NWTestDB.docs['norwood/sample-lumber'].qoh,375);
 w.NWOperations.show('purchasing');action('invoice',15112);fill('number','V-SAMPLE-1');fill('qty-0','300');fill('price-0','6');fill('status','Ready');await save();assert.match(doc.querySelector('#ops-error').textContent,/Resolve before marking ready/);fill('status','Held');await save();assert.equal(w.getPOLog()[0].vendorInvoices[0].status,'Held');
 w.NWOperations.show('matching');action('invoice');fill('qty-0','275');fill('price-0','5.75');fill('status','Ready');await save();assert.equal(w.getPOLog()[0].vendorInvoices[0].status,'Ready');
 w.NWOperations.show('receivables');assert.match(doc.querySelector('#page-operations').textContent,/\$2,000.00/);action('contact',101);fill('note','Spoke with the customer; will call after the next delivery.');fill('next','2026-10-05');await save();assert.equal(w.NWTestDB.docs['ns_quotes/101'].activity.length,1);assert.equal(w.NWTestDB.docs['ns_quotes/101'].paymentHistory[0].amount,450);assert.equal(w.getSavedQuotesRaw().find(q=>q.id===103).removed,true);
 w.NWOperations.show('followup');action('eta',101);fill('eta','2026-10-03');fill('note','Vendor confirmed truck.');await save();assert.equal(w.NWTestDB.docs['ns_sync/ns_order_meta'].data['INV-OTHER'].eta,'2026-10-12');assert.equal(w.getOrderMeta()['INV-SAMPLE-101'].eta,'2026-10-03');
 w.NWOperations.show('activity');assert.match(doc.querySelector('#page-operations').textContent,/Vendor confirmed truck/);
 // A stale receiving form cannot overwrite a newer shared save.
 w.NWOperations.receive(15112);fill('received-0','290');const latest=w.NWTestDB.docs['ns_sync/ns_po_log'].data[0];latest.receiving.savedAt='concurrent-receipt';await save();assert.match(doc.querySelector('#ops-error').textContent,/another device/);assert.equal(latest.receiving.items[0].qtyReceived,280);action('cancel');
 // Repeat SKUs on separate PO lines post their combined quantities once.
 const dup={id:2,poNum:'PO-DUP',items:[{item:'Lumber A',sku:'SAMPLE-24-8',qty:3,unitCost:1},{item:'Lumber B',sku:'SAMPLE-24-8',qty:4,unitCost:1}]};const updated=core.receipt(dup,[{received:3,damaged:0},{received:4,damaged:0}],details);w.NWTestDB.docs['ns_sync/ns_po_log'].data.push(updated);w.savePOLog(w.NWTestDB.docs['ns_sync/ns_po_log'].data);await w.NWOperations.postStock(2,'Lance');assert.equal(w.NWTestDB.docs['norwood/sample-lumber'].qoh,382);
 // Failed transactions leave both count and posting ledger unchanged.
 const pending=core.receipt({id:3,poNum:'PO-FAIL',items:[{item:'Lumber',sku:'SAMPLE-24-8',qty:10,unitCost:1}]},[{received:10,damaged:0}],details);w.NWTestDB.docs['ns_sync/ns_po_log'].data.push(pending);w.savePOLog(w.NWTestDB.docs['ns_sync/ns_po_log'].data);w.NWTestDB.failNext();await assert.rejects(()=>w.NWOperations.postStock(3,'Lance'),/Simulated/);assert.equal(w.NWTestDB.docs['norwood/sample-lumber'].qoh,382);assert.equal(w.NWTestDB.docs['ns_sync/ns_po_log'].data.find(p=>p.id===3).receiving.stockPosted[0],0);
 const source=fs.readFileSync(__dirname+'/../index.html','utf8');const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());scripts.forEach(s=>new vm.Script(s));assert.match(source,/if\(prior.ops\) record.ops/);assert.match(source,/NWOperations.lineTable\(po\)/);assert.match(source,/const NS_SYNC_KEYS = \['ns_po_log', 'ns_orders', 'ns_order_meta', 'ns_inquiries'\]/);
 console.log('PASS: count example, damage validation, invoice variance and cumulative billing, aging, shared receipt notices, repeat-safe stock including duplicate SKUs, customer notes/payment and deletion preservation, ETA isolation, stale receipt rejection, transaction failure, and all inline script syntax. No live systems contacted.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
