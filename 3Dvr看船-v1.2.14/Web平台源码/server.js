const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const { PlatformStore } = require('./src/platform-store');
const { installPlatformRoutes } = require('./src/platform-routes');
const { buildDrawingWorkbook } = require('./src/drawing-workbook');
const { rateLimit } = require('./src/rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 仅信任本地反向代理（nginx）透传的真实客户端 IP，供限流与日志使用。
app.set('trust proxy', 'loopback');

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
// 模型文件名只保留安全字符，避免原始文件名中的 ../ 等成分造成路径穿越。
const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, modelUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '').slice(0, 80) || 'model';
    cb(null, uniqueSuffix + '-' + base + ext);
  }
});
const modelUpload = multer({
  storage: modelStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const exts = ['.fbx', '.gltf', '.glb', '.obj'];
    const ext = path.extname(file.originalname).toLowerCase();
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
if (modelUploadDir !== fbxDir) app.use('/FBX', express.static(modelUploadDir, { maxAge: '7d' }));
app.use('/FBX', express.static(path.join(__dirname, 'FBX'), { maxAge: '7d' }));
app.use('/uploads', express.static(uploadDir));
app.use('/vr-content', express.static(path.join(__dirname, 'vr-content'), {
  immutable: true,
  maxAge: '7d'
}));

// V1.2 数据与权限接口先注册，兼容并保护后面的原有 API。
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
app.use('/api/admin', requirePlatformAdmin);

// ===== 定制选项（定制页仍在使用） =====
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

// ===== 图纸提交（公众开放，写入数据库） =====
app.post('/api/customize/upload', rateLimit({ windowMs: 60 * 1000, max: 5, message: '提交过于频繁，请稍后再试' }), upload.array('files', 10), async (req, res, next) => {
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

// ===== 图纸导出 Excel（后台使用） =====
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
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('定制图纸_' + new Date().toISOString().slice(0, 10))}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, message: '导出失败: ' + err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件超过大小限制' });
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
  // 定期清理过期会话，避免 v12_sessions 无限增长。
  const sessionCleanup = setInterval(() => {
    platformStore.cleanupExpiredSessions().catch(err => console.error('会话清理失败:', err.message));
  }, 60 * 60 * 1000);
  sessionCleanup.unref();

  // 仅监听本地回环地址，对外统一由 nginx 反代，避免绕过限流与压缩。
  const HOST = process.env.HOST || '127.0.0.1';
  return app.listen(PORT, HOST, () => {
    console.log(`船舶定制系统已启动: http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('服务启动失败:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer, platformStore };
