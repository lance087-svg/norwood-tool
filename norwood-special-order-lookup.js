/* Search vendor costs already recorded in the builder and purchasing history. */
(function () {
  'use strict';

  const vendorNames = {dyke: 'Dyke Industries', tlc: 'TLC Millwork', woodgrain:'Woodgrain', weyerhaeuser:'Weyerhaeuser', bluelinx:'BlueLinx', logan:'Logan Lumber', millworksales:'Millwork Sales', uslumber:'U.S. Lumber', unknown: 'Vendor not recorded'};
  const normalize = value => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const searchText = value => normalize(value).replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bpre hung\b/g, 'prehung');

  const prefix = 'ns_vendor_history_';
  const archive = new Map();
  function cutoff(now = Date.now()) {
    const date = new Date(now);
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    const day = new Date(now).getUTCDate();
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, date.getUTCDate()));
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }
  function collection() {
    return typeof nsSyncDb === 'function' && nsSyncDb()?.collection('ns_vendor_quote_history');
  }
  function syncRecord(id, json) {
    const db = collection();
    if (db) db.doc(id).set(JSON.parse(json)).then(() => {
      if (localStorage.getItem(prefix + id) === json) {
        archive.set(id, JSON.parse(json));
        localStorage.removeItem(prefix + id);
      }
    }).catch(error => console.warn('Vendor quote sync pending', error));
  }
  window.nsArchiveVendorQuote = function(id, vendor, rows, reference, recordedAt) {
    const record = {recordedAt, vendor:vendorNames[vendor] ? vendor : 'unknown', reference,
      items: rows.map(row => ({sku:row.code, item:row.desc || row.code, cost:row.cost, uom:row.uom}))};
    const json = JSON.stringify(record);
    localStorage.setItem(prefix + id, json);
    archive.set(id, record);
    syncRecord(id, json);
  };
  const processing = new Set();
  async function recoverAttachments() {
    let unavailable = 0;
    for (const quote of getSavedQuotes()) {
      const date = new Date(quote.date || quote.createdAt);
      if (!Number.isFinite(+date) || +date < cutoff() || +date > Date.now()) continue;
      for (const file of quote.vendorQuotes || []) {
        const id = 'pdf-' + file.path;
        if (!file.path || archive.has(id) || processing.has(id)) continue;
        processing.add(id);
        try {
          const stored = await nsAccessVendorQuote('readonly', store => store.get(file.path));
          if (!stored?.pdf) { unavailable++; continue; }
          const parsed = await NQI.readHistoricalPDF(stored.pdf);
          const rows = parsed.items.filter(row => row.unit > 0).map(row => ({
            code:row.code || '', desc:row.desc || '', cost:row.unit, uom:row.uom || 'EA'
          }));
          if (!rows.length) { unavailable++; continue; }
          nsArchiveVendorQuote(id, parsed.vendor, rows, [quote.quoteNum, stored.name].filter(Boolean).join(' · '), date.toISOString());
        } catch (error) { unavailable++; }
        finally { processing.delete(id); }
      }
    }
    render();
    if (unavailable) results.append(' ' + unavailable + ' attached PDF(s) could not be read on this device.');
  }
  async function loadArchive() {
    const threshold = cutoff();
    const db = collection();
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
      const json = localStorage.getItem(key);
      const record = JSON.parse(json);
      if (Date.parse(record.recordedAt) < threshold) localStorage.removeItem(key);
      else {
        archive.set(key.slice(prefix.length), record);
        syncRecord(key.slice(prefix.length), json);
      }
    }
    render();
    if (!db) return;
    try {
      const snapshot = await db.get();
      snapshot.forEach(doc => {
        if (Date.parse(doc.data().recordedAt) < threshold) {
          archive.delete(doc.id);
          doc.ref.delete().catch(console.warn);
        } else if (!localStorage.getItem(prefix + doc.id)) archive.set(doc.id, doc.data());
      });
      render();
    } catch (error) {
      results.append(' Shared vendor history could not be loaded.');
    }
  }

  function recentVendorDoorCosts(quotes, orders, now = Date.now()) {
    const recent = new Map();
    function add(line, vendor, cost, date, reference, kind) {
      const timestamp = Date.parse(date);
      const description = [line.item, line.size, normalize(line.description) !== normalize(line.item) && line.description]
        .filter(Boolean).join(' · ');
      const specs = Object.entries(line.doorSpec || {}).filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b));
      const searchable = searchText([vendorNames[vendor], reference, description, line.sku, line.doorStyle, ...specs.map(([, value]) => value)].join(' '));
      if (!vendorNames[vendor] || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(timestamp) || timestamp < cutoff(now) || timestamp > now) return;

      // Only compare identical descriptions, dimensions, and configuration fields.
      const key = JSON.stringify([normalize(line.description || line.item), normalize(line.size), specs.map(([name, value]) => [name, normalize(value)])]);
      if (!recent.has(key)) recent.set(key, new Map());
      const offers = recent.get(key);
      const offerKey = JSON.stringify([vendor, timestamp, cost, reference]);
      offers.set(offerKey, {line, vendor, cost, timestamp, reference, kind, description, searchable});
    }

    for (const record of archive.values()) {
      for (const line of record.items) add(line, record.vendor, Number(line.cost), record.recordedAt, record.reference, 'Vendor quote');
    }
    for (const quote of quotes) {
      for (const line of quote.lines || []) {
        const source = line.vendorQuoteSource;
        if (source && vendorNames[source.vendor]) {
          add(line, source.vendor, Number(source.unitCost ?? line.cost), source.recordedAt || quote.date, quote.quoteNum, 'Quote imported');
        } else if (!source && !line.pricePending && !line.vendorCostReference && (line.isCustom || line.sku === 'SO-DOOR')) {
          add(line, 'unknown', Number(line.cost), quote.date || new Date(quote.createdAt).toJSON(), quote.quoteNum, 'Saved special-order cost · vendor source unconfirmed');

        }
      }
    }
    for (const order of orders) {
      const vendor = /\bdyke\b/i.test(order.vendorName) ? 'dyke' :
        nsIsTLC(order.vendorName, order.vendorEmail) ? 'tlc' : 'unknown';
      (order.items || []).forEach((line, index) => {
        const acknowledged = order.ack?.items?.[index];
        if (acknowledged && Number(acknowledged.qty) > 0 && Number(acknowledged.cost) > 0) {
          add(line, vendor, Number(acknowledged.cost), order.ack.date || order.ack.savedAt,
            order.ack.ref || order.poNum, 'Acknowledgment');
        } else if (line.isImported || ['Sent','Acknowledged','Partial','Received'].includes(order.status)) {
          add(line, vendor, Number(line.unitCost), order.date || order.savedAt, order.poNum, line.isImported ? 'Imported PO cost' : 'Purchase order cost');
        }
      });
    }
    return Array.from(recent.values(), offers => Array.from(offers.values()).sort((a, b) => Number(a.vendor === 'unknown') - Number(b.vendor === 'unknown') || a.cost - b.cost))
      .sort((a, b) => b[0].timestamp - a[0].timestamp);
  }

  const door = document.getElementById('sodoor-modal');
  if (!door) return;
  const embedded = door.querySelector('#sod-lookup');
  if (embedded) {
    embedded.remove();
    door.insertAdjacentHTML('beforebegin', `<div id="sod-lookup" class="modal-bg hidden" onclick="if(event.target===this)this.classList.add('hidden')">
  <div class="modal" role="dialog" aria-labelledby="sod-lookup-title">
    <h3 id="sod-lookup-title">Vendor Costs on Previous Special Orders</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <div class="fg" style="flex:1;min-width:180px">
          <label class="lbl" for="sod-lookup-search">Vendor, item, size or code · past 12 months</label>
          <input type="search" id="sod-lookup-search" placeholder="Monroe hollow core prehung">
        </div>
        <div class="fg">
          <label class="lbl" for="sod-lookup-qty">Qty</label>
          <input type="number" id="sod-lookup-qty" min="1" step="1" value="1" style="width:76px">
        </div>
      </div>
      <div id="sod-lookup-results" style="max-height:340px;overflow:auto"></div>
    <button type="button" class="btn btn-gh" id="sod-lookup-close">Close</button>
  </div>
</div>
`);
    door.querySelector('.modal > div:nth-child(2)').insertAdjacentHTML('afterend', `<button class="btn btn-gh" type="button" style="margin-bottom:12px" onclick="closeSpecialOrderDoor();NQI.open('quote')">Upload or Paste Vendor Quote</button>`);
  }
  const lookup = document.getElementById('sod-lookup');
  const search = document.getElementById('sod-lookup-search');
  const quantity = document.getElementById('sod-lookup-qty');
  const results = document.getElementById('sod-lookup-results');
  const money = value => '$' + value.toFixed(2);

  function render() {
    results.replaceChildren();
    const qty = quantity.valueAsNumber;
    if (!Number.isInteger(qty) || qty < 1) return;
    const terms = searchText(search.value).trim().split(/\s+/).filter(Boolean);
    const matches = recentVendorDoorCosts(getSavedQuotes(), getPOLog())
      .filter(offers => terms.every(term => offers.some(offer => offer.searchable.includes(term))));
    if (!matches.length) {
      results.textContent = 'No matching vendor costs found.';
      return;
    }

    results.append(matches.length + (matches.length === 1 ? ' configuration' : ' configurations'));
    for (const offers of matches) {
      const cheapest = offers[0];
      const row = document.createElement('div');
      row.style.cssText = 'border-top:1px solid #e8dcc0;padding:8px 0';
      const title = document.createElement('strong');
      title.textContent = cheapest.description;
      row.append(title);
      const specs = Object.values(cheapest.line.doorSpec || {}).filter(Boolean);
      if (specs.length) {
        const details = document.createElement('div');
        details.textContent = specs.join(' · ');
        row.append(details);
      }
      for (const offer of offers) {
        const price = nsSpecialOrderMarkup(offer.cost);
        const detail = document.createElement('div');
        detail.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0';
        detail.append([
          vendorNames[offer.vendor], offer.kind, new Date(offer.timestamp).toLocaleDateString('en-US', {timeZone:'UTC'}),
          offer.reference, 'Cost ' + money(offer.cost), 'Retail ' + money(price.unit) + ' ea.'
        ].filter(Boolean).join(' · '));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-gh';
        button.textContent = new Set(offers.map(item => item.vendor)).size > 1 && offer === cheapest ? 'Add lowest cost' : 'Add to quote';
        button.onclick = () => {
          const original = offer.line;
          const id = Date.now();
          lines.push({
            id, lineId:id, sku:original.sku || 'SO-DOOR', item:original.item || original.description,
            description:original.description || original.item, size:original.size || '',
            doorSpec:original.doorSpec, doorStyle:original.doorStyle, category:original.category || 'Special Order',
            group:original.group || 'Custom', cost:offer.cost, qty, retail:price.unit, gm:price.gm,
            uom:original.uom || 'EA', isCustom:true, onHand:null,
            vendorCostReference:{vendor:offer.vendor, recordedAt:new Date(offer.timestamp).toISOString(), reference:offer.reference}
          });
          lookup.classList.add('hidden');
          renderLines();
          renderSummary();
        };
        detail.append(button);
        row.append(detail);
      }
      results.append(row);
    }
  }

  document.getElementById('sod-lookup-close').onclick = () => lookup.classList.add('hidden');
  search.addEventListener('input', render);
  quantity.addEventListener('input', render);
  const lookupButton = document.createElement('button');
  lookupButton.type = 'button';
  lookupButton.className = 'btn btn-gh';
  lookupButton.textContent = 'Vendor Costs on Previous Special Orders';
  lookupButton.style.cssText = 'background:#ffdb57;color:#2f2005;border-color:#b8860b;font-weight:700';
  lookupButton.onclick = () => {
    search.value = '';
    quantity.value = '1';
    lookup.classList.remove('hidden');
    loadArchive().finally(recoverAttachments);
    search.focus();
  };
  const doorButton = document.querySelector('button[onclick="showSpecialOrderDoor()"]');
  doorButton?.after(lookupButton);
})();
