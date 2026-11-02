const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function setup(type){
 const source={id:123,type,quoteNum:type==='invoice'?'INV-01325':'Q-12345',date:'Sep 24, 2026',customer:{name:'Test customer',co:'Test company',addr:'Test address',taxExempt:true,taxExemptCert:'TEST',payment:'PAID IN FULL',etaDate:'2026-09-23'},lines:[{qty:2,retail:100,cost:60,doorSpec:{hand:'LH'}}],manualGM:.3,delivery:25,discount:10,amountPaid:215,paymentHistory:[{amount:215}],release:{delivered:true}};
 let records=[source]; const elements={};
 const c={Date,Set,JSON,nsPayState:()=>({status:"PAID IN FULL"}),document:{getElementById:id=>elements[id]||(elements[id]={value:'',classList:{add(){},remove(){}}})},getSavedQuotes:()=>records,saveQuotesToStorage:r=>{records=r},showToast(){},showSaveBadge(){},nsInvoiceCreatedAt:q=>q.id,renderPayBanner:(id,record)=>{c.banner=record},renderLines(){},renderSummary(){},recalcLines(){c.repriced=true},showPage(){},showView(){},getCustomer:()=>({name:elements['c-name'].value,payment:elements['c-payment'].value,taxExempt:elements['c-tax-exempt'].checked,delivery:Number(elements['delivery-charge'].value),discount:Number(elements['discount-amount'].value)})};
 c.doNewQuote=()=>{c.quoteNum='Q-new';c.currentInvNum=null;c.currentInvoiceRecordId=null;};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('function loadQuote('),html.indexOf('function loadAndPrint(')),c);
 c.window=c;vm.runInContext(fs.readFileSync('norwood-patch.js','utf8').split('// Repeat sales: create a fresh quote without changing the source record.')[1].split('(function(){')[0],c);
 vm.runInContext(html.slice(html.indexOf('function saveCurrentQuote('),html.indexOf('function showSaveBadge(')),c);
 return {c,source,elements,records:()=>records};
}
for(const type of ['quote','invoice'])test(`copy ${type}, edit, save and reopen preserves source and resets sale state`,()=>{
 const {c,source,elements,records}=setup(type),before=JSON.stringify(source);c.copyToNewQuote(123);
 assert.notEqual(c.quoteNum,source.quoteNum);assert.equal(c.currentInvNum,null);assert.equal(c.currentInvoiceRecordId,null);assert.equal(c.banner,null);assert.equal(c.repriced,undefined);
 assert.equal(elements['c-name'].value,'Test customer');assert.equal(elements['c-tax-exempt'].checked,true);assert.equal(elements['c-eta-date'].value,'');assert.equal(elements['c-payment'].value,'50% DEPOSIT REQUIRED');assert.equal(c.lines[0].retail,100);
 c.lines[0].doorSpec.hand='RH';c.lines[0].qty=3;c.saveCurrentQuote('quote');
 assert.equal(records().length,2);assert.equal(JSON.stringify(source),before);const saved=records()[0];assert.equal(saved.amountPaid,0);assert.equal(saved.paymentHistory.length,0);assert.equal(saved.release,undefined);assert.equal(saved.grand,315);assert.equal(saved.lines[0].doorSpec.hand,'RH');
 c.loadIntoBuilder(saved.id);assert.equal(c.quoteNum,saved.quoteNum);assert.equal(c.lines[0].qty,3);
});
test('ordinary invoice edit keeps original identity',()=>{const {c,source}=setup('invoice');c.loadIntoBuilder(source.id);assert.equal(c.currentInvNum,source.quoteNum);assert.equal(c.currentInvoiceRecordId,source.id);});
test('history buttons appear once and invoke copy without opening original',()=>{
 const {JSDOM}=require('jsdom');
 const dom=new JSDOM('<div id="history-list"><div><button onclick="event.stopPropagation();loadAndPrint(123,\'quote\')">📄 View Quote</button><button>Edit</button></div></div>');
 const c={document:dom.window.document,renderHistory(){},Date,Set};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('norwood-patch.js','utf8').split('// Repeat sales: create a fresh quote without changing the source record.')[1],c);
 let copied;c.copyToNewQuote=id=>{copied=id};c.renderHistory();assert.equal(c.document.querySelectorAll('.ns-copy-quote').length,1);c.document.querySelector('.ns-copy-quote').click();assert.equal(copied,123);
});
