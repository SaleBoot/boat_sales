const express = require('express');
const fs = require('fs');
const path = require('path');
const { validatePassword } = require('./security');
const { generateOrderPdf } = require('./order-pdf');

const SECURITY_QUESTIONS = [
  '您的出生城市是？',
  '您母亲的名字是？',
  '您的第一所学校名称是？',
  '您最喜爱的船型是？'
];

function cookieToken(req) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === 'ship_session') {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return null;
}

function requestToken(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return cookieToken(req);
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie('ship_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires: expiresAt,
    path: '/'
  });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function installPlatformRoutes(app, store, options = {}) {
  const modelDrafts = new Map();
  const modelExtensions = new Set(['.fbx', '.gltf', '.glb', '.obj']);
  const removeDirectory = directory => {
    if (directory && fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
  };
  const cleanupExpiredDrafts = () => {
    const now = Date.now();
    for (const [id, draft] of modelDrafts) {
      if (draft.expiresAt > now) continue;
      removeDirectory(draft.directory);
      modelDrafts.delete(id);
    }
  };
  app.use(asyncRoute(async (req, res, next) => {
    req.accessToken = requestToken(req);
    req.platformUser = await store.userFromToken(req.accessToken);
    next();
  }));

  const requireLogin = (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ success: false, message: '请先登录' });
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ success: false, message: '请先登录' });
    if (req.platformUser.role !== 'platform_admin') {
      return res.status(403).json({ success: false, message: '仅平台管理员可执行此操作' });
    }
    next();
  };
  const requireShipyard = (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ success: false, message: '请先登录' });
    if (!['shipyard_owner', 'sales'].includes(req.platformUser.role) || !req.platformUser.shipyard_id) {
      return res.status(403).json({ success: false, message: '该账号不属于船厂' });
    }
    next();
  };
  const requireVrUser = (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ success: false, message: '请先登录' });
    const allowed = req.platformUser.role === 'platform_admin' ||
      (['shipyard_owner', 'sales'].includes(req.platformUser.role) && req.platformUser.shipyard_id);
    if (!allowed) return res.status(403).json({ success: false, message: '该账号不能登录VR' });
    next();
  };
  const requireOwner = (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ success: false, message: '请先登录' });
    if (req.platformUser.role !== 'shipyard_owner' || !req.platformUser.shipyard_id) {
      return res.status(403).json({ success: false, message: '仅厂商主账号可执行此操作' });
    }
    next();
  };

  app.get('/api/auth/questions', (req, res) => res.json({ success: true, data: SECURITY_QUESTIONS }));

  app.post('/api/auth/register', (req, res) => {
    res.status(403).json({ success: false, message: '普通访客无需注册，可直接提交图纸；厂商账号由平台管理员开通' });
  });

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    const user = await store.authenticate(username, password);
    if (!user) return res.status(401).json({ success: false, message: '用户名或密码错误' });
    await store.deletePlatformSessions(user.id);
    const session = await store.createSession(user.id, 'web');
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ success: true, message: '登录成功', data: store.userDto(user) });
  }));

  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    await store.deleteSession(requestToken(req));
    res.clearCookie('ship_session', { path: '/' });
    res.json({ success: true, message: '已退出登录' });
  }));

  app.get('/api/auth/me', requireLogin, (req, res) => {
    res.json({ success: true, data: store.userDto(req.platformUser) });
  });

  app.put('/api/account/profile', requireShipyard, asyncRoute(async (req, res) => {
    if (req.platformUser.role === 'sales' && req.body.shipyardName != null) {
      return res.status(403).json({ success: false, message: '销售账号不能修改厂家资料' });
    }
    const data = await store.updateOwnProfile(req.platformUser, req.body);
    res.json({ success: true, message: '资料已更新', data: store.userDto(data) });
  }));

  if (options.logoUpload) {
    app.post('/api/shipyard/logo', requireOwner, options.logoUpload.single('logo'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择厂家图标文件' });
      const logoUrl = `/uploads/${req.file.filename}`;
      const data = await store.updateShipyardLogo(req.platformUser.shipyard_id, logoUrl, req.platformUser.id);
      res.json({ success: true, message: '厂家图标已上传', data });
    }));
  }

  app.put('/api/account/password', requireShipyard, asyncRoute(async (req, res) => {
    if (!req.body.currentPassword || !validatePassword(req.body.newPassword)) {
      return res.status(400).json({ success: false, message: '请填写当前密码，新密码须为6-18位并包含至少两种字符' });
    }
    await store.changeOwnPassword(req.platformUser, req.body.currentPassword, req.body.newPassword);
    res.clearCookie('ship_session', { path: '/' });
    res.json({ success: true, message: '密码已修改，请重新登录' });
  }));

  app.get('/api/auth/check-username', asyncRoute(async (req, res) => {
    if (!req.query.username) return res.json({ success: true, data: { available: false } });
    const user = await store.findUserByName(req.query.username);
    res.json({ success: true, data: { available: !user } });
  }));

  app.post('/api/auth/security-question', asyncRoute(async (req, res) => {
    if (!req.body.username) return res.status(400).json({ success: false, message: '请输入用户名' });
    const securityQuestion = await store.securityQuestion(req.body.username);
    if (!securityQuestion) return res.status(404).json({ success: false, message: '未找到该用户' });
    res.json({ success: true, data: { securityQuestion } });
  }));

  app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) return res.status(400).json({ success: false, message: '请填写所有必填项' });
    if (!validatePassword(newPassword)) return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
    await store.resetPassword(username, securityAnswer, newPassword);
    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  }));

  app.post('/api/vr/login', asyncRoute(async (req, res) => {
    const user = await store.authenticate(req.body.username, req.body.password);
    if (!user || !['shipyard_owner', 'sales'].includes(user.role) || !user.shipyard_id) {
      return res.status(401).json({ success: false, message: '船厂账号或密码错误' });
    }
    const session = await store.createSession(user.id, 'vr');
    const catalog = await store.vrCatalog(user);
    res.json({
      success: true,
      message: '登录成功',
      data: { accessToken: session.token, expiresAt: session.expiresAt.toISOString(), user: store.userDto(user), allowedVariantIds: catalog.entries.map(x => x.variantId) }
    });
  }));

  app.get('/api/vr/catalog', requireShipyard, asyncRoute(async (req, res) => {
    res.json(await store.vrCatalog(req.platformUser));
  }));

  app.get('/api/vr/current-model', requireVrUser, asyncRoute(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ success: true, data: await store.currentVrModel(req.platformUser) });
  }));

  app.put('/api/vr/current-model', requireVrUser, asyncRoute(async (req, res) => {
    const variantId = String(req.body.variantId || '').trim();
    if (!variantId) return res.status(400).json({ success: false, message: '请选择需要同步的船舶模型' });
    const data = await store.setCurrentVrModel(req.platformUser, variantId);
    res.json({ success: true, message: '已同步到当前账号的VR头显', data });
  }));

  app.get('/api/platform/models', asyncRoute(async (req, res) => {
    const data = await store.publicModels(req.platformUser);
    res.json({ success: true, count: data.length, data });
  }));

  app.post('/api/customize', asyncRoute(async (req, res) => {
    if (!req.body.boatId) return res.status(400).json({ success: false, message: '请选择船型' });
    if (!String(req.body.customerName || '').trim() || !String(req.body.customerPhone || '').trim()) {
      return res.status(400).json({ success: false, message: '请填写客户姓名和联系方式' });
    }
    const data = await store.saveCustomization(req.body);
    res.status(201).json({ success: true, message: '定制方案已保存', data });
  }));

  app.get('/api/boats', asyncRoute(async (req, res) => {
    const data = await store.boats(req.query);
    res.json({ success: true, count: data.length, data });
  }));

  app.get('/api/boats/:id', asyncRoute(async (req, res) => {
    const data = await store.boat(req.params.id, Boolean(req.platformUser && req.platformUser.role === 'platform_admin'));
    if (!data) return res.status(404).json({ success: false, message: '未找到该船型' });
    res.json({ success: true, data });
  }));

  // 保存数字孪生配置（勾选的系统 + 智能大类选择），需登录
  app.put('/api/boats/:id/twin-config', requireLogin, asyncRoute(async (req, res) => {
    const data = await store.updateBoatTwinConfig(Number(req.params.id), req.body || {}, req.platformUser.id);
    res.json({ success: true, data });
  }));

  // 数字孪生（独立系统）：目录与页面须登录后才能访问，公众不可见。
  // 目录位于项目根下 twin/（不在 public 静态目录），仅由该受保护路由对外。
  app.use('/twin', requireLogin, express.static(path.join(__dirname, '..', 'twin'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  app.get('/api/membership/plans', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.plans() });
  }));

  app.get('/api/boat-categories', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.boatCategories() });
  }));

  app.get('/api/shipyard/dashboard', requireShipyard, asyncRoute(async (req, res) => {
    const user = await store.findUserByName(req.platformUser.username);
    const models = await store.publicModels(user);
    res.json({ success: true, data: { account: store.userDto(user), models } });
  }));

  app.post('/api/shipyard/binding-requests', requireOwner, asyncRoute(async (req, res) => {
    if (!req.body.variantId) return res.status(400).json({ success: false, message: '请选择模型' });
    const data = await store.requestBinding(req.platformUser, req.body.variantId, req.body.note);
    res.status(201).json({ success: true, message: '申请已提交，请等待平台管理员确认', data });
  }));

  app.get('/api/shipyard/sales', requireOwner, asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.salesAccounts(req.platformUser) });
  }));

  app.post('/api/shipyard/sales', requireOwner, asyncRoute(async (req, res) => {
    const username = String(req.body.username || '').trim();
    if (!String(req.body.displayName || '').trim() || !/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(username) || !validatePassword(req.body.password)) {
      return res.status(400).json({ success: false, message: '请填写销售姓名、有效登录账号和符合要求的初始密码' });
    }
    const data = await store.createSales(req.platformUser, req.body);
    res.status(201).json({ success: true, message: '销售员工已创建', data });
  }));

  app.put('/api/shipyard/sales/:id', requireOwner, asyncRoute(async (req, res) => {
    if (req.body.password && !validatePassword(req.body.password)) {
      return res.status(400).json({ success: false, message: '新密码不符合格式要求' });
    }
    const data = await store.updateSales(req.platformUser, req.params.id, req.body);
    res.json({ success: true, message: '销售员工资料已更新', data });
  }));

  app.delete('/api/shipyard/sales/:id', requireOwner, asyncRoute(async (req, res) => {
    await store.deleteSales(req.platformUser, req.params.id);
    res.json({ success: true, message: '销售员工已删除' });
  }));

  app.get('/api/shipyard/membership-requests', requireOwner, asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.membershipUpgradeRequests(req.platformUser.shipyard_id) });
  }));

  app.post('/api/shipyard/membership-requests', requireOwner, asyncRoute(async (req, res) => {
    const data = await store.requestMembershipUpgrade(req.platformUser, req.body);
    res.status(201).json({ success: true, message: '会员升级申请已提交', data });
  }));

  const admin = express.Router();
  admin.use(requireAdmin);
  admin.get('/members', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.members(req.query) });
  }));
  admin.post('/members', (req, res) => {
    res.status(403).json({ success: false, message: '管理员只能新增厂商会员，请使用“新增厂商”' });
  });
  admin.put('/members/:id', asyncRoute(async (req, res) => {
    if (req.body.password && !validatePassword(req.body.password)) {
      return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
    }
    const data = await store.updateMember(req.params.id, req.body);
    res.json({ success: true, message: '会员资料已更新', data });
  }));
  admin.delete('/members/:id', asyncRoute(async (req, res) => {
    await store.deleteMember(req.params.id);
    res.json({ success: true, message: '会员已删除' });
  }));
  admin.post('/members/batch', asyncRoute(async (req, res) => {
    if (!Array.isArray(req.body.ids) || !req.body.ids.length || !['delete','disable','enable'].includes(req.body.action)) {
      return res.status(400).json({ success: false, message: '请选择用户和有效操作' });
    }
    const affected = await store.batchMembers(req.body.ids, req.body.action);
    res.json({ success: true, message: `已处理 ${affected} 个会员`, data: { affected } });
  }));
  admin.get('/plans', asyncRoute(async (req, res) => res.json({ success: true, data: await store.plans() })));
  admin.post('/boat-categories', asyncRoute(async (req, res) => {
    const data = await store.createBoatCategory(req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '船型大类已添加', data });
  }));
  admin.put('/boat-categories/reorder', asyncRoute(async (req, res) => {
    const data = await store.reorderBoatCategories(req.body, req.platformUser.id);
    res.json({ success: true, message: '分类顺序已保存', data });
  }));
  admin.put('/boat-categories/:id', asyncRoute(async (req, res) => {
    const data = await store.updateBoatCategory(req.params.id, req.body, req.platformUser.id);
    res.json({ success: true, message: '船型大类已更新', data });
  }));
  admin.delete('/boat-categories/:id', asyncRoute(async (req, res) => {
    await store.deleteBoatCategory(req.params.id, req.platformUser.id);
    res.json({ success: true, message: '船型大类已删除' });
  }));
  admin.post('/boat-categories/:id/sub', asyncRoute(async (req, res) => {
    const data = await store.createBoatSubcategory(req.params.id, req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '船型小类已添加', data });
  }));
  admin.put('/boat-categories/:id/sub/:subId', asyncRoute(async (req, res) => {
    const data = await store.updateBoatSubcategory(req.params.id, req.params.subId, req.body, req.platformUser.id);
    res.json({ success: true, message: '船型小类已更新', data });
  }));
  admin.delete('/boat-categories/:id/sub/:subId', asyncRoute(async (req, res) => {
    await store.deleteBoatSubcategory(req.params.id, req.params.subId, req.platformUser.id);
    res.json({ success: true, message: '船型小类已删除' });
  }));
  admin.get('/shipyards', asyncRoute(async (req, res) => res.json({ success: true, data: await store.shipyards() })));
  admin.post('/vendors', asyncRoute(async (req, res) => {
    const ownerUsername = String(req.body.ownerUsername || '').trim();
    if (!String(req.body.name || '').trim()) return res.status(400).json({ success: false, message: '请填写厂商名称' });
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(ownerUsername) || !validatePassword(req.body.ownerPassword)) {
      return res.status(400).json({ success: false, message: '请填写有效厂商主账号和符合要求的初始密码' });
    }
    const data = await store.createVendor(req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '厂商会员及主账号已创建', data });
  }));
  admin.post('/shipyards', asyncRoute(async (req, res) => {
    if (!String(req.body.name || '').trim()) return res.status(400).json({ success: false, message: '请填写船厂名称' });
    const data = await store.createShipyard(req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '船厂已创建', data });
  }));
  admin.put('/shipyards/:id', asyncRoute(async (req, res) => {
    if (req.body.ownerUsername && !/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(String(req.body.ownerUsername).trim())) {
      return res.status(400).json({ success: false, message: '厂商主账号应为3-16位字母、数字、下划线或中文' });
    }
    if (req.body.ownerPassword && !validatePassword(req.body.ownerPassword)) {
      return res.status(400).json({ success: false, message: '主账号密码格式不符合要求' });
    }
    const data = await store.updateShipyard(req.params.id, req.body, req.platformUser.id);
    res.json({ success: true, message: '船厂资料已更新', data });
  }));
  if (options.logoUpload) {
    admin.post('/shipyards/:id/logo', options.logoUpload.single('logo'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择厂家图标文件' });
      const logoUrl = `/uploads/${req.file.filename}`;
      const data = await store.updateShipyardLogo(req.params.id, logoUrl, req.platformUser.id);
      res.json({ success: true, message: '厂家图标已上传', data });
    }));
  }
  admin.get('/shipyard-accounts', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.accounts(req.query.shipyardId) });
  }));
  admin.post('/shipyard-accounts', asyncRoute(async (req, res) => {
    if (req.body.role !== 'shipyard_owner') {
      return res.status(403).json({ success: false, message: '平台管理员只能创建厂商主账号；销售员工由厂商主账号创建' });
    }
    if (!req.body.shipyardId || !String(req.body.username || '').trim() || !validatePassword(req.body.password)) {
      return res.status(400).json({ success: false, message: '请填写船厂、账号及符合要求的密码' });
    }
    const data = await store.createAccount(req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '账号已创建', data });
  }));
  admin.put('/shipyard-accounts/:id', asyncRoute(async (req, res) => {
    if (req.body.username && !/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(String(req.body.username).trim())) {
      return res.status(400).json({ success: false, message: '账号格式不正确' });
    }
    if (req.body.password && !validatePassword(req.body.password)) {
      return res.status(400).json({ success: false, message: '密码格式不符合要求' });
    }
    res.json({ success: true, message: '账号已更新', data: await store.updateAccount(req.params.id, req.body, req.platformUser.id) });
  }));
  admin.get('/binding-requests', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.bindingRequests(req.query.status) });
  }));
  admin.put('/binding-requests/:id', asyncRoute(async (req, res) => {
    const approve = req.body.decision === 'approve';
    if (!approve && req.body.decision !== 'reject') {
      return res.status(400).json({ success: false, message: '请选择通过或拒绝' });
    }
    const data = await store.decideBinding(req.params.id, approve, req.body.reviewNote, req.platformUser.id);
    res.json({ success: true, message: approve ? '已通过并绑定船型模型' : '已拒绝申请', data });
  }));
  admin.get('/vr-models', asyncRoute(async (req, res) => {
    const data = await store.publicModels(req.platformUser);
    res.json({ success: true, data });
  }));
  admin.get('/boats', asyncRoute(async (req, res) => {
    const data = await store.adminBoats({ shipyardId: req.query.shipyardId, includeArchived: req.query.includeArchived === 'true' });
    res.json({ success: true, count: data.length, data });
  }));
  admin.get('/orders', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.customizations() });
  }));
  admin.get('/orders/:id/pdf', asyncRoute(async (req, res) => {
    const order = await store.customization(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    const pdf = await generateOrderPdf(order, options.rootDir || path.resolve(__dirname, '..'));
    const safeId = String(order.orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="custom-order-${safeId}.pdf"; filename*=UTF-8''${encodeURIComponent(`定制方案报价单-${order.orderId}.pdf`)}`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }));
  admin.post('/boats', asyncRoute(async (req, res) => {
    if (!req.body.ownerShipyardId || !String(req.body.name || '').trim()) {
      return res.status(400).json({ success: false, message: '请选择所属厂家并填写船型名称' });
    }
    const data = await store.createBoat(req.body, req.platformUser.id);
    res.status(201).json({ success: true, message: '船型已创建', data });
  }));
  admin.put('/boats/:id', asyncRoute(async (req, res) => {
    const data = await store.updateBoat(req.params.id, req.body, req.platformUser.id);
    res.json({ success: true, message: '船型信息已保存到数据库', data });
  }));
  admin.put('/boats/:id/config-tabs', asyncRoute(async (req, res) => {
    const { tabId, options, label } = req.body;
    const boat = await store.boat(req.params.id);
    if (!boat) return res.status(404).json({ success: false, message: '船型不存在' });
    const tab = boat.configTabs.find(t => String(t.id) === String(tabId));
    if (!tab) return res.status(404).json({ success: false, message: '配置板块不存在' });
    tab.options = options;
    if (label != null) tab.label = label;
    await store.updateBoat(req.params.id, { configTabs: boat.configTabs }, req.platformUser.id);
    res.json({ success: true, message: '配置板块已保存' });
  }));
  admin.put('/boats/:id/archive', asyncRoute(async (req, res) => {
    const data = await store.archiveBoat(req.params.id, req.body.archived !== false, req.platformUser.id);
    res.json({ success: true, message: data.archived ? '船型已归档' : '船型已恢复', data });
  }));
  admin.put('/boats/:id/image', asyncRoute(async (req, res) => {
    if (!req.body.image) return res.status(400).json({ success: false, message: '缺少图片路径' });
    await store.updateBoatImage(req.params.id, req.body.image, req.platformUser.id);
    res.json({ success: true, message: '船型图片已保存', image: req.body.image });
  }));
  if (options.modelDraftUpload && options.modelStagingDir && options.modelUploadDir) {
    admin.post('/boats/:id/model-drafts', options.modelDraftUpload.array('files', 80), asyncRoute(async (req, res) => {
      cleanupExpiredDrafts();
      const boat = await store.boat(req.params.id);
      if (!boat) {
        removeDirectory(req.modelDraftId && path.join(options.modelStagingDir, req.modelDraftId));
        return res.status(404).json({ success: false, message: '船型不存在' });
      }
      const files = Array.isArray(req.files) ? req.files : [];
      const entry = files.find(file => modelExtensions.has(path.extname(file.filename).toLowerCase()));
      if (!entry) {
        removeDirectory(req.modelDraftId && path.join(options.modelStagingDir, req.modelDraftId));
        return res.status(400).json({ success: false, message: '请选择 FBX、GLTF、GLB 或 OBJ 主模型文件' });
      }
      const draft = {
        id: req.modelDraftId,
        boatId: Number(boat.id),
        actorId: Number(req.platformUser.id),
        directory: path.join(options.modelStagingDir, req.modelDraftId),
        entryFile: entry.filename,
        files: files.map(file => file.filename),
        variantName: String(req.body.variantName || path.parse(entry.originalname).name || '平台上传模型').trim(),
        expiresAt: Date.now() + 6 * 60 * 60 * 1000
      };
      modelDrafts.set(draft.id, draft);
      res.status(201).json({
        success: true,
        message: '模型已暂存，请预览并确认后入库',
        data: {
          draftId: draft.id,
          variantName: draft.variantName,
          entryFile: draft.entryFile,
          files: draft.files,
          modelUrl: `/api/admin/model-drafts/${draft.id}/files/${encodeURIComponent(draft.entryFile)}`,
          expiresAt: new Date(draft.expiresAt).toISOString()
        }
      });
    }));
    admin.get('/model-drafts/:draftId/files/:filename', (req, res) => {
      cleanupExpiredDrafts();
      const draft = modelDrafts.get(req.params.draftId);
      const filename = path.basename(req.params.filename);
      if (!draft || !draft.files.includes(filename)) return res.status(404).json({ success: false, message: '预览文件不存在或已过期' });
      res.sendFile(path.join(draft.directory, filename));
    });
    admin.delete('/model-drafts/:draftId', (req, res) => {
      const draft = modelDrafts.get(req.params.draftId);
      if (draft) removeDirectory(draft.directory);
      modelDrafts.delete(req.params.draftId);
      res.json({ success: true, message: '暂存模型已取消' });
    });
    admin.post('/boats/:id/model-drafts/:draftId/confirm', asyncRoute(async (req, res) => {
      cleanupExpiredDrafts();
      const draft = modelDrafts.get(req.params.draftId);
      if (!draft || Number(draft.boatId) !== Number(req.params.id) || Number(draft.actorId) !== Number(req.platformUser.id)) {
        return res.status(404).json({ success: false, message: '暂存模型不存在、已过期或不属于当前船型' });
      }
      const boat = await store.boat(req.params.id);
      if (!boat) return res.status(404).json({ success: false, message: '船型不存在' });
      const variantId = `admin_${String(boat.shipId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
      const permanentRoot = path.join(options.modelUploadDir, 'uploads');
      const permanentDirectory = path.join(permanentRoot, variantId);
      fs.mkdirSync(permanentRoot, { recursive: true });
      try {
        fs.renameSync(draft.directory, permanentDirectory);
      } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        fs.cpSync(draft.directory, permanentDirectory, { recursive: true });
        removeDirectory(draft.directory);
      }
      const variant = {
        variantId,
        variantName: String(req.body.variantName || draft.variantName || '平台上传模型').trim(),
        modelFiles: [`/FBX/uploads/${variantId}/${draft.entryFile}`],
        textureBaseUrl: '',
        hullMaterial: String(req.body.hullMaterial || 'mat_part01').trim(),
        materialNames: [],
        detailedInterior: Boolean(req.body.detailedInterior),
        thumbnailUrl: boat.image || '',
        sourceFiles: draft.files,
        viewSettings: req.body.viewSettings || { bowDirection: 'auto', exterior: null, interior: null }
      };
      try {
        const data = await store.addBoatVariant(req.params.id, variant, req.platformUser.id);
        modelDrafts.delete(draft.id);
        res.status(201).json({ success: true, message: '模型预览已确认并保存入库', variant, data });
      } catch (error) {
        if (fs.existsSync(permanentDirectory) && !fs.existsSync(draft.directory)) fs.renameSync(permanentDirectory, draft.directory);
        throw error;
      }
    }));
    admin.put('/boats/:id/variants/:variantId', asyncRoute(async (req, res) => {
      const data = await store.updateBoatVariant(req.params.id, req.params.variantId, req.body, req.platformUser.id);
      res.json({ success: true, message: '模型名称、船头方向和展示视角已保存', data });
    }));
  }
  if (options.modelUpload) {
    admin.post('/boats/:id/model', options.modelUpload.single('model'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择模型文件' });
      const boat = await store.boat(req.params.id);
      if (!boat) return res.status(404).json({ success: false, message: '船型不存在' });
      const variantId = `admin_${boat.shipId}_${Date.now()}`;
      const variant = {
        variantId,
        variantName: String(req.body.variantName || '平台上传模型').trim(),
        modelFiles: [`/FBX/${req.file.filename}`],
        textureBaseUrl: '',
        hullMaterial: 'mat_part01',
        materialNames: [],
        detailedInterior: false,
        thumbnailUrl: boat.image || ''
      };
      const data = await store.addBoatVariant(req.params.id, variant, req.platformUser.id);
      res.status(201).json({ success: true, message: '模型已上传并保存到该船型', modelFile: req.file.filename, variant, data });
    }));
    admin.post('/boats/:id/accessory', options.modelUpload.single('model'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择配件模型文件' });
      const boat = await store.boat(req.params.id);
      if (!boat) return res.status(404).json({ success: false, message: '船型不存在' });
      res.status(201).json({
        success: true,
        message: '配件模型已上传，请在选项中调整位置、旋转与缩放后保存',
        data: { id: `asset-${Date.now()}`, name: req.file.originalname, modelUrl: `/FBX/${req.file.filename}`, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
      });
    }));
  }
  if (options.imageUpload) {
    admin.post('/boats/:id/image', options.imageUpload.single('image'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择图片文件' });
      const image = `/uploads/${req.file.filename}`;
      await store.updateBoatImage(req.params.id, image, req.platformUser.id);
      res.json({ success: true, message: '船型图片已上传', image });
    }));
    admin.post('/boats/:id/option-image', options.imageUpload.single('image'), asyncRoute(async (req, res) => {
      if (!req.file) return res.status(400).json({ success: false, message: '请选择图片文件' });
      res.json({ success: true, image: `/uploads/${req.file.filename}` });
    }));
  }
  admin.put('/vr-models/:variantId/publish', asyncRoute(async (req, res) => {
    const data = await store.setModelPublished(req.params.variantId, req.body.published, req.platformUser.id);
    res.json({ success: true, message: data.published ? '模型已上架' : '模型已下架', data });
  }));
  admin.get('/submissions', asyncRoute(async (req, res) => res.json({ success: true, data: await store.submissions() })));
  admin.put('/submissions/:id', asyncRoute(async (req, res) => {
    const allowedStatuses = ['submitted', 'contacted', 'quoted', 'confirmed', 'modeling', 'completed', 'cancelled'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: '无效的处理状态' });
    }
    const data = await store.updateSubmission(req.params.id, req.body, req.platformUser.id);
    res.json({ success: true, message: '提交记录已更新', data });
  }));
  admin.get('/membership-requests', asyncRoute(async (req, res) => {
    res.json({ success: true, data: await store.membershipUpgradeRequests() });
  }));
  admin.put('/membership-requests/:id', asyncRoute(async (req, res) => {
    if (!['approve', 'reject'].includes(req.body.decision)) {
      return res.status(400).json({ success: false, message: '请选择通过或拒绝' });
    }
    const data = await store.decideMembershipUpgrade(req.params.id, req.body, req.platformUser.id);
    res.json({ success: true, message: data.status === 'approved' ? '会员等级已更新' : '升级申请已拒绝', data });
  }));
  app.use('/api/admin', admin);

  return { requireAdmin, requireLogin, requireShipyard, requireVrUser };
}

module.exports = { installPlatformRoutes };
