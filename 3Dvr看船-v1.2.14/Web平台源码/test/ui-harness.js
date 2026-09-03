const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');
const { installPlatformRoutes } = require('../src/platform-routes');
const { makePassword } = require('../src/security');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-ui-harness-'));
  const stagingDir = path.join(testRoot, 'staging');
  const permanentDir = path.join(testRoot, 'models');
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(permanentDir, { recursive: true });
  const store = new PlatformStore(rootDir);
  await store.init();
  const credentials = makePassword('QaAdmin123!');
  const admin = (await store.pool.query(
    `INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name)
     VALUES('qa_ui_admin','qa_ui_admin',$1,$2,'platform_admin','active','网页验收管理员') RETURNING *`,
    [credentials.salt, credentials.passwordHash]
  )).rows[0];
  const session = await store.createSession(admin.id);
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
  app.use(express.json());
  app.get('/__qa_login', (req, res) => {
    res.cookie('ship_session', session.token, { httpOnly: true, sameSite: 'lax', path: '/' });
    const user = JSON.stringify({ username: admin.username, displayName: admin.display_name, role: 'platform_admin' }).replace(/</g, '\\u003c');
    res.type('html').send(`<script>localStorage.setItem('auth_user',JSON.stringify(${user}));location.replace('/members.html')</script>`);
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
