const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const { PlatformStore } = require('./src/platform-store');
const { installPlatformRoutes } = require('./src/platform-routes');
const { buildDrawingWorkbook } = require('./src/drawing-workbook');

/* ===== 用户认证：账号注册 / 登录 / 找回密码 ===== */
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, hash) {
  const test = hashPassword(password, salt);
  // 长度不同直接返回，避免 timing 差异报错
  if (test.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
}

// 密码强度：6-18 位，数字 / 字母 / 符号 至少两种组合
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 18) return false;
  const types = [/[0-9]/.test(password), /[a-zA-Z]/.test(password), /[^0-9a-zA-Z]/.test(password)];
  return types.filter(Boolean).length >= 2;
}

const SECURITY_QUESTIONS = [
  '您的出生城市是？',
  '您母亲的名字是？',
  '您的第一所学校名称是？',
  '您最喜爱的船型是？'
];

// 首次启动时初始化默认管理员账号（admin / admin123）
function seedDefaultAdmin() {
  const users = loadUsers();
  if (users.length === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    users.push({
      id: 1,
      username: 'admin',
      salt,
      passwordHash: hashPassword('admin123', salt),
      securityQuestion: SECURITY_QUESTIONS[2],
      securityAnswer: '海洋小学',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    console.log('已初始化默认账号：admin / admin123');
  }
}
seedDefaultAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const exts = ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (exts.includes(ext)) cb(null, true);
    else cb(new Error('不支持的文件格式'));
  }
});

const logoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (allowedExtensions.has(ext) && allowedMimeTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('厂家图标仅支持 PNG、JPEG 或 WebP 图片'));
  }
});

