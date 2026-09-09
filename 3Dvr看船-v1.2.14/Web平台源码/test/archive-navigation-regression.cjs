const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/js/admin.js'), 'utf8');
const render = source.slice(source.indexOf('function renderHierarchy()'), source.indexOf('function boatDirectoryTable('));
for (const exists of [true, false]) {
  let restored = false, closed = false;
  const header = {};
  const container = {
    querySelector: () => ({ dataset: { shipyardId: '46' } }),
    querySelectorAll: () => exists ? [{ dataset: { shipyardId: '46' }, querySelector: () => header }] : [],
    classList: { contains: () => true }
  };
  vm.runInNewContext(render + '\nrenderHierarchy();', {
    state: { shipyards: [], boats: [] },
    document: { getElementById: id => id === 'shipyardHierarchy' ? container : { value: '' } },
    openShipyardDetail: value => { assert.equal(value, header); restored = true; },
    closeShipyardDetail: () => { closed = true; }
  });
  assert.equal(restored, exists);
  assert.equal(closed, !exists);
}
console.log('PASS: rerender preserves selected vendor or exits empty detail mode');
