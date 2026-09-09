const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const dump = process.argv[2];
assert(dump && fs.statSync(dump).isFile());
const container = 'ship-platform-local-postgres16';
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert(info.NetworkSettings.Ports['5432/tcp'].some(port => port.HostPort === '15433'));
const settings = Object.fromEntries(info.Config.Env.map(item => { const i = item.indexOf('='); return [item.slice(0, i), item.slice(i + 1)]; }));
const env = { ...process.env, PGPASSWORD: settings.POSTGRES_PASSWORD };
const database = `ship_restore_qa_${Date.now()}`;
const command = (program, args, options = {}) => execFileSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', container,
  program, '-U', settings.POSTGRES_USER, ...args], { env, encoding: 'utf8', ...options });
command('createdb', [database]);
try {
  const fd = fs.openSync(dump, 'r');
  try { command('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '-d', database], { stdio: [fd, 'pipe', 'pipe'] }); }
  finally { fs.closeSync(fd); }
  const counts = command('psql', ['-d', database, '-At', '-c', 'SELECT (SELECT count(*) FROM v12_vr_models),(SELECT count(*) FROM v12_users),(SELECT count(*) FROM v12_boats)']).trim().split('|').map(Number);
  assert(counts[0] >= 81 && counts[1] > 0 && counts[2] >= 27);
  if (process.argv[3]) {
    const query = sql => command('psql', ['-d', database, '-At', '-c', sql]).trim();
    const identity = `SELECT jsonb_agg(to_jsonb(m)-ARRAY['asset_format','bundle_file','bundle_size','bundle_sha256','bundle_version','processing_status','processing_error'] ORDER BY variant_id) FROM v12_vr_models m`;
    const before = query(identity);
    const bindings = query('SELECT jsonb_agg(to_jsonb(b) ORDER BY shipyard_id,variant_id) FROM v12_shipyard_model_bindings b');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-switch-qa-'));
    const args = [path.join(__dirname, '../scripts/switch-vr-models.cjs'), process.argv[3], process.argv[4]];
    const dbEnv = { ...env, PGHOST: '127.0.0.1', PGPORT: '15433', PGUSER: settings.POSTGRES_USER, PGDATABASE: database };
    try {
      execFileSync(process.execPath, [...args, '--check'], { env: dbEnv, stdio: 'pipe' });
      assert.equal(Number(query("SELECT count(*) FROM v12_vr_models WHERE asset_format='glb'")), 81);
      execFileSync(process.execPath, [...args, '--apply', path.join(temp, 'before.json')], { env: dbEnv, stdio: 'pipe' });
      assert.equal(Number(query("SELECT count(*) FROM v12_vr_models WHERE asset_format='glb'")), 0);
      assert.equal(query(identity), before, 'Model identity, publication and owner must not change');
      assert.equal(query('SELECT jsonb_agg(to_jsonb(b) ORDER BY shipyard_id,variant_id) FROM v12_shipyard_model_bindings b'), bindings);
      assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'before.json'), 'utf8')).length, 81);
      console.log('PASS: 81 model switch dry-run rolls back; apply preserves identities, publication and manufacturer bindings');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
  console.log(JSON.stringify({ restored: true, models: counts[0], users: counts[1], boats: counts[2], isolatedPort: 15433 }));
} finally { command('dropdb', [database]); }