const fbxDir = path.join(__dirname, 'FBX');
if (!fs.existsSync(fbxDir)) {
  fs.mkdirSync(fbxDir, { recursive: true });
}
const modelUploadDir = process.env.MODEL_UPLOAD_DIR || fbxDir;
if (!fs.existsSync(modelUploadDir)) {
  fs.mkdirSync(modelUploadDir, { recursive: true });
}
const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, modelUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const modelUpload = multer({
  storage: modelStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const exts = ['.fbx', '.gltf', '.glb', '.obj'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (exts.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 .fbx / .gltf / .glb / .obj 格式'));
  }
});

const modelStagingDir = process.env.MODEL_STAGING_DIR || path.join(__dirname, 'uploads', 'model-staging');
fs.mkdirSync(modelStagingDir, { recursive: true });
function safeModelAssetName(value) {
  const base = path.basename(String(value || 'asset')).normalize('NFC').replace(/[\u0000-\u001f]/g, '').replace(/^\.+/, '');
  return (base || `asset-${Date.now()}`).slice(0, 180);
}
const modelDraftStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.modelDraftId) req.modelDraftId = crypto.randomBytes(18).toString('hex');
    const destination = path.join(modelStagingDir, req.modelDraftId);
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (req, file, cb) => cb(null, safeModelAssetName(file.originalname))
});
const modelDraftUpload = multer({
  storage: modelDraftStorage,
  limits: { fileSize: 300 * 1024 * 1024, files: 80 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['.fbx', '.gltf', '.glb', '.obj', '.bin', '.mtl', '.png', '.jpg', '.jpeg', '.webp', '.tga', '.bmp']);
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.has(ext)) cb(null, true);
    else cb(new Error('模型支持 FBX / GLTF / GLB / OBJ；可同时选择 BIN、MTL 和常用贴图文件'));
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
if (modelUploadDir !== fbxDir) app.use('/FBX', express.static(modelUploadDir));
app.use('/FBX', express.static(path.join(__dirname, 'FBX')));
app.use('/uploads', express.static(uploadDir));
app.use('/vr-content', express.static(path.join(__dirname, 'vr-content'), {
  immutable: true,
  maxAge: '7d'
}));

// V1.2.12 数据与权限接口先注册，兼容并保护后面的原有 API。
const platformStore = new PlatformStore(__dirname);
app.locals.platformStore = platformStore;
const { requireAdmin: requirePlatformAdmin } = installPlatformRoutes(app, platformStore, {
  modelUpload,
  modelDraftUpload,
  modelStagingDir,
  modelUploadDir,
  imageUpload: upload,
  logoUpload
});
// 新平台路由未覆盖到的历史 /api/admin/* 接口也必须经过同一管理员会话校验。
// 这样订单导出、字段管理等兼容功能不会因为落到旧路由而绕过权限。
app.use('/api/admin', requirePlatformAdmin);

const orders = [
  {
    orderId: 'ORD-20260101-001',
    boatId: 1,
    boatName: '海卫一号',
    hullColor: '远洋银',
    interiorStyle: '现代简约',
    enginePackage: '标准动力',
    smartSystem: '基础智能',
    extras: ['破浪船首'],
    basePrice: '¥1,850万',
    extraPrice: '80万',
    totalPrice: '¥1,930万',
    createdAt: '2026-01-15T09:30:00Z'
  },
  {
    orderId: 'ORD-20260220-002',
    boatId: 4,
    boatName: 'Azure Flybridge',
    hullColor: '极地白',
    interiorStyle: '豪华经典',
    enginePackage: '高性能动力',
    smartSystem: '全船智能',
    extras: ['船尾游泳平台', '豪华客厅'],
    basePrice: '¥2,800万',
    extraPrice: '320万',
    totalPrice: '¥3,120万',
    createdAt: '2026-02-20T14:00:00Z'
  },
  {
    orderId: 'ORD-20260310-003',
    boatId: 5,
    boatName: 'Majesty Supreme',
    hullColor: '极地白',
    interiorStyle: '豪华经典',
    enginePackage: '高性能动力',
    smartSystem: '全船智能',
    extras: ['无边泳池', '私人影院', '直升机库'],
    basePrice: '¥7,200万',
    extraPrice: '850万',
    totalPrice: '¥8,050万',
    createdAt: '2026-03-10T10:15:00Z'
  },
  {
    orderId: 'ORD-20260405-004',
    boatId: 2,
    boatName: '绿动先锋',
    hullColor: '破浪青',
    interiorStyle: '现代简约',
    enginePackage: '标准动力',
    smartSystem: '基础智能',
    extras: ['太阳能甲板'],
    basePrice: '¥1,560万',
    extraPrice: '120万',
    totalPrice: '¥1,680万',
    createdAt: '2026-04-05T16:20:00Z'
  },
  {
    orderId: 'ORD-20260518-005',
    boatId: 3,
    boatName: '执法者号',
    hullColor: '远洋银',
    interiorStyle: '现代简约',
    enginePackage: '高性能动力',
    smartSystem: '全船智能',
    extras: ['防弹驾驶舱', '电子监控平台'],
    basePrice: '¥1,280万',
    extraPrice: '200万',
    totalPrice: '¥1,480万',
    createdAt: '2026-05-18T11:45:00Z'
  },
  {
    orderId: 'ORD-20260622-006',
    boatId: 6,
    boatName: '智航者号',
    hullColor: '极地白',
    interiorStyle: '现代简约',
    enginePackage: '标准动力',
    smartSystem: '全船智能',
    extras: ['AI自主导航', '长航时续航'],
    basePrice: '¥680万',
    extraPrice: '150万',
    totalPrice: '¥830万',
    createdAt: '2026-06-22T08:00:00Z'
  }
];

const boats = [
  {
    id: 1,
    name: '海卫一号',
    category: 'government',
    categoryName: '公务船',
    subtype: 'rescue',
    type: 'rescue',
    typeName: '救援船',
    length: '22.0米',
    capacity: '20人',
    maxSpeed: '35节',
    price: '¥1,850万',
    description: '专业应急救援船艇，配备医疗救护系统与高速救援设备，可在恶劣海况下快速响应搜救任务。',
    features: ['医疗救护舱', '高速救援吊臂', '全天候夜视系统', '破浪船首'],
    image: '/assets/boat-rescue.jpg',
    modelFile: '4028sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  },
  {
    id: 2,
    name: '绿动先锋',
    category: 'commercial',
    categoryName: '商用船',
    subtype: 'sightseeing',
    type: 'newenergy',
    typeName: '观光船',
    length: '16.8米',
    capacity: '12人',
    maxSpeed: '24节',
    price: '¥1,560万',
    description: '纯电动推进系统零排放航行，太阳能甲板与储能电池组，兼顾环保与静音舒适体验。',
    features: ['纯电推进系统', '太阳能甲板', '静音客舱', '零排放设计'],
    image: '/assets/boat-newenergy.jpg',
    modelFile: '1588sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  },
  {
    id: 3,
    name: '执法者号',
    category: 'government',
    categoryName: '公务船',
    subtype: 'enforcement',
    type: 'official',
    typeName: '执法艇',
    length: '18.5米',
    capacity: '15人',
    maxSpeed: '40节',
    price: '¥1,280万',
    description: '公务执法高速巡逻艇，配备执法装备与电子监控系统，为水域执法与巡逻提供可靠保障。',
    features: ['高速拦截能力', '执法装备系统', '电子监控平台', '防弹驾驶舱'],
    image: '/assets/boat-official.jpg',
    modelFile: '950sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  },
  {
    id: 4,
    name: 'Azure Flybridge',
    category: 'leisure',
    categoryName: '民用休闲',
    subtype: 'luxury-yacht',
    type: 'yacht',
    typeName: '豪华游艇',
    length: '18.5米',
    capacity: '12人',
    maxSpeed: '32节',
    price: '¥2,800万',
    description: '飞桥设计提供360度全景视野，宽敞的甲板空间和豪华内饰，适合商务接待与家庭出海。',
    features: ['飞桥全景甲板', '豪华客厅', '三间客舱', '船尾游泳平台'],
    image: '/assets/boat-yacht1.jpg',
    modelFile: '1398sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  },
  {
    id: 5,
    name: 'Majesty Supreme',
    category: 'leisure',
    categoryName: '民用休闲',
    subtype: 'luxury-yacht',
    type: 'yacht',
    typeName: '豪华游艇',
    length: '30.0米',
    capacity: '14人',
    maxSpeed: '28节',
    price: '¥7,200万',
    description: '旗舰级超级游艇，三层甲板设计，配备无边泳池、影院及私人套房，定义海上奢华新标准。',
    features: ['三层甲板', '无边泳池', '私人影院', '直升机库'],
    image: '/assets/boat-yacht2.jpg',
    modelFile: '1198sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  },
  {
    id: 6,
    name: '智航者号',
    category: 'military',
    categoryName: '军用船',
    subtype: 'unmanned',
    type: 'unmanned',
    typeName: '无人艇',
    length: '12.0米',
    capacity: '无人',
    maxSpeed: '28节',
    price: '¥680万',
    description: '自主航行无人船平台，搭载AI智能导航与多任务载荷系统，可用于海洋监测、测绘与巡逻。',
    features: ['AI自主导航', '多任务载荷舱', '远程控制站', '长航时续航'],
    image: '/assets/boat-unmanned.jpg',
    modelFile: 'wuren1sites01.fbx',
    manufacturer: '海洋装备制造集团',
    customizable: true
  }
];

app.get('/api/boats', (req, res) => {
  const { type, category, subtype } = req.query
  let result = boats
  if (category && category !== 'all') {
    result = result.filter(b => b.category === category)
  }
  if (subtype) {
    result = result.filter(b => b.subtype === subtype)
  }
  // 兼容旧版 type 查询,type 等价于 subtype 语义
  if (type && type !== 'all' && !subtype) {
    result = boats.filter(b => b.type === type || b.subtype === type || b.category === type)
  }
  res.json({
    success: true,
    count: result.length,
    data: result
  })
});

app.get('/api/boats/:id', (req, res) => {
  const boat = boats.find(b => b.id === parseInt(req.params.id));
  if (!boat) {
    return res.status(404).json({ success: false, message: '未找到该船型' });
  }
  res.json({ success: true, data: boat });
});

const customizationOptions = {
  hullColors: [
    { name: '极地白', hex: '#F0F0F2' },
    { name: '远洋银', hex: '#C4C9D2' },
    { name: '破浪青', hex: '#2E8B8B' },
    { name: '深渊蓝', hex: '#1B3A5B' },
    { name: '曙光金', hex: '#C4A04A' },
    { name: '炽焰红', hex: '#E63946' },
    { name: '流金黄', hex: '#FFB300' },
    { name: '暮夜黑', hex: '#1A1A1C' }
  ],
  interiorStyles: ['现代简约', '经典奢华', '地中海风', '东方意境', '极简主义'],
  enginePackages: [
    { name: '标准动力', power: '1000HP', priceDelta: 0 },
    { name: '高性能', power: '1400HP', priceDelta: 120 },
    { name: '旗舰动力', power: '1800HP', priceDelta: 280 }
  ],
  // 动力板块新增:智能系统选配(单选,与动力方案叠加计价)
  smartSystems: [
    { name: '基础智能', desc: '自动导航 + 船况数据面板', priceDelta: 0 },
    { name: '进阶智驾', desc: '自动避障 + 远程诊断', priceDelta: 58 },
    { name: '智能领航 Pro', desc: 'AI 航线规划 + 全天候夜视', priceDelta: 138 },
    { name: '旗舰智控 Max', desc: '无人航行 + 船岸一体化中枢', priceDelta: 268 }
  ],
  extras: ['船尾酒吧', '水上摩托库', '潜水设备', '智能船载系统', '全景天窗', '船首浴池']
};

app.get('/api/customize/options', (req, res) => {
  res.json({ success: true, data: customizationOptions });
});

// ===== 字段管理：船型分类类型 =====
const boatCategories = [
  {
    id: 'leisure',
    name: '民用休闲',
    icon: 'leisure',
    children: [
      { id: 'luxury-yacht', name: '豪华游艇' },
      { id: 'sport-yacht', name: '运动游艇' },
      { id: 'speedboat', name: '快艇' },
      { id: 'fishing', name: '钓鱼艇' },
      { id: 'sailboat', name: '帆船' },
      { id: 'leisure-boat', name: '休闲船' }
    ]
  },
  {
    id: 'commercial',
    name: '商用船',
    icon: 'commercial',
    children: [
      { id: 'passenger', name: '客船' },
      { id: 'sightseeing', name: '观光船' },
      { id: 'transport', name: '运输船' },
      { id: 'fishing-commercial', name: '渔船' },
      { id: 'workboat', name: '工作船' },
      { id: 'engineering', name: '工程船' },
      { id: 'tugboat', name: '拖船' }
    ]
  },
  {
    id: 'government',
    name: '公务船',
    icon: 'government',
    children: [
      { id: 'patrol', name: '巡逻艇' },
      { id: 'enforcement', name: '执法艇' },
      { id: 'fireboat', name: '消防船' },
      { id: 'rescue', name: '救援船' },
      { id: 'pilot', name: '引航艇' },
      { id: 'research', name: '科考船' },
      { id: 'survey', name: '测量船' }
    ]
  },
  {
    id: 'military',
    name: '军用船',
    icon: 'military',
    children: [
      { id: 'patrol-mil', name: '巡逻艇' },
      { id: 'interceptor', name: '拦截艇' },
      { id: 'landing', name: '登陆艇' },
      { id: 'transport-mil', name: '运输艇' },
      { id: 'training', name: '训练艇' },
      { id: 'support', name: '保障艇' },
      { id: 'unmanned', name: '无人艇' }
    ]
  }
];

app.get('/api/boat-categories', (req, res) => {
  res.json({ success: true, data: boatCategories });
});

// 大类 CRUD
app.post('/api/admin/boat-categories', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: '名称不能为空' });
  const id = Date.now().toString(36);
  const cat = { id, name: name.trim(), icon: 'default', children: [] };
  boatCategories.push(cat);
  res.json({ success: true, message: '大类已添加', data: cat });
});

app.put('/api/admin/boat-categories/:id', (req, res) => {
  const cat = boatCategories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: '大类不存在' });
  if (req.body.name) cat.name = req.body.name.trim();
  res.json({ success: true, message: '大类已更新', data: cat });
});

app.delete('/api/admin/boat-categories/:id', (req, res) => {
  const idx = boatCategories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '大类不存在' });
  boatCategories.splice(idx, 1);
  res.json({ success: true, message: '大类已删除' });
});

