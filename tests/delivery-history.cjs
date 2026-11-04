const {JSDOM} = require('jsdom');
const fs = require('fs');
const assert = require('node:assert/strict');

// The server transport is replaced; the real loader, date handling, filters,
// summary counts and rendered cards all run against these saved records.
const records = [
  {id:'overdue', customerName:'Overdue stop', deliveryDate:'2026-11-02', status:'scheduled', driverId:'andre'},
  {id:'history', customerName:'Completed stop', deliveryDate:'2026-10-30', status:'delivered', driverId:'robert'},
  {id:'today', customerName:'Today stop', deliveryDate:'2026-11-03', status:'scheduled', driverId:'andre'},
  {id:'tomorrow', customerName:'Tomorrow stop', deliveryDate:'2026-11-04', status:'scheduled', driverId:'marcel'},
  {id:'future', customerName:'Later stop', deliveryDate:'2026-11-20', status:'scheduled', driverId:'marcel'},
  {id:'enroute', customerName:'En route stop', deliveryDate:'2026-11-02', status:'enroute', driverId:'andre'},
  {id:'cancelled', customerName:'Cancelled stop', deliveryDate:'2026-11-02', status:'cancelled', driverId:'andre'},
  {id:'undated', customerName:'Undated stop', status:'scheduled', driverId:'andre'}
];
const originalRecords = JSON.stringify(records);
let failLoad = false;

function openBoard() {
  const dom = new JSDOM('<div class="header"><nav class="nav"><button class="tab" id="tab-reports">Reports</button></nav></div><main class="main"><div class="page active" id="page-quote"></div></main>', {url:'https://isolated.test/', runScripts:'outside-only'});
  const w = dom.window;
  const RealDate = w.Date;
  // Nov 3 in Jacksonville, even though UTC has already rolled into Nov 4.
  w.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-04T01:00:00Z'])); } };
  w.showInvoice = () => {};
  w.showView = () => {};
  w.showPage = () => {};
  w.getSavedQuotes = () => [];
  w.console.error = () => {};
  w.__firebaseModule = async () => ({
    getApps: () => [{}], getFirestore: () => ({}),
    collection: (db, name) => { assert.equal(name, 'deliveries'); return name; },
    getDocs: async () => {
      if (failLoad) throw Error('Offline');
      return {forEach: fn => records.forEach(record => fn({id:record.id, data:() => ({...record})}))};
    }
  });
  const source = fs.readFileSync('norwood-delivery-patch.js', 'utf8')
    .replace(/import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.0\/firebase-[^"]+"\)/g, 'window.__firebaseModule()');
  w.eval(source);
  return dom;
}

(async () => {
  let dom = openBoard();
  let w = dom.window, d = w.document;
  const cards = () => d.querySelectorAll('.dlv-card');
  const count = name => d.getElementById('dlv-stat-'+name).textContent;
  await w.NWDelivery.refreshSchedule();
  assert.equal(cards().length, 8, 'All must include history, overdue, distant and undated stops');
  assert.equal(count('pending'), '5');
  assert.equal(count('today'), '1', 'Today follows Jacksonville time');
  assert.equal(count('upcoming'), '2');
  assert.equal(count('delivered'), '1');
  assert.equal(count('enroute'), '1');
  assert.match(d.getElementById('dlv-schedule-list').textContent, /Date not set/);
  w.NWDelivery.setFilter('delivered');
  assert.equal(cards().length, 1);
  assert.match(cards()[0].textContent, /Completed stop/);
  w.NWDelivery.setFilter('scheduled');
  assert.equal(cards().length, 5);
  assert.match(d.getElementById('dlv-schedule-list').textContent, /Overdue stop/);
  w.NWDelivery.setFilter('enroute');
  assert.equal(cards().length, 1);
  w.NWDelivery.setFilter('andre');
  assert.equal(cards().length, 4, 'Driver view excludes cancelled stops');
  w.NWDelivery.openManual();
  assert.equal(d.getElementById('dlv-date').value, '2026-11-04');
  w.NWDelivery.closeModal();
  failLoad = true;
  await w.NWDelivery.refreshSchedule();
  assert.match(d.getElementById('dlv-schedule-list').textContent, /Could not load deliveries/);
  assert.equal(count('pending'), '—', 'A failed read must not look like zero saved records');
  failLoad = false;
  await w.NWDelivery.refreshSchedule();
  assert.equal(cards().length, 4, 'Refreshing preserves the selected driver filter');
  dom.window.close();
  dom = openBoard(); w = dom.window; d = w.document;
  await w.NWDelivery.refreshSchedule();
  assert.equal(cards().length, 8, 'Reopening the board retains the full saved history');
  assert.equal(JSON.stringify(records), originalRecords, 'Reading never changes stored delivery records');
  dom.window.close();
  console.log('PASS: delivery history, overdue and future stops, filters, totals, Jacksonville dates, reload and read failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
