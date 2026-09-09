const assert = require('node:assert/strict');
const express = require('express');
const { rateLimit } = require('../src/rate-limit');

(async () => {
  for (const trusted of [false, 'loopback']) {
    const app = express();
    app.set('trust proxy', trusted);
    app.get('/', rateLimit({ max: 2 }), (req, res) => res.sendStatus(200));
    const server = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
      const url = `http://127.0.0.1:${server.address().port}/`;
      for (let i = 0; i < 3; i++) {
        // The proxy appends the actual client to any attacker-supplied chain.
        const response = await fetch(url, { headers: {
          'X-Real-IP': `198.51.100.${i}`,
          'X-Forwarded-For': `198.51.100.${i}, 203.0.113.7`
        }});
        assert.equal(response.status, i < 2 ? 200 : 429);
        if (i === 2) assert.ok(Number(response.headers.get('Retry-After')) > 0);
        await response.text();
      }
      if (trusted) {
        const response = await fetch(url, { headers: { 'X-Forwarded-For': '203.0.113.8' } });
        assert.equal(response.status, 200, 'distinct clients retain distinct quotas');
        await response.text();
      }
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
  console.log('PASS: forged IP headers cannot reset quotas; trusted proxy clients remain isolated');
})().catch(error => { console.error(error); process.exitCode = 1; });