// 小类 CRUD
app.post('/api/admin/boat-categories/:id/sub', (req, res) => {
  const cat = boatCategories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: '大类不存在' });
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: '名称不能为空' });
  const sub = { id: Date.now().toString(36) + 's', name: name.trim() };
  cat.children.push(sub);
  res.json({ success: true, message: '小类已添加', data: sub });
});

app.put('/api/admin/boat-categories/:id/sub/:subId', (req, res) => {
  const cat = boatCategories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: '大类不存在' });
  const sub = cat.children.find(s => s.id === req.params.subId);
  if (!sub) return res.status(404).json({ success: false, message: '小类不存在' });
  if (req.body.name) sub.name = req.body.name.trim();
  res.json({ success: true, message: '小类已更新', data: sub });
});

app.delete('/api/admin/boat-categories/:id/sub/:subId', (req, res) => {
  const cat = boatCategories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: '大类不存在' });
  const idx = cat.children.findIndex(s => s.id === req.params.subId);
  if (idx === -1) return res.status(404).json({ success: false, message: '小类不存在' });
  cat.children.splice(idx, 1);
  res.json({ success: true, message: '小类已删除' });
});

// 修改船型的大类/小类
app.put('/api/admin/boats/:id/category', (req, res) => {
  const boat = boats.find(b => b.id === parseInt(req.params.id));
  if (!boat) return res.status(404).json({ success: false, message: '船型不存在' });
  const { categoryId, subId } = req.body;
  const cat = boatCategories.find(c => c.id === categoryId);
  if (!cat) return res.status(400).json({ success: false, message: '大类不存在' });
  boat.category = cat.id;
  boat.categoryName = cat.name;
  if (subId) {
    const sub = cat.children.find(s => s.id === subId);
    if (sub) {
      boat.subtype = sub.id;
      boat.typeName = sub.name;
    }
  }
  res.json({ success: true, message: '船型分类已更新', data: { id: boat.id, name: boat.name, categoryName: boat.categoryName, typeName: boat.typeName } });
});

