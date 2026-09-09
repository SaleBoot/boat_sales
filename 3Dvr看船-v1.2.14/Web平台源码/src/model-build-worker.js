const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');
const { validateGlb } = require('./glb-validation');

function run(command, args, logFile, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(logFile, 'a');
    const child = spawn(command, args, { stdio: ['ignore', log, log], timeout, killSignal: 'SIGKILL' });
    fs.closeSync(log);
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`构建命令失败 (${code ?? signal})，请查看构建日志`)));
  });
}

async function buildModel(row, options) {
  if (!/^[a-zA-Z0-9_-]+$/.test(row.variant_id)) throw new Error('模型版本标识无效');
  if (!row.source_file?.startsWith('/FBX/')) throw new Error('模型源路径必须位于公司模型目录');
  const root = fs.realpathSync(options.modelRoot);
  const source = fs.realpathSync(path.resolve(root, row.source_file.slice(5)));
  if (!source.startsWith(root + path.sep) || path.extname(source).toLowerCase() !== '.glb') throw new Error('只支持模型目录内的 GLB');
  const summary = validateGlb(source);
  const output = path.join(options.contentRoot, 'uploads', row.variant_id);
  fs.mkdirSync(output, { recursive: true });
  const log = path.join(output, 'build.log');
  await run(options.unity, ['-batchmode', '-nographics', '-quit', '-buildTarget', 'Android',
    '-projectPath', options.project, '-executeMethod', 'ShipModelBuilder.Build',
    '-shipSource', source, '-shipOutput', output, '-logFile', path.join(output, 'unity.log')], log);
  const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
  if (!report.renderers || (summary.images && !report.textures)) throw new Error('构建包缺少网格或贴图');
  const bundle = fs.readFileSync(path.join(output, 'ship.bundle'));
  if (bundle.subarray(0, 7).toString() !== 'UnityFS') throw new Error('Unity 未生成有效模型包');
  const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
  const filename = `${sha256}.bundle`;
  fs.renameSync(path.join(output, 'ship.bundle'), path.join(output, filename));
  // Content-addressed names prevent a rebuilt model from hitting an older immutable cache entry.
  if (options.publicUrl) {
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    await verifyDownload(new URL(row.source_file, options.publicUrl), sourceHash, true);
    await verifyDownload(new URL(`/vr-content/android/uploads/${row.variant_id}/${filename}`, options.publicUrl), sha256, true);
  }
  return { file: `uploads/${row.variant_id}/${filename}`, version: sha256.slice(0, 16), sha256, size: bundle.length };
}

async function verifyDownload(url, expectedHash, requireCache = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`腾讯云缓存不可用 (${response.status})`);
  const hash = crypto.createHash('sha256');
  for await (const chunk of response.body) hash.update(chunk);
  if (hash.digest('hex') !== expectedHash) throw new Error('腾讯云缓存文件校验失败');
  if (requireCache) {
    const cached = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!cached.ok || cached.headers.get('x-cache-status') !== 'HIT') throw new Error('腾讯云缓存尚未就绪，暂不能上架');
  }
}

async function drainQueue(pool, options, build = buildModel) {
  for (;;) {
    const row = (await pool.query("UPDATE v12_vr_models SET processing_status='building',processing_error='' WHERE variant_id=(SELECT variant_id FROM v12_vr_models WHERE processing_status='pending' AND source_file<>'' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING variant_id,source_file")).rows[0];
    if (!row) return;
    try {
      const asset = await build(row, options);
      await pool.query("UPDATE v12_vr_models SET asset_format='assetbundle',bundle_file=$2,bundle_version=$3,bundle_size=$4,bundle_sha256=$5,processing_status='ready',processing_error='',updated_at=CURRENT_TIMESTAMP WHERE variant_id=$1",
        [row.variant_id, asset.file, asset.version, asset.size, asset.sha256]);
    } catch (error) {
      await pool.query("UPDATE v12_vr_models SET processing_status='failed',processing_error=$2,updated_at=CURRENT_TIMESTAMP WHERE variant_id=$1", [row.variant_id, error.message.slice(0, 500)]);
    }
  }
}

async function main() {
  for (const name of ['DATABASE_URL','UNITY_PATH','UNITY_PROJECT_DIR','MODEL_UPLOAD_DIR','VR_CONTENT_DIR','MODEL_CACHE_PUBLIC_URL'])
    if (!process.env[name]) throw new Error(`缺少配置 ${name}`);
  const projects = process.env.UNITY_PROJECT_DIR.split(path.delimiter).map(dir => fs.realpathSync(dir));
  if (new Set(projects).size !== projects.length) throw new Error('并行构建必须使用独立 Unity 工程');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(7121701) AS locked');
    if (!lock.rows[0].locked) return;
    await client.query("UPDATE v12_vr_models SET processing_status='pending' WHERE processing_status='building'");
    const results = await Promise.allSettled(projects.map(project => drainQueue(pool, {
      unity: process.env.UNITY_PATH, project, modelRoot: process.env.MODEL_UPLOAD_DIR,
      contentRoot: process.env.VR_CONTENT_DIR, publicUrl: process.env.MODEL_CACHE_PUBLIC_URL
    })));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  } finally { await client.query('SELECT pg_advisory_unlock(7121701)'); client.release(); await pool.end(); }
}

module.exports = { buildModel, verifyDownload, drainQueue };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
