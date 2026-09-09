const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/detail.html'), 'utf8');
const start = source.indexOf('function returnToCatalog()');
const end = source.indexOf('</script>', start);
assert(start >= 0 && end > start);
for (const [role, search, expected] of [
  ['platform_admin', '?id=20', 'members.html#boats'],
  ['admin', '?id=20&admin=1', 'members.html#boats'],
  ['shipyard_owner', '?id=20', 'shipyard.html'],
  ['sales', '?id=20', 'shipyard.html'],
  ['', '?id=20', 'index.html'],
  ['', '?id=20&admin=1', 'members.html#boats']
]) {
  let target;
  vm.runInNewContext(source.slice(start, end) + '\nreturnToCatalog();', {
    URLSearchParams, localStorage: { getItem: () => JSON.stringify({ role }) },
    window: { location: { search, replace: url => { target = url; } }, close: () => assert.fail('Must not close tab') },
    document: { referrer: 'https://example.test/twin?boat=qa' },
    history: { length: 5, back: () => assert.fail('Must not return to digital twin') }
  });
  assert.equal(target, expected);
}
console.log('PASS: detail return uses role-specific ship management, never twin history');