// 旧的类型管理 API（保留兼容）
app.get('/api/admin/boat-types', (req, res) => {
  const typeMap = {};
  boats.forEach(b => {
    const t = b.typeName || '未分类';
    if (!typeMap[t]) typeMap[t] = { name: t, count: 0, boats: [] };
    typeMap[t].count++;
    typeMap[t].boats.push({ id: b.id, name: b.name, typeName: b.typeName });
  });
  res.json({ success: true, data: Object.values(typeMap) });
});

app.post('/api/customize', (req, res) => {
  const { boatId, hullColor, interiorStyle, enginePackage, smartSystem, extras } = req.body;

  if (!boatId) {
    return res.status(400).json({ success: false, message: '请选择船型' });
  }

  const boat = boats.find(b => b.id === parseInt(boatId));
  if (!boat) {
    return res.status(404).json({ success: false, message: '未找到该船型' });
  }

  let extraPrice = 0;
  if (enginePackage) {
    const engine = customizationOptions.enginePackages.find(e => e.name === enginePackage);
    if (engine) extraPrice += engine.priceDelta;
  }
  if (smartSystem) {
    const smart = customizationOptions.smartSystems.find(s => s.name === smartSystem);
    if (smart) extraPrice += smart.priceDelta;
  }
  if (extras && Array.isArray(extras)) {
    extraPrice += extras.length * 35;
  }

  const basePrice = parseInt(boat.price.replace(/[^0-9]/g, ''));
  const totalPrice = basePrice + extraPrice;

  const order = {
    orderId: 'ORD-' + Date.now(),
    boatId: boat.id,
    boatName: boat.name,
    hullColor: hullColor || '纯白',
    interiorStyle: interiorStyle || '现代简约',
    enginePackage: enginePackage || '标准动力',
    smartSystem: smartSystem || '基础智能',
    extras: extras || [],
    basePrice: boat.price,
    extraPrice: extraPrice + '万',
    totalPrice: '¥' + totalPrice.toLocaleString() + '万',
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  res.status(201).json({
    success: true,
    message: '定制方案已生成',
    data: order
  });
});

app.get('/api/admin/orders', (req, res) => {
  res.json({ success: true, count: orders.length, data: orders });
});

app.get('/api/admin/drawings', (req, res) => {
  const drawings = orders.filter(o => o.type === '图纸定制');
  res.json({ success: true, count: drawings.length, data: drawings });
});

app.post('/api/admin/drawings/zip', (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '请至少选择一个文件' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=drawings-${Date.now()}.zip`);

  const archive = new archiver.ZipArchive({ zlib: { level: 5 } });
  archive.on('error', err => {
    console.error('Zip error:', err);
    res.status(500).json({ success: false, message: '打包失败' });
  });
  archive.pipe(res);

  const usedNames = {};
  items.forEach(item => {
    const filePath = path.join(uploadDir, item.savedAs);
    if (fs.existsSync(filePath)) {
      let name = item.originalName || item.savedAs;
      if (usedNames[name]) {
        usedNames[name]++;
        const dot = name.lastIndexOf('.');
        name = dot > -1
          ? name.slice(0, dot) + ` (${usedNames[name]})` + name.slice(dot)
          : name + ` (${usedNames[name]})`;
      } else {
        usedNames[name] = 1;
      }
      archive.file(filePath, { name });
    }
  });

  archive.finalize();
});

app.post('/api/admin/drawings/export', async (req, res) => {
  const ids = Array.isArray(req.body.orderIds) ? req.body.orderIds.map(String) : [];
  let drawings = await platformStore.submissions();
  if (Array.isArray(ids) && ids.length > 0) {
    drawings = drawings.filter(d => ids.includes(String(d.id)));
  }

  if (drawings.length === 0) {
    return res.status(400).json({ success: false, message: '暂无可导出的数据' });
  }

  try {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const baseUrl = process.env.PUBLIC_BASE_URL || `${forwardedProto || req.protocol}://${req.get('host')}`;
    const workbook = await buildDrawingWorkbook(drawings, { uploadDir, baseUrl });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('定制图纸_' + new Date().toISOString().slice(0,10))}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, message: '导出失败: ' + err.message });
  }
});

