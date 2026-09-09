const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const container = 'ship-platform-postgres16-6060';
assert.equal(process.env.PGPORT, '15432');
assert.equal(process.env.PGDATABASE, 'salesboat');
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert(info.NetworkSettings.Ports['5432/tcp'].some(port => port.HostPort === process.env.PGPORT));
const directory = path.join(process.env.HOME, 'ship-platform-api-6060/backups', `final-${Date.now()}`);
fs.mkdirSync(directory, { mode: 0o700 });
const dump = path.join(directory, 'salesboat.dump');
let fd = fs.openSync(dump, 'wx', 0o600);
try {
  execFileSync('docker', ['exec', '-e', 'PGPASSWORD', container, 'pg_dump', '-U', process.env.PGUSER,
    '-d', process.env.PGDATABASE, '-Fc'], { stdio: ['ignore', fd, 'pipe'] });
} finally { fs.closeSync(fd); }
fd = fs.openSync(dump, 'r');
try {
  const list = execFileSync('docker', ['exec', '-i', container, 'pg_restore', '--list'],
    { stdio: [fd, 'pipe', 'pipe'], encoding: 'utf8' });
  assert(list.includes('v12_vr_models'));
  assert(list.includes('v12_users'));
} finally { fs.closeSync(fd); }
console.log(JSON.stringify({ dump, bytes: fs.statSync(dump).size, archiveReadable: true, restoreTested: false }));
