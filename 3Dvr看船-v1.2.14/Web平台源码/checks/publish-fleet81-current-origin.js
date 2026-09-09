const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');

const BATCH = 'fleet81-20260908';
const root = path.resolve(__dirname, '..');
const batchRoot = process.env.FLEET81_BATCH_ROOT || '/home/cqypxl/ship-platform-api-6060/model-batches/fleet81-20260908/output';
const assetRoot = process.env.FLEET81_ASSET_ROOT || path.join(root, 'FBX', 'uploads');
const vrRoot = process.env.FLEET81_VR_ROOT || path.join(root, 'vr-content', 'uploads');

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function groupByBoat(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.boatId)) groups.set(item.boatId, []);
    groups.get(item.boatId).push(item);
  }
  return [...groups].map(([boatId, variants]) => {
    variants.sort((a, b) => a.id.localeCompare(b.id));
    assert.strictEqual(variants.length, 3, `${boatId} 不是 3 套版本`);
    return { boatId, base: variants[0], variants };
  });
}

function optionList(items) {
  return (items || []).map(item => ({
    id: item.id,
    name: item.label,
    description: item.description,
    priceDeltaYuan: Math.round(Number(item.priceYuan) || 0),
    accessories: []
  }));
}

function configTabs(base, variants, categoryName, typeName) {
  return [
    { id: 'overview', label: '船型', kind: 'overview', cameraMode: 'exterior', description: base.detailedDescription || base.description, options: [] },
    { id: 'appearance', label: '外观', kind: 'color', cameraMode: 'exterior', description: `${base.hullMaterialText || ''}；选择船体涂装。`, options: [
      { id: 'paint-original', name: base.exteriorColorLabel || '原船涂装', description: '当前模型标准船体颜色', color: base.colors?.hull || '#244B63', priceDeltaYuan: 0 },
      { id: 'paint-navy', name: '深海蓝涂装', description: '船体深蓝色涂装', color: '#24465D', priceDeltaYuan: Math.round((base.basePriceYuan || 0) * 0.004 / 1000) * 1000 },
      { id: 'paint-silver', name: '银灰涂装', description: '船体银灰色涂装', color: '#AEB9BE', priceDeltaYuan: Math.round((base.basePriceYuan || 0) * 0.003 / 1000) * 1000 }
    ] },
    { id: 'exterior-equipment', label: '甲板配置', kind: 'accessory', cameraMode: 'exterior', description: '按船型用途选择甲板设备。', options: optionList(base.exteriorOptions) },
    { id: 'interior', label: base.subtype === 'unmanned' ? '设备舱' : '内饰', kind: 'model', cameraMode: 'interior', description: '同一船型的三套内饰风格与布局。', options: variants.map(item => ({
      id: `interior-${item.id}`,
      name: item.variantLabel || item.style,
      description: item.interior_notes || (item.spaces || []).join('、'),
      modelVariantId: `${BATCH}-${item.id}-interior`,
      priceDeltaYuan: Math.round(Number(item.variantPriceDeltaYuan) || 0),
      imageUrl: `/FBX/uploads/${BATCH}-${item.id}/interior.jpg`,
      entryView: { mode: 'interior', ...(item.viewSettings?.interior || {}) }
    })) },
    { id: 'power', label: '动力', kind: 'config', cameraMode: 'exterior', description: base.propulsion || '', options: optionList(base.powerOptions) },
    { id: 'smart', label: '智能', kind: 'accessory', cameraMode: 'exterior', description: '航行、通信及监测配置。', options: optionList(base.smartOptions) }
  ].map((tab, sortOrder) => ({ ...tab, sortOrder }));
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(batchRoot, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.boats.length, 81);
  const plan = JSON.parse(fs.readFileSync(path.join(batchRoot, 'publish-plan.json'), 'utf8'));
  const planByBoat = new Map(plan.map(item => [item.id, item]));
  const store = new PlatformStore(root);
  await store.init();
  assert.strictEqual(store.usingMemory, false, '必须连接真实 PostgreSQL');
  const admin = (await store.pool.query("SELECT id FROM v12_users WHERE role='platform_admin' ORDER BY id LIMIT 1")).rows[0];
  assert.ok(admin, '缺少管理员账号');
  const categories = await store.boatCategories();
  const groups = groupByBoat(manifest.boats);
  assert.strictEqual(groups.length, 27);

  let boatCount = 0;
  let variantCount = 0;
  for (const group of groups) {
    const base = group.base;
    const category = categories.find(item => item.name === base.category || item.id === base.category);
    assert.ok(category, `未知大类 ${base.category}`);
    const subtype = category.children.find(item => item.name === base.subcategory || item.id === base.subtype);
    assert.ok(subtype, `未知小类 ${base.subcategory}`);
    const owner = planByBoat.get(group.boatId);
    assert.ok(owner, `缺少分配计划 ${group.boatId}`);

    for (const item of group.variants) {
      const targetDir = path.join(assetRoot, `${BATCH}-${item.id}`);
      const targetVrDir = path.join(vrRoot, `${BATCH}-${item.id}`);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.mkdirSync(targetVrDir, { recursive: true });
      for (const [source, name] of [[item.model_file, 'model.glb'], [item.thumbnail_file, 'exterior.jpg'], [item.interior_file, 'interior.jpg']]) {
        fs.copyFileSync(path.join(batchRoot, source), path.join(targetDir, name));
      }
      fs.copyFileSync(path.join(batchRoot, item.model_file), path.join(targetVrDir, 'model.glb'));
    }

    const shipId = `${BATCH}-${group.boatId}`;
    const data = {
      shipId,
      ownerShipyardId: owner.ownerShipyardId,
      name: base.name,
      category: category.id,
      categoryName: category.name,
      subtype: subtype.id,
      typeName: subtype.name,
      length: `${Number.parseFloat(base.length)}m`,
      capacity: base.capacity,
      maxSpeed: base.maxSpeed,
      basePriceYuan: base.basePriceYuan,
      description: `${base.detailedDescription || base.description}\n船体材质：${base.hullMaterialText || ''}。推进配置：${base.propulsion || ''}。船宽${base.beam || ''}m，参数为设计值，价格为估算参考。`,
      features: [...new Set([...(base.features || []), base.hullMaterialText, base.propulsion].filter(Boolean))],
      image: `/FBX/uploads/${BATCH}-${base.id}/exterior.jpg`,
      sceneImage: `/FBX/uploads/${BATCH}-${base.id}/exterior.jpg`,
      customizable: true,
      published: true,
      configTabs: configTabs(base, group.variants, category.name, subtype.name)
    };
    const existing = (await store.pool.query('SELECT id FROM v12_boats WHERE ship_id=$1', [shipId])).rows[0];
    const boat = existing ? await store.updateBoat(existing.id, data, admin.id) : await store.createBoat(data, admin.id);

    for (const item of group.variants) {
      const variantId = `${BATCH}-${item.id}-interior`;
      const url = `/FBX/uploads/${BATCH}-${item.id}`;
      if (!boat.variants.some(variant => variant.variantId === variantId)) {
        await store.addBoatVariant(boat.id, {
          variantId,
          variantName: item.variantLabel || item.style,
          modelFiles: [`${url}/model.glb`],
          detailedInterior: true,
          thumbnailUrl: `${url}/exterior.jpg`,
          viewSettings: item.viewSettings,
          vrBundle: {
            assetFormat: 'glb',
            version: hash(path.join(batchRoot, item.model_file)).slice(0, 16),
            file: `uploads/${BATCH}-${item.id}/model.glb`,
            size: fs.statSync(path.join(batchRoot, item.model_file)).size,
            sha256: hash(path.join(batchRoot, item.model_file))
          }
        }, admin.id);
      }
      await store.setModelPublished(variantId, true, admin.id);
      await store.pool.query(
        `INSERT INTO v12_shipyard_model_bindings(shipyard_id,variant_id,bound_by,active)
         VALUES($1,$2,$3,TRUE) ON CONFLICT(shipyard_id,variant_id)
         DO UPDATE SET active=TRUE,bound_by=EXCLUDED.bound_by,bound_at=CURRENT_TIMESTAMP`,
        [owner.ownerShipyardId, variantId, admin.id]
      );
      variantCount++;
    }
    if (!boat.published) await store.setBoatPublished(boat.id, true, admin.id);
    boatCount++;
  }

  const verify = await store.pool.query("SELECT COUNT(*)::int AS boats, COALESCE(SUM(jsonb_array_length(variants_json::jsonb)),0)::int AS variants FROM v12_boats WHERE ship_id LIKE 'fleet81-20260908-%'");
  const vr = await store.pool.query("SELECT COUNT(*)::int AS n FROM v12_vr_models WHERE ship_id LIKE 'fleet81-20260908-%' AND is_published=TRUE AND bundle_file<>''");
  console.log(JSON.stringify({ insertedBoats: boatCount, insertedVariants: variantCount, dbBoats: verify.rows[0].boats, dbVariants: verify.rows[0].variants, publishedVrModels: vr.rows[0].n }));
  await store.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
