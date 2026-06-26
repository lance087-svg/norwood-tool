// ============================================================
//  NORWOOD PATCH — loads after index.html
//  Contains:
//  1. Description deduplication fix (quotes + invoices)
//  2. Live Inventory Lookup panel
//  3. QOH deduction on invoice creation
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // Load Firebase SDK dynamically
  function loadFirebaseSDK(callback) {
    if (typeof firebase !== 'undefined') { callback(); return; }
    var s1 = document.createElement('script');
    s1.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
    s1.onload = function() {
      var s2 = document.createElement('script');
      s2.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
      s2.onload = callback;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }

  // Pre-load Firebase — sets window._db using named 'norwood-inv' app
  loadFirebaseSDK(function() {
    if (window._db) return;
    try {
      var _fbConfig = {
        apiKey: "AIzaSyAf50oc1i0ec1hsD_pPQNjj_tqcpIt0Sig",
        authDomain: "norwood-supply.firebaseapp.com",
        projectId: "norwood-supply",
        storageBucket: "norwood-supply.firebasestorage.app",
        messagingSenderId: "933963197210",
        appId: "1:933963197210:web:c362a02d3d1a8d010d9aa3"
      };
      var app;
      try { app = firebase.app('norwood-inv'); }
      catch(e) { app = firebase.initializeApp(_fbConfig, 'norwood-inv'); }
      window._db = app.firestore();
      console.log('Norwood patch: _db ready');
    } catch(e) { console.warn('Norwood patch: db init error', e); }
  });

  // ── FIX 1: MONKEY-PATCH showQuote / showInvoice ───────────────────────────

  var _origShowQuote   = window.showQuote;
  var _origShowInvoice = window.showInvoice;

  // Patch showQuote — dedup only
  if (typeof _origShowQuote === 'function') {
    window.showQuote = function() {
      _origShowQuote.apply(this, arguments);
      setTimeout(function() {
        var rows = document.querySelectorAll('#qp-content tr td:nth-child(2)');
        rows.forEach(function(td) {
          var bold = td.querySelector('div[style*="font-weight:600"]') ||
                     td.querySelector('div[style*="font-weight: 600"]');
          var sub  = td.querySelector('div[style*="color:#6b5a3a"]') ||
                     td.querySelector('div[style*="color: #6b5a3a"]');
          if (bold && sub) {
            var boldTxt = bold.textContent.trim();
            var subTxt  = sub.textContent.trim().split('·')[0].trim();
            if (subTxt && (subTxt === boldTxt || sub.textContent.trim() === boldTxt)) {
              sub.style.display = 'none';
            }
          }
        });
      }, 50);
    };
  }

  // Patch showInvoice — dedup + QOH deduction
  if (typeof _origShowInvoice === 'function') {
    var _deductedKeys = {}; // guard: never deduct same invoice render twice

    window.showInvoice = function(existingInvNum) {
      _origShowInvoice.apply(this, arguments);

      // Never deduct when loading an existing invoice
      if (existingInvNum) return;

      // Use a timestamp key — each new invoice render gets a unique key
      var renderKey = Date.now();

      setTimeout(function() {
        // Guard against double-fire
        if (_deductedKeys[renderKey]) return;
        _deductedKeys[renderKey] = true;

        // Collect only Live Inventory lines (explicitly marked isLive===true)
        var liveLines = (typeof lines !== 'undefined' ? lines : [])
          .filter(function(l) {
            return l.isLive === true
              && l.sku
              && String(l.sku).trim().length > 0
              && l.sku !== 'CUSTOM';
          });

        console.log('[PATCH-DEDUCT] live lines:', liveLines.length,
          liveLines.map(function(l) { return l.sku + ' x' + l.qty; }));

        if (!liveLines.length) {
          // Still run dedup even if no live lines
          runDedup();
          return;
        }

        // Get Firestore via named app
        var app;
        try { app = firebase.app('norwood-inv'); }
        catch(e) {
          try {
            app = firebase.initializeApp({
              apiKey: "AIzaSyAf50oc1i0ec1hsD_pPQNjj_tqcpIt0Sig",
              authDomain: "norwood-supply.firebaseapp.com",
              projectId: "norwood-supply",
              storageBucket: "norwood-supply.firebasestorage.app",
              messagingSenderId: "933963197210",
              appId: "1:933963197210:web:c362a02d3d1a8d010d9aa3"
            }, 'norwood-inv');
          } catch(e2) {
            console.error('[PATCH-DEDUCT] Firebase unavailable:', e2.message);
            runDedup();
            return;
          }
        }
        var db = app.firestore();
        var deducted = 0;

        liveLines.forEach(function(l) {
          var sku = String(l.sku).trim();
          var qty = Math.max(1, parseInt(l.qty) || 1);
          db.collection('norwood').doc(sku).get().then(function(doc) {
            if (!doc.exists) {
              console.warn('[PATCH-DEDUCT] SKU not in Firestore:', sku);
              return;
            }
            var curQoh = parseInt(doc.data().qoh) || 0;
            var newQoh = Math.max(0, curQoh - qty);
            return doc.ref.update({
              qoh: newQoh,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function() {
              deducted++;
              console.log('[PATCH-DEDUCT] ✅', sku, curQoh, '→', newQoh);
              if (deducted === liveLines.length) {
                if (typeof showToast === 'function') {
                  showToast('✅ Inventory updated: ' + deducted + ' item(s) deducted', '#2d6a30');
                }
              }
            });
          }).catch(function(e) {
            console.error('[PATCH-DEDUCT] ❌', sku, ':', e.message);
          });
        });

        runDedup();
      }, 500);

      // ── DEDUP: hide sub-description that duplicates the item name ─────────
      function runDedup() {
        setTimeout(function() {
          var cells = document.querySelectorAll('#invoice-content td[style*="line-height"]');
          cells.forEach(function(td) {
            var strong = td.querySelector('strong');
            var span   = td.querySelector('span[style*="font-size:11px"]') ||
                         td.querySelector('span[style*="font-size: 11px"]');
            if (strong && span) {
              var itemText = strong.textContent.trim();
              var spanText = span.textContent.trim();
              var descText = spanText.split('·')[0].trim();
              var hasSku   = /^[A-Z]{2}-/.test(spanText);
              if (spanText && !hasSku && (descText === itemText || spanText === itemText)) {
                span.style.display = 'none';
              }
            }
          });
        }, 50);
      }
    };
  }

  // ── FIX 2: LIVE INVENTORY LOOKUP ──────────────────────────────────────────

  var style = document.createElement('style');
  style.textContent =
    '.invChip{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid #d0dce8;background:#fff;color:#555;transition:all 0.15s;user-select:none;display:inline-block;font-family:system-ui}' +
    '.invChip.active{background:#1E70B8;border-color:#1E70B8;color:#fff}' +
    '.invChip:hover:not(.active){background:#e8f2fb;border-color:#1E70B8;color:#1E70B8}' +
    '.invResultItem{display:flex;gap:10px;align-items:center;padding:11px 12px;border-radius:8px;margin-bottom:8px;cursor:pointer;border:1.5px solid #e8edf2;background:#fff;transition:all 0.15s}' +
    '.invResultItem:hover{border-color:#1E70B8;background:#f0f7ff;box-shadow:0 2px 8px rgba(30,112,184,0.10)}' +
    '.invResultItem.zero-stock{opacity:0.55;border-style:dashed}' +
    '.invQohBadge{display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:800;flex-shrink:0;white-space:nowrap;font-family:system-ui}' +
    '.invQohBadge.good{background:#e8f5e9;color:#2E7D32}' +
    '.invQohBadge.low{background:#fff3e0;color:#e65100}' +
    '.invQohBadge.zero{background:#fce4ec;color:#c62828}' +
    '.inv-banner-tag{color:#fff!important;font-size:11px!important}' +
    '.inv-banner-num{font-size:22px!important;font-weight:900!important}' +
    '.inv-meta-label{font-size:10px!important}' +
    '.inv-meta-value{font-size:11px!important}';
  document.head.appendChild(style);

  // Find the "Custom Item" button to insert Live Inventory button next to it
  var customBtn = document.querySelector('button[onclick="showCustomItem()"]');
  if (!customBtn) {
    setTimeout(function() {
      customBtn = document.querySelector('button[onclick="showCustomItem()"]');
      if (customBtn) injectLiveBtn(customBtn);
    }, 800);
  } else {
    injectLiveBtn(customBtn);
  }

  function injectLiveBtn(refBtn) {
    var liveBtn = document.createElement('button');
    liveBtn.className = refBtn.className || 'btn';
    liveBtn.style.cssText = 'background:#1E70B8;color:#fff;font-weight:700;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;';
    liveBtn.innerHTML = '📦 Live Inventory';
    liveBtn.onclick = openInv;
    refBtn.parentNode.insertBefore(liveBtn, refBtn);
  }

  // ── Modal ───────────────────────────────────────────────────────────────────
  var modal = document.createElement('div');
  modal.id = '_invModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:none;align-items:flex-start;justify-content:center;padding-top:60px;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:12px;width:min(96vw,580px);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.22);overflow:hidden;">' +
    '<div style="background:#1E70B8;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">' +
    '<div style="font-weight:800;font-size:16px;font-family:system-ui;color:#fff;">&#x1F4E6; Live Inventory</div>' +
    '<div id="invSubtitle" style="font-size:12px;color:#cde;font-family:system-ui;"></div>' +
    '<button onclick="document.getElementById(\'_invModal\').style.display=\'none\'" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:6px;padding:2px 10px;line-height:1;">✕</button>' +
    '</div>' +
    '<div style="padding:12px 14px;border-bottom:1px solid #eee;background:#f8fafc;">' +
    '<input type="text" id="invSearch" placeholder="Search description, SKU, or Item No..." ' +
    'style="width:100%;box-sizing:border-box;padding:8px 12px;border:1.5px solid #cdd;border-radius:7px;font-size:14px;font-family:system-ui;outline:none;" ' +
    'oninput="filterInv()">' +
    '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
    '<span class="invChip active" data-cat="ALL" onclick="setInvCat(this)">All</span>' +
    '<span class="invChip" data-cat="DR" onclick="setInvCat(this)">Doors</span>' +
    '<span class="invChip" data-cat="MW" onclick="setInvCat(this)">Millwork</span>' +
    '<span class="invChip" data-cat="LB" onclick="setInvCat(this)">Lumber</span>' +
    '<span class="invChip" data-cat="HW" onclick="setInvCat(this)">Hardware</span>' +
    '<label style="font-size:11px;color:#888;margin-left:auto;display:flex;align-items:center;gap:4px;cursor:pointer;font-family:system-ui;">' +
    '<input type="checkbox" id="invShowZero" onchange="filterInv()"> Show out-of-stock</label>' +
    '</div>' +
    '</div>' +
    '<div id="invList" style="overflow-y:auto;flex:1;padding:12px 14px;"></div>' +
    '</div>';
  document.body.appendChild(modal);

  var _inv = [];
  var _invCat = 'ALL';

  window.setInvCat = function(el) {
    document.querySelectorAll('.invChip').forEach(function(c) { c.classList.remove('active'); });
    el.classList.add('active');
    _invCat = el.dataset.cat;
    filterInv();
  };

  window.filterInv = function() {
    var q = (document.getElementById('invSearch').value || '').toLowerCase();
    var showZ = document.getElementById('invShowZero').checked;
    var filtered = _inv.filter(function(item) {
      if (_invCat !== 'ALL' && item.category !== _invCat) return false;
      if (!showZ && (item.qoh || 0) === 0) return false;
      if (!q) return true;
      return (item.description || '').toLowerCase().indexOf(q) > -1 ||
             (item.sku || '').toLowerCase().indexOf(q) > -1 ||
             String(item.itemNo || '').indexOf(q) > -1;
    });

    var listEl = document.getElementById('invList');
    if (!filtered.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:#aaa;font-family:system-ui;">No matching items. Try a different search or check out-of-stock.</div>';
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(function(item) {
      var qoh = item.qoh || 0;
      var qc  = qoh === 0 ? 'zero' : qoh < 3 ? 'low' : 'good';
      var ql  = qoh === 0 ? 'Out of Stock' : 'QOH: ' + qoh;

      var row = document.createElement('div');
      row.className = 'invResultItem' + (qoh === 0 ? ' zero-stock' : '');
      row.dataset.sku = item.sku || '';

      // Photo or icon
      var photoEl;
      if (item.photoBase64) {
        photoEl = document.createElement('img');
        photoEl.src = 'data:image/jpeg;base64,' + item.photoBase64;
        photoEl.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid #dde;';
      } else {
        photoEl = document.createElement('div');
        photoEl.style.cssText = 'width:48px;height:48px;border-radius:6px;background:#f0f3f7;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;';
        photoEl.textContent = item.isSalvage || item.type === 'salvage' ? '🏷️' : '📦';
      }

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';

      // SKU line with item number and salvage badge
      var skuLine = document.createElement('div');
      skuLine.style.cssText = 'font-size:11px;color:#1E70B8;font-family:Courier New,monospace;font-weight:700;margin-bottom:2px;';

      if (item.itemNo) {
        var noTag = document.createElement('span');
        noTag.style.cssText = 'background:#1E70B8;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;margin-right:4px;';
        noTag.textContent = '#' + item.itemNo;
        skuLine.appendChild(noTag);
      }
      if (item.isSalvage || item.type === 'salvage') {
        var salvTag = document.createElement('span');
        salvTag.style.cssText = 'background:#fff3e0;color:#e65100;border:1px solid #e65100;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;margin-right:4px;';
        salvTag.textContent = '🏷️ SALVAGE';
        skuLine.appendChild(salvTag);
      }
      skuLine.appendChild(document.createTextNode(item.sku || ''));

      var descLine = document.createElement('div');
      descLine.style.cssText = 'font-size:14px;font-weight:600;color:#222;line-height:1.3;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      descLine.textContent = item.description || item.sku || '';

      var metaLine = document.createElement('div');
      metaLine.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';

      var priceSpan = document.createElement('span');
      priceSpan.style.cssText = 'font-size:14px;font-weight:800;color:#2E7D32;';
      priceSpan.textContent = '$' + (item.price || 0).toFixed(2);
      metaLine.appendChild(priceSpan);

      if (item.vendor) {
        var vSpan = document.createElement('span');
        vSpan.style.cssText = 'font-size:11px;color:#888;font-family:system-ui;';
        vSpan.textContent = item.vendor;
        metaLine.appendChild(vSpan);
      }
      if (item.location) {
        var lSpan = document.createElement('span');
        lSpan.style.cssText = 'font-size:11px;color:#aaa;font-family:system-ui;';
        lSpan.textContent = '📍' + item.location;
        metaLine.appendChild(lSpan);
      }

      info.appendChild(skuLine);
      info.appendChild(descLine);
      info.appendChild(metaLine);

      var badge = document.createElement('span');
      badge.className = 'invQohBadge ' + qc;
      badge.textContent = ql;

      row.appendChild(photoEl);
      row.appendChild(info);
      row.appendChild(badge);
      row.addEventListener('click', function() { pickInv(this.dataset.sku); });
      listEl.appendChild(row);
    });
  };

  function updateSubtitle() {
    var n = _inv.filter(function(i) { return (i.qoh || 0) > 0; }).length;
    var el = document.getElementById('invSubtitle');
    if (el) el.textContent = n + ' item' + (n === 1 ? '' : 's') + ' in stock';
  }

  function openInv() {
    modal.style.display = 'flex';
    document.getElementById('invSearch').value = '';
    _invCat = 'ALL';
    document.querySelectorAll('.invChip').forEach(function(c) {
      c.classList.toggle('active', c.dataset.cat === 'ALL');
    });
    loadInv();
  }

  function closeInv() { modal.style.display = 'none'; }

  async function loadInv() {
    var listEl = document.getElementById('invList');
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-family:system-ui;">Connecting to inventory...</div>';
    await new Promise(function(resolve) { loadFirebaseSDK(resolve); });
    try {
      if (typeof firebase === 'undefined') {
        listEl.innerHTML = '<div style="color:#c62828;padding:20px;font-family:system-ui;">Could not load Firebase. Check your internet connection.</div>';
        return;
      }
      var _fbConfig = {
        apiKey: "AIzaSyAf50oc1i0ec1hsD_pPQNjj_tqcpIt0Sig",
        authDomain: "norwood-supply.firebaseapp.com",
        projectId: "norwood-supply",
        storageBucket: "norwood-supply.firebasestorage.app",
        messagingSenderId: "933963197210",
        appId: "1:933963197210:web:c362a02d3d1a8d010d9aa3"
      };
      var _fbApp;
      try { _fbApp = firebase.app('norwood-inv'); }
      catch(e) { _fbApp = firebase.initializeApp(_fbConfig, 'norwood-inv'); }
      var db = _fbApp.firestore();
      var snap = await db.collection('norwood').limit(500).get();
      var valid = ['DR', 'MW', 'LB', 'HW'];
      _inv = snap.docs
        .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
        .filter(function(d) {
          if (d.id.indexOf('__') === 0) return false;
          if (d.isSalvage || d.type === 'salvage') return true;
          return valid.indexOf(d.category) > -1 || (d.sku && d.description);
        })
        .sort(function(a, b) {
          var qa = a.qoh || 0, qb = b.qoh || 0;
          if (qa > 0 && qb === 0) return -1;
          if (qa === 0 && qb > 0) return 1;
          return (a.description || '').localeCompare(b.description || '');
        });
      filterInv();
      updateSubtitle();
    } catch(e) {
      listEl.innerHTML = '<div style="color:#c62828;padding:20px;font-family:system-ui;">Error: ' + e.message + '</div>';
    }
  }

  function pickInv(sku) {
    var item = _inv.find(function(i) { return i.sku === sku; });
    if (!item) return;

    var pseudo = {
      id: 'inv_' + sku,
      sku: sku,
      item: item.description || sku,
      description: '',
      category: item.category || 'Other',
      group: 'Inventory',
      size: '',
      cost: item.cost || 0,
      fixedRetail: item.price || null,
      onHand: item.qoh || 0,
      uom: 'EA',
      notes: item.notes || '',
      imageUrl: item.photoBase64 ? 'data:image/jpeg;base64,' + item.photoBase64 : '',
      isCustom: false,
      isLive: true   // ← tells patch deduction to write back to Firestore
    };

    var qty    = parseInt(document.getElementById('qty-in').value) || 1;
    var gm     = (typeof manualGM !== 'undefined' && manualGM !== null) ? manualGM
                 : (typeof getCategoryGM === 'function' ? getCategoryGM(pseudo, qty) : 0.40);
    var retail = typeof calcRetail === 'function'
                 ? calcRetail(pseudo.cost, gm, pseudo.fixedRetail)
                 : (pseudo.fixedRetail || Math.round(pseudo.cost / (1 - gm)));

    lines.push(Object.assign({}, pseudo, { qty: qty, retail: retail, gm: gm, lineId: Date.now() }));
    if (typeof recalcLines  === 'function') recalcLines();
    if (typeof renderLines  === 'function') renderLines();
    if (typeof renderSummary === 'function') renderSummary();
    document.getElementById('qty-in').value = 1;
    closeInv();

    // Toast
    var t = document.getElementById('_invToast');
    if (!t) {
      t = document.createElement('div');
      t.id = '_invToast';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1E70B8;color:#fff;padding:10px 18px;border-radius:8px;font-family:system-ui;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.18);opacity:0;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = '📦 Added: ' + (item.description || sku);
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(function() { t.style.opacity = '0'; }, 2500);
  }

  // Close modal on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeInv();
  });

}); // end DOMContentLoaded
