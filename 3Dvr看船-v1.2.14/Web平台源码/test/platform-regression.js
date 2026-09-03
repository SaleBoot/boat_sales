const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

async function scalar(store, sql, params = []) {
  const result = await store.pool.query(sql, params);
  return Number(Object.values(result.rows[0])[0]);
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const store = new PlatformStore(rootDir);
  await store.init();
  try {
    const jingsui = (await store.pool.query("SELECT id FROM v12_shipyards WHERE name='京穗船舶'")).rows[0];
    assert.ok(jingsui, '京穗船舶必须存在');
    assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_boats'), 19, '必须保留19艘船');
    assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_vr_models'), 25, '必须保留25个模型版本');
    assert.equal(await scalar(store, 'SELECT COUNT(DISTINCT ship_id) FROM v12_vr_models'), 19, '模型版本必须覆盖19个船型家族');
    assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_shipyard_model_bindings'), 25, '京穗原始模型绑定数量不能变化');
    const jingsuiUser = await store.enrichUser({ shipyard_id: jingsui.id });
    assert.equal(jingsuiUser.bound_count, 19, '25个模型版本应按19艘整船占用额度');
    assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_boats WHERE owner_shipyard_id<>$1', [jingsui.id]), 0, '原19艘船必须仍归京穗船舶');
    assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_shipyard_model_bindings WHERE shipyard_id<>$1', [jingsui.id]), 0, '不得给资料库船厂生成模型绑定');

    const demoRows = (await store.pool.query("SELECT * FROM v12_shipyards WHERE data_source='企业官网公开资料' ORDER BY id")).rows;
    assert.equal(demoRows.length, 10, '应导入10家真实船厂公开资料');
    for (const row of demoRows) {
      assert.equal(row.directory_only, false, `${row.name}必须显示在现有厂商列表`);
      assert.equal(await scalar(store, "SELECT COUNT(*) FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner'", [row.id]), 1, `${row.name}必须有且只有一个演示主账号`);
      assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_boats WHERE owner_shipyard_id=$1', [row.id]), 0, `${row.name}不得导入船型`);
      assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_vr_models WHERE owner_shipyard_id=$1', [row.id]), 0, `${row.name}不得关联模型`);
      assert.equal(await scalar(store, 'SELECT COUNT(*) FROM v12_shipyard_model_bindings WHERE shipyard_id=$1', [row.id]), 0, `${row.name}不得生成绑定`);
    }
    assert.equal((await store.shipyards()).filter(item => item.data_source === '企业官网公开资料').length, 10, '10家资料厂商必须直接进入现有厂商会员列表');
    const membersHtml = fs.readFileSync(path.join(rootDir, 'public', 'members.html'), 'utf8');
    assert.equal(membersHtml.includes('厂家资料库'), false, '公开船厂资料不得新增后台菜单或独立页面');
    assert.ok(membersHtml.includes('data-nav="categories"'), '系统设置必须恢复船型分类入口');
    assert.ok(membersHtml.includes('id="fieldManageWrap"'), '船型分类管理面板必须存在');
    const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
    assert.ok(/id="modelFile"[^>]*multiple/.test(adminHtml), '模型上传必须支持主模型和外部贴图多文件选择');
    assert.ok(adminHtml.includes('id="modelPreviewOverlay"'), '上传模型后必须进入3D预览确认');
    assert.ok(adminHtml.includes('for="modelFile"'), '模型上传必须使用可直接唤起文件选择器的原生标签');
    assert.ok(!adminHtml.includes('id="viewVariantList"'), '定制配置中不得增加独立的视角模块');
    assert.strictEqual((adminHtml.match(/data-editor-panel=/g) || []).length, 3, '船型编辑器必须分为基本资料、3D模型和定制配置三步');
    const adminJs = fs.readFileSync(path.join(rootDir, 'public', 'js', 'admin.js'), 'utf8');
    const adminCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'admin-v2.css'), 'utf8');
    assert.ok(adminJs.includes('data-action="option-view"'), '每个选配必须直接提供切入视角编辑入口');
    assert.ok(adminJs.includes("element.hidden = preview.kind === 'draft'"), '上传预览阶段不得重复显示视角编辑控件');
    assert.ok(adminJs.includes('ensureBoatSavedForUpload'), '新增船型选择模型后必须自动保存必要基本资料');
    assert.ok(!adminJs.includes("uploadModelBtn').disabled = !boat"), '新增船型的模型上传入口不能被禁用');
    assert.ok(adminJs.includes('type="color"'), '颜色配置必须提供直观调色盘');
    assert.ok(adminCss.includes('grid-template-rows:auto minmax(0,1fr) auto'), '视角弹窗必须固定头部、可伸缩内容区和底部按钮栏');
    assert.ok(!adminCss.includes('.model-preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;min-height:620px'), '视角弹窗不得使用导致按钮溢出的固定内容高度');
    assert.ok(adminJs.includes('data-color-preset'), '颜色配置必须提供常用颜色色块');
    assert.ok(!adminJs.includes('placeholder="#FFFFFF"'), '不得要求管理员手工输入16进制颜色');
    const sceneJs = fs.readFileSync(path.join(rootDir, 'public', 'js', 'Scene.js'), 'utf8');
    ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].forEach(code => assert.ok(sceneJs.includes(code), `第一人称视角必须支持${code}`));
    const detailJs = fs.readFileSync(path.join(rootDir, 'public', 'js', 'detail.js'), 'utf8');
    assert.ok(detailJs.includes('applyOptionEntryView'), '访客选择选配后必须应用该选配切入视角');
    assert.ok(detailJs.includes('customerName'), '提交定制方案时必须采集客户姓名');
    assert.ok(adminHtml.includes('data-panel="bindings"'), '会员升级申请后必须提供船型绑定审核入口');
    assert.ok(adminJs.includes('导出PDF'), '定制订单必须提供PDF导出');
    const serverSource = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    assert.equal(serverSource.includes("app.get('/api/manufacturers'"), false, '不得保留硬编码厂家资料接口');

    const boats = await store.boats();
    assert.equal(boats.length, 19);
    assert.ok(boats.every(item => item.basePriceYuan > 0), '19艘船必须都有模拟基础价');
    assert.ok(boats.some(item => item.configTabs.flatMap(tab => tab.options).some(option => option.priceDeltaYuan > 0)), '应存在有价选配');
    assert.equal(boats.find(item => item.shipId === 'barge40').configTabs.some(tab => tab.id === 'power'), false, '固定趸船不应显示动力选配');

    const modern = boats.find(item => item.shipId === 'js950');
    const saved = await store.saveCustomization({
      boatId: modern.id,
      variantId: 'forged-variant',
      selections: {
        appearance: { optionId: 'ocean-silver', priceDeltaYuan: -999999999 },
        interior: { optionId: 'interior-js950-modern-b', priceDeltaYuan: 1 },
        power: { optionId: 'power-enhanced', priceDeltaYuan: 1 }
      }
    });
    assert.equal(saved.basePriceYuan, 2280000);
    assert.equal(saved.optionPriceYuan, 380000);
    assert.equal(saved.totalPriceYuan, 2660000, '后端应按数据库选项重新计价，忽略客户端篡改价格');
    assert.equal((await store.customizations())[0].totalPriceYuan, 2660000, '订单价格快照必须持久化并可查询');

    const demoShipyard = demoRows[0];
    const demoOwner = (await store.pool.query("SELECT * FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner'", [demoShipyard.id])).rows[0];
    const allVariants = (await store.pool.query('SELECT ship_id,variant_id FROM v12_vr_models ORDER BY ship_id,variant_id')).rows;
    const groupedVariants = allVariants.reduce((map, row) => map.set(row.ship_id, [...(map.get(row.ship_id) || []), row.variant_id]), new Map());
    const multiVersionEntry = Array.from(groupedVariants.entries()).find(([, variants]) => variants.length > 1);
    const multiVersion = multiVersionEntry && { ship_id: multiVersionEntry[0], variants: multiVersionEntry[1] };
    assert.ok(multiVersion && multiVersion.variants.length > 1, '测试数据必须包含同船多模型版本');
    for (const variantId of multiVersion.variants.slice(0, 2)) {
      const request = await store.requestBinding(demoOwner, variantId, '同船多版本额度回归测试');
      await store.decideBinding(request.id, true, '通过', demoOwner.id);
    }
    const enrichedDemo = await store.enrichUser(demoOwner);
    assert.equal(enrichedDemo.bound_count, 1, '同一艘船绑定多个模型版本只能扣1个额度');
    const boundBoat = (await store.adminBoats()).find(item => item.shipId === multiVersion.ship_id);
    assert.ok(boundBoat.boundShipyardIds.includes(Number(demoShipyard.id)), '跨厂绑定船型必须出现在申请厂家的目录关系中');
    await assert.rejects(
      store.saveCustomization({ boatId: modern.id, selections: { appearance: { optionId: 'not-an-option' } } }),
      error => error && error.status === 400
    );

    const directoryId = demoRows[0].id;
    const logo = await store.updateShipyardLogo(directoryId, '/uploads/test-logo.webp', null);
    assert.equal(logo.logoUrl, '/uploads/test-logo.webp');

    const qaShipyard = await store.createShipyard({ name: '回归测试船厂', planCode: 'free' }, null);
    const qaCategory = await store.createBoatCategory({ name: '回归测试大类' }, null);
    const qaSubcategory = await store.createBoatSubcategory(qaCategory.id, { name: '回归测试小类' }, null);
    assert.ok((await store.boatCategories()).some(item => item.id === qaCategory.id && item.children.some(child => child.id === qaSubcategory.id)));
    await store.updateBoatCategory(qaCategory.id, { name: '回归测试大类-已改名' }, null);
    await store.updateBoatSubcategory(qaCategory.id, qaSubcategory.id, { name: '回归测试小类-已改名' }, null);
    const qaBoat = await store.createBoat({ ownerShipyardId: qaShipyard.id, shipId: 'qa-boat', name: '回归测试船', category: qaCategory.id, categoryName: '回归测试大类-已改名', subtype: qaSubcategory.id, typeName: '回归测试小类-已改名', basePriceYuan: 100000 }, null);
    assert.equal(qaBoat.basePriceYuan, 100000);
    await assert.rejects(store.deleteBoatSubcategory(qaCategory.id, qaSubcategory.id, null), error => error && error.status === 409);
    await assert.rejects(store.deleteBoatCategory(qaCategory.id, null), error => error && error.status === 409);
    const updated = await store.updateBoat(qaBoat.id, { name: '回归测试船-已更新', basePriceYuan: 120000 }, null);
    assert.equal(updated.name, '回归测试船-已更新');
    assert.equal(updated.basePriceYuan, 120000);
    assert.equal((await store.archiveBoat(qaBoat.id, true, null)).archived, true);
    assert.equal((await store.archiveBoat(qaBoat.id, false, null)).archived, false);
    const withVariant = await store.addBoatVariant(qaBoat.id, {
      variantId: 'qa-variant', variantName: '回归模型', modelFiles: ['/FBX/qa.glb'], detailedInterior: true,
      viewSettings: { bowDirection: '+x', exterior: null, interior: { position: [0, .1, 0], target: [1, .1, 0], near: .005 } }
    }, null);
    assert.equal(withVariant.variants.length, 1);
    const viewUpdated = await store.updateBoatVariant(qaBoat.id, 'qa-variant', {
      viewSettings: { bowDirection: '-x', exterior: { position: [2, 1, 2], target: [0, 0, 0], near: .01 }, interior: { position: [0, .1, 0], target: [-1, .1, 0], near: .003 } }
    }, null);
    assert.equal(viewUpdated.variants[0].viewSettings.bowDirection, '-x');
    const entryUpdated = await store.updateBoat(qaBoat.id, { configTabs: [{
      id: 'qa-config', label: '测试配置', kind: 'model', cameraMode: 'interior', options: [{
        id: 'qa-option', name: '测试选配', modelVariantId: 'qa-variant',
        entryView: { mode: 'interior', position: [1, 2, 3], target: [4, 2, 3], near: .004 }
      }]
    }] }, null);
    assert.deepEqual(entryUpdated.configTabs[0].options[0].entryView, { mode: 'interior', position: [1, 2, 3], target: [4, 2, 3], near: .004 });
    await store.updateBoat(qaBoat.id, { category: 'commercial', categoryName: '商用船', subtype: 'workboat', typeName: '工作船' }, null);
    await store.deleteBoatSubcategory(qaCategory.id, qaSubcategory.id, null);
    await store.deleteBoatCategory(qaCategory.id, null);

    assert.equal(await scalar(store, "SELECT COUNT(*) FROM v12_vr_models WHERE ship_id<>'qa-boat'"), 25, '业务CRUD不得改变原25个模型');
    console.log('platform-regression: ok (19 boats, 25 models, categories, model views, pricing and 10 visible demo vendors)');
  } finally {
    await store.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
