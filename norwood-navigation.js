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
