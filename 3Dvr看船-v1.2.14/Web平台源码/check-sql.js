const { PlatformStore } = require('./src/platform-store.js');
(async () => {
  const store = new PlatformStore(__dirname);
  await store.init();
  console.log("Testing SQL: SELECT COUNT(DISTINCT m.ship_id) FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id WHERE b.shipyard_id=1 AND b.active=TRUE");
  try {
    const r = await store.pool.query("SELECT COUNT(DISTINCT m.ship_id) AS count FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id WHERE b.shipyard_id=$1 AND b.active=TRUE", [1]);
    console.log("Result:", r.rows[0]);
  } catch (e) {
    console.log("SQL ERR:", e.message);
  }
  console.log("\nCheck v12_vr_models columns:");
  try {
    const cols = await store.pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='v12_vr_models'");
    cols.rows.forEach(r => console.log("  ", r.column_name));
  } catch (e) { console.log("cols ERR:", e.message); }
  await store.close();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
