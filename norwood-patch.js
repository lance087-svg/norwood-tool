// ============================================================
//  NORWOOD PATCH — loads after index.html
//  Contains:
//  1. Description deduplication fix (quotes + invoices)
//  2. Live Inventory Lookup panel
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // ── FIX 1: DESCRIPTION DEDUPLICATION ──────────────────────
  // Monkey-patch showQuote and showInvoice so the sub-description
  // line only appears when it differs from the item name.

  var _origShowQuote   = window.showQuote;
  var _origShowInvoice = window.showInvoice;

  function cleanRows(lines) {
    // Returns patched line objects where description won't duplicate item
    return lines.map(function(l) {
      return Object.assign({}, l, {
        _showDesc: l.description && l.description.trim() !== (l.item||'').trim()
      });
    });
  }

  if (typeof _origShowQuote === 'function') {
    window.showQuote = function() {
      // Call original — it builds the HTML into qp-content
      _origShowQuote.apply(this, arguments);
      // Now strip duplicate description lines from the rendered HTML
      setTimeout(function() {
        var rows = document.querySelectorAll('#qp-content tr td:nth-child(2)');
        rows.forEach(function(td) {
          var bold = td.querySelector('div[style*="font-weight:600"]') ||
                     td.querySelector('div[style*="font-weight: 600"]');
          var sub  = td.querySelector('div[style*="color:#6b5a3a"]') ||
                     td.querySelector('div[style*="color: #6b5a3a"]');
          if (bold && sub) {
            var itemText = bold.textContent.trim();
            var descText = sub.textContent.replace(/·.*$/, '').trim(); // strip size part
            if (descText === itemText || sub.textContent.trim() === itemText) {
              sub.style.display = 'none';
            }
          }
        });
      }, 50);
    };
  }

  if (typeof _origShowInvoice === 'function') {
    window.showInvoice = function() {
      _origShowInvoice.apply(this, arguments);
      setTimeout(function() {
        var cells = document.querySelectorAll('#invoice-content td[style*="line-height"]');
        cells.forEach(function(td) {
          var strong = td.querySelector('strong');
          var span   = td.querySelector('span[style*="font-size:11px"]') ||
                       td.querySelector('span[style*="font-size: 11px"]');
          if (strong && span) {
            var itemText = strong.textContent.trim();
            // span text starts with the description before any SKU
            var descText = span.textContent.split('·')[0].trim();
            if (descText === itemText) {
              span.style.display = 'none';
            }
          }
        });
      }, 50);
    };
  }

  // ── FIX 2: LIVE INVENTORY LOOKUP ──────────────────────────

  // Inject styles
  var style = document.createElement('style');
  style.textContent =
    /* Inventory lookup chips */
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
    /* Invoice banner: change light-blue #90CAF9 text to white, bump font sizes */
    '.inv-banner-tag{color:#fff!important;font-size:11px!important}' +
    '.inv-banner-contact{color:#fff!important;font-size:12px!important;line-height:1.9!important}' +
    '.inv-banner-num{color:#fff!important;font-size:14px!important;font-weight:700!important;margin-top:4px!important}' +
    '.inv-banner-meta{color:#fff!important;font-size:12px!important;line-height:2!important}' +
    '.inv-banner-title{font-size:28px!important;letter-spacing:4px!important}' +
    '.inv-banner-logo{font-size:26px!important}' +
    /* Quote banner: same treatment */
    '.qp-banner-tag{color:#fff!important;font-size:11px!important}' +
    '.qp-banner-contact{color:#fff!important;font-size:12px!important;line-height:1.9!important}' +
    '.qp-banner-num{color:#fff!important;font-size:14px!important;font-weight:700!important}' +
    '.qp-banner-meta{color:#fff!important;font-size:12px!important;line-height:2!important}' +
    '.qp-banner-title{font-size:28px!important;letter-spacing:4px!important}' +
    '.qp-banner-logo{font-size:26px!important}' +
    /* Print: force color backgrounds and white text */
    '@media print{.inv-banner,.qp-banner{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
    '.inv-banner-contact,.inv-banner-tag,.inv-banner-num,.inv-banner-meta,' +
    '.qp-banner-contact,.qp-banner-tag,.qp-banner-num,.qp-banner-meta{color:#fff!important}}';
  document.head.appendChild(style);

  // Inject modal HTML
  var modal = document.createElement('div');
  modal.id = 'invLookupOverlay';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;align-items:flex-end;justify-content:center;';
  modal.innerHTML = [
    '<div style="background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:640px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -4px 32px rgba(0,0,0,0.18);overflow:hidden;">',
      '<div style="background:#1E70B8;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">',
        '<div>',
          '<div style="font-weight:800;font-size:16px;font-family:system-ui">&#x1F4E6; Live Inventory</div>',
          '<div id="invSubtitle" style="font-size:11px;opacity:0.8;margin-top:1px;font-family:system-ui">Loading...</div>',
        '</div>',
        '<button id="invCloseBtn" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;line-height:1;">&#x2715;</button>',
      '</div>',
      '<div style="padding:12px 16px;border-bottom:1px solid #eee;flex-shrink:0;background:#f9fbfe;">',
        '<input type="text" id="invSearch" placeholder="Search description, SKU, or Item No..." ',
          'style="width:100%;padding:10px 14px;border:1.5px solid #c8dff4;border-radius:8px;font-size:14px;color:#333;box-sizing:border-box;outline:none;margin-bottom:10px;font-family:system-ui"/>',
        '<div id="invChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">',
          '<div class="invChip active" data-cat="ALL">All</div>',
          '<div class="invChip" data-cat="DR">&#x1F6AA; Doors</div>',
          '<div class="invChip" data-cat="MW">Millwork</div>',
          '<div class="invChip" data-cat="LB">Lumber</div>',
          '<div class="invChip" data-cat="HW">Hardware</div>',
        '</div>',
        '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#666;cursor:pointer;margin:0;font-family:system-ui;">',
          '<input type="checkbox" id="invShowZero" style="width:15px;height:15px;accent-color:#1E70B8;cursor:pointer;"> Show out-of-stock items',
        '</label>',
      '</div>',
      '<div id="invList" style="overflow-y:auto;flex:1;padding:10px 12px;">',
        '<div style="text-align:center;padding:30px;color:#999;font-size:14px;font-family:system-ui;">Loading inventory...</div>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);

  // Inject trigger button next to Custom Item button
  var customBtn = document.querySelector('button[onclick="showCustomItem()"]');
  if (customBtn) {
    var invBtn = document.createElement('button');
    invBtn.className = 'btn';
    invBtn.textContent = '📦 From Inventory';
    invBtn.style.cssText = 'background:#1E70B8;color:#fff;white-space:nowrap;border:none;cursor:pointer;padding:8px 14px;border-radius:5px;font-size:12px;font-weight:600;';
    invBtn.addEventListener('click', openInv);
    customBtn.parentNode.insertBefore(invBtn, customBtn.nextSibling);
  }

  // ── Inventory state ──
  var _inv    = [];
  var _invCat = 'ALL';

  function openInv() {
    modal.style.display = 'flex';
    document.getElementById('invSearch').value = '';
    document.getElementById('invShowZero').checked = false;
    document.querySelectorAll('.invChip').forEach(function(c) { c.classList.remove('active'); });
    document.querySelector('.invChip[data-cat="ALL"]').classList.add('active');
    _invCat = 'ALL';
    if (_inv.length === 0) { loadInv(); } else { filterInv(); updateSubtitle(); }
    setTimeout(function() { document.getElementById('invSearch').focus(); }, 200);
  }

  function closeInv() { modal.style.display = 'none'; }

  async function loadInv() {
    var listEl = document.getElementById('invList');
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-family:system-ui;">Connecting to Firestore...</div>';
    try {
      // Wait up to 5 seconds for Firebase to initialize
      var attempts = 0;
      while ((typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) && attempts < 50) {
        await new Promise(function(r){ setTimeout(r, 100); });
        attempts++;
      }
      if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
        listEl.innerHTML = '<div style="color:#c62828;padding:20px;font-family:system-ui;">Firebase not connected. Please refresh the page and try again.</div>';
        return;
      }
      var db = firebase.firestore();
      var snap = await db.collection('norwood').limit(500).get();
      var valid = ['DR', 'MW', 'LB', 'HW'];
      _inv = snap.docs
        .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
        .filter(function(d) {
          if (d.id.indexOf('__') === 0) return false;
          if (d.type === 'salvage') return false;
          return valid.indexOf(d.category) > -1 || (d.sku && d.description && !d.salvageType);
        })
        .sort(function(a, b) {
          var qa = a.qoh || 0, qb = b.qoh || 0;
          if (qa > 0 && qb === 0) return -1;
          if (qa === 0 && qb > 0) return 1;
          return (a.description || '').localeCompare(b.description || '');
        });
      filterInv();
      updateSubtitle();
    } catch (e) {
      listEl.innerHTML = '<div style="color:#c62828;padding:20px;font-family:system-ui;">Error: ' + e.message + '</div>';
    }
  }

  function updateSubtitle() {
    var n = _inv.filter(function(i) { return (i.qoh || 0) > 0; }).length;
    document.getElementById('invSubtitle').textContent = n + ' in stock of ' + _inv.length + ' items';
  }

  function filterInv() {
    var q = document.getElementById('invSearch').value.toLowerCase();
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

      var photoEl;
      if (item.photoBase64) {
        photoEl = document.createElement('img');
        photoEl.src = 'data:image/jpeg;base64,' + item.photoBase64;
        photoEl.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid #dde;';
      } else {
        photoEl = document.createElement('div');
        photoEl.style.cssText = 'width:48px;height:48px;border-radius:6px;background:#f0f3f7;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;';
        photoEl.textContent = '📦';
      }

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';

      var skuLine = document.createElement('div');
      skuLine.style.cssText = 'font-size:11px;color:#1E70B8;font-family:Courier New,monospace;font-weight:700;margin-bottom:2px;';
      if (item.itemNo) {
        var noTag = document.createElement('span');
        noTag.style.cssText = 'background:#1E70B8;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;margin-right:4px;';
        noTag.textContent = '#' + item.itemNo;
        skuLine.appendChild(noTag);
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
  }

  function pickInv(sku) {
    var item = _inv.find(function(i) { return i.sku === sku; });
    if (!item) return;

    var pseudo = {
      id: 'inv_' + sku,
      sku: sku,
      item: item.description || sku,
      description: item.description || sku,
      category: item.category || 'Other',
      group: 'Inventory',
      size: '',
      cost: item.cost || 0,
      fixedRetail: item.price || null,
      onHand: item.qoh || 0,
      uom: 'EA',
      notes: item.notes || '',
      imageUrl: item.photoBase64 ? 'data:image/jpeg;base64,' + item.photoBase64 : '',
      isCustom: false
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
      t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);background:#2E7D32;color:#fff;padding:10px 22px;border-radius:24px;font-size:14px;font-weight:700;z-index:9999;transition:transform 0.3s;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.2);pointer-events:none;font-family:system-ui;';
      document.body.appendChild(t);
    }
    t.textContent = 'Added: ' + (item.description || sku);
    t.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(function() { t.style.transform = 'translateX(-50%) translateY(80px)'; }, 2500);
  }

  // ── Event wiring ──
  document.getElementById('invCloseBtn').addEventListener('click', closeInv);
  modal.addEventListener('click', function(e) { if (e.target === modal) closeInv(); });
  document.getElementById('invSearch').addEventListener('input', filterInv);
  document.getElementById('invShowZero').addEventListener('change', filterInv);
  document.getElementById('invChips').addEventListener('click', function(e) {
    var chip = e.target.closest('.invChip');
    if (!chip) return;
    document.querySelectorAll('.invChip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    _invCat = chip.dataset.cat;
    filterInv();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeInv();
  });

  window.openInvLookup = openInv;

}); // end DOMContentLoaded
