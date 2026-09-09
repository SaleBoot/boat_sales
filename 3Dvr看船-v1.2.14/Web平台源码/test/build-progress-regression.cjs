const assert = require('node:assert/strict');
const path = require('node:path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  assert(!process.env.DATABASE_URL && !process.env.PGHOST, 'Use isolated memory database');
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  try {
    await store.init();
    store.seedJingsuiShipyard = () => { throw new Error('Existing installation must not recreate seed vendor'); };
    // pg-mem cannot replay idempotent DDL; exercise the real initialization data path.
    const query = store.pool.query.bind(store.pool);
    store.pool.query = (sql, ...args) => /^\s*(CREATE|ALTER)/i.test(sql) ? Promise.resolve({ rows: [], rowCount: 0 }) : query(sql, ...args);
    await store.init();
    const boat = (await store.pool.query('SELECT id FROM v12_boats LIMIT 1')).rows[0];
    await assert.rejects(store.addBoatVariant(boat.id, { variantId: 'qa-missing-source', variantName: 'No source', modelFiles: [] }, null), /缺少有效文件/);
    console.log('PASS: restart does not recreate seed vendor; missing source is not a build task');
  } finally { await store.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
