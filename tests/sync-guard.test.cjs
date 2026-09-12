const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../norwood-sync-guard.js'), 'utf8');

function harness() {
  let saved = '[]', draft, badge, start, timerId = 0;
  const writes = [], timers = new Map();
  const context = {
    console: { log() {} },
    localStorage: { getItem: () => saved, setItem: (key, value) => { saved = value; } },
    document: {
      addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') start = callback; },
      createElement: () => ({ style: {}, addEventListener() {} }),
      body: { appendChild: element => { badge = element; } }
    },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval() {},
    print() {},
    confirm: () => true,
    saveCurrentQuote: () => { saved = JSON.stringify([draft]); return draft.id; },
    _db: { collection: () => ({ doc: () => ({ set: record => new Promise((resolve, reject) => {
      writes.push({ record, resolve, reject });
    }) }) }) }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  start();
  return {
    writes, timers,
    save(record) { draft = record; context.saveCurrentQuote('quote'); },
    record: () => JSON.parse(saved)[0],
    badge: () => badge
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('older save acknowledgement cannot mark a newer edit synced', async () => {
  const h = harness();
  h.save({ id: 1, timestamp: 10, grand: 100 });
  h.save({ id: 1, timestamp: 11, grand: 200 });
  h.writes[0].resolve();
  await flush();
  assert.equal(h.record()._syncStatus, 'pending');
  h.writes[1].resolve();
  await flush();
  assert.equal(h.record()._syncStatus, 'synced');
  assert.equal(h.record().grand, 200);
});

test('late failure of an older save does not mark the latest saved edit as failed', async () => {
  const h = harness();
  h.save({ id: 1, timestamp: 10, grand: 100 });
  h.save({ id: 1, timestamp: 11, grand: 200 });
  h.writes[1].resolve();
  await flush();
  h.writes[0].reject(new Error('offline'));
  await flush();
  assert.equal(h.record()._syncStatus, 'synced');
});

test('content changes within the same timestamp still need their own acknowledgement', async () => {
  const h = harness();
  h.save({ id: 1, timestamp: 10, grand: 100 });
  h.save({ id: 1, timestamp: 10, grand: 200 });
  h.writes[0].resolve();
  await flush();
  assert.equal(h.record()._syncStatus, 'pending');
});

test('a new unsynced quote cancels the previous success badge hide timer', async () => {
  const h = harness();
  h.save({ id: 1, grand: 100 });
  h.writes[0].resolve();
  await flush();
  assert.equal([...h.timers.values()].filter(t => t.delay === 3000).length, 1);
  h.save({ id: 1, grand: 200 });
  assert.equal([...h.timers.values()].filter(t => t.delay === 3000).length, 0);
  assert.match(h.badge().textContent, /1 not yet synced/);
  assert.equal(h.badge().style.opacity, '1');
});
