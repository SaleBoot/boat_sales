const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

// Stages verified artifacts only. Publication remains a separate database operation.
async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function stage(manifestFile, target) {
  const manifest = JSON.parse(await fs.promises.readFile(manifestFile, 'utf8'));
  assert.equal(manifest.count, manifest.assets.length);
  const ids = new Set();
  const entries = [];
  for (const asset of manifest.assets) {
    const id = path.basename(asset.output);
    assert.match(id, /^[a-zA-Z0-9_-]+$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert(!ids.has(id), 'duplicate model identifier');
    ids.add(id);
    const source = path.join(asset.output, 'ship.bundle');
    assert.equal((await fs.promises.stat(source)).size, asset.size);
    assert.equal(await sha256(source), asset.sha256, `source mismatch: ${id}`);
    const relative = `uploads/${id}/${asset.sha256}.bundle`;
    const destination = path.join(target, 'android', relative);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    try { await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    assert.equal(await sha256(destination), asset.sha256, `staged mismatch: ${id}`);
    entries.push({ artifactId: id, file: relative, sha256: asset.sha256, size: asset.size });
  }
  console.log(JSON.stringify({ count: entries.length, bytes: entries.reduce((sum, x) => sum + x.size, 0), target, entries }));
}

if (require.main === module) {
  const [manifest, target] = process.argv.slice(2);
  if (!manifest || !target) throw new Error('Usage: node stage-vr-release.cjs manifest.json target-directory');
  stage(manifest, target).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { stage };
