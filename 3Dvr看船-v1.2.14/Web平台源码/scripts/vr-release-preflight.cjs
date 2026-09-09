const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const sources = manifest.assets.map(asset => {
    const suffix = `uploads/${path.basename(asset.output)}/model.glb`;
    assert(asset.source.endsWith('/' + suffix));
    return '/FBX/' + suffix;
  });
  assert.equal(new Set(sources).size, manifest.count);
  const pool = new Pool({ max: 1, connectionTimeoutMillis: 10000 });
  try {
    await pool.query('BEGIN READ ONLY');
    const { rows } = await pool.query(`SELECT variant_id,ship_id,source_file,bundle_file,asset_format,
      is_published,to_jsonb(m)->>'processing_status' AS processing_status
      FROM v12_vr_models m WHERE source_file=ANY($1::text[]) ORDER BY variant_id`, [sources]);
    const missing = sources.filter(source => !rows.some(row => row.source_file === source));
    assert.equal(rows.length, new Set(rows.map(row => row.source_file)).size, 'Ambiguous source mapping');
    console.log(JSON.stringify({ expected: sources.length, matched: rows.length, missing,
      boats: new Set(rows.map(row => row.ship_id)).size,
      published: rows.filter(row => row.is_published).length,
      formats: [...new Set(rows.map(row => row.asset_format))], rows }, null, 2));
    assert.equal(missing.length, 0, 'Release contains models absent from the database');
    await pool.query('ROLLBACK');
  } finally { await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
