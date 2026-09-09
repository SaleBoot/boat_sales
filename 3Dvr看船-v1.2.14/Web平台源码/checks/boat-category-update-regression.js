const assert = require('assert');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

(async () => {
  const store = new PlatformStore(path.resolve(__dirname, '..'));
  await store.init();
  const boat = (await store.boats())[0];
  const categories = await store.boatCategories();
  const category = categories.find(item => item.id !== boat.category) || categories[0];
  const subtype = category.children[0];
  const updated = await store.updateBoat(boat.id, {
    category: category.id,
    categoryName: category.name,
    subtype: subtype.id,
    typeName: subtype.name
  }, null);

  assert.strictEqual(updated.category, category.id);
  assert.strictEqual(updated.categoryName, category.name);
  assert.strictEqual(updated.subtype, subtype.id);
  assert.strictEqual(updated.typeName, subtype.name);
  await store.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
