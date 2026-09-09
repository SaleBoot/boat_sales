const assert = require('assert');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  await store.init();
  const boat = (await store.boats())[0];
  const shipyards = await store.shipyards({ includeDirectory: true });
  const other = shipyards.find(item => Number(item.id) !== Number(boat.ownerShipyardId));
  assert.ok(boat && other, '需要至少一条船型和两个厂家');

  const variantId = `check_unbind_${Date.now()}`;
  await store.addBoatVariant(boat.id, {
    variantId,
    variantName: '解绑检查模型',
    modelFiles: [`/FBX/uploads/${variantId}/model.glb`],
    vrBundle: {
      assetFormat: 'glb',
      version: '1234567890abcdef',
      file: `uploads/${variantId}/model.glb`,
      size: 12,
      sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    }
  }, null);
  await store.pool.query(
    `INSERT INTO v12_shipyard_model_bindings(shipyard_id,variant_id,active)
     VALUES($1,$2,TRUE) ON CONFLICT(shipyard_id,variant_id) DO UPDATE SET active=TRUE`,
    [other.id, variantId]
  );

  assert.strictEqual(await store.unbindShipyardBoat(other.id, boat.id, null), 1);
  const active = await store.pool.query(
    'SELECT 1 FROM v12_shipyard_model_bindings WHERE shipyard_id=$1 AND variant_id=$2 AND active=TRUE',
    [other.id, variantId]
  );
  assert.strictEqual(active.rowCount, 0);
  const logs = await store.pool.query(
    'SELECT 1 FROM v12_shipyard_model_unbind_logs WHERE shipyard_id=$1 AND variant_id=$2',
    [other.id, variantId]
  );
  assert.strictEqual(logs.rowCount, 1);
  assert.ok(await store.boat(boat.id));
  await store.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
