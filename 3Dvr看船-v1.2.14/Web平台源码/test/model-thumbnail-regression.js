const assert = require('assert/strict');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

async function main() {
  assert.ok(!process.env.DATABASE_URL && !process.env.PGHOST, 'Run against the in-memory database only');
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  try {
    await store.init();
    const shipyard = await store.createShipyard({ name: '图片回归船厂', planCode: 'free' }, null);
    const boat = await store.createBoat({ ownerShipyardId: shipyard.id, shipId: 'qa-image', name: '图片回归船' }, null);
    await store.addBoatVariant(boat.id, { variantId: 'qa-image', modelFiles: ['/FBX/qa.glb'] }, null);
    await store.setModelPublished('qa-image', true, null);
    const thumbnail = async user => (await store.publicModels(user)).find(model => model.variantId === 'qa-image').thumbnailUrl;
    assert.equal(await thumbnail(null), '');
    await store.updateBoatImage(boat.id, '/uploads/cover.png', null);
    for (const user of [null, { role: 'shipyard_owner', shipyard_id: shipyard.id }, { role: 'sales', shipyard_id: 1 }, { role: 'platform_admin' }]) {
      assert.equal(await thumbnail(user), '/uploads/cover.png', '后补封面必须对所有账号生效');
    }
    await store.updateBoat(boat.id, { sceneImage: '/uploads/scene.png' }, null);
    assert.equal(await thumbnail(null), '/uploads/scene.png');
    await store.updateBoat(boat.id, { sceneImage: '/uploads/new-scene.png' }, null);
    assert.equal(await thumbnail(null), '/uploads/new-scene.png', '修改图片必须立即生效');
    await store.pool.query('UPDATE v12_vr_models SET thumbnail_url=$1 WHERE variant_id=$2', ['/uploads/variant.png', 'qa-image']);
    assert.equal(await thumbnail(null), '/uploads/variant.png', '保留版本缩略图优先级');
    console.log('Model thumbnail regression passed');
  } finally {
    await store.pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
