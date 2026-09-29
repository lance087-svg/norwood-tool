const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../norwood-patch.js'), 'utf8');
const start = source.indexOf('  var _patchedStorage = false;');
const end = source.indexOf('  setTimeout(patchStorageFunctions, 500);', start);
assert.ok(start >= 0 && end > start);
const patch = source.slice(start, end + '  setTimeout(patchStorageFunctions, 500);'.length);

test('saving one quote never uploads stale, unchanged quotes', () => {
  const old = [{ id: 1, quoteNum: 'Q-1', amount: 100 }, { id: 2, quoteNum: 'Q-2', amount: 200 }];
  let saved = JSON.stringify(old);
  const uploaded = [];
  const context = {
    window: {
      getSavedQuotes() { return JSON.parse(saved); },
      saveQuotesToStorage(quotes) { saved = JSON.stringify(quotes); }
    },
    localStorage: { getItem() { return saved; } },
    syncSaveQuote(q) { uploaded.push(q.id); },
    _syncEnabled: true,
    setTimeout(fn) { fn(); },
    console
  };
  vm.runInNewContext(patch, context);
  context.window.saveQuotesToStorage([old[0], { ...old[1], amount: 225 }]);
  assert.deepEqual(uploaded, [2]);
});
