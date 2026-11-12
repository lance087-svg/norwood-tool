/* Read-only invoice aging. Payments and credits remain owned by nsPayState. */
(function(root) {
  'use strict';
  var DAY = 86400000;
  var zone = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'});
  function calendarDay(y, m, d) {
    var time = Date.UTC(Number(y), Number(m)-1, Number(d)), date = new Date(time);
    return date.getUTCFullYear() === Number(y) && date.getUTCMonth()+1 === Number(m) && date.getUTCDate() === Number(d) ? time / DAY : null;
  }
  function day(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
      var s = value.trim(), match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) return calendarDay(match[1], match[2], match[3]);
      match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) return calendarDay(match[3], match[1], match[2]);
      // Saved display dates have no time zone: keep their calendar date intact.
      if (!/[T:]\d{2}/.test(s)) {
        var parsed = Date.parse(s + ' 12:00:00 GMT');
        if (!Number.isFinite(parsed)) return null;
        var date = new Date(parsed);
        return calendarDay(date.getUTCFullYear(), date.getUTCMonth()+1, date.getUTCDate());
      }
    }
    var instant = new Date(value);
    if (!Number.isFinite(instant.getTime())) return null;
    var parts = {};
    zone.formatToParts(instant).forEach(function(p) { parts[p.type] = p.value; });
    return calendarDay(parts.year, parts.month, parts.day);
  }
  function state(q, now) {
    if (!q || q.removed || q.type !== 'invoice') return {flagged:false};
    // Match the existing invoice's two-decimal balance before adding subtotals.
    // Legacy totals can contain fractions of a cent after tax calculations.
    var balance = Number(root.nsPayState(q).balance.toFixed(2));
    if (!(balance > 0.01)) return {flagged:false, balance:0};
    var due = q.dueDate || (q.ops && q.ops.dueDate), start = day(due), basis = 'due';
    if (start == null) {
      basis = 'invoice';
      start = Number(q.createdAt) > 0 ? day(Number(q.createdAt)) : day(q.date);
      // Older records use a millisecond creation ID. Never age by last-edit timestamp.
      if (start == null && Number(q.id) >= 946684800000) start = day(Number(q.id));
    }
    var age = start == null ? null : day(now == null ? Date.now() : now) - start;
    return {flagged:age != null && age > 45, days:age, basis:basis, balance:balance, missingDate:start == null};
  }
  function badge(q) {
    var s = state(q);
    if (!s.flagged) return '';
    return '<span class="ns-aging-flag" title="' + (s.basis === 'due' ? 'Measured from payment due date' : 'No due date set; measured from original invoice date') + '">⚑ ' + s.days + (s.basis === 'due' ? ' DAYS PAST DUE' : ' DAYS UNPAID') + '</span>';
  }
  function records(local, cloud) {
    var byId = new Map();
    (cloud || []).forEach(function(q) { if (q && q.id != null) byId.set(String(q.id), q); });
    // Match the history screen: local copies (including unsynced payments and
    // deletion markers) own the visible state until the existing sync reconciles it.
    (local || []).forEach(function(q) { if (q && q.id != null) byId.set(String(q.id), q); });
    return Array.from(byId.values()).filter(function(q) { return !q.removed; });
  }
  function summary(list, now) {
    var result = {count:0, cents:0, missingDates:0};
    list.forEach(function(q) {
      var s = state(q, now);
      if (s.missingDate) result.missingDates++;
      if (s.flagged) { result.count++; result.cents += Math.round(s.balance * 100); }
    });
    return result;
  }
  function showOverdue() {
    var D = root.document;
    D.getElementById('history-search').value = '';
    D.getElementById('history-period').value = 'all';
    D.getElementById('history-filter').value = 'over45';
    root.__nsCloudShowN = 50;
    if (root.NWTabs) root.NWTabs._currentType = 'invoice';
    root.renderHistory();
    if (root.NWTabs) root.NWTabs.showType('invoice');
  }
  function decorate() {
    var D = root.document, all = new Map(records(root.getSavedQuotesRaw(), root.__nsCloudAll).map(function(q) { return [String(q.id), q]; }));
    D.querySelectorAll('#history-list .ns-aging-flag').forEach(function(el) { el.remove(); });
    D.querySelectorAll('#history-list .hcard').forEach(function(card) {
      var match = (card.getAttribute('onclick') || '').match(/loadQuote\((\d+)\)/);
      var title = card.querySelector('.hcard-num');
      if (match && title) title.insertAdjacentHTML('afterend', badge(all.get(match[1])));
    });
    D.querySelectorAll('#ns-cloud-older-section button').forEach(function(button) {
      var match = (button.getAttribute('onclick') || '').match(/nsOpenCloudRecord\((\d+),'invoice'\)/);
      var row = button.parentElement && button.parentElement.parentElement;
      var title = row && row.querySelector('div > div');
      if (match && title) title.insertAdjacentHTML('beforeend', badge(all.get(match[1])));
    });
  }
  function renderOverdue() {
    var D = root.document, search = D.getElementById('history-search').value.toLowerCase().trim();
    D.getElementById('history-period').value = 'all';
    var list = records(root.getSavedQuotesRaw(), root.__nsCloudAll).filter(function(q) {
      return state(q).flagged && (!search || root.nsQuoteMatchesSearch(q, search));
    }).sort(function(a,b) { return state(b).days-state(a).days; });
    var limit = root.__nsCloudShowN || 50, container = D.getElementById('history-list');
    var local = new Set(root.getSavedQuotesRaw().map(function(q) { return String(q.id); }));
    var visible = list.slice(0, limit);
    container.innerHTML = visible.map(function(q, i) {
      var s = state(q), c = q.customer || {};
      return '<div class="hcard"><div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><strong class="hcard-num">' + root.nsEsc(q.quoteNum || '') + '</strong><span class="hbadge hbadge-pending">UNPAID</span>' + badge(q) + '</div>' +
        '<div class="hcard-cust">' + root.nsEsc(c.name || c.co || '—') + '</div><div class="hcard-date">' + root.nsEsc(q.date || '') + '</div>' +
        '<button type="button" class="btn ns-aging-open" data-row="' + i + '" style="background:#1a1008;color:#fff;margin-top:8px">View Invoice</button></div>' +
        '<div class="hcard-owe">OWES ' + s.balance.toLocaleString('en-US',{style:'currency',currency:'USD'}) + '</div></div>';
    }).join('') || '<p style="padding:24px;text-align:center">No invoices match this view.</p>';
    container.querySelectorAll('.ns-aging-open').forEach(function(button) {
      button.onclick = function() {
        var q = visible[Number(button.dataset.row)];
        if (local.has(String(q.id))) root.loadAndPrint(q.id, 'invoice');
        else root.nsOpenCloudRecord(q.id, 'invoice');
      };
    });
    if (list.length > limit) {
      var more = D.createElement('button');more.className = 'btn';more.textContent = 'Show more (' + (list.length-limit) + ' left)';
      more.onclick = function() { root.__nsCloudShowN = limit+50; root.renderHistory(); };container.appendChild(more);
    }
    D.getElementById('history-count').textContent = list.length + ' unpaid invoice(s) over 45 days · ' + visible.length + ' showing';
    var empty = D.getElementById('nw-empty-filter');if (empty) empty.style.display = 'none';
    if (root.NWTabs) root.NWTabs.showType('invoice');
    if (root._db) root.nsLoadCloudQuotes();
  }
  function render() {
    var box = root.document.getElementById('ns-aging-summary');
    if (!box) return;
    var s = summary(records(root.getSavedQuotesRaw(), root.__nsCloudAll));
    var partial = root.__nsCloudError || !root.__nsCloudAll || !root.__nsCloudAllAt || Date.now()-root.__nsCloudAllAt > 10*60*1000;
    box.className = 'ns-aging-summary' + (s.count ? ' has-overdue' : '');
    box.innerHTML = '<div><strong>⚑ Unpaid over 45 days</strong><div class="ns-aging-total">' + s.count + ' invoice' + (s.count === 1 ? '' : 's') + ' · ' + (partial ? 'Known subtotal: ' : 'Subtotal: ') + '<b>' + (s.cents/100).toLocaleString('en-US', {style:'currency',currency:'USD'}) + '</b></div>' +
      '<small>All dates and customers · Remaining balances after payments and credits.<br>45 days after the due date, or the original invoice date when no due date is set.</small>' +
      (partial ? '<div class="ns-aging-note">' + (root.__nsCloudError ? 'Cloud unavailable — subtotal may be incomplete.' : root.__nsCloudLoading || !root.__nsCloudAll ? 'Checking older cloud invoices — subtotal may be incomplete.' : 'Cloud totals need refreshing — showing last known balances.') + '</div>' : '') +
      (s.missingDates ? '<div class="ns-aging-note">' + s.missingDates + ' unpaid invoice(s) need a valid date and are excluded.</div>' : '') +
      '</div><button type="button" class="btn" id="ns-aging-show">Show these invoices</button>';
    root.document.getElementById('ns-aging-show').onclick = showOverdue;
  }
  function mount() {
    var D = root.document, container = D.getElementById('history-list'), filter = D.getElementById('history-filter');
    if (!container || !filter || root.renderHistory.__nsAging) return;
    if (!D.getElementById('ns-aging-summary')) {
      var box = D.createElement('div');box.id = 'ns-aging-summary';box.setAttribute('aria-live','polite');container.before(box);
    }
    var option = D.createElement('option');option.value = 'over45';option.textContent = '⚑ Unpaid over 45 days';filter.appendChild(option);
    var original = root.renderHistory;
    root.renderHistory = function() {
      if (filter.value === 'over45') renderOverdue();
      else { original.apply(this,arguments);decorate(); }
      render();
    };
    root.renderHistory.__nsAging = true;
    if (root.NWTabs) {
      var showType = root.NWTabs.showType;
      root.NWTabs.showType = function(type) {
        if (type === 'quote' && filter.value === 'over45') { filter.value = 'quote';root.renderHistory(); }
        return showType.apply(this,arguments);
      };
    }
    root.renderHistory();
  }
  root.NWInvoiceAging = {day:day, state:state, badge:badge, records:records, summary:summary, render:render, showOverdue:showOverdue, mount:mount};
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount);else mount();
})(window);
