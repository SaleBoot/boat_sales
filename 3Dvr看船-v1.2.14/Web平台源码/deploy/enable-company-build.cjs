const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = '/home/cqypxl/ship-platform-api-6060';
const env = parseEnv(fs.readFileSync(`${root}/env`, 'utf8'));
const url = new URL(`postgresql://${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`);
url.username = env.PGUSER; url.password = env.PGPASSWORD;
const settings = {
  DATABASE_URL: url.href, MODEL_BUILD_NODE: process.execPath,
  MODEL_BUILD_WORKER: `${root}/current/src/model-build-worker.js`,
  UNITY_PATH: `${root}/unity/editors/2022.3.52f1/Editor/Unity`,
  UNITY_PROJECT_DIR: `${root}/review-20260909/Worker1:${root}/review-20260909/Worker2`,
  MODEL_UPLOAD_DIR: env.MODEL_UPLOAD_DIR, VR_CONTENT_DIR: env.VR_CONTENT_DIR,
  MODEL_CACHE_PUBLIC_URL: 'http://1.14.77.78'
};
for (const key of ['MODEL_BUILD_NODE', 'MODEL_BUILD_WORKER', 'UNITY_PATH', 'MODEL_UPLOAD_DIR', 'VR_CONTENT_DIR']) assert(fs.existsSync(settings[key]), key);
for (const project of settings.UNITY_PROJECT_DIR.split(':')) assert(fs.existsSync(project));
assert.equal(execFileSync('loginctl', ['show-user', 'cqypxl', '-p', 'Linger', '--value'], { encoding: 'utf8' }).trim(), 'yes');
fs.mkdirSync(`${root}/shared/build-config`, { recursive: true, mode: 0o700 });
fs.writeFileSync(`${root}/shared/build-config/production.env`, Object.entries(settings).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
for (const extension of ['service', 'timer']) fs.copyFileSync(`${root}/current/deploy/ship-model-build@.${extension}`, `${process.env.HOME}/.config/systemd/user/ship-model-build@.${extension}`);
execFileSync('systemctl', ['--user', 'daemon-reload']);
execFileSync('systemctl', ['--user', 'enable', '--now', 'ship-model-build@production.timer']);
console.log('Production model queue timer enabled with two existing verified Unity projects');
