const assert = require('assert/strict');
const express = require('express');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');
const { installPlatformRoutes } = require('../src/platform-routes');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const store = new PlatformStore(rootDir);
  await store.init();
  let server;
  try {
    const app = express();
    app.use(express.json());
    installPlatformRoutes(app, store);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, message: error.message }));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const page = await fetch(`${baseUrl}/twin/?boat=js950`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /数字孪生/);
    assert.doesNotMatch(await (await fetch(`${baseUrl}/twin/twin.js`)).text(), /throw new Error\('未登录'\)/);

    const save = await fetch(`${baseUrl}/api/boats/1/twin-config`, { method: 'PUT' });
    assert.equal(save.status, 401);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await store.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