app.put('/api/admin/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const idx = orders.findIndex(o => o.orderId === orderId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  const allowed = ['hullColor', 'interiorStyle', 'enginePackage', 'smartSystem', 'extras', 'basePrice', 'extraPrice', 'totalPrice'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      orders[idx][field] = req.body[field];
    }
  });
  res.json({ success: true, message: '订单已更新', data: orders[idx] });
});

app.post('/api/admin/boats/:id/image', upload.single('image'), (req, res) => {
  const boatId = parseInt(req.params.id);
  const boat = boats.find(b => b.id === boatId);
  if (!boat) {
    return res.status(404).json({ success: false, message: '船型不存在' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择图片文件' });
  }
  boat.image = '/uploads/' + req.file.filename;
  res.json({ success: true, message: '图片上传成功', image: boat.image });
});

app.post('/api/admin/boats/:id/model', modelUpload.single('model'), (req, res) => {
  const boatId = parseInt(req.params.id);
  const boat = boats.find(b => b.id === boatId);
  if (!boat) {
    return res.status(404).json({ success: false, message: '船型不存在' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择模型文件' });
  }
  boat.modelFile = req.file.filename;
  res.json({ success: true, message: '模型上传成功', modelFile: boat.modelFile });
});

app.put('/api/admin/boats/:id/image', (req, res) => {
  const boatId = parseInt(req.params.id);
  const boat = boats.find(b => b.id === boatId);
  if (!boat) {
    return res.status(404).json({ success: false, message: '船型不存在' });
  }
  if (!req.body.image) {
    return res.status(400).json({ success: false, message: '缺少图片路径' });
  }
  boat.image = req.body.image;
  res.json({ success: true, message: '图片已恢复', image: boat.image });
});

app.put('/api/admin/boats/:id', (req, res) => {
  const boatId = parseInt(req.params.id);
  const boat = boats.find(b => b.id === boatId);
  if (!boat) {
    return res.status(404).json({ success: false, message: '船型不存在' });
  }
  const fields = ['name', 'description', 'length', 'capacity', 'maxSpeed', 'price', 'typeName', 'features', 'sceneImage'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      if (f === 'features') {
        boat.features = Array.isArray(req.body[f]) ? req.body[f] : String(req.body[f]).split('、').map(s => s.trim()).filter(Boolean);
      } else {
        boat[f] = req.body[f];
      }
    }
  });
  res.json({ success: true, message: '船型信息已更新', data: boat });
});

app.put('/api/admin/customize-options', (req, res) => {
  const { hullColors, interiorStyles, enginePackages, smartSystems } = req.body;
  if (hullColors) customizationOptions.hullColors = hullColors;
  if (interiorStyles) customizationOptions.interiorStyles = interiorStyles;
  if (enginePackages) customizationOptions.enginePackages = enginePackages;
  if (smartSystems) customizationOptions.smartSystems = smartSystems;
  res.json({ success: true, message: '定制选项已更新', data: customizationOptions });
});

app.post('/api/customize/upload', upload.array('files', 10), async (req, res, next) => {
  const { contactName, contactPhone, remark } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: '请至少上传一个图纸文件' });
  }
  if (!contactName || !contactPhone) {
    return res.status(400).json({ success: false, message: '请填写联系人和联系方式' });
  }

  const uploadRecords = req.files.map(f => ({
    originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
    savedAs: f.filename,
    size: f.size
  }));

  const order = {
    orderId: 'ORD-' + Date.now(),
    type: '图纸定制',
    contactName,
    contactPhone,
    remark: remark || '',
    files: uploadRecords,
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  try {
    await platformStore.saveSubmission(order);
  } catch (error) {
    return next(error);
  }

  res.status(201).json({
    success: true,
    message: '图纸提交成功',
    data: { orderId: order.orderId, fileCount: uploadRecords.length }
  });
});

