const {JSDOM} = require('jsdom');
const fs = require('fs');
const assert = require('node:assert/strict');

const records = [
  {id:'pending', customerName:'Pending stop', deliveryDate:'2026-11-02', status:'scheduled', driverId:'andre', invoiceNumber:'TEST-1', address:'Example Road', photos:['existing-photo'], smsLog:{scheduled:'original'}},
  {id:'route', customerName:'En route stop', deliveryDate:'2026-11-03', status:'enroute', driverId:'marcel'},
  {id:'done', customerName:'Previous completion', deliveryDate:'2026-11-01', status:'delivered'},
  {id:'cancelled', customerName:'Cancelled stop', deliveryDate:'2026-11-01', status:'cancelled'}
];
const initial = structuredClone(records);
const timestamp = {serverTimestamp:true};
const alerts = [], writes = [];
let holdWrite = null, failWrite = false;
const settle = () => new Promise(resolve => setImmediate(resolve));

function openBoard() {
  const dom = new JSDOM('<div class="header"><nav class="nav"><button class="tab" id="tab-reports">Reports</button></nav></div><main class="main"><div class="page active" id="page-quote"></div></main>', {url:'https://isolated.test/', runScripts:'dangerously'});
  const w = dom.window;
  w.showInvoice = w.showView = w.showPage = w.showToast = () => {};
  w.getSavedQuotes = () => [];
  w.alert = message => alerts.push(message);
  w.console.error = () => {};
  w.fetch = () => { throw Error('Completion must not send a customer message'); };
  w.__firebaseModule = async () => ({
    getApps: () => [{}], getFirestore: () => ({}),
    collection: (db, name) => { assert.equal(name, 'deliveries'); return name; },
    getDocs: async () => ({forEach: fn => records.forEach(record => fn({id:record.id, data:() => structuredClone(record)}))}),
    doc: (db, collection, id) => { assert.equal(collection, 'deliveries'); return id; },
    serverTimestamp: () => timestamp,
    updateDoc: async (id, fields) => {
      writes.push({id, fields});
      if (holdWrite) await holdWrite;
      if (failWrite) throw Error('Offline');
      Object.assign(records.find(r => r.id === id), fields);
    }
  });
  w.eval(fs.readFileSync('norwood-delivery-patch.js','utf8')
    .replace(/import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.0\/firebase-[^"]+"\)/g,'window.__firebaseModule()'));
  return dom;
}

(async () => {
  let dom = openBoard(), w = dom.window, d = w.document;
  const completeButtons = () => d.querySelectorAll('.dlv-act-complete');
  await w.NWDelivery.refreshSchedule();
  assert.equal(completeButtons().length, 2, 'Only scheduled and en-route records can be completed');
  const button = [...completeButtons()].find(b => b.closest('.dlv-card').textContent.includes('Pending stop'));
  let release;
  holdWrite = new Promise(resolve => { release = resolve; });
  button.click();
  await settle();
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Saving…');
  assert.equal(d.querySelectorAll('.status-delivered').length, 1, 'No success before the cloud write');
  button.click();
  await w.NWDelivery.completeDeliveryById('pending', button);
  assert.equal(writes.length, 1, 'Double clicks cannot create duplicate writes');
  release(); holdWrite = null;
  await settle();
  assert.equal(records[0].status, 'delivered');
  assert.equal(records[0].deliveredAt, timestamp);
  assert.deepEqual(Object.keys(writes[0].fields).sort(), ['deliveredAt','status']);
  assert.equal(d.getElementById('dlv-stat-pending').textContent, '0');
  assert.equal(d.getElementById('dlv-stat-delivered').textContent, '2');
  assert.equal(completeButtons().length, 1);
  const untouched = {...records[0]}; delete untouched.deliveredAt; untouched.status = 'scheduled';
  assert.deepEqual(untouched, initial[0], 'Preserve invoice link, notes, photos, schedule and SMS history');
  w.NWDelivery.setFilter('delivered');
  assert.equal(d.querySelectorAll('.dlv-card').length, 2);
  assert.match(d.getElementById('dlv-schedule-list').textContent, /Pending stop/);
  dom.window.close();

  dom = openBoard(); w = dom.window; d = w.document;
  await w.NWDelivery.refreshSchedule();
  assert.equal(d.getElementById('dlv-stat-delivered').textContent, '2', 'Completion survives reopening');
  failWrite = true;
  const routeButton = completeButtons()[0];
  routeButton.click(); await settle();
  assert.equal(records[1].status, 'enroute');
  assert.equal(d.getElementById('dlv-stat-delivered').textContent, '2');
  assert.equal(routeButton.disabled, false);
  assert.match(alerts[0], /Could not mark this delivery completed/);
  failWrite = false;
  routeButton.click(); await settle();
  assert.equal(records[1].status, 'delivered', 'Failed writes can be retried');
  assert.equal(d.getElementById('dlv-stat-enroute').textContent, '0');
  assert.equal(d.getElementById('dlv-stat-delivered').textContent, '3');
  await w.NWDelivery.completeDeliveryById('cancelled');
  await w.NWDelivery.completeDeliveryById('done');
  assert.equal(writes.length, 3, 'Cancelled and completed records cannot be completed again');
  assert.deepEqual(records[2], initial[2]);
  assert.deepEqual(records[3], initial[3]);
  dom.window.close();
  console.log('PASS: Completed button clicks, saved status and timestamp, history, reload, duplicate clicks, failed saves and retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
