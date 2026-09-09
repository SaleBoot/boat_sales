const assert = require('assert');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  store.pool = {
    async query() {
      return { rowCount: 1, rows: [{ variant_id: 'new_model', is_published: true, boat_id: 1, has_access: true, bundle_file: '', bundle_sha256: '' }] };
    }
  };
  await assert.rejects(
    () => store.setCurrentVrModel({ id: 1, role: 'shipyard_owner', shipyard_id: 1 }, 'new_model'),
    /暂未生成可供PICO直接加载的VR资源/
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