/* ===== 认证接口 ===== */

// 获取密保问题列表（注册时选择）
app.get('/api/auth/questions', (req, res) => {
  res.json({ success: true, data: SECURITY_QUESTIONS });
});

// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;

  if (!username || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ success: false, message: '请填写所有必填项' });
  }
  const uname = String(username).trim();
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(uname)) {
    return res.status(400).json({ success: false, message: '用户名需为 3-16 位字母、数字、下划线或中文' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
  }
  if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
    return res.status(400).json({ success: false, message: '请选择有效的密保问题' });
  }
  if (String(securityAnswer).trim().length < 2) {
    return res.status(400).json({ success: false, message: '密保答案至少 2 个字符' });
  }

  const users = loadUsers();
  if (users.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
    return res.status(409).json({ success: false, message: '该用户名已被注册' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const newUser = {
    id: Date.now(),
    username: uname,
    salt,
    passwordHash: hashPassword(password, salt),
    securityQuestion,
    securityAnswer: String(securityAnswer).trim(),
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers(users);

  res.status(201).json({
    success: true,
    message: '注册成功，请登录',
    data: { username: newUser.username }
  });
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }

  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  res.json({
    success: true,
    message: '登录成功',
    data: { id: user.id, username: user.username, role: user.role || 'user' }
  });
});

// 根据用户名获取密保问题（找回密码第一步）
app.post('/api/auth/security-question', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: '请输入用户名' });
  }
  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: '未找到该用户' });
  }
  res.json({ success: true, data: { securityQuestion: user.securityQuestion } });
});

// 重置密码（找回密码第二步）
app.post('/api/auth/reset-password', (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;
  if (!username || !securityAnswer || !newPassword) {
    return res.status(400).json({ success: false, message: '请填写所有必填项' });
  }
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
  }

  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: '未找到该用户' });
  }
  if (String(user.securityAnswer).trim().toLowerCase() !== String(securityAnswer).trim().toLowerCase()) {
    return res.status(401).json({ success: false, message: '密保答案不正确' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  user.salt = salt;
  user.passwordHash = hashPassword(newPassword, salt);
  saveUsers(users);

  res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
});

// 检查用户名是否可用
app.get('/api/auth/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.json({ success: true, data: { available: false } });
  }
  const users = loadUsers();
  const exists = users.some(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  res.json({ success: true, data: { available: !exists } });
});

/* ===== 会员管理接口（管理员） ===== */
const INTENTION_LEVELS = ['高意向', '中意向', '低意向', '无意向'];
const MEMBER_STATUSES = ['正常', '禁用'];
const BOAT_TYPES_FOR_INTENTION = ['豪华游艇', '运动游艇', '救援船', '执法艇', '新能源船', '无人艇'];

// 确保用户记录包含会员资料字段
function ensureMemberFields(user) {
  if (!user.phone) user.phone = '';
  if (!user.intentionBoat) user.intentionBoat = '';
  if (!user.intentionLevel) user.intentionLevel = '无意向';
  if (!user.status) user.status = '正常';
  if (!user.consultant) user.consultant = '';
  if (!user.source) user.source = '自主注册';
  return user;
}

// 脱敏后返回会员信息（不暴露 salt / passwordHash / securityAnswer）
function toMemberDTO(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role || 'user',
    phone: user.phone || '',
    intentionBoat: user.intentionBoat || '',
    intentionLevel: user.intentionLevel || '无意向',
    status: user.status || '正常',
    consultant: user.consultant || '',
    source: user.source || '自主注册',
    createdAt: user.createdAt
  };
}

