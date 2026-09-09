// Company-server only: tests the real service coordinator with invalid QA inputs,
// not Unity rendering. Real Unity output is covered by the separate parallel QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const root = '/home/cqypxl/ship-platform-api-6060';
const review = `${root}/review-20260909`;
const service = 'ship-model-build@qa.service';
const timer = 'ship-model-build@qa.timer';
const systemctl = (...args) => execFileSync('systemctl', ['--user', ...args], { encoding: 'utf8' });
(async () => {
    assert.equal(process.env.HOME, '/home/cqypxl');
    const container = JSON.parse(execFileSync('docker', ['inspect', 'ship-platform-local-postgres16'], { encoding: 'utf8' }))[0];
    assert(container.NetworkSettings.Ports['5432/tcp'].some(p => p.HostPort === '15433'));
    const env = Object.fromEntries(container.Config.Env.map(item => { const p = item.indexOf('='); return [item.slice(0, p), item.slice(p + 1)]; }));
    const database = 'ship_build_service_qa_20260909';
    const config = { host: '127.0.0.1', port: 15433, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: 'postgres' };
    const admin = new Pool(config);
    try {
        if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query(`CREATE DATABASE ${database}`);
    } finally { await admin.end(); }
    const pool = new Pool({ ...config, database });
    const url = new URL(`postgresql://127.0.0.1:15433/${database}`);
    url.username = config.user; url.password = config.password;
    const settings = {
        DATABASE_URL: url.href, NODE_PATH: `${root}/current/node_modules`, MODEL_BUILD_NODE: process.execPath,
        MODEL_BUILD_WORKER: `${review}/pg-qa/src/model-build-worker.js`,
        UNITY_PATH: `${root}/unity/editors/2022.3.52f1/Editor/Unity`,
        UNITY_PROJECT_DIR: `${review}/Worker1:${review}/Worker2`,
        MODEL_UPLOAD_DIR: `${review}/service-qa-models`,
        VR_CONTENT_DIR: `${review}/service-qa-output`,
        MODEL_CACHE_PUBLIC_URL: 'http://127.0.0.1:1'
    };
    fs.mkdirSync(settings.MODEL_UPLOAD_DIR, { recursive: true });
    fs.mkdirSync(settings.VR_CONTENT_DIR, { recursive: true });
    fs.mkdirSync(`${root}/shared/build-config`, { recursive: true, mode: 0o700 });
    const envFile = `${root}/shared/build-config/qa.env`;
    fs.writeFileSync(envFile, Object.entries(settings).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(envFile, 0o600);
    try {
        systemctl('stop', timer, service);
        await pool.query(`CREATE TABLE IF NOT EXISTS v12_vr_models (
            variant_id text PRIMARY KEY, source_file text, processing_status text,
            processing_error text DEFAULT '', updated_at timestamptz DEFAULT now(),
            asset_format text, bundle_file text, bundle_version text, bundle_size bigint, bundle_sha256 text)`);
        const id = `qa-recovery-${Date.now()}`;
        await pool.query("INSERT INTO v12_vr_models(variant_id,source_file,processing_status) VALUES($1,'/invalid-source','building')", [id]);
        systemctl('start', service);
        const recovered = (await pool.query('SELECT * FROM v12_vr_models WHERE variant_id=$1', [id])).rows[0];
        assert.equal(recovered.processing_status, 'failed');
        assert.match(recovered.processing_error, /模型源路径/);
        assert.equal(systemctl('show', service, '-p', 'Result', '--value').trim(), 'success');
        const queued = `${id}-queued`;
        await pool.query("INSERT INTO v12_vr_models(variant_id,source_file,processing_status) VALUES($1,'/invalid-source','pending')", [queued]);
        systemctl('enable', '--now', timer);
        const deadline = Date.now() + 45000;
        let status;
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            status = (await pool.query('SELECT processing_status FROM v12_vr_models WHERE variant_id=$1', [queued])).rows[0].processing_status;
        } while (status === 'pending' && Date.now() < deadline);
        assert.equal(status, 'failed', 'Timer must claim newly queued work without an SSH-attached worker');
        assert.equal(systemctl('is-enabled', timer).trim(), 'enabled');
        assert.equal(execFileSync('loginctl', ['show-user', 'cqypxl', '-p', 'Linger', '--value'], { encoding: 'utf8' }).trim(), 'yes');
        console.log('PASS: real systemd queue timer, interrupted-job recovery, persisted pending jobs, user lingering and boot enablement');
        console.log('Not tested: physical server reboot, successful upload-to-Unity-to-cache pipeline');
    } finally {
        systemctl('disable', '--now', timer);
        systemctl('stop', service);
        await pool.end();
        fs.unlinkSync(envFile);
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
