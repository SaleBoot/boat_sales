const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = '/home/cqypxl/ship-platform-api-6060';
const backup = `${root}/backups/final-switch-20260909`;
const stage = `${root}/review-20260909/final-release`;
const unit = 'ship-platform-api.service';
const systemctl = (...args) => execFileSync('systemctl', ['--user', ...args], { stdio: 'pipe' });
(async () => {
  const pid = Number(process.argv[2]);
  assert(Number.isInteger(pid) && pid > 1);
  assert.equal(fs.readlinkSync(`/proc/${pid}/cwd`), `${root}/current`);
  assert(fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('server.js'));
  assert(fs.statSync(`${backup}/code.tar.gz`).size > 0);
  fs.copyFileSync(`${root}/env`, `${backup}/env`, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(`${backup}/env`, 0o600);
  const env = parseEnv(fs.readFileSync(`${root}/env`, 'utf8'));
  Object.assign(env, { TRUSTED_PROXIES: 'loopback,10.101.10.50/32',
    VR_CONTENT_ROOT: `${root}/shared/vr-release-20260909`,
    VR_CONTENT_DIR: `${root}/shared/vr-release-20260909/android` });
  fs.writeFileSync(`${root}/env.next`, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  fs.mkdirSync(`${process.env.HOME}/.config/systemd/user`, { recursive: true });
  fs.copyFileSync(`${stage}/deploy/${unit}`, `${process.env.HOME}/.config/systemd/user/${unit}`);
  systemctl('daemon-reload');
  try {
    process.kill(pid, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1500));
    execFileSync('rsync', ['-a', `${stage}/`, `${root}/current/`], { stdio: 'pipe' });
    fs.renameSync(`${root}/env.next`, `${root}/env`);
    systemctl('start', unit);
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const response = await fetch('http://10.100.100.1:6060/api/auth/me', { signal: AbortSignal.timeout(2000) });
        if (response.status === 401) { healthy = true; break; }
      } catch {}
    }
    assert(healthy, 'New API health check failed');
    systemctl('enable', unit);
    console.log('Company API replaced, authentication gate responds 401, service enabled');
  } catch (error) {
    try { systemctl('stop', unit); } catch {}
    execFileSync('tar', ['-xzf', `${backup}/code.tar.gz`, '-C', `${root}/current`]);
    fs.copyFileSync(`${backup}/env`, `${root}/env`);
    systemctl('start', unit);
    throw error;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
