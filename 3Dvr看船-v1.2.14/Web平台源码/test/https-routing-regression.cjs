// Run on Tencent with sudo. Uses a private Nginx process, never reloads production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-https-qa-'));
const nginx = '/usr/sbin/nginx';
let started = false;
function request(route, { ar = false, post = false } = {}) {
    const args = ['--silent', '--show-error', '--max-time', '30', '--noproxy', '*'];
    if (!ar) args.push('--connect-to', '1.14.77.78:8443:127.0.0.1:18443');
    if (post) args.push('-H', 'Content-Type: application/json', '--data', '{}');
    args.push('-o', `${root}/response`, '-w', '%{http_code}', `https://1.14.77.78${ar ? '' : ':8443'}${route}`);
    const status = Number(execFileSync('curl', args, { encoding: 'utf8' }));
    const body = fs.statSync(`${root}/response`).size < 100000 ? fs.readFileSync(`${root}/response`, 'utf8') : '';
    return { status, body };
}
try {
    const original = fs.readFileSync(path.join(__dirname, '../deploy/ship-https.conf'), 'utf8');
    assert(original.includes('proxy_set_header Host $http_host;'));
    assert(original.includes('client_max_body_size 310m;'));
    assert(original.includes('proxy_cookie_flags ship_session secure httponly samesite=lax;'));
    const config = original.replace('listen 8443 ssl;', 'listen 127.0.0.1:18443 ssl;')
        .replace('/srv/ship-twin/current/', `${root}/twin/`);
    fs.cpSync('/srv/ship-platform/current/twin', `${root}/twin`, { recursive: true });
    // Nginx workers need traverse permission, but no QA secrets are written here.
    fs.chmodSync(root, 0o755);
    fs.writeFileSync(`${root}/nginx.conf`, `pid ${root}/nginx.pid;
error_log ${root}/error.log;
events {}
http {
include /etc/nginx/mime.types;
access_log off;
proxy_cache_path ${root}/cache keys_zone=ship_model_cache:1m max_size=10m;
${config}
}`);
    execFileSync(nginx, ['-t', '-c', `${root}/nginx.conf`]);
    execFileSync(nginx, ['-c', `${root}/nginx.conf`]);
    started = true;
    const login = request('/login.html');
    assert.equal(login.status, 200);
    assert(login.body.includes('https://1.14.77.78/'));
    for (const route of ['/twin/?boat=20', '/twin/twin.js', '/vendor/three/three.module.js', '/vendor/cesium/Cesium.js']) {
        assert.equal(request(route).status, 200, route);
    }
    assert.equal(request('/twin?boat=20').status, 302);
    assert.equal(request('/geo-twin?boat=20').status, 302);
    assert.equal(request('/api/auth/me').status, 401);
    assert.equal(request('/api/vr/screen/status').status, 401);
    assert.equal(request('/api/boats').status, 200);
    const catalog = JSON.parse(fs.readFileSync(`${root}/response`, 'utf8'));
    assert(catalog.success && catalog.data.length > 0);
    const unsafe = [];
    function inspect(value, key = '') {
        if (Array.isArray(value)) return value.forEach(item => inspect(item, key));
        if (value && typeof value === 'object') return Object.entries(value).forEach(([k, v]) => inspect(v, k));
        if (typeof value === 'string' && /^(http|ws):\/\//i.test(value) && /url|file|image|model/i.test(key)) unsafe.push(key);
    }
    inspect(catalog.data);
    assert.deepEqual(unsafe, [], 'Mixed-content asset URLs in the published catalog');
    assert.equal(request('/twin/not-a-real-file.js').status, 404);
    const health = request('/api/health', { ar: true });
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).app, 'ship-ar-repair');
    assert.equal(request('/api/me', { ar: true }).status, 401);
    console.log('HTTPS_ROUTING_QA_OK: isolated HTTPS, twin assets, legacy redirects, protected APIs, AR unchanged');
} finally {
    if (started) execFileSync(nginx, ['-s', 'quit', '-c', `${root}/nginx.conf`]);
    // Keep the small QA directory and error log for failure diagnosis.
    console.log(`QA evidence: ${root}`);
}
