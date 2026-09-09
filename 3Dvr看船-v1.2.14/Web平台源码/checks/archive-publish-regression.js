const assert = require('assert');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  await store.init();
  const boat = (await store.boats())[0];
  const unpublished = await store.setBoatPublished(boat.id, false, null);
  assert.strictEqual(unpublished.published, false);

  await store.archiveBoat(boat.id, true, null);
  await store.pool.query('UPDATE v12_boats SET archived_at=$2 WHERE id=$1', [boat.id, new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)]);
  const deleted = await store.purgeArchivedBoats({ olderThanDays: 7 });
  assert.strictEqual(deleted, 1);
  assert.strictEqual(await store.boat(boat.id), null);
  await store.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
