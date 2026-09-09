const assert = require('assert');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  await store.init();
  const boat = (await store.boats())[0];
  const variantId = `check_vr_bundle_${Date.now()}`;
  await store.addBoatVariant(boat.id, {
    variantId,
    variantName: '自动VR资源检查',
    modelFiles: [`/FBX/uploads/${variantId}/model.glb`],
    vrBundle: {
      assetFormat: 'glb',
      version: '1234567890abcdef',
      file: `uploads/${variantId}/model.glb`,
      size: 12,
      sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    }
  }, null);
  const model = (await store.pool.query('SELECT * FROM v12_vr_models WHERE variant_id=$1', [variantId])).rows[0];
  assert.strictEqual(model.is_published, true);
  assert.strictEqual(model.asset_format, 'glb');
  assert.strictEqual(model.bundle_file, `uploads/${variantId}/model.glb`);
  assert.strictEqual(model.bundle_size, 12);
  const binding = await store.pool.query(
    'SELECT 1 FROM v12_shipyard_model_bindings WHERE shipyard_id=$1 AND variant_id=$2 AND active=TRUE',
    [boat.ownerShipyardId, variantId]
  );
  assert.strictEqual(binding.rowCount, 1);
  await store.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
