/* Isolated fictional records and Firestore simulator. Never loads the live app. */
(function(root){
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const anchor=new Date().toISOString().slice(0,10);
const po={id:15112,poNum:'PO-15112',vendorName:'Coastal Building Products (sample)',date:anchor,reqBy:anchor,customerName:'Stock order',rep:'Lance',status:'Sent',totalCost:1725,items:[{item:'2×4 treated lumber',size:'8 ft',sku:'SAMPLE-24-8',qty:300,unitCost:5.75}]};
const records=[{id:101,type:'invoice',quoteNum:'INV-SAMPLE-101',date:'Aug 20, 2026',grand:2450,amountPaid:450,dueDate:'2026-08-30',customer:{name:'Oakline Construction (sample)',rep:'Lance'},paymentHistory:[{amount:450,type:'partial'}],returnsHistory:[],activity:[]},{id:102,type:'quote',quoteNum:'Q-SAMPLE-102',date:'Sep 25, 2026',grand:3100,customer:{name:'River Bend Remodel (sample)',rep:'Garen'},activity:[]},{id:103,type:'quote',quoteNum:'Q-DELETED',removed:true,customer:{name:'Removed sample'},grand:0}];
function makeDB(initial){
 const docs=clone(initial),writes=[];let fail=false;
 const ref=(c,i)=>({path:c+'/'+i});
 const snapshot=r=>({exists:docs[r.path]!==undefined,data:()=>clone(docs[r.path]),ref:r});
 return {docs,writes,failNext(){fail=true},collection(c){return {doc(i){return ref(c,i)},where(field,op,value){return {async get(){return {docs:Object.keys(docs).filter(k=>k.startsWith(c+'/')&&docs[k][field]===value).map(k=>snapshot({path:k}))}}}}}},async runTransaction(cb){if(fail){fail=false;throw Error('Simulated sync failure');}const pending=[];let writing=false;await cb({async get(r){if(writing)throw Error('All transaction reads must happen before writes');return snapshot(r)},update(r,data){if(docs[r.path]===undefined)throw Error('Missing document');writing=true;pending.push({r,data})},set(r,data){writing=true;pending.push({r,data})}});pending.forEach(x=>{docs[x.r.path]=Object.assign({},docs[x.r.path]||{},clone(x.data));writes.push(clone(x));});}};
}
root.NWMakeDB=makeDB;
const initial={'ns_sync/ns_po_log':{data:[po]},'ns_sync/ns_order_meta':{data:{'INV-OTHER':{eta:'2026-10-12',status:'In Transit'}}},'norwood/sample-lumber':{sku:'SAMPLE-24-8',qoh:100}};
records.forEach(q=>initial['ns_quotes/'+q.id]=q);
const database=makeDB(initial);root.NWTestDB=database;root._db=database;
localStorage.setItem('ns_po_log',JSON.stringify([po]));localStorage.setItem('ns_quotes',JSON.stringify(records));localStorage.setItem('ns_order_meta',JSON.stringify(initial['ns_sync/ns_order_meta'].data));
root.firebase={firestore:{FieldValue:{serverTimestamp:()=> 'mock-server-time'}}};root.nsDeviceLabel=()=> 'mock-device';root.nsSyncDb=()=>database;
root.getPOLog=()=>JSON.parse(localStorage.getItem('ns_po_log')||'[]');root.savePOLog=list=>localStorage.setItem('ns_po_log',JSON.stringify(list));
root.getSavedQuotesRaw=()=>JSON.parse(localStorage.getItem('ns_quotes')||'[]');root.getSavedQuotes=()=>root.getSavedQuotesRaw().filter(q=>!q.removed);root.nsSafeSetQuotes=list=>{localStorage.setItem('ns_quotes',JSON.stringify(list));return true};root.saveQuotesToStorage=root.nsSafeSetQuotes;
root.getOrderMeta=()=>JSON.parse(localStorage.getItem('ns_order_meta')||'{}');root.saveOrderMeta=m=>localStorage.setItem('ns_order_meta',JSON.stringify(m));root.buildOrderList=()=>root.getSavedQuotes().filter(q=>q.type==='invoice').map(q=>({invNum:q.quoteNum,status:'Received',eta:root.getOrderMeta()[q.quoteNum]?.eta}));
root.nsPayState=q=>({balance:Math.max(0,q.grand-(q.paymentHistory||[]).filter(p=>p.type!=='net30').reduce((a,p)=>a+p.amount,0)),paid:q.amountPaid||0});root.nsActingAs=()=> 'Lance';root.showToast=s=>{root.document.getElementById('mock-status').textContent=s};
root.showPage=(name,b)=>{root.document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));root.document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));};root.nsSyncApplyRemote=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
root.renderPOLog=()=>{const el=root.document.getElementById('mock-po-log');if(el&&root.NWOperations)el.innerHTML=root.getPOLog().map(root.NWOperations.lineTable).join('')};root.renderHistory=()=>{};root.renderOrderTracker=()=>{};root.loadLiveInventory=()=>{};
root.openPaymentModal=id=>root.showToast('Existing payment form opened for '+id);root.loadQuote=id=>root.showToast('Existing builder opened for '+id);root.openPOViewModal=id=>root.showToast('Existing PO view opened for '+id);root.showPOBuilder=()=>root.showToast('Existing PO builder opened');root.nsUploadReceivingPhotos=async(_,photos)=>photos.map(()=> 'https://example.invalid/sample-photo.jpg');
root.products=[];
})(window);
