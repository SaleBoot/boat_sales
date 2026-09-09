const assert = require('node:assert/strict');
const path = require('node:path');
const { PlatformStore } = require('../src/platform-store');
const { drainQueue } = require('../src/model-build-worker');

(async () => {
  assert(!process.env.DATABASE_URL && process.env.PGDATABASE === 'ship_vr_release_qa_20260909' && process.env.PGPORT === '15433', 'Requires isolated QA database');
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  try {
    await store.init();
    const boat = (await store.boats({ includeArchived: true }))[0];
    assert(boat);
    for (const role of ['platform_admin', 'shipyard_owner', 'sales']) {
      const username = 'qa-session-' + role + '-' + Date.now();
      const user = (await store.pool.query("INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name,shipyard_id) VALUES($1,$1,'qa','qa',$2,'active',$1,$3) RETURNING id", [username, role, role === 'platform_admin' ? null : boat.ownerShipyardId])).rows[0];
      const original = await store.createSession(user.id, 'web');
      const pico = await store.createSession(user.id, 'vr');
      const replacements = await Promise.all([store.createSession(user.id, 'web'), store.createSession(user.id, 'web')]);
      assert.equal(await store.userFromToken(original.token), null);
      const active = await Promise.all(replacements.map(session => store.userFromToken(session.token)));
      assert.equal(active.filter(Boolean).length, 1, role + ': exactly one computer session must survive concurrent logins');
      assert(await store.userFromToken(pico.token), 'Computer login must not break the existing paired VR session');
      const headsets = await Promise.all([store.createSession(user.id, 'vr'), store.createSession(user.id, 'vr')]);
      assert.equal(await store.userFromToken(pico.token), null);
      assert.equal((await Promise.all(headsets.map(session => store.userFromToken(session.token)))).filter(Boolean).length, 1);
      assert.equal((await Promise.all(replacements.map(session => store.userFromToken(session.token)))).filter(Boolean).length, 1, 'PICO login must preserve the active computer');
    }
    console.log('PASS: all three roles have exactly one web and one VR session, simultaneous logins revoke old tokens without cross-device eviction');
    const before = (await store.pool.query('SELECT variants_json,is_published FROM v12_boats WHERE id=$1', [boat.id])).rows[0];
    const modelsBefore = (await store.pool.query('SELECT variant_id,is_published FROM v12_vr_models WHERE ship_id=$1 ORDER BY variant_id', [boat.shipId])).rows;
    const audit = store.audit;
    store.audit = async () => { throw new Error('injected audit failure'); };
    await assert.rejects(store.setBoatPublished(boat.id, false, null), /injected/);
    assert.deepEqual((await store.pool.query('SELECT variant_id,is_published FROM v12_vr_models WHERE ship_id=$1 ORDER BY variant_id', [boat.shipId])).rows, modelsBefore);
    const variant = id => ({ variantId: id, variantName: id, modelFiles: ['/FBX/qa.glb'] });
    await assert.rejects(store.addBoatVariant(boat.id, variant('qa-rollback'), null), /injected/);
    assert.deepEqual((await store.pool.query('SELECT variants_json,is_published FROM v12_boats WHERE id=$1', [boat.id])).rows[0], before);
    assert.equal((await store.pool.query("SELECT variant_id FROM v12_vr_models WHERE variant_id='qa-rollback'")).rowCount, 0);
    store.audit = audit;
    const suffix = Date.now();
    const ids = [`qa-concurrent-a-${suffix}`, `qa-concurrent-b-${suffix}`];
    await Promise.all(ids.map(id => store.addBoatVariant(boat.id, variant(id), null)));
    const saved = await store.boat(boat.id);
    for (const id of ids) assert(saved.variants.some(v => v.variantId === id), 'Concurrent uploads must not overwrite each other');
    await assert.rejects(store.setBoatPublished(boat.id, true, null), /构建成功/);
    await store.pool.query("UPDATE v12_vr_models SET processing_status='failed' WHERE processing_status='pending'");
    for (const id of ids) await store.pool.query("UPDATE v12_vr_models SET processing_status='pending' WHERE variant_id=$1", [id]);
    const claimed = new Set(); const projects = new Set();
    let release, timeout;
    const overlap = new Promise((resolve, reject) => { release = resolve; timeout = setTimeout(() => reject(new Error('Workers did not overlap')), 10000); });
    const build = async (row, options) => {
      assert(!claimed.has(row.variant_id), 'A task must only be claimed once');
      claimed.add(row.variant_id); projects.add(options.project);
      if (claimed.size === 2) release();
      await overlap;
      if (row.variant_id === ids[0]) throw new Error('isolated build failure');
      return { file: 'qa.bundle', sha256: 'qa-hash', size: 1, version: 'qa' };
    };
    try { await Promise.all([drainQueue(store.pool, { project: 'worker-1' }, build), drainQueue(store.pool, { project: 'worker-2' }, build)]); }
    finally { clearTimeout(timeout); }
    assert.equal(claimed.size, 2); assert.equal(projects.size, 2);
    for (const [index, id] of ids.entries()) {
      const row = (await store.pool.query('SELECT processing_status FROM v12_vr_models WHERE variant_id=$1', [id])).rows[0];
      assert.equal(row.processing_status, index === 0 ? 'failed' : 'ready');
    }
    console.log('PASS: PostgreSQL publication rollback, upload rollback, concurrent uploads and pending publication guard');
    console.log('PASS: two overlapping build workers, exclusive task claims and independent failure handling');
  } finally { await store.pool.end(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
