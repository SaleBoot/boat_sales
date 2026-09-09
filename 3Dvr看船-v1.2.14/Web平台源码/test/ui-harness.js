const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const http = require('node:http');
const { PlatformStore } = require('../src/platform-store');
const { installPlatformRoutes } = require('../src/platform-routes');
const { makePassword } = require('../src/security');

async function main() {
  if (process.env.DATABASE_URL || process.env.PGHOST) throw new Error('UI harness requires an isolated memory database');
  const rootDir = path.resolve(__dirname, '..');
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-ui-harness-'));
  const stagingDir = path.join(testRoot, 'staging');
  const permanentDir = path.join(testRoot, 'models');
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(permanentDir, { recursive: true });
  const store = new PlatformStore(rootDir);
  await store.init();
  const credentials = makePassword('123');
  const admin = (await store.pool.query(
    `INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name)
     VALUES('123','123',$1,$2,'platform_admin','active','网页验收管理员') RETURNING *`,
    [credentials.salt, credentials.passwordHash]
  )).rows[0];
  const bundleFile = process.env.QA_VR_BUNDLE;
  let bundleName;
  if (bundleFile) {
    const bundle = fs.readFileSync(bundleFile);
    if (bundle.subarray(0, 7).toString() !== 'UnityFS') throw new Error('Invalid QA bundle');
    const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
    bundleName = `${sha256}.bundle`;
    const boat = await store.createBoat({ shipId: 'qa-angling', name: '海钓8（隔离测试）', ownerShipyardId: 1,
      category: 'leisure', categoryName: '民用休闲', typeName: '钓鱼艇', length: '8.5m' }, admin.id);
    await store.addBoatVariant(boat.id, {
      variantId: 'qa-angling-unpublished', variantName: '新增船型贴图测试', modelFiles: ['/FBX/qa-model.glb'],
      vrBundle: { file: bundleName, version: sha256.slice(0, 16), sha256, size: bundle.length }
    }, admin.id);
    await store.setCurrentVrModel(admin, 'qa-angling-unpublished');
  }
  const draftStorage = multer.diskStorage({
    destination: (req, file, callback) => {
      if (!req.modelDraftId) req.modelDraftId = crypto.randomBytes(12).toString('hex');
      const directory = path.join(stagingDir, req.modelDraftId);
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (req, file, callback) => callback(null, path.basename(file.originalname))
  });
  const modelDraftUpload = multer({ storage: draftStorage, limits: { fileSize: 300 * 1024 * 1024, files: 80 } });
  const modelUpload = multer({ storage: multer.diskStorage({ destination: permanentDir, filename: (req, file, callback) => callback(null, `${Date.now()}-${path.basename(file.originalname)}`) }) });
  const app = express();
  if (process.env.QA_SCREEN_PORT) {
    const port = Number(process.env.QA_SCREEN_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid QA relay port');
    app.use('/api/vr/screen', (req, res) => {
      const upstream = http.request({ hostname: '127.0.0.1', port, path: req.originalUrl, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.setTimeout(20000, () => upstream.destroy(new Error('QA relay timeout')));
      upstream.on('error', () => { if (!res.headersSent) res.sendStatus(503); else res.destroy(); });
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
    });
  }
  if (process.env.QA_PROGRESS_DEMO === '1') {
    const began = Date.now();
    app.get('/api/admin/model-builds', (req, res) => res.json({ success: true, data: ['并行船型甲', '并行船型乙'].map((name, index) => ({
      variant_id: 'qa-progress-' + index, variant_name: '内饰版本一', ship_name: name,
      processing_status: Date.now() - began > 90000 ? 'ready' : 'building', processing_error: '', boat_id: 1
    })) }));
  }
  app.use((req, res, next) => { res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode}`)); next(); });
  app.use(express.json());
  if (bundleFile) app.get(`/vr-content/android/${bundleName}`, (req, res) => res.sendFile(path.resolve(bundleFile)));
  if (process.env.QA_VR_SOURCE) app.get('/FBX/qa-model.glb', (req, res) => res.sendFile(path.resolve(process.env.QA_VR_SOURCE)));
  app.get('/vendor/three/three.module.js', (req, res) => res.sendFile(path.join(rootDir, 'node_modules/three/build/three.module.js')));
  app.use('/vendor/three/jsm', express.static(path.join(rootDir, 'node_modules/three/examples/jsm')));
  app.get('/__qa_login', async (req, res, next) => {
    try {
    const session = await store.createSession(admin.id, 'web');
    res.cookie('ship_session', session.token, { httpOnly: true, sameSite: 'lax', path: '/' });
    const user = JSON.stringify({ username: admin.username, displayName: admin.display_name, role: 'platform_admin' }).replace(/</g, '\\u003c');
    res.type('html').send(`<script>localStorage.setItem('auth_user',JSON.stringify(${user}));location.replace('/members.html')</script>`);
    } catch (error) { next(error); }
  });
  app.use(express.static(path.join(rootDir, 'public')));
  app.use('/FBX', express.static(path.join(rootDir, 'FBX')));
  installPlatformRoutes(app, store, { modelDraftUpload, modelStagingDir: stagingDir, modelUploadDir: permanentDir, modelUpload });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, message: error.message }));
  const port = Number(process.env.QA_UI_PORT || 3211);
  const server = app.listen(port, '127.0.0.1', () => console.log(`ui-harness: http://127.0.0.1:${port}/__qa_login`));
  const shutdown = async () => {
    server.close();
    await store.close();
    fs.rmSync(testRoot, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => { console.error(error); process.exit(1); });
