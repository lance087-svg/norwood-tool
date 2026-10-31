const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
let mode='active';const c={Date,Number,document:{getElementById:()=>({value:mode})},getOrderMeta:()=>({}),nsPayState:q=>({status:q.paid?'PAID IN FULL':'UNPAID'})};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function nsArchiveEligible'),html.indexOf('function nsShouldShowStorageToast')),c);
const old={id:1,date:'2026-01-01',type:'quote'},now=Date.parse('2026-10-31');
test('90 day boundary, unknown date and active work remain available',()=>{assert.equal(c.nsArchiveEligible(old,now),true);for(const q of [{...old,date:new Date(now-90*86400000).toISOString()},{...old,date:'',id:'unknown'},{...old,keepActive:true},{...old,_syncStatus:'pending'}])assert.equal(c.nsArchiveEligible(q,now),false)});
test('old invoices require full payment, delivery and confirmed commission',()=>{const invoice={...old,type:'invoice'};for(const q of [invoice,{...invoice,paid:true},{...invoice,paid:true,release:{} }])assert.equal(c.nsArchiveEligible(q,now),false);assert.equal(c.nsArchiveEligible({...invoice,paid:true,release:{},commissionPaid:true},now),true)});
test('archive is searchable across dates without changing source data',()=>{const before=JSON.stringify(old);mode='active';assert.equal(c.nsHistoryPeriodMatch(old,''),false);assert.equal(c.nsHistoryPeriodMatch(old,'customer'),true);mode='archive';assert.equal(c.nsHistoryPeriodMatch(old,''),true);mode='all';assert.equal(c.nsHistoryPeriodMatch(old,''),true);assert.equal(JSON.stringify(old),before)});
test('all inline scripts compile',()=>{for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);});
