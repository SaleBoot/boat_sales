const { PlatformStore } = require('./src/platform-store.js');
(async () => {
  const store = new PlatformStore(__dirname);
  await store.init();
  const user = await store.findUserByName('13110297890');
  console.log('user:', user ? user.username + ' shipyard=' + user.shipyard_id : 'NOT FOUND');
  console.log('\nTest publicModels SQL...');
  try {
    const models = await store.publicModels(user);
    console.log('models count:', models.length);
    if (models.length > 0) console.log('first model:', JSON.stringify(models[0]).substring(0, 200));
  } catch (e) {
    console.log('publicModels ERR:', e.message);
    console.log('stack:', e.stack);
  }
  await store.close();
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
