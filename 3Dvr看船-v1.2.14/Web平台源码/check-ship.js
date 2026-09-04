const { PlatformStore } = require('./src/platform-store.js');
(async () => {
  const store = new PlatformStore(__dirname);
  await store.init();
  const r = await store.pool.query("SELECT s.id AS shipyard_id, s.name AS shipyard_name, u.id AS user_id, u.username, u.role FROM v12_shipyards s LEFT JOIN v12_users u ON u.shipyard_id = s.id AND u.role = 'shipyard_owner' ORDER BY s.id");
  console.log('Shipyards and their owner accounts:');
  r.rows.forEach(x => console.log('  shipyard ' + x.shipyard_id + ' (' + x.shipyard_name + ') -> user ' + (x.user_id || 'NONE') + ' ' + (x.username || '')));
  await store.close();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
