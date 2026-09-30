/* Shared customer invoice delivery status. Opening a screen never writes data. */
(function(root){
'use strict';
function completion(q,meta,payment){
  meta=meta||{};payment=payment||{};
  var paid=Number.isFinite(payment.balance)&&payment.balance<=0.01;
  var delivered=meta.status!=null?meta.status==='Delivered':!!(q&&q.release);
  var customerConfirmed=delivered&&!!meta.customerReceipt?.confirmed;
  return {paid:paid,delivered:delivered,customerConfirmed:customerConfirmed,complete:paid&&delivered&&customerConfirmed,release:delivered?(meta.release||(q||{}).release||null):null,receipt:customerConfirmed?meta.customerReceipt:null};
}
function deliveryChange(q,meta,state,record,at,undo){
  if(!q||q.removed||q.type!=='invoice')throw Error('This invoice is no longer available. Refresh before editing.');
  var by=String(record.by||'').trim(),recipient=String(record.pickedUpBy||'').trim(),reason=String(record.reason||'').trim();
  if(!by)throw Error('Choose who is recording the delivery.');
  var isDelivered=meta.status!=null?meta.status==='Delivered':!!q.release;
  if(undo&&!isDelivered)throw Error('This invoice is no longer marked delivered.');
  if(!undo&&isDelivered)throw Error('This invoice has already been marked delivered. Refresh to see the shared status.');
  if(undo&&!reason)throw Error('Enter a reason for correcting the delivery status.');
  if(!undo&&!recipient)throw Error('Enter who received the delivery.');
  if(!undo&&!state.ok&&(!record.canOverride||!reason))throw Error('Collect payment first, or use the existing manager override with a reason.');
  var stamp=new Date(at),date=stamp.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}),time=stamp.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
  var release=undo?null:{at:at,date:date,time:time,by:by,pickedUpBy:recipient,mode:'delivery',balance:Math.round(state.balance*100)/100,override:!state.ok,reason:reason,net30:state.tone==='amber'};
  var note=undo?'Delivery mark removed: '+reason:'Delivered to '+recipient+(release.override?' — balance due $'+release.balance.toFixed(2)+'. '+reason:'');
  var event={id:'delivery_'+at,action:undo?'delivery_corrected':'delivered',label:undo?'Delivery corrected':'Delivered',channel:'Delivery',by:by,at:stamp.toISOString(),note:note};
  return {meta:Object.assign({},meta,{status:undo?'Received':'Delivered',release:release,deliveredAt:undo?'':event.at,deliveredBy:undo?'':by,customerReceipt:null}),fields:{release:release,activity:(q.activity||[]).concat(event),history:(q.history||[]).concat({at:at,by:by,action:note}),lastActivityAt:event.at,lastActivityLabel:event.label,timestamp:at}};
}
function receiptChange(q,meta,record,at){
  if(!q||q.removed||q.type!=='invoice')throw Error('This invoice is no longer available. Refresh before editing.');
  var by=String(record.by||'').trim(),confirmed=!!record.confirmed;
  if(!by)throw Error('Enter who is recording the customer confirmation.');
  if(!completion(q,meta,{}).delivered)throw Error('Mark delivered before confirming customer receipt.');
  if(!!meta.customerReceipt?.confirmed===confirmed)throw Error('Customer confirmation changed on another device. Refresh to see the shared status.');
  var iso=new Date(at).toISOString(),note=confirmed?'Customer confirmed receipt of the order.':'Customer receipt confirmation cleared.',label=confirmed?'Customer receipt confirmed':'Customer receipt corrected';
  var event={id:'customer_receipt_'+at,action:confirmed?'customer_receipt_confirmed':'customer_receipt_corrected',label:label,channel:'Delivery',by:by,at:iso,note:note};
  return {meta:Object.assign({},meta,{customerReceipt:confirmed?{confirmed:true,by:by,at:iso}:null}),fields:{activity:(q.activity||[]).concat(event),history:(q.history||[]).concat({at:at,by:by,action:note}),lastActivityAt:iso,lastActivityLabel:label,timestamp:at}};
}
if(typeof module!=='undefined'&&module.exports){module.exports={completion:completion,deliveryChange:deliveryChange,receiptChange:receiptChange};return;}
var D=root.document,mounted=false;
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function invoice(qid){return root.getSavedQuotes().find(function(q){return String(q.id)===String(qid)&&q.type==='invoice'});}
function status(q){return completion(q,(root.getOrderMeta()||{})[q.quoteNum],root.nsPayState(q));}
function badge(label,tone){return '<span class="ns-delivery-badge '+(tone||'')+'">'+esc(label)+'</span>';}
function deliveryBadge(q){if(!q||q.type!=='invoice')return '';var s=status(q);return badge(s.complete?'Complete — paid, delivered & confirmed':s.delivered?(s.customerConfirmed?'Customer received — payment open':s.paid?'Awaiting customer receipt':'Delivered'):'Delivery pending',s.complete?'complete':s.delivered?'delivered':'pending');}
function action(q){if(!q||q.type!=='invoice'||status(q).delivered)return '';return '<button type="button" class="ns-delivery-button" data-ns-deliver="'+esc(q.id)+'">Mark delivered</button>';}
function customerCheck(q,compact){
  if(!q||q.type!=='invoice')return '';var s=status(q);if(compact&&!s.delivered)return '';
  var receipt=s.receipt,stamp=receipt?'Confirmed by '+receipt.by+' · '+new Date(receipt.at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):s.delivered?'Check after the customer confirms receiving the order.':'Mark delivered first.';
  return '<div class="ns-customer-receipt"><label class="ns-customer-check" title="'+esc(stamp)+'"><input type="checkbox" data-ns-customer-receipt="'+esc(q.id)+'" aria-label="Customer confirmed receipt for '+esc(q.quoteNum)+'"'+(s.customerConfirmed?' checked':'')+(!s.delivered?' disabled':'')+'><span>Customer confirmed receipt</span></label>'+(!compact?'<small>'+esc(stamp)+'</small>':'')+'</div>';
}
function renderInvoice(){
  var parent=D.getElementById('invoice-view'),content=D.getElementById('invoice-content');if(!parent||!content||parent.classList.contains('hidden'))return;
  var invNum=typeof currentInvNum!=='undefined'?currentInvNum:'',q=root.getSavedQuotes().find(function(q){return q.type==='invoice'&&q.quoteNum===invNum});if(!q)return;
  var panel=D.getElementById('ns-invoice-completion');if(!panel){panel=D.createElement('section');panel.id='ns-invoice-completion';panel.setAttribute('aria-label','Invoice completion');content.parentNode.insertBefore(panel,content);}
  var s=status(q),rel=s.release,ps=root.nsPayState(q),label=s.complete?'Complete — paid, delivered & confirmed':s.delivered?(s.paid?'Paid & delivered — awaiting customer receipt':s.customerConfirmed?'Delivered & customer confirmed — payment open':'Delivered — payment and customer receipt open'):s.paid?'Paid — awaiting delivery':'Payment and delivery still open';
  panel.className='ns-invoice-completion '+(s.complete?'is-complete':'');
  panel.innerHTML='<div><strong>'+label+'</strong><div class="ns-delivery-status-row">'+badge(s.paid?'Paid in full':'Balance due $'+Number(ps.balance).toFixed(2),s.paid?'complete':'pending')+badge(s.delivered?'Delivered':'Delivery pending',s.delivered?'delivered':'pending')+'</div>'+customerCheck(q,false)+(rel?'<p>'+esc(rel.date||'')+(rel.time?' at '+esc(rel.time):'')+(rel.by?' · Recorded by '+esc(rel.by):'')+(rel.pickedUpBy?' · To '+esc(rel.pickedUpBy):'')+'</p>':'')+'</div><div class="ns-delivery-actions">'+(!s.paid?'<button type="button" class="ns-delivery-button" data-ns-delivery-pay="'+esc(q.id)+'">Take payment</button>':'')+(s.delivered?'<button type="button" class="ns-delivery-button secondary" data-ns-undeliver="'+esc(q.id)+'">Correct delivery mark</button>':action(q))+'</div>';
}
function active(id){return D.getElementById(id)?.classList.contains('active');}
function refresh(){
  if(active('page-history')&&typeof root.renderHistory==='function')root.renderHistory();
  if(active('page-orders')&&typeof root.renderOrderTracker==='function')root.renderOrderTracker();
  if(active('page-pickup')&&typeof root.renderPickup==='function')root.renderPickup();
  renderInvoice();if(root.NWOperations)root.NWOperations.render();if(typeof root.nsUpdateOwingBar==='function')root.nsUpdateOwingBar();
}
async function writeChange(qid,changeFor){
  var database=typeof root.nsSyncDb==='function'?root.nsSyncDb():root._db;if(!database)throw Error('Cloud sync is not connected. Reconnect before saving shared invoice status.');
  var cached=invoice(qid);if(!cached)throw Error('Invoice not found.');var qr=database.collection('ns_quotes').doc(String(qid)),mr=database.collection('ns_sync').doc('ns_order_meta'),meta,updated,at=Date.now();
  await database.runTransaction(async function(tx){
    var qs=await tx.get(qr),ms=await tx.get(mr);if(!qs.exists)throw Error('The shared invoice could not be found. Refresh and try again.');
    var q=qs.data();if(q.quoteNum!==cached.quoteNum)throw Error('The invoice changed. Refresh before marking delivery.');
    meta=ms.exists?(ms.data().data||{}):{};
    var change=changeFor(q,meta[q.quoteNum]||{},at);meta[q.quoteNum]=change.meta;updated=Object.assign({},q,change.fields);
    tx.set(mr,{data:meta,updatedAt:root.firebase.firestore.FieldValue.serverTimestamp(),device:root.nsDeviceLabel()},{merge:true});tx.update(qr,change.fields);
  });
  localStorage.setItem('ns_order_meta',JSON.stringify(meta));var all=root.getSavedQuotesRaw(),i=all.findIndex(function(q){return String(q.id)===String(qid)});if(i>=0)all[i]=updated;else all.push(updated);
  if(!root.nsSafeSetQuotes(all))throw Error('Status saved in the cloud. Refresh to update this device.');refresh();return updated;
}
function writeDelivery(qid,record,undo){return writeChange(qid,function(q,meta,at){var r=Object.assign({},record,{canOverride:(root.NS_OVERRIDE_NAMES||['Cleve','Lance','Garon']).indexOf(record.by)!==-1});return deliveryChange(q,meta,root.nsReleaseState(q),r,at,undo)});}
async function confirmCustomerReceipt(qid,confirmed,by){var q=await writeChange(qid,function(q,meta,at){return receiptChange(q,meta,{confirmed:confirmed,by:by},at)});root.showToast(status(q).complete?'Complete — paid, delivered & confirmed. Shared with all associates.':confirmed?'Customer receipt confirmed. Remaining balance stays open.':'Customer receipt confirmation cleared.','#2d6a30');return q;}
async function commitDelivery(qid,record){var q=await writeDelivery(qid,record,false);root.showToast(status(q).paid?'Delivered. Check Customer confirmed receipt once the customer confirms.':'Delivery recorded. Remaining balance stays open.','#2d6a30');return q;}
function markDelivered(qid){var q=invoice(qid);if(!q)return;if(status(q).delivered){refresh();return;}root.nsReleaseOrder(q.quoteNum,{mode:'delivery'});}
async function undoDelivery(qid,reason,by){var q=await writeDelivery(qid,{by:by,reason:reason},true);root.showToast('Delivery mark corrected. Payment stays saved.','#174b79');return q;}
root.NWFulfillment={completion:completion,status:status,deliveryBadge:deliveryBadge,action:action,customerCheck:customerCheck,renderInvoice:renderInvoice,refresh:refresh,markDelivered:markDelivered,commitDelivery:commitDelivery,undoDelivery:undoDelivery,confirmCustomerReceipt:confirmCustomerReceipt};
function mount(){
  if(mounted)return;mounted=true;
  D.addEventListener('click',function(e){if(e.target.closest('.ns-customer-check')){e.stopPropagation();return;}var button=e.target.closest('[data-ns-deliver],[data-ns-undeliver],[data-ns-delivery-pay]');if(!button)return;e.preventDefault();e.stopPropagation();
    if(button.dataset.nsDeliver){markDelivered(button.dataset.nsDeliver);return;}
    if(button.dataset.nsDeliveryPay){root.openPaymentModal(Number(button.dataset.nsDeliveryPay));return;}
    var reason=root.prompt('Reason for correcting the delivered mark:');if(!reason||!reason.trim())return;button.disabled=true;undoDelivery(button.dataset.nsUndeliver,reason.trim(),root.nsActingAs()).catch(function(err){button.disabled=false;root.showToast(err.message,'#c04040')});
  },true);
  D.addEventListener('change',function(e){var input=e.target;if(!input.matches('[data-ns-customer-receipt]'))return;e.stopPropagation();var desired=input.checked,by=root.nsActingAs();
    if(!by){by=String(root.prompt('Recorded by (your name):')||'').trim();if(by&&typeof root.nsSetActingAs==='function')root.nsSetActingAs(by);}
    if(!by){input.checked=!desired;root.showToast('Enter your name to record customer confirmation.','#b35309');return;}input.disabled=true;
    confirmCustomerReceipt(input.dataset.nsCustomerReceipt,desired,by).catch(function(err){input.disabled=false;input.checked=!desired;refresh();root.showToast(err.message||'Could not save customer confirmation. Try again.','#c04040',6000)});
  });
  var strip=root.updateInvFulfillmentStrip;if(typeof strip==='function')root.updateInvFulfillmentStrip=function(){var result=strip.apply(this,arguments);renderInvoice();return result;};
  var apply=root.nsSyncApplyRemote;if(typeof apply==='function')root.nsSyncApplyRemote=function(key,value){apply(key,value);if(key==='ns_order_meta')refresh();};
  D.addEventListener('visibilitychange',function(){if(!D.hidden)refresh()});root.addEventListener('storage',refresh);
  function version(){return (localStorage.getItem('ns_quotes')||'')+'|'+(localStorage.getItem('ns_order_meta')||'');}var last=version();root.setInterval(function(){var value=version();if(value!==last){last=value;refresh()}},5000);
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window!=='undefined'?window:globalThis);
