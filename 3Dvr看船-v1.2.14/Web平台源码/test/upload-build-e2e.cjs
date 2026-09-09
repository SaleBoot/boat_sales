// Company-only integration test. Requires the isolated Tencent cache on port 19188.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { Pool } = require('pg');
const express = require('express');
const multer = require('multer');
const { PlatformStore } = require('../src/platform-store');
const { installPlatformRoutes } = require('../src/platform-routes');
const { makePassword } = require('../src/security');
const root = '/home/cqypxl/ship-platform-api-6060';
const review = `${root}/review-20260909`;
(async () => {
  assert.equal(process.env.HOME, '/home/cqypxl');
  assert(!process.env.DATABASE_URL, 'Do not use production credentials');
  const container = JSON.parse(execFileSync('docker', ['inspect', 'ship-platform-local-postgres16'], { encoding: 'utf8' }))[0];
  assert(container.NetworkSettings.Ports['5432/tcp'].some(p => p.HostPort === '15433'));
  const env = Object.fromEntries(container.Config.Env.map(item => { const p = item.indexOf('='); return [item.slice(0, p), item.slice(p + 1)]; }));
  const database = `ship_upload_qa_${Date.now()}`;
  const config = { host: '127.0.0.1', port: 15433, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: 'postgres' };
  const adminPool = new Pool(config);
  try { await adminPool.query(`CREATE DATABASE ${database}`); } finally { await adminPool.end(); }
  Object.assign(process.env, { PGHOST: config.host, PGPORT: '15433', PGUSER: config.user, PGPASSWORD: config.password, PGDATABASE: database });
  const work = `${review}/${database}`;
  const staging = `${work}/staging`, models = `${work}/models`, bundles = `${work}/android`;
  for (const dir of [staging, models, bundles]) fs.mkdirSync(dir, { recursive: true });
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  await store.init();
  let server;
  try {
    const password = makePassword('123');
    const user = async (name, role, yard) => (await store.pool.query("INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name,shipyard_id) VALUES($1,$1,$2,$3,$4,'active',$1,$5) RETURNING *", [name, password.salt, password.passwordHash, role, yard])).rows[0];
    const admin = await user('qa-build-admin', 'platform_admin', null);
    const existing = (await store.adminBoats())[0];
    const owner = await user('qa-build-owner', 'shipyard_owner', existing.ownerShipyardId);
    const boat = await store.createBoat({ shipId: 'qa-pipeline', name: '自动构建验收船', ownerShipyardId: owner.shipyard_id, category: 'leisure', typeName: '钓鱼艇' }, admin.id);
    const storage = multer.diskStorage({
      destination(req, file, cb) {
        req.modelDraftId ||= crypto.randomBytes(12).toString('hex');
        const dir = path.join(staging, req.modelDraftId); fs.mkdirSync(dir, { recursive: true }); cb(null, dir);
      }, filename(req, file, cb) { cb(null, path.basename(file.originalname)); }
    });
    const app = express(); app.use(express.json());
    app.use('/FBX', express.static(models, { maxAge: '7d' }));
    app.use('/vr-content/android', express.static(bundles, { immutable: true, maxAge: '7d' }));
    installPlatformRoutes(app, store, { modelDraftUpload: multer({ storage, limits: { fileSize: 300 * 1024 * 1024, files: 1 } }), modelStagingDir: staging, modelUploadDir: models });
    app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, message: error.message }));
    server = await new Promise((resolve, reject) => { const s = app.listen(19060, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
    const session = await store.createSession(admin.id, 'web');
    const ownerSession = await store.createSession(owner.id, 'vr');
    async function request(route, { method = 'GET', body, token = session.token } = {}) {
      const headers = { Authorization: `Bearer ${token}` };
      if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
      const response = await fetch(`http://127.0.0.1:19060${route}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
      return { status: response.status, data: await response.json() };
    }
    const source = fs.readFileSync(`${root}/current/vr-content/uploads/fleet81-20260908-angling-01/model.glb`);
    const form = new FormData(); form.append('variantName', '真实内嵌贴图验收'); form.append('files', new Blob([source]), 'boat.glb');
    const staged = await request(`/api/admin/boats/${boat.id}/model-drafts`, { method: 'POST', body: form });
    assert.equal(staged.status, 201, JSON.stringify(staged.data));
    const saved = await request(`/api/admin/boats/${boat.id}/model-drafts/${staged.data.data.draftId}/confirm`, { method: 'POST', body: { variantName: '真实内嵌贴图验收' } });
    assert.equal(saved.status, 201, JSON.stringify(saved.data));
    const id = saved.data.variant.variantId;
    assert.equal((await request(`/api/admin/boats/${boat.id}/publish`, { method: 'PUT', body: { published: true } })).status, 409);
    const url = new URL(`postgresql://127.0.0.1:15433/${database}`); url.username = config.user; url.password = config.password;
    console.log('UPLOAD_PENDING_OK: real GLB saved; starting real Unity queue worker');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.resolve(__dirname, '../src/model-build-worker.js')], { stdio: 'inherit', env: {
        ...process.env, DATABASE_URL: url.href, UNITY_PATH: `${root}/unity/editors/2022.3.52f1/Editor/Unity`,
        UNITY_PROJECT_DIR: `${review}/Worker1:${review}/Worker2`, MODEL_UPLOAD_DIR: models, VR_CONTENT_DIR: bundles,
        MODEL_CACHE_PUBLIC_URL: 'http://127.0.0.1:19188'
      } });
      child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)));
    });
    const model = (await store.pool.query('SELECT * FROM v12_vr_models WHERE variant_id=$1', [id])).rows[0];
    assert.equal(model.processing_status, 'ready', model.processing_error);
    const report = JSON.parse(fs.readFileSync(`${bundles}/uploads/${id}/report.json`, 'utf8'));
    assert(report.textures > 0 && report.materials > 0 && report.renderers > 0);
    const has = async token => (await request('/api/vr/catalog', { token })).data.entries.some(entry => entry.variantId === id);
    assert(await has(session.token), 'Admin sees ready unpublished model');
    assert.equal(await has(ownerSession.token), false, 'Owner must not see unpublished model');
    const published = await request(`/api/admin/boats/${boat.id}/publish`, { method: 'PUT', body: { published: true } });
    assert.equal(published.status, 200, JSON.stringify(published.data));
    assert(await has(ownerSession.token), 'Corresponding owner sees published model');
    assert.equal((await request('/api/vr/current-model', { method: 'PUT', token: ownerSession.token, body: { variantId: id } })).status, 200);
    const state = await request('/api/vr/current-model', { token: ownerSession.token });
    assert.equal(state.status, 200); assert(state.data.data);
    fs.writeFileSync(`${work}/result.json`, JSON.stringify({ passed: true, database, boatId: boat.id, variantId: id, sha256: model.bundle_sha256, report, checks: ['upload', 'pending gate', 'Unity', 'Tencent cache hashes and HIT', 'admin preview', 'owner isolation', 'publish', 'owner VR assignment'] }, null, 2));
    console.log(`UPLOAD_BUILD_CACHE_PUBLISH_OK: ${work}/result.json`);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
