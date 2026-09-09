const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [root, output, expectedFile] = process.argv.slice(2);
assert(root && output, 'Usage: node vr-origin-inventory.cjs ROOT OUTPUT [EXPECTED]');
async function inventory(directory, relative = '') {
  const entries = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, item.name), file = path.join(directory, item.name);
    if (item.isDirectory()) entries.push(...await inventory(file, name));
    else {
      assert(item.isFile(), `Unexpected symlink or special file: ${name}`);
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
      entries.push({ file: name, size: fs.statSync(file).size, sha256: hash.digest('hex') });
    }
  }
  return entries;
}
(async () => {
  const files = await inventory(root);
  const byName = new Map(files.map(file => [file.file, file]));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'android/catalog.json'), 'utf8'));
  for (const entry of catalog.entries) {
    const file = byName.get(`android/${entry.file}`);
    assert(file, `Catalog resource missing: ${entry.variantId}`);
    assert.equal(file.sha256, entry.sha256, entry.variantId);
    assert.equal(file.size, entry.size, entry.variantId);
  }
  if (expectedFile) assert.deepEqual(files, JSON.parse(fs.readFileSync(expectedFile, 'utf8')).files, 'Origin archive differs from Tencent');
  fs.writeFileSync(output, JSON.stringify({ files, catalogEntries: catalog.entries.length, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ files: files.length, bytes: files.reduce((total, file) => total + file.size, 0), catalogEntries: catalog.entries.length, matchesExpected: Boolean(expectedFile) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
