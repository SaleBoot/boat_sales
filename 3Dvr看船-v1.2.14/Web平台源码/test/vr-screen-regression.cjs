const assert = require('node:assert/strict');
const express = require('express');
const install = require('../src/vr-screen');
(async () => {
  process.env.LIVEKIT_API_KEY = 'qa-key';
  process.env.LIVEKIT_API_SECRET = 'qa-only-secret-not-valid-on-production-12345';
  process.env.SHIPVR_LIVEKIT_URL = 'wss://qa.invalid';
  process.env.SHIPVR_ROOM_PREFIX = 'shipvr-isolated-test-';
  const app = express(); app.use(express.json());
  install(app, (req, res, next) => {
    const id = req.headers.authorization === 'Bearer qa' ? 7 : req.headers.cookie === 'qa=viewer' ? 7 : req.headers.cookie === 'qa=other' ? 8 : null;
    if (!id) return res.sendStatus(401);
    req.platformUser = { id }; next();
  });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/vr/screen`;
    const post = (route, headers, body = {}) => fetch(url + route, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await fetch(url + '/status')).status, 401);
    assert.equal((await post('/connect', { Authorization: 'Bearer qa' }, { role: 'publisher' })).status, 409);
    await fetch(url + '/status?stage=ready&version=qa', { headers: { Authorization: 'Bearer qa' } });
    const watch = await post('/watch', { Cookie: 'qa=viewer' });
    assert.equal((await watch.json()).online, true);
    assert.equal((await (await post('/watch', { Cookie: 'qa=other' })).json()).online, false);
    assert.equal((await post('/connect', { Cookie: 'qa=viewer' }, { role: 'publisher' })).status, 403);
    for (const role of ['viewer', 'publisher']) {
      const res = await post('/connect', role === 'viewer' ? { Cookie: 'qa=viewer' } : { Authorization: 'Bearer qa' }, { role });
      assert.equal(res.status, 200);
      const payload = JSON.parse(Buffer.from((await res.json()).token.split('.')[1], 'base64url'));
      assert.equal(payload.video.room, 'shipvr-isolated-test-7');
      assert.equal(payload.video.canPublish, role === 'publisher');
      assert.equal(payload.video.canSubscribe, role === 'viewer');
    }
    console.log('PASS: relay authentication, viewer/publisher separation, account isolation and QA room namespace');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
