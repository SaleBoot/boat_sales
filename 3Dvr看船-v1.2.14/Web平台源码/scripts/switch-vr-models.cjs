const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

async function prepare(manifestFile, root) {
  const manifest = JSON.parse(await fs.promises.readFile(manifestFile, 'utf8'));
  assert.equal(manifest.count, manifest.assets.length);
  const entries = [];
  for (const asset of manifest.assets) {
    const id = path.basename(asset.output);
    assert.match(id, /^[a-zA-Z0-9_-]+$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert(asset.source.endsWith(`/uploads/${id}/model.glb`));
    const file = `uploads/${id}/${asset.sha256}.bundle`;
    const local = path.join(root, 'android', file);
    assert.equal((await fs.promises.stat(local)).size, asset.size);
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(local)) hash.update(chunk);
    assert.equal(hash.digest('hex'), asset.sha256);
    entries.push({ source: `/FBX/uploads/${id}/model.glb`, file, size: asset.size, sha256: asset.sha256 });
  }
  assert.equal(new Set(entries.map(entry => entry.source)).size, entries.length);
  return entries;
}

// Caller owns the transaction; only VR resource fields are changed.
async function switchModels(client, entries) {
  const changes = [];
  for (const entry of entries) {
    const { rows } = await client.query('SELECT * FROM v12_vr_models WHERE source_file=$1 FOR UPDATE', [entry.source]);
    assert.equal(rows.length, 1, `Source mapping must be unique: ${entry.source}`);
    const before = rows[0];
    assert(!['building', 'pending'].includes(before.processing_status), 'Do not replace an active build');
    await client.query(`UPDATE v12_vr_models SET asset_format='assetbundle',bundle_file=$2,
      bundle_size=$3,bundle_sha256=$4,bundle_version=$5,processing_status='ready',processing_error=''
      WHERE variant_id=$1`, [before.variant_id, entry.file, entry.size, entry.sha256, entry.sha256.slice(0, 16)]);
    changes.push({ before, after: entry });
  }
  return changes;
}

async function main() {
  const [manifest, root, mode = '--check', backup] = process.argv.slice(2);
  assert(['--check', '--apply'].includes(mode));
  assert(manifest && root, 'Usage: manifest root [--check|--apply backup.json]');
  if (mode === '--apply') assert(backup, 'A new backup file is required');
  const entries = await prepare(manifest, root);
  const pool = new Pool({ max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const changes = await switchModels(client, entries);
    if (mode === '--apply') await fs.promises.writeFile(backup, JSON.stringify(changes, null, 2), { flag: 'wx', mode: 0o600 });
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ models: changes.length, committed: mode === '--apply' }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
module.exports = { prepare, switchModels };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
