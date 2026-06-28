// ============================================================
//  NORWOOD PATCH v3.1 — loads after index.html
//  Contains:
//  1. Description deduplication fix (quotes + invoices)
//  2. Live Inventory Lookup panel
//  3. QOH deduction on invoice creation
//  4. Firestore sync for quotes/invoices (cross-device)
//  5. One-time localStorage → Firestore migration
//  6. Quote tab / Invoice tab split in nav
//  7. *** CENTS FIX — decimal prices throughout ***
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // ── FIREBASE SETUP ────────────────────────────────────────────────────────
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

  var _fbConfig = {
    apiKey: "AIzaSyAf50oc1i0ec1hsD_pPQNjj_tqcpIt0Sig",
    authDomain: "norwood-supply.firebaseapp.com",
    projectId: "norwood-supply",
    storageBucket: "norwood-supply.firebasestorage.app",
    messagingSenderId: "933963197210",
    appId: "1:933963197210:web:c362a02d3d1a8d010d9aa3"
  };

  function getDB() {
    if (window._db) return window._db;
    loadFirebaseSDK(function() {
      try {
        var app;
        try { app = firebase.app('norwood-inv'); }
        catch(e) { app = firebase.initializeApp(_fbConfig, 'norwood-inv'); }
        window._db = app.firestore();
        console.log('Norwood patch: _db ready');
      } catch(e) { console.warn('Norwood patch: db init error', e); }
    });
    return window._db;
  }

  // Pre-load Firebase
  loadFirebaseSDK(function() {
    if (window._db) return;
    try {
      var app;
      try { app = firebase.app('norwood-inv'); }
      catch(e) { app = firebase.initializeApp(_fbConfig, 'norwood-inv'); }
      window._db = app.firestore();
      console.log('Norwood patch: _db ready');
    } catch(e) { console.warn('Norwood patch: db init error', e); }
  });

  // ── FIRESTORE QUOTE/INVOICE SYNC ─────────────────────────────────────────
  var QUOTES_COL = 'ns_quotes';
  var _syncEnabled = false;

  function waitForDB(cb, tries) {
    tries = tries || 0;
    if (window._db) { _syncEnabled = true; cb(window._db); return; }
    if (tries > 20) { console.warn('[SYNC] DB never ready'); return; }
    setTimeout(function() { waitForDB(cb, tries + 1); }, 300);
  }

  function syncSaveQuote(q) {
    waitForDB(function(db) {
      var docId = String(q.id);
      db.collection(QUOTES_COL).doc(docId).set(q)
        .then(function() { console.log('[SYNC] Saved', q.quoteNum); })
        .catch(function(e) { console.error('[SYNC] Save error', e); });
    });
  }

  function syncDeleteQuote(id) {
    waitForDB(function(db) {
      db.collection(QUOTES_COL).doc(String(id)).delete()
        .catch(function(e) { console.error('[SYNC] Delete error', e); });
    });
  }

  function syncLoadAll(callback) {
    waitForDB(function(db) {
      db.collection(QUOTES_COL)
        .orderBy('timestamp', 'desc')
        .limit(500)
        .get()
        .then(function(snap) {
          var quotes = [];
          snap.forEach(function(doc) { quotes.push(doc.data()); });
          localStorage.setItem('ns_quotes', JSON.stringify(quotes));
          if (typeof callback === 'function') callback(quotes);
        })
        .catch(function(e) {
          console.error('[SYNC] Load error', e);
          if (typeof callback === 'function') callback(null);
        });
    });
  }

  // ── PATCH getSavedQuotes / saveQuotesToStorage ───────────────────────────
  var _patchedStorage = false;
  function patchStorageFunctions() {
    if (_patchedStorage) return;
    if (typeof window.getSavedQuotes !== 'function') {
      setTimeout(patchStorageFunctions, 400); return;
    }
    _patchedStorage = true;
    var _origSave = window.saveQuotesToStorage;
    window.saveQuotesToStorage = function(quotes) {
      _origSave.apply(this, arguments);
      if (_syncEnabled && Array.isArray(quotes)) {
        quotes.forEach(function(q) { if (q && q.id) syncSaveQuote(q); });
      }
    };
    console.log('[SYNC] Storage functions patched');
  }
  setTimeout(patchStorageFunctions, 500);

  // ── ONE-TIME MIGRATION UI ─────────────────────────────────────────────────
  function addMigrationUI() {
    var tries = 0;
    function tryAdd() {
      tries++;
      if (tries > 30) return;
      var adminPage = document.getElementById('page-admin');
      if (!adminPage) { setTimeout(tryAdd, 400); return; }
      if (document.getElementById('nw-migration-panel')) return;

      var panel = document.createElement('div');
      panel.id = 'nw-migration-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;border:1px solid #e0d5c0;overflow:hidden;margin-bottom:16px;';
      panel.innerHTML = [
        '<div style="background:#1a2438;color:#fff;padding:12px 16px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between">',
          '☁️ Cloud Sync — Quotes &amp; Invoices',
          '<small style="font-size:11px;color:#a89060;font-weight:400">Syncs across all devices in real time</small>',
        '</div>',
        '<div style="padding:16px;">',
          '<p style="font-size:13px;color:#4a3a20;margin-bottom:12px;line-height:1.6">',
            'Click <strong>Migrate to Cloud</strong> once to push all your existing quotes and invoices to Firestore. ',
            'After migration, every device (Lance\'s desktop, Garon\'s phone, Cleve\'s tablet) will see the same quotes and invoices in real time.',
          '</p>',
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">',
            '<button id="nw-migrate-btn" style="background:#1E70B8;color:#fff;padding:9px 22px;border-radius:5px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">',
              '☁️ Migrate to Cloud (one-time)',
            '</button>',
            '<button id="nw-sync-load-btn" style="background:#2d6a30;color:#fff;padding:9px 22px;border-radius:5px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">',
              '🔄 Load from Cloud',
            '</button>',
            '<span id="nw-sync-status" style="font-size:12px;color:#8B6914;"></span>',
          '</div>',
        '</div>'
      ].join('');

      adminPage.insertBefore(panel, adminPage.firstChild);

      document.getElementById('nw-migrate-btn').addEventListener('click', function() {
        var btn = this;
        var status = document.getElementById('nw-sync-status');
        var local = JSON.parse(localStorage.getItem('ns_quotes') || '[]');
        if (!local.length) { status.textContent = '⚠️ No local quotes found to migrate.'; return; }
        if (!confirm('Push ' + local.length + ' quotes/invoices to Firestore? This is safe — nothing is deleted.')) return;
        btn.disabled = true;
        btn.textContent = 'Migrating…';
        status.textContent = '';
        var done = 0;
        waitForDB(function(db) {
          var batch = db.batch();
          local.forEach(function(q) {
            if (!q || !q.id) return;
            batch.set(db.collection(QUOTES_COL).doc(String(q.id)), q);
            done++;
          });
          batch.commit()
            .then(function() {
              status.textContent = '✅ ' + done + ' records migrated to cloud!';
              btn.textContent = '✅ Migration Complete';
              if (typeof showToast === 'function') showToast('✅ ' + done + ' quotes synced to cloud!', '#2d6a30');
            })
            .catch(function(e) {
              status.textContent = '❌ Error: ' + e.message;
              btn.disabled = false;
              btn.textContent = '☁️ Migrate to Cloud (one-time)';
            });
        });
      });

      document.getElementById('nw-sync-load-btn').addEventListener('click', function() {
        var btn = this;
        var status = document.getElementById('nw-sync-status');
        btn.disabled = true;
        btn.textContent = 'Loading…';
        syncLoadAll(function(quotes) {
          if (!quotes) {
            status.textContent = '❌ Could not reach cloud. Check connection.';
            btn.disabled = false;
            btn.textContent = '🔄 Load from Cloud';
            return;
          }
          status.textContent = '✅ Loaded ' + quotes.length + ' records from cloud.';
          btn.disabled = false;
          btn.textContent = '🔄 Load from Cloud';
          if (typeof renderHistory === 'function') renderHistory();
          if (typeof showToast === 'function') showToast('✅ Loaded ' + quotes.length + ' quotes from cloud', '#2d6a30');
        });
      });
    }
    tryAdd();
  }
  addMigrationUI();

  // ── AUTO-LOAD FROM CLOUD ON STARTUP ──────────────────────────────────────
  waitForDB(function(db) {
    _syncEnabled = true;
    setTimeout(function() {
      syncLoadAll(function(quotes) {
        if (!quotes || !quotes.length) return;
        if (typeof renderHistory === 'function') {
          var histPage = document.getElementById('page-history');
          if (histPage && histPage.classList.contains('active')) renderHistory();
        }
        console.log('[SYNC] Auto-loaded', quotes.length, 'quotes from cloud');
      });
    }, 1500);
  });

  // ── QUOTE / INVOICE TAB SPLIT ─────────────────────────────────────────────
  function splitQuoteInvoiceTabs() {
    var histTab = document.getElementById('tab-history');
    if (!histTab) { setTimeout(splitQuoteInvoiceTabs, 400); return; }
    if (document.getElementById('tab-invoices')) return;

    histTab.textContent = '📋 Quotes';
    histTab.title = 'Saved Quotes';
    histTab.onclick = function() {
      if (window.showPage) window.showPage('history', this);
      setTimeout(function() { NWTabs.showType('quote'); }, 100);
    };

    var invTab = document.createElement('button');
    invTab.className = 'tab';
    invTab.id = 'tab-invoices';
    invTab.textContent = '🧾 Invoices';
    invTab.title = 'Saved Invoices';
    invTab.onclick = function() {
      if (window.showPage) window.showPage('history', this);
      setTimeout(function() { NWTabs.showType('invoice'); }, 100);
    };
    histTab.insertAdjacentElement('afterend', invTab);
    console.log('[TABS] Quote/Invoice tabs split');
  }

  window.NWTabs = {
    _currentType: null,
    showType: function(type) {
      this._currentType = type;
      var histPage = document.getElementById('page-history');
      if (!histPage) return;
      var badge = document.getElementById('nw-type-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'nw-type-badge';
        badge.style.cssText = 'margin-bottom:14px;font-size:13px;font-weight:700;color:#1a2438;display:flex;align-items:center;gap:10px;';
        histPage.insertBefore(badge, histPage.firstChild);
      }
      var isInvoice = type === 'invoice';
      badge.innerHTML = isInvoice
        ? '<span style="background:#1565C0;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;">🧾 INVOICES</span> Showing invoices only'
        : '<span style="background:#2E7D32;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;">📋 QUOTES</span> Showing quotes only';
      this._filterCards(type);
    },
    _filterCards: function(type) {
      var tries = 0;
      function tryFilter() {
        tries++;
        if (tries > 15) return;
        var cards = document.querySelectorAll('.hcard');
        if (!cards.length) { setTimeout(tryFilter, 200); return; }
        cards.forEach(function(card) {
          var hasQuoteBadge   = card.querySelector('.hbadge-quote');
          var hasInvoiceBadge = card.querySelector('.hbadge-invoice') ||
                                card.querySelector('.hbadge-paid')   ||
                                card.querySelector('.hbadge-pending');
          if (type === 'invoice') {
            card.style.display = hasInvoiceBadge ? '' : 'none';
          } else {
            card.style.display = hasQuoteBadge ? '' : 'none';
          }
        });
        var visible = Array.from(cards).filter(function(c) { return c.style.display !== 'none'; });
        var emptyEl = document.getElementById('nw-empty-filter');
        if (!visible.length) {
          if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.id = 'nw-empty-filter';
            emptyEl.style.cssText = 'text-align:center;padding:40px;color:#a89060;font-size:14px;';
            var histPage = document.getElementById('page-history');
            if (histPage) histPage.appendChild(emptyEl);
          }
          emptyEl.textContent = type === 'invoice'
            ? 'No invoices found. Convert a quote to invoice from the Quote Builder.'
            : 'No quotes found. Build a new quote using the Quote Builder tab.';
          emptyEl.style.display = '';
        } else if (emptyEl) {
          emptyEl.style.display = 'none';
        }
      }
      tryFilter();
    },
    reapply: function() {
      if (this._currentType) this._filterCards(this._currentType);
    }
  };

  function patchRenderHistory() {
    if (typeof window.renderHistory !== 'function') { setTimeout(patchRenderHistory, 400); return; }
    var _origRender = window.renderHistory;
    window.renderHistory = function() {
      _origRender.apply(this, arguments);
      setTimeout(function() { NWTabs.reapply(); }, 100);
    };
  }
  patchRenderHistory();
  splitQuoteInvoiceTabs();

  // ── FIX 1: MONKEY-PATCH showQuote / showInvoice ───────────────────────────
  var _origShowQuote   = window.showQuote;
  var _origShowInvoice = window.showInvoice;

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

  if (typeof _origShowInvoice === 'function') {
    var _deductedKeys = {};
    window.showInvoice = function(existingInvNum) {
      _origShowInvoice.apply(this, arguments);
      if (existingInvNum) return;
      var renderKey = Date.now();
      setTimeout(function() {
        if (_deductedKeys[renderKey]) return;
        _deductedKeys[renderKey] = true;
        var liveLines = (typeof lines !== 'undefined' ? lines : [])
          .filter(function(l) {
            return l.isLive === true && l.sku && String(l.sku).trim().length > 0 && l.sku !== 'CUSTOM';
          });
        console.log('[PATCH-DEDUCT] live lines:', liveLines.length,
          liveLines.map(function(l) { return l.sku + ' x' + l.qty; }));
        if (!liveLines.length) { runDedup(); return; }
        var app;
        try { app = firebase.app('norwood-inv'); }
        catch(e) {
          try { app = firebase.initializeApp(_fbConfig, 'norwood-inv'); }
          catch(e2) { console.error('[PATCH-DEDUCT] Firebase unavailable:', e2.message); runDedup(); return; }
        }
        var db = app.firestore();
        var deducted = 0;
        liveLines.forEach(function(l) {
          var sku = String(l.sku).trim();
          var qty = Math.max(1, parseInt(l.qty) || 1);
          db.collection('norwood').doc(sku).get().then(function(doc) {
            if (!doc.exists) { console.warn('[PATCH-DEDUCT] SKU not in Firestore:', sku); return; }
            var curQoh = parseInt(doc.data().qoh) || 0;
            var newQoh = Math.max(0, curQoh - qty);
            return doc.ref.update({
              qoh: newQoh,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function() {
              deducted++;
              console.log('[PATCH-DEDUCT] ✅', sku, curQoh, '→', newQoh);
              if (deducted === liveLines.length) {
                if (typeof showToast === 'function') showToast('✅ Inventory updated: ' + deducted + ' item(s) deducted', '#2d6a30');
              }
            });
          }).catch(function(e) { console.error('[PATCH-DEDUCT] ❌', sku, ':', e.message); });
        });
        runDedup();
      }, 500);

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
    '.invQohBadge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}' +
    '.invQohIn{background:#e8f5e9;color:#2E7D32;border:1px solid #a5d6a7}' +
    '.invQohLow{background:#fff8e1;color:#F57F17;border:1px solid #ffe082}' +
    '.invQohOut{background:#fce4ec;color:#c62828;border:1px solid #ef9a9a}';
  document.head.appendChild(style);

  var modal = document.createElement('div');
  modal.id = 'invModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;align-items:flex-start;justify-content:center;padding-top:60px;';
  modal.innerHTML = [
    '<div style="background:#fff;border-radius:10px;width:100%;max-width:560px;margin:0 16px;box-shadow:0 8px 32px rgba(0,0,0,0.2);overflow:hidden;max-height:80vh;display:flex;flex-direction:column;">',
      '<div style="background:#1a2438;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">',
        '<div><div style="font-size:15px;font-weight:700;">📦 Add from Live Inventory</div>',
        '<div id="invSubtitle" style="font-size:11px;color:#a89060;margin-top:1px;"></div></div>',
        '<button onclick="document.getElementById(\'invModal\').style.display=\'none\'" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:14px;">✕</button>',
      '</div>',
      '<div style="padding:12px 14px;border-bottom:1px solid #f0e8d8;flex-shrink:0;">',
        '<input id="invSearch" type="text" placeholder="Search by description or SKU…" oninput="filterInv()" style="width:100%;padding:8px 12px;border-radius:5px;border:1.5px solid #d5c8a8;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">',
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;" id="invChips">',
          '<button class="invChip active" data-cat="ALL" onclick="setInvCat(\'ALL\',this)">All</button>',
          '<button class="invChip" data-cat="DR" onclick="setInvCat(\'DR\',this)">Doors</button>',
          '<button class="invChip" data-cat="MW" onclick="setInvCat(\'MW\',this)">Millwork</button>',
          '<button class="invChip" data-cat="LB" onclick="setInvCat(\'LB\',this)">Lumber</button>',
          '<button class="invChip" data-cat="HW" onclick="setInvCat(\'HW\',this)">Hardware</button>',
          '<button class="invChip" data-cat="SAL" onclick="setInvCat(\'SAL\',this)">🏷️ Salvage</button>',
        '</div>',
      '</div>',
      '<div id="invList" style="overflow-y:auto;padding:12px 14px;flex:1;"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);

  function addInvButton() {
    var addRow = document.querySelector('.add-row');
    if (!addRow) { setTimeout(addInvButton, 500); return; }
    if (document.getElementById('invOpenBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'invOpenBtn';
    btn.className = 'btn';
    btn.style.cssText = 'background:#1a2438;color:#f5e8c8;white-space:nowrap;';
    btn.textContent = '📦 Add from Inventory';
    btn.onclick = openInv;
    addRow.appendChild(btn);
  }
  addInvButton();

  var _inv = [];
  var _invCat = 'ALL';

  window.setInvCat = function(cat, el) {
    _invCat = cat;
    document.querySelectorAll('.invChip').forEach(function(c) {
      c.classList.toggle('active', c.dataset.cat === cat);
    });
    filterInv();
  };

  window.filterInv = function() {
    var q = (document.getElementById('invSearch').value || '').toLowerCase();
    var listEl = document.getElementById('invList');
    if (!listEl) return;
    var filtered = _inv.filter(function(item) {
      if (_invCat === 'SAL') return item.isSalvage || item.type === 'salvage';
      if (_invCat !== 'ALL' && item.category !== _invCat) return false;
      if (!q) return true;
      return (item.description || '').toLowerCase().indexOf(q) > -1 ||
             (item.sku || '').toLowerCase().indexOf(q) > -1 ||
             (String(item.itemNo || '')).indexOf(q) > -1;
    });
    if (!filtered.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#a89060;font-family:system-ui;font-size:13px;">No items found</div>';
      return;
    }
    listEl.innerHTML = '';
    filtered.slice(0, 100).forEach(function(item) {
      var qoh = item.qoh || 0;
      var qc, ql;
      if (qoh > 5)      { qc = 'invQohIn';  ql = qoh + ' in stock'; }
      else if (qoh > 0) { qc = 'invQohLow'; ql = qoh + ' left'; }
      else              { qc = 'invQohOut'; ql = 'Out of stock'; }
      var row = document.createElement('div');
      row.className = 'invResultItem';
      row.dataset.sku = item.sku;
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
      priceSpan.textContent = '$' + parseFloat(item.price || 0).toFixed(2);
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

  async function loadInv() {
    var listEl = document.getElementById('invList');
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-family:system-ui;">Connecting to inventory...</div>';
    await new Promise(function(resolve) { loadFirebaseSDK(resolve); });
    try {
      if (typeof firebase === 'undefined') {
        listEl.innerHTML = '<div style="color:#c62828;padding:20px;font-family:system-ui;">Could not load Firebase. Check your internet connection.</div>';
        return;
      }
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
      isLive: true
    };
    var qty    = parseInt(document.getElementById('qty-in').value) || 1;
    var gm     = (typeof manualGM !== 'undefined' && manualGM !== null) ? manualGM
                 : (typeof getCategoryGM === 'function' ? getCategoryGM(pseudo, qty) : 0.40);
    var retail = typeof calcRetail === 'function'
                 ? calcRetail(pseudo.cost, gm, pseudo.fixedRetail)
                 : (pseudo.fixedRetail || Math.round(pseudo.cost / (1 - gm)));
    lines.push(Object.assign({}, pseudo, { qty: qty, retail: retail, gm: gm, lineId: Date.now() }));
    if (typeof recalcLines   === 'function') recalcLines();
    if (typeof renderLines   === 'function') renderLines();
    if (typeof renderSummary === 'function') renderSummary();
    document.getElementById('qty-in').value = 1;
    closeInv();
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

  function closeInv() { modal.style.display = 'none'; }

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeInv();
  });

  // ── FIX 7: CENTS / DECIMAL PRICE FIX ─────────────────────────────────────
  // Enables $9.59-style pricing throughout the quote and invoice builder.
  // Runs after the tool finishes initializing so it catches all rendered inputs.

  function nwCentsFix() {

    // ── 7a. Allow decimals on all price-related inputs ──
    function fixPriceInputs() {
      var hits = 0;
      document.querySelectorAll('input[type="number"]').forEach(function(el) {
        var name = (el.name || el.id || el.className || '').toLowerCase();
        // Target price, unit, retail, cost fields — skip pure qty/count fields
        if (/price|retail|cost|unit|rate|amount/.test(name) ||
            el.closest('td') !== null) {          // catch table row inputs too
          el.setAttribute('step', '0.01');
          el.setAttribute('inputmode', 'decimal');
          // Remove any integer-only constraint
          if ((el.getAttribute('pattern') || '') === '\\d*') {
            el.removeAttribute('pattern');
          }
          hits++;
        }
      });
      return hits;
    }

    // ── 7b. Safe float parser — strips $, commas, spaces ──
    function toFloat(v) {
      if (v === null || v === undefined) return 0;
      var n = parseFloat(String(v).replace(/[$,\s]/g, ''));
      return isNaN(n) ? 0 : n;
    }

    // ── 7c. Format a number as "9.59" (no $ — callers add it) ──
    function fmt(n) { return toFloat(n).toFixed(2); }

    // ── 7d. Recalculate one table row: qty × price → total cell ──
    function recalcRow(row) {
      var qtyEl   = row.querySelector('[name*="qty"],[id*="qty"],[class*="qty"]');
      var priceEl = row.querySelector('[name*="price"],[id*="price"],[class*="price"],[name*="retail"],[id*="retail"]');
      var totalEl = row.querySelector('[name*="total"],[id*="total"],[class*="total"],[class*="ext"],[class*="line"]');
      if (!qtyEl || !priceEl || !totalEl) return;
      var total = (parseFloat(qtyEl.value) || 0) * toFloat(priceEl.value);
      if (totalEl.tagName === 'INPUT') {
        totalEl.value = fmt(total);
      } else {
        totalEl.textContent = '$' + fmt(total);
      }
    }

    // ── 7e. Re-format any total/subtotal display elements ──
    function fixTotals() {
      var sel = [
        '[id*="subtotal"],[id*="Subtotal"],[id*="sub-total"]',
        '[id*="grandtotal"],[id*="grandTotal"],[id*="grand-total"]',
        '[id*="invoiceTotal"],[id*="invoice-total"]',
        '[class*="subtotal"],[class*="grand-total"],[class*="invoice-total"]'
      ].join(',');
      document.querySelectorAll(sel).forEach(function(el) {
        var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
        var num = toFloat(raw);
        if (num === 0) return;
        var formatted = '$' + fmt(num);
        // Only rewrite if it looks like a bare money value
        if (/^\$?[\d,]+(\.\d{0,4})?$/.test(raw.trim())) {
          if (el.tagName === 'INPUT') { el.value = fmt(num); }
          else { el.textContent = formatted; }
        }
      });
    }

    // ── 7f. Wrap known global calc functions so totals stay formatted ──
    var wrapTargets = [
      'calculateTotal','calcTotal','updateTotal','recalc','recalculate',
      'updateLineTotal','calcLineTotal','computeTotal','refreshTotals','updateInvoice'
    ];
    wrapTargets.forEach(function(fn) {
      if (typeof window[fn] === 'function') {
        var orig = window[fn];
        window[fn] = function() {
          var r = orig.apply(this, arguments);
          setTimeout(fixTotals, 30);
          return r;
        };
        console.log('[cents-fix] Wrapped', fn);
      }
    });

    // ── 7g. Recalc on input (qty only) and on blur (price fields) ──
    // IMPORTANT: price fields must only reformat on BLUR (when user leaves
    // the field), NOT on every keystroke — otherwise typing "3.98" gets
    // interrupted at "3.9" and rounded before the last digit can be entered.

    document.addEventListener('input', function(e) {
      var el = e.target;
      if (el.tagName !== 'INPUT') return;
      var name = (el.name || el.id || el.className || '').toLowerCase();
      // Recalc rows when QTY changes — qty fields are integers so no rounding issue
      if (/qty|quantity/.test(name)) {
        var row = el.closest('tr');
        if (row) recalcRow(row);
        setTimeout(fixTotals, 40);
      }
      // For price fields: update line total display in real time but DO NOT
      // reformat the input value itself — let the user finish typing
      if (/price|retail|cost|unit|rate|amount/.test(name)) {
        var row = el.closest('tr');
        if (row) {
          // Recalc the total cell only — don't touch the price input value
          var qtyEl = row.querySelector('[name*="qty"],[id*="qty"],[class*="qty"]');
          var totalEl = row.querySelector('[name*="total"],[id*="total"],[class*="total"],[class*="ext"],[class*="line"]');
          if (qtyEl && totalEl) {
            var qty = parseFloat(qtyEl.value) || 0;
            var price = toFloat(el.value);
            var total = qty * price;
            if (totalEl.tagName === 'INPUT') { totalEl.value = fmt(total); }
            else { totalEl.textContent = '$' + fmt(total); }
          }
        }
      }
    }, true);

    // On blur: NOW it's safe to clean up the price field format
    document.addEventListener('blur', function(e) {
      var el = e.target;
      if (el.tagName !== 'INPUT') return;
      var name = (el.name || el.id || el.className || '').toLowerCase();
      if (/price|retail|cost|unit|rate|amount/.test(name)) {
        var val = toFloat(el.value);
        if (val > 0) el.value = fmt(val); // format to 2dp only after user leaves field
        var row = el.closest('tr');
        if (row) recalcRow(row);
        setTimeout(fixTotals, 40);
      }
    }, true);

    // ── 7h. Watch for new rows added dynamically ──
    new MutationObserver(function(muts) {
      var added = false;
      muts.forEach(function(m) { if (m.addedNodes.length) added = true; });
      if (added) { fixPriceInputs(); setTimeout(fixTotals, 60); }
    }).observe(document.body, { childList: true, subtree: true });

    // ── 7i. Initial pass ──
    var n = fixPriceInputs();
    fixTotals();
    console.log('[cents-fix] Ready — ' + n + ' price input(s) unlocked for decimals.');
  }

  // Run after a short delay so index.html has fully rendered its inputs
  setTimeout(nwCentsFix, 800);

}); // end DOMContentLoaded
