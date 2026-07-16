// ============================================================
//  NORWOOD SYNC GUARD v1.0 — loads AFTER norwood-patch.js
//  Problem this solves: a quote/invoice can be built and printed
//  on a phone with weak signal before it ever reaches Firestore.
//  It's saved to that phone's local storage, but no one else
//  (Lance, Garon, another device) can see it — and if the phone's
//  browser data ever gets cleared, it's gone for good.
//
//  What this adds, without touching norwood-patch.js:
//  1. Tags every saved quote/invoice as pending / synced / error
//  2. Retries anything not yet synced every 15s, forever
//  3. A small live badge (top-right) showing sync status
//  4. A confirmation prompt before Print (or Back / New Quote)
//     if the record on screen hasn't been confirmed in the
//     cloud yet — "wait a few seconds" vs "leave anyway"
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  function getQuotes() {
    try { return JSON.parse(localStorage.getItem('ns_quotes') || '[]'); }
    catch (e) { return []; }
  }

  function setQuotesSilently(quotes) {
    localStorage.setItem('ns_quotes', JSON.stringify(quotes));
  }

  function markStatus(id, status) {
    var quotes = getQuotes();
    var idx = quotes.findIndex(function (q) { return q && String(q.id) === String(id); });
    if (idx === -1) return;
    quotes[idx]._syncStatus = status;
    if (status === 'synced') quotes[idx]._syncedAt = Date.now();
    setQuotesSilently(quotes);
    updateBadge();
  }

  function waitForDB(cb, tries) {
    tries = tries || 0;
    if (window._db) { cb(window._db); return; }
    if (tries > 40) return;
    setTimeout(function () { waitForDB(cb, tries + 1); }, 300);
  }

  function pushOne(record) {
    if (!record || !record.id) return;
    waitForDB(function (db) {
      db.collection('ns_quotes').doc(String(record.id)).set(record)
        .then(function () { markStatus(record.id, 'synced'); })
        .catch(function () { markStatus(record.id, 'error'); });
    });
  }

  var lastSavedId = null;
  function patchSave() {
    if (typeof window.saveCurrentQuote !== 'function') { setTimeout(patchSave, 400); return; }
    var _origSaveCurrentQuote = window.saveCurrentQuote;
    window.saveCurrentQuote = function (type) {
      var id = _origSaveCurrentQuote.apply(this, arguments);
      lastSavedId = id;
      markStatus(id, 'pending');
      var rec = getQuotes().find(function (q) { return q && String(q.id) === String(id); });
      pushOne(rec);
      return id;
    };
  }
  patchSave();

  function retrySweep() {
    getQuotes()
      .filter(function (q) { return q && q.id && q._syncStatus && q._syncStatus !== 'synced'; })
      .forEach(pushOne);
    updateBadge();
  }
  setInterval(retrySweep, 15000);

  var badge;
  function ensureBadge() {
    if (badge) return badge;
    badge = document.createElement('div');
    badge.id = 'ns-sync-badge';
    badge.title = 'Tap to retry syncing now';
    badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99998;' +
      'padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;' +
      'font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;' +
      'transition:opacity .4s;';
    badge.addEventListener('click', retrySweep);
    document.body.appendChild(badge);
    return badge;
  }
  function updateBadge() {
    var quotes = getQuotes();
    var pending = quotes.filter(function (q) { return q && q._syncStatus && q._syncStatus !== 'synced'; }).length;
    var b = ensureBadge();
    b.style.opacity = '1';
    if (pending === 0) {
      b.style.background = '#2d6a30'; b.style.color = '#fff';
      b.textContent = '\u2601\ufe0f All quotes synced';
      setTimeout(function () { if (b) b.style.opacity = '0'; }, 3000);
    } else {
      b.style.background = '#c0392b'; b.style.color = '#fff';
      b.textContent = '\u26a0\ufe0f ' + pending + ' not yet synced';
    }
  }
  setTimeout(updateBadge, 1000);

  function currentRecordUnsynced() {
    if (!lastSavedId) return false;
    var rec = getQuotes().find(function (q) { return q && String(q.id) === String(lastSavedId); });
    return !!(rec && rec._syncStatus && rec._syncStatus !== 'synced');
  }

  function guardedProceed(proceedFn, context) {
    if (!currentRecordUnsynced()) { proceedFn(); return; }
    var ok = window.confirm(
      '\u26a0\ufe0f This quote/invoice hasn\u2019t finished saving to the cloud yet ' +
      '(weak signal?). If you ' + context + ' now, it may only exist on this device.\n\n' +
      'Tap Cancel to wait a few seconds, or OK to continue anyway.'
    );
    if (ok) proceedFn();
  }

  var _origPrint = window.print.bind(window);
  window.print = function () {
    guardedProceed(_origPrint, 'print');
  };

  ['backToBuilder', 'newQuote'].forEach(function (fnName) {
    var tries = 0;
    (function wrap() {
      if (typeof window[fnName] !== 'function') {
        if (++tries > 40) return;
        setTimeout(wrap, 300);
        return;
      }
      var _orig = window[fnName];
      window[fnName] = function () {
        var args = arguments, self = this;
        guardedProceed(function () { _orig.apply(self, args); }, 'leave');
      };
    })();
  });

  console.log('[SYNC GUARD] active');
});
