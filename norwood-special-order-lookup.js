/* Search vendor costs already recorded in the builder and purchasing history. */
(function () {
  'use strict';

  const vendorNames = {dyke: 'Dyke Industries', tlc: 'TLC Millwork'};
  const normalize = value => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const searchText = value => normalize(value).replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bpre hung\b/g, 'prehung');

  function recentVendorDoorCosts(quotes, orders, now = Date.now()) {
    const recent = new Map();
    const oldest = now - 90 * 86400000;
    function add(line, vendor, cost, date, reference, kind) {
      const timestamp = Date.parse(date);
      const description = [line.item, line.size, normalize(line.description) !== normalize(line.item) && line.description]
        .filter(Boolean).join(' · ');
      const specs = Object.entries(line.doorSpec || {}).filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b));
      const searchable = searchText([description, line.sku, ...specs.map(([, value]) => value)].join(' '));
      if (!vendorNames[vendor] || !Number.isFinite(cost) || cost <= 0 ||
          !(timestamp >= oldest && timestamp <= now) ||
          !/\b(doors?|pre ?hung|slabs?|monroe|bifold)\b/.test(searchable)) return;

      // Only compare identical descriptions, dimensions, and configuration fields.
      const key = JSON.stringify([normalize(line.description || line.item), normalize(line.size), specs.map(([name, value]) => [name, normalize(value)])]);
      if (!recent.has(key)) recent.set(key, new Map());
      const offers = recent.get(key);
      if ((offers.get(vendor)?.timestamp ?? -Infinity) >= timestamp) return;
      offers.set(vendor, {line, vendor, cost, timestamp, reference, kind, description, searchable});
    }

    for (const quote of quotes) {
      for (const line of quote.lines || []) {
        const source = line.vendorQuoteSource;
        if (source) add(line, source.vendor, Number(source.unitCost ?? line.cost), source.recordedAt, '', 'Quote imported');
      }
    }
    for (const order of orders) {
      const vendor = /\bdyke\b/i.test(order.vendorName) ? 'dyke' :
        nsIsTLC(order.vendorName, order.vendorEmail) ? 'tlc' : '';
      (order.items || []).forEach((line, index) => {
        const acknowledged = order.ack?.items?.[index];
        if (acknowledged && Number(acknowledged.qty) > 0 && Number(acknowledged.cost) > 0) {
          add(line, vendor, Number(acknowledged.cost), order.ack.date || order.ack.savedAt,
            order.ack.ref || order.poNum, 'Acknowledgment');
        } else if (['Sent', 'Acknowledged', 'Partial', 'Received'].includes(order.status)) {
          add(line, vendor, Number(line.unitCost), order.date || order.savedAt, order.poNum, 'PO cost');
        }
      });
    }
    return Array.from(recent.values(), offers => Array.from(offers.values()).sort((a, b) => a.cost - b.cost))
      .sort((a, b) => b[0].timestamp - a[0].timestamp);
  }

  const lookup = document.getElementById('sod-lookup');
  if (!lookup) return;
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
      results.textContent = 'No matching Dyke or TLC door costs recorded in the last 90 days.';
      return;
    }

    for (const offers of matches.slice(0, 30)) {
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
        const price = nsSpecialOrderMarkup(offer.cost, qty);
        const detail = document.createElement('div');
        detail.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0';
        detail.append([
          vendorNames[offer.vendor], offer.kind, new Date(offer.timestamp).toLocaleDateString('en-US', {timeZone:'UTC'}),
          offer.reference, 'Cost ' + money(offer.cost), 'Retail ' + money(price.unit) + ' ea.'
        ].filter(Boolean).join(' · '));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-gh';
        button.textContent = offers.length > 1 && offer === cheapest ? 'Add lowest cost' : 'Add to quote';
        button.onclick = () => {
          const original = offer.line;
          const id = Date.now();
          lines.push({
            id, lineId:id, sku:original.sku || 'SO-DOOR', item:original.item || original.description,
            description:original.description || original.item, size:original.size || '',
            doorSpec:original.doorSpec, doorStyle:original.doorStyle, category:original.category || 'Special Order',
            group:original.group || 'Custom', cost:offer.cost, qty, retail:price.unit, gm:price.gm,
            uom:'EA', isCustom:true, onHand:null,
            vendorCostReference:{vendor:offer.vendor, recordedAt:new Date(offer.timestamp).toISOString(), reference:offer.reference}
          });
          closeSpecialOrderDoor();
          renderLines();
          renderSummary();
        };
        detail.append(button);
        row.append(detail);
      }
      results.append(row);
    }
    if (matches.length > 30) results.append('Showing 30 results. Narrow the search to see more.');
  }

  lookup.addEventListener('toggle', () => { if (lookup.open) render(); });
  search.addEventListener('input', render);
  quantity.addEventListener('input', render);
  const openDoor = window.showSpecialOrderDoor;
  window.showSpecialOrderDoor = function () {
    const result = openDoor.apply(this, arguments);
    search.value = '';
    quantity.value = '1';
    if (lookup.open) render();
    return result;
  };
})();