// 会员列表（支持筛选 + 分页）
app.get('/api/admin/members', (req, res) => {
  const { keyword, role, intentionLevel, status, page = 1, pageSize = 10 } = req.query;
  let users = loadUsers().map(ensureMemberFields);

  if (keyword) {
    const kw = String(keyword).trim().toLowerCase();
    users = users.filter(u =>
      String(u.username).toLowerCase().includes(kw) ||
      String(u.id).includes(kw) ||
      String(u.phone).includes(kw)
    );
  }
  if (role && role !== 'all') users = users.filter(u => u.role === role);
  if (intentionLevel && intentionLevel !== 'all') users = users.filter(u => u.intentionLevel === intentionLevel);
  if (status && status !== 'all') users = users.filter(u => u.status === status);

  // 持久化补充的字段（懒迁移）
  saveUsers(loadUsers().map(ensureMemberFields));

  const total = users.length;
  const p = Math.max(1, parseInt(page));
  const ps = Math.max(1, parseInt(pageSize));
  const start = (p - 1) * ps;
  const list = users.slice(start, start + ps).map(toMemberDTO);

  res.json({ success: true, data: { list, total, page: p, pageSize: ps } });
});

// 新增会员（管理员创建账号 + 资料）
app.post('/api/admin/members', (req, res) => {
  const { username, password, phone, intentionBoat, intentionLevel, status, consultant, source } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请填写用户名和初始密码' });
  }
  const uname = String(username).trim();
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(uname)) {
    return res.status(400).json({ success: false, message: '用户名需为 3-16 位字母、数字、下划线或中文' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
  }

  const users = loadUsers();
  if (users.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
    return res.status(409).json({ success: false, message: '该用户名已存在' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const newUser = ensureMemberFields({
    id: Date.now(),
    username: uname,
    salt,
    passwordHash: hashPassword(password, salt),
    role: 'user',
    phone: phone || '',
    intentionBoat: intentionBoat || '',
    intentionLevel: INTENTION_LEVELS.includes(intentionLevel) ? intentionLevel : '无意向',
    status: MEMBER_STATUSES.includes(status) ? status : '正常',
    consultant: consultant || '',
    source: source || '管理员录入',
    createdAt: new Date().toISOString()
  });
  users.push(newUser);
  saveUsers(users);

  res.status(201).json({ success: true, message: '会员添加成功', data: toMemberDTO(newUser) });
});

// 编辑会员资料
app.put('/api/admin/members/:id', (req, res) => {
  const id = req.params.id;
  const { phone, intentionBoat, intentionLevel, status, consultant, role, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => String(u.id) === String(id));
  if (!user) {
    return res.status(404).json({ success: false, message: '未找到该会员' });
  }

  ensureMemberFields(user);
  if (phone !== undefined) user.phone = String(phone).trim();
  if (intentionBoat !== undefined) user.intentionBoat = intentionBoat;
  if (INTENTION_LEVELS.includes(intentionLevel)) user.intentionLevel = intentionLevel;
  if (MEMBER_STATUSES.includes(status)) user.status = status;
  if (consultant !== undefined) user.consultant = String(consultant).trim();
  if (role === 'admin' || role === 'user') user.role = role;
  // 重置密码
  if (password && password.trim()) {
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: '密码格式应为6-18位数字、字母、符号的任意两种组合' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    user.salt = salt;
    user.passwordHash = hashPassword(password, salt);
  }
  saveUsers(users);

  res.json({ success: true, message: '会员资料已更新', data: toMemberDTO(user) });
});

// 删除会员
app.delete('/api/admin/members/:id', (req, res) => {
  const id = req.params.id;
  const users = loadUsers();
  const idx = users.findIndex(u => String(u.id) === String(id));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '未找到该会员' });
  }
  if (users[idx].role === 'admin') {
    return res.status(400).json({ success: false, message: '不可删除管理员账号' });
  }
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ success: true, message: '会员已删除' });
});

// 批量操作（删除 / 禁用 / 启用）
app.post('/api/admin/members/batch', (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要操作的会员' });
  }
  if (!['delete', 'disable', 'enable'].includes(action)) {
    return res.status(400).json({ success: false, message: '未知的批量操作' });
  }
  const users = loadUsers();
  let affected = 0;
  for (let i = users.length - 1; i >= 0; i--) {
    const u = users[i];
    if (!ids.includes(String(u.id)) && !ids.includes(u.id)) continue;
    if (action === 'delete') {
      if (u.role === 'admin') continue; // 保护管理员
      users.splice(i, 1);
      affected++;
    } else if (action === 'disable') {
      if (u.role === 'admin') continue;
      ensureMemberFields(u);
      u.status = '禁用';
      affected++;
    } else if (action === 'enable') {
      ensureMemberFields(u);
      u.status = '正常';
      affected++;
    }
  }
  saveUsers(users);
  res.json({ success: true, message: `已处理 ${affected} 条`, data: { affected } });
});

