const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { PlatformStore } = require('../src/platform-store');
const { makePassword } = require('../src/security');

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1';

async function request(route, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET', headers, body, redirect: 'manual'
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return {
    status: response.status,
    json,
    cookie: String(response.headers.get('set-cookie') || '').split(';')[0]
  };
}

function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: ${result.status} ${JSON.stringify(result.json)}`);
  return result.json;
}

async function counts(store) {
  const result = await store.pool.query(
    `SELECT
      (SELECT count(*) FROM v12_boats WHERE archived_at IS NULL) AS boats,
      (SELECT count(*) FROM v12_vr_models) AS models,
      (SELECT count(*) FROM v12_shipyard_model_bindings WHERE active=TRUE) AS bindings,
      (SELECT count(*) FROM v12_shipyards WHERE directory_only=TRUE) AS directories,
      (SELECT count(*) FROM v12_shipyards WHERE data_source='企业官网公开资料') AS demo_vendors`
  );
  const row = result.rows[0];
  return [row.boats, row.models, row.bindings, row.directories, row.demo_vendors].map(Number);
}

async function main() {
  assert.ok(process.env.DATABASE_URL || process.env.PGHOST, '生产回归必须显式连接部署数据库');
  const rootDir = path.resolve(__dirname, '..');
  const store = new PlatformStore(rootDir);
  await store.init();

  const suffix = String(Date.now()).slice(-8);
  const qa = {
    adminUsername: `qaadmin${suffix}`.slice(0, 16),
    ownerUsername: `qaowner${suffix}`.slice(0, 16),
    salesUsername: `qasales${suffix}`.slice(0, 16),
    shipyardName: `QA船厂${suffix}`,
    adminPassword: 'QaAdmin#917',
    ownerPassword: 'QaOwner#917',
    salesPassword: 'QaSales#917'
  };
  const created = { userIds: [], orderId: null, shipyardId: null, boatId: null, logoPath: null };
  const before = await counts(store);
  assert.equal(before[0], 19, '生产回归前船型数量必须保持 19');
  assert.equal(before[1], 25, '生产回归前模型版本数量必须保持 25');
  assert.ok(before[2] >= 25, '生产回归前至少应保留京穗船舶的 25 个绑定版本');
  assert.equal(before[3], 0, '真实厂商资料不应写入独立目录层');
  assert.equal(before[4], 10, '真实厂商资料必须保持 10 家');

  try {
    const adminCredentials = makePassword(qa.adminPassword);
    const admin = (await store.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,role,display_name,source)
       VALUES($1,$2,$3,$4,'platform_admin','生产回归管理员','自动化回归') RETURNING id`,
      [qa.adminUsername, qa.adminUsername.toLowerCase(), adminCredentials.salt, adminCredentials.passwordHash]
    )).rows[0];
    created.userIds.push(Number(admin.id));

    const adminLogin = await request('/api/auth/login', {
      method: 'POST', body: { username: qa.adminUsername, password: qa.adminPassword }
    });
    expectStatus(adminLogin, 200, '管理员登录');
    const adminCookie = adminLogin.cookie;
    assert.ok(adminCookie.startsWith('ship_session='));

    expectStatus(await request('/api/admin/members', {
      method: 'POST', cookie: adminCookie, body: { username: 'illegal-sales' }
    }), 403, '管理员不得直接新增普通/销售用户');

    const vendorJson = expectStatus(await request('/api/admin/vendors', {
      method: 'POST', cookie: adminCookie, body: {
        name: qa.shipyardName,
        planCode: 'free',
        contactName: '回归联系人',
        contactPhone: '13800000000',
        address: '广东省回归测试地址',
        businessScope: '生产回归测试',
        ownerUsername: qa.ownerUsername,
        ownerPassword: qa.ownerPassword,
        ownerDisplayName: '回归厂家主账号'
      }
    }), 201, '管理员新增厂家与唯一主账号');
    created.shipyardId = Number(vendorJson.data.shipyard.id);
    const ownerId = Number(vendorJson.data.account.id);
    created.userIds.push(ownerId);

    const accounts = expectStatus(await request(`/api/admin/shipyard-accounts?shipyardId=${created.shipyardId}`, {
      cookie: adminCookie
    }), 200, '读取厂家账号').data;
    assert.equal(accounts.filter(item => item.role === 'shipyard_owner').length, 1, '厂家必须只有一个主账号');

    expectStatus(await request('/api/admin/shipyard-accounts', {
      method: 'POST', cookie: adminCookie, body: {
        shipyardId: created.shipyardId, role: 'sales', username: `bad${suffix}`, password: qa.salesPassword
      }
    }), 403, '管理员不能创建销售账号');

    expectStatus(await request(`/api/admin/shipyard-accounts/${ownerId}`, {
      method: 'PUT', cookie: adminCookie, body: { displayName: '回归厂家主账号-已更新', status: 'active' }
    }), 200, '管理员更新厂家主账号');

    const boatJson = expectStatus(await request('/api/admin/boats', {
      method: 'POST', cookie: adminCookie, body: {
        ownerShipyardId: created.shipyardId,
        shipId: `qa_${suffix}`,
        name: 'QA回归船型',
        category: '公务船',
        categoryName: '公务船',
        subtype: '测试艇',
        typeName: '测试艇',
        basePriceYuan: 100000,
        published: false,
        customizable: true,
        configTabs: [
          { id: 'overview', label: '船型', kind: 'overview', options: [] },
          { id: 'appearance', label: '外观', kind: 'color', options: [
            { id: 'qa-white', name: '白色', color: '#f7f7f7', priceDeltaYuan: 0 },
            { id: 'qa-blue', name: '蓝色', color: '#245a88', priceDeltaYuan: 12000 }
          ] }
        ]
      }
    }), 201, '管理员新增船型');
    created.boatId = Number(boatJson.data.id);
    assert.equal(boatJson.data.basePriceYuan, 100000);

    const updatedBoat = expectStatus(await request(`/api/admin/boats/${created.boatId}`, {
      method: 'PUT', cookie: adminCookie, body: { name: 'QA回归船型-已更新', basePriceYuan: 120000 }
    }), 200, '管理员更新船型').data;
    assert.equal(updatedBoat.name, 'QA回归船型-已更新');
    assert.equal(updatedBoat.basePriceYuan, 120000);
    assert.equal(expectStatus(await request(`/api/admin/boats/${created.boatId}/archive`, {
      method: 'PUT', cookie: adminCookie, body: { archived: true }
    }), 200, '管理员归档船型').data.archived, true);
    assert.equal(expectStatus(await request(`/api/admin/boats/${created.boatId}/archive`, {
      method: 'PUT', cookie: adminCookie, body: { archived: false }
    }), 200, '管理员恢复船型').data.archived, false);

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST', body: { username: qa.ownerUsername, password: qa.ownerPassword }
    });
    expectStatus(ownerLogin, 200, '厂家主账号登录');
    const ownerCookie = ownerLogin.cookie;

    const ownerProfile = expectStatus(await request('/api/account/profile', {
      method: 'PUT', cookie: ownerCookie, body: {
        shipyardName: `${qa.shipyardName}-已更新`,
        contactName: '回归联系人-已更新',
        contactPhone: '13900000000',
        address: '广东省回归地址-已更新',
        displayName: '厂家负责人'
      }
    }), 200, '厂家修改自己的资料').data;
    assert.equal(ownerProfile.shipyardName, `${qa.shipyardName}-已更新`);

    const logoForm = new FormData();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    logoForm.append('logo', new Blob([png], { type: 'image/png' }), 'qa-logo.png');
    const logoJson = expectStatus(await request('/api/shipyard/logo', {
      method: 'POST', cookie: ownerCookie, body: logoForm
    }), 200, '厂家上传自定义图标');
    assert.match(logoJson.data.logoUrl, /^\/uploads\//);
    created.logoPath = path.join(process.env.UPLOAD_DIR || path.join(rootDir, 'uploads'), path.basename(logoJson.data.logoUrl));

    const dashboard = expectStatus(await request('/api/shipyard/dashboard', { cookie: ownerCookie }), 200, '厂家工作台').data;
    assert.equal(dashboard.models.length, 25, '厂家控制台应可浏览全部已上架模型并提交申请');
    assert.ok(dashboard.models.every(item => item.bound === false), '新厂家不应自动绑定任何模型');

    const ownerVr = expectStatus(await request('/api/vr/login', {
      method: 'POST', body: { username: qa.ownerUsername, password: qa.ownerPassword }
    }), 200, 'PICO厂家账号登录').data;
    assert.equal(ownerVr.allowedVariantIds.length, 0, 'PICO初始不得显示未绑定模型');

    expectStatus(await request('/api/shipyard/sales', {
      method: 'POST', cookie: ownerCookie, body: {
        username: 'bad@name', password: qa.salesPassword, displayName: '非法账号'
      }
    }), 400, '销售登录账号拒绝特殊字符');

    const salesJson = expectStatus(await request('/api/shipyard/sales', {
      method: 'POST', cookie: ownerCookie, body: {
        username: qa.salesUsername, password: qa.salesPassword,
        displayName: '回归销售', phone: '13700000000'
      }
    }), 201, '厂家新增销售').data;
    const salesId = Number(salesJson.id);
    created.userIds.push(salesId);
    expectStatus(await request(`/api/shipyard/sales/${salesId}`, {
      method: 'PUT', cookie: ownerCookie, body: { displayName: '回归销售-已更新', status: 'active' }
    }), 200, '厂家更新销售');

    const salesLogin = await request('/api/auth/login', {
      method: 'POST', body: { username: qa.salesUsername, password: qa.salesPassword }
    });
    expectStatus(salesLogin, 200, '销售账号登录');
    const salesCookie = salesLogin.cookie;
    expectStatus(await request('/api/shipyard/sales', {
      method: 'POST', cookie: salesCookie, body: { username: 'forbidden', password: 'Forbidden#1', displayName: '无权限' }
    }), 403, '销售不得创建员工');
    expectStatus(await request('/api/account/profile', {
      method: 'PUT', cookie: salesCookie, body: { shipyardName: '销售无权修改厂家名' }
    }), 403, '销售不得修改厂家资料');

    const salesVr = expectStatus(await request('/api/vr/login', {
      method: 'POST', body: { username: qa.salesUsername, password: qa.salesPassword }
    }), 200, 'PICO销售账号登录').data;
    assert.equal(salesVr.allowedVariantIds.length, 0);

    const membership = expectStatus(await request('/api/shipyard/membership-requests', {
      method: 'POST', cookie: ownerCookie, body: {
        targetPlanCode: 'silver', contactName: '回归联系人', contactPhone: '13900000000', note: '生产回归'
      }
    }), 201, '厂家提交会员升级申请').data;
    expectStatus(await request(`/api/admin/membership-requests/${membership.id}`, {
      method: 'PUT', cookie: adminCookie, body: { decision: 'approve', reviewNote: '生产回归通过' }
    }), 200, '管理员审批会员升级');
    const plan = (await store.pool.query('SELECT plan_code FROM v12_shipyards WHERE id=$1', [created.shipyardId])).rows[0];
    assert.equal(plan.plan_code, 'silver');

    const model = (await store.pool.query(
      'SELECT variant_id FROM v12_vr_models WHERE is_published=TRUE ORDER BY variant_id LIMIT 1'
    )).rows[0];
    assert.ok(model, '应至少存在一个已上架模型');
    const binding = expectStatus(await request('/api/shipyard/binding-requests', {
      method: 'POST', cookie: ownerCookie, body: { variantId: model.variant_id, note: '生产回归绑定' }
    }), 201, '厂家提交模型绑定申请').data;
    expectStatus(await request(`/api/admin/binding-requests/${binding.id}`, {
      method: 'PUT', cookie: adminCookie, body: { decision: 'approve', reviewNote: '生产回归通过' }
    }), 200, '管理员审批模型绑定');

    const ownerVrBound = expectStatus(await request('/api/vr/login', {
      method: 'POST', body: { username: qa.ownerUsername, password: qa.ownerPassword }
    }), 200, 'PICO厂家绑定后登录').data;
    const salesVrBound = expectStatus(await request('/api/vr/login', {
      method: 'POST', body: { username: qa.salesUsername, password: qa.salesPassword }
    }), 200, 'PICO销售绑定后登录').data;
    assert.deepEqual(ownerVrBound.allowedVariantIds, [model.variant_id]);
    assert.deepEqual(salesVrBound.allowedVariantIds, [model.variant_id]);

    const customization = expectStatus(await request('/api/customize', {
      method: 'POST', body: {
        boatId: 12, variantId: 'forged', selections: {
          appearance: { optionId: 'ocean-silver', priceDeltaYuan: -99999999 },
          interior: { optionId: 'interior-js950-modern-b', priceDeltaYuan: 1 },
          power: { optionId: 'power-enhanced', priceDeltaYuan: 1 }
        },
        customerName: '生产回归客户',
        customerPhone: '13800000000',
        customerNote: '验证订单客户信息与报价持久化'
      }
    }), 201, '匿名定制与后端价格计算').data;
    created.orderId = customization.orderId;
    assert.equal(customization.basePriceYuan, 2280000);
    assert.equal(customization.optionPriceYuan, 380000);
    assert.equal(customization.totalPriceYuan, 2660000);
    const orders = expectStatus(await request('/api/admin/orders', { cookie: adminCookie }), 200, '管理员读取持久化订单').data;
    assert.ok(orders.some(item => item.orderId === created.orderId
      && item.totalPriceYuan === 2660000
      && item.customerName === '生产回归客户'
      && item.customerPhone === '13800000000'));
    const pdfResponse = await fetch(`${baseUrl}/api/admin/orders/${encodeURIComponent(created.orderId)}/pdf`, {
      headers: { Cookie: adminCookie }
    });
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdfResponse.status, 200, `管理员导出订单PDF: ${pdfResponse.status} ${pdfBuffer.toString('utf8')}`);
    assert.match(String(pdfResponse.headers.get('content-type') || ''), /^application\/pdf/i);
    assert.ok(pdfBuffer.byteLength > 1000, '订单PDF内容不能为空');

    expectStatus(await request('/api/manufacturers'), 404, '船厂丰富资料不得暴露为独立页面接口');
    const plans = expectStatus(await request('/api/membership/plans'), 200, '会员规则').data;
    assert.deepEqual(plans.map(item => Number(item.model_quota)), [5, 10, 20, 30, 40]);

    expectStatus(await request(`/api/shipyard/sales/${salesId}`, {
      method: 'DELETE', cookie: ownerCookie
    }), 200, '厂家删除销售');
    created.userIds = created.userIds.filter(id => id !== salesId);
    const remainingSales = expectStatus(await request('/api/shipyard/sales', { cookie: ownerCookie }), 200, '确认销售删除').data;
    assert.equal(remainingSales.length, 0);

    console.log('production-api-regression: workflow ok');
  } finally {
    const client = await store.pool.connect();
    try {
      await client.query('BEGIN');
      if (created.orderId) await client.query('DELETE FROM v12_customizations WHERE id=$1', [created.orderId]);
      if (created.shipyardId) {
        await client.query('DELETE FROM v12_shipyard_model_bindings WHERE shipyard_id=$1', [created.shipyardId]);
        await client.query('DELETE FROM v12_binding_requests WHERE shipyard_id=$1', [created.shipyardId]);
        await client.query('DELETE FROM v12_membership_upgrade_requests WHERE shipyard_id=$1', [created.shipyardId]);
        await client.query('DELETE FROM v12_boats WHERE owner_shipyard_id=$1', [created.shipyardId]);
      }
      if (created.userIds.length) {
        await client.query('DELETE FROM v12_audit_logs WHERE actor_user_id=ANY($1::bigint[])', [created.userIds]);
        await client.query('DELETE FROM v12_sessions WHERE user_id=ANY($1::bigint[])', [created.userIds]);
        await client.query('DELETE FROM v12_users WHERE id=ANY($1::bigint[])', [created.userIds]);
      }
      if (created.shipyardId) await client.query('DELETE FROM v12_shipyards WHERE id=$1', [created.shipyardId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    if (created.logoPath) {
      try { fs.unlinkSync(created.logoPath); } catch {}
    }
    const after = await counts(store);
    assert.deepEqual(after, before, `生产回归清理后关系变化：${after.join('/')}`);
    await store.close();
    console.log(`production-api-regression: cleanup ok (${after.join('|')})`);
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
