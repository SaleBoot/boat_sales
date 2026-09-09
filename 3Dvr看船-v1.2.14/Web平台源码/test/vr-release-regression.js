const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PlatformStore } = require('../src/platform-store');
const { validateGlb } = require('../src/glb-validation');
const fixture = require('./glb-fixture');
const { makePassword } = require('../src/security');
const { createServer } = require('node:http');
const crypto = require('node:crypto');
const { verifyDownload } = require('../src/model-build-worker');

(async () => {
  assert(!process.env.DATABASE_URL && !process.env.PGHOST, 'Use isolated memory database');
  const payload = Buffer.from('cache-integrity-test');
  const cache = createServer((req, res) => {
    res.statusCode = req.url === '/missing' ? 404 : 200;
    if (req.url !== '/uncached') res.setHeader('X-Cache-Status', 'HIT');
    res.end(payload);
  });
  await new Promise(resolve => cache.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${cache.address().port}`;
    await verifyDownload(url, crypto.createHash('sha256').update(payload).digest('hex'));
    await verifyDownload(url, crypto.createHash('sha256').update(payload).digest('hex'), true);
    await assert.rejects(verifyDownload(url + '/uncached', crypto.createHash('sha256').update(payload).digest('hex'), true), /尚未就绪/);
    await assert.rejects(verifyDownload(url, 'wrong-hash'), /校验失败/);
    await assert.rejects(verifyDownload(url + '/missing', ''), /不可用/);
  } finally { cache.closeAllConnections(); await new Promise(resolve => cache.close(resolve)); }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-vr-release-'));
  const file = path.join(directory, 'sample.glb');
  fs.writeFileSync(file, fixture()); assert.equal(validateGlb(file).meshes, 1);
  fs.writeFileSync(file, fixture(doc => { doc.images = [{ uri: 'texture.png' }]; }));
  assert.throws(() => validateGlb(file), /内嵌/);
  fs.writeFileSync(file, fixture(doc => { doc.bufferViews[0].byteLength = 10000; }));
  assert.throws(() => validateGlb(file), /越界/);
  for (const change of [doc => { doc.images = {}; }, doc => { doc.buffers = [null]; }, doc => { doc.buffers[0].byteLength = -1; }, doc => { doc.meshes[0].primitives = {}; }]) {
    fs.writeFileSync(file, fixture(change));
    assert.throws(() => validateGlb(file), error => error.status === 400);
  }
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  try {
    await store.init();
    const model = (await store.pool.query('SELECT * FROM v12_vr_models LIMIT 1')).rows[0];
    const boat = (await store.pool.query('SELECT * FROM v12_boats WHERE ship_id=$1', [model.ship_id])).rows[0];
    const credentials = makePassword('QaRelease123!');
    const createUser = async (name, role, shipyardId) => (await store.pool.query(
      'INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name,shipyard_id) VALUES($1,$1,$2,$3,$4,\'active\',$1,$5) RETURNING *',
      [name, credentials.salt, credentials.passwordHash, role, shipyardId]
    )).rows[0];
    const admin = await createUser('qa_release_admin', 'platform_admin', null);
    const owner = await createUser('qa_release_owner', 'shipyard_owner', boat.owner_shipyard_id);
    assert(admin && owner && boat);
    await store.pool.query("UPDATE v12_vr_models SET bundle_file='test.bundle',bundle_sha256='test',processing_status='ready',is_published=FALSE WHERE variant_id=$1", [model.variant_id]);
    await store.pool.query('UPDATE v12_boats SET is_published=TRUE WHERE id=$1', [boat.id]);
    assert.equal((await store.boat(boat.id, false)).variants.some(v => v.variantId === model.variant_id), false, 'Web detail hides unpublished variants');
    assert.equal((await store.boats()).find(b => b.id === boat.id).variants.some(v => v.variantId === model.variant_id), false, 'Web catalog hides unpublished variants');
    assert.equal((await store.boat(boat.id)).variants.some(v => v.variantId === model.variant_id), true, 'Admin retains web preview');
    const has = async user => (await store.vrCatalog(user)).entries.some(e => e.variantId === model.variant_id);
    assert.equal(await has(admin), true, 'Admin previews unpublished builds');
    assert.equal(await has(owner), false, 'Owner cannot preview unpublished builds');
    await store.setCurrentVrModel(admin, model.variant_id);
    assert.equal((await store.currentVrModel(admin)).variantId, model.variant_id);
    await assert.rejects(store.setCurrentVrModel(owner, model.variant_id), /无权/);
    await store.pool.query('UPDATE v12_boats SET is_published=TRUE WHERE id=$1', [boat.id]);
    await store.pool.query('UPDATE v12_vr_models SET is_published=TRUE WHERE variant_id=$1', [model.variant_id]);
    await store.pool.query('INSERT INTO v12_shipyard_model_bindings(shipyard_id,variant_id,active) VALUES($1,$2,TRUE) ON CONFLICT(shipyard_id,variant_id) DO UPDATE SET active=TRUE', [owner.shipyard_id, model.variant_id]);
    assert.equal(await has(owner), true);
    await store.setCurrentVrModel(owner, model.variant_id);
    await store.pool.query('UPDATE v12_shipyard_model_bindings SET active=FALSE WHERE shipyard_id=$1 AND variant_id=$2', [owner.shipyard_id, model.variant_id]);
    assert.equal(await store.currentVrModel(owner), null, 'Revoked binding invalidates existing VR assignment');
    await store.setBoatPublished(boat.id, false, admin.id);
    assert.equal(await has(owner), false);
    assert.equal(await has(admin), true);
    assert.equal(await has({ ...owner, membership_expires_at: '2000-01-01' }), false);
    await store.pool.query("UPDATE v12_vr_models SET processing_status='failed' WHERE variant_id=$1", [model.variant_id]);
    await assert.rejects(store.setBoatPublished(boat.id, true, admin.id), /构建成功/);
    console.log('PASS: embedded GLB validation, admin draft preview, owner isolation, revoke, unpublish, expiry, failed-build publication gate');
  } finally { await store.pool.end(); fs.rmSync(directory, { recursive: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