/* ===== 权限管理接口（预备） ===== */

// 获取角色列表
app.get('/api/admin/roles', (req, res) => {
  const roles = [
    { id: 1, name: '超级管理员', code: 'super_admin', permissions: ['*'], userCount: 0, remark: '拥有全部权限' },
    { id: 2, name: '管理员', code: 'admin', permissions: ['member:read', 'member:write', 'boat:read', 'boat:write', 'order:read'], userCount: 0, remark: '日常管理操作' },
    { id: 3, name: '销售顾问', code: 'consultant', permissions: ['member:read', 'member:write', 'order:read'], userCount: 0, remark: '会员与订单跟进' },
    { id: 4, name: '普通用户', code: 'user', permissions: ['boat:read'], userCount: 0, remark: '仅浏览权限' }
  ];
  const users = loadUsers();
  roles.forEach(r => {
    r.userCount = users.filter(u => u.role === r.code || (r.code === 'admin' && u.role === 'admin')).length;
  });
  res.json({ success: true, data: roles });
});

// 获取权限树
app.get('/api/admin/permissions', (req, res) => {
  const tree = [
    { id: 'member', name: '会员管理', children: [
      { id: 'member:read', name: '查看会员' },
      { id: 'member:write', name: '编辑会员' },
      { id: 'member:delete', name: '删除会员' }
    ]},
    { id: 'boat', name: '船型管理', children: [
      { id: 'boat:read', name: '查看船型' },
      { id: 'boat:write', name: '编辑船型' }
    ]},
    { id: 'order', name: '订单管理', children: [
      { id: 'order:read', name: '查看订单' },
      { id: 'order:write', name: '编辑订单' }
    ]},
    { id: 'system', name: '系统设置', children: [
      { id: 'system:config', name: '系统配置' },
      { id: 'system:permission', name: '权限管理' }
    ]}
  ];
  res.json({ success: true, data: tree });
});

// 创建 / 更新角色（预备）
app.post('/api/admin/roles', (req, res) => {
  res.json({ success: true, message: '角色创建接口预备中', data: null });
});

app.put('/api/admin/roles/:id', (req, res) => {
  res.json({ success: true, message: '角色更新接口预备中', data: null });
});

app.delete('/api/admin/roles/:id', (req, res) => {
  res.json({ success: true, message: '角色删除接口预备中', data: null });
});

/* ===== 公海会员接口（预备） ===== */

// 公海会员列表（无归属顾问的用户）
app.get('/api/admin/public-pool', (req, res) => {
  const { keyword, page = 1, pageSize = 10 } = req.query;
  let pool = loadUsers()
    .map(ensureMemberFields)
    .filter(u => !u.consultant || u.consultant.trim() === '');

  if (keyword) {
    const kw = String(keyword).trim().toLowerCase();
    pool = pool.filter(u =>
      String(u.username).toLowerCase().includes(kw) ||
      String(u.id).includes(kw) ||
      String(u.phone).includes(kw)
    );
  }

  const total = pool.length;
  const p = Math.max(1, parseInt(page));
  const ps = Math.max(1, parseInt(pageSize));
  const start = (p - 1) * ps;
  const list = pool.slice(start, start + ps).map(toMemberDTO);

  res.json({ success: true, data: { list, total, page: p, pageSize: ps } });
});

// 认领公海会员（分配顾问）
app.post('/api/admin/public-pool/claim', (req, res) => {
  const { memberId, consultant } = req.body;
  if (!memberId || !consultant) {
    return res.status(400).json({ success: false, message: '请指定认领的会员和顾问' });
  }
  const users = loadUsers();
  const u = users.find(x => String(x.id) === String(memberId));
  if (!u) return res.status(404).json({ success: false, message: '会员不存在' });
  ensureMemberFields(u);
  u.consultant = consultant;
  saveUsers(users);
  res.json({ success: true, message: '认领成功' });
});

// 释放到公海（清除顾问归属）
app.post('/api/admin/public-pool/release', (req, res) => {
  const { memberId } = req.body;
  if (!memberId) {
    return res.status(400).json({ success: false, message: '请指定释放的会员' });
  }
  const users = loadUsers();
  const u = users.find(x => String(x.id) === String(memberId));
  if (!u) return res.status(404).json({ success: false, message: '会员不存在' });
  ensureMemberFields(u);
  u.consultant = '';
  saveUsers(users);
  res.json({ success: true, message: '已释放到公海' });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件超过50MB限制' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    const status = Number(err.status) || (String(err.message).toLowerCase().includes('duplicate') ? 409 : 400);
    return res.status(status).json({ success: false, message: err.message });
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '船舶定制系统服务运行中', time: new Date().toISOString() });
});

async function startServer() {
  await platformStore.init();
  return app.listen(PORT, () => {
    console.log(`船舶定制系统已启动: http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('服务启动失败:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer, platformStore };
