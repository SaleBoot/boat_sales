const { PlatformStore } = require('./src/platform-store.js');
(async () => {
  const store = new PlatformStore(__dirname);
  await store.init();
  const user = await store.findUserByName('13110297890');
  console.log('findUserByName:', user ? JSON.stringify({ id: user.id, username: user.username, key: user.username_key, role: user.role, status: user.status, shipyard_id: user.shipyard_id, shipyard_name: user.shipyard_name }) : 'NOT FOUND');
  const auth = await store.authenticate('13110297890', 'epkwwjx4');
  console.log('authenticate:', auth ? 'SUCCESS' : 'FAILED');
  const all = await store.pool.query('SELECT id, username, username_key, role, status FROM v12_users ORDER BY id');
  console.log('All users:');
  all.rows.forEach(r => console.log('  id=' + r.id + ' username=' + r.username + ' key=' + r.username_key + ' role=' + r.role + ' status=' + r.status));
  await store.close();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
