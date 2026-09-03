const assert = require('assert/strict');
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
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-model-upload-'));
  const stagingDir = path.join(testRoot, 'staging');
  const permanentDir = path.join(testRoot, 'models');
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(permanentDir, { recursive: true });
  const store = new PlatformStore(rootDir);
  await store.init();
  let server;
  try {
    const credentials = makePassword('QaAdmin123!');
    const admin = (await store.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,display_name)
       VALUES('qa_model_admin','qa_model_admin',$1,$2,'platform_admin','active','模型回归管理员') RETURNING *`,
      [credentials.salt, credentials.passwordHash]
    )).rows[0];
    const session = await store.createSession(admin.id);
    const storage = multer.diskStorage({
      destination: (req, file, callback) => {
        if (!req.modelDraftId) req.modelDraftId = crypto.randomBytes(12).toString('hex');
        const directory = path.join(stagingDir, req.modelDraftId);
        fs.mkdirSync(directory, { recursive: true });
        callback(null, directory);
      },
      filename: (req, file, callback) => callback(null, path.basename(file.originalname))
    });
    const draftUpload = multer({ storage, limits: { fileSize: 1024 * 1024, files: 10 } });
    const app = express();
    app.use(express.json());
    installPlatformRoutes(app, store, { modelDraftUpload: draftUpload, modelStagingDir: stagingDir, modelUploadDir: permanentDir });
    app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, message: error.message }));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const headers = { Authorization: `Bearer ${session.token}` };
    const boats = await store.adminBoats();
    const boat = boats[0];
    const initialVariantCount = boat.variants.length;
    const initialModelCount = Number((await store.pool.query('SELECT COUNT(*) AS count FROM v12_vr_models')).rows[0].count);

    const form = new FormData();
    form.append('variantName', '暂存预览回归模型');
    form.append('files', new Blob([Buffer.from('0123456789')]), 'qa-model.glb');
    const stagedResponse = await fetch(`${baseUrl}/api/admin/boats/${boat.id}/model-drafts`, { method: 'POST', headers, body: form });
    const staged = await stagedResponse.json();
    assert.equal(stagedResponse.status, 201);
    assert.equal(staged.success, true);
    assert.equal(Number((await store.pool.query('SELECT COUNT(*) AS count FROM v12_vr_models')).rows[0].count), initialModelCount, '暂存阶段不得写入模型数据库');

    const previewResponse = await fetch(`${baseUrl}${staged.data.modelUrl}`, { headers });
    assert.equal(previewResponse.status, 200, '管理员必须能读取暂存模型进行预览');
    assert.equal((await previewResponse.arrayBuffer()).byteLength, 10);

    const confirmedResponse = await fetch(`${baseUrl}/api/admin/boats/${boat.id}/model-drafts/${staged.data.draftId}/confirm`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantName: '已确认回归模型', detailedInterior: true,
        viewSettings: { bowDirection: '+x', exterior: { position: [2, 1, 2], target: [0, 0, 0], near: .01 }, interior: { position: [0, .1, 0], target: [1, .1, 0], near: .003 } }
      })
    });
    const confirmed = await confirmedResponse.json();
    assert.equal(confirmedResponse.status, 201);
    assert.equal(confirmed.success, true);
    assert.equal(confirmed.data.variants.length, initialVariantCount + 1, '确认后模型版本必须写入船型');
    assert.equal(confirmed.variant.viewSettings.bowDirection, '+x');
    assert.equal(Number((await store.pool.query('SELECT COUNT(*) AS count FROM v12_vr_models')).rows[0].count), initialModelCount + 1, '确认后模型索引必须入库');
    assert.ok(fs.existsSync(path.join(permanentDir, 'uploads', confirmed.variant.variantId, 'qa-model.glb')), '确认后的模型文件必须移入正式目录');

    const editedResponse = await fetch(`${baseUrl}/api/admin/boats/${boat.id}/variants/${confirmed.variant.variantId}`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewSettings: { ...confirmed.variant.viewSettings, bowDirection: '-x' } })
    });
    const edited = await editedResponse.json();
    assert.equal(editedResponse.status, 200);
    assert.equal(edited.data.variants.find(item => item.variantId === confirmed.variant.variantId).viewSettings.bowDirection, '-x');
    console.log('model-upload-regression: ok (stage, preview, confirm, persist, viewpoint update)');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
