const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));
function boot(file, replies, parent) {
  const timers = new Map(), events = {}, requests = [];
  let next = 0, removed = false;
  const element = () => ({ prepend() {}, appendChild() {}, append() {}, replaceChildren() {}, setAttribute() {}, querySelectorAll: () => [], classList: { add() {} } });
  const window = { location: {}, addEventListener: (name, cb) => { events[name] = cb; }, postMessage() {} };
  window.top = parent || window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), {
    window, location: { origin: 'http://qa.test' }, Map, Set, AbortSignal,
    document: { head: element(), body: element(), createElement: element, querySelector: () => null, querySelectorAll: () => [], addEventListener: (name, cb) => { events[name] = cb; } },
    localStorage: { getItem: () => JSON.stringify({ role: 'sales' }), setItem() {}, removeItem() { removed = true; } },
    setTimeout: (fn, ms) => { timers.set(++next, { fn, ms }); return next; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      requests.push({ url, options });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      if (typeof reply === 'function') return reply();
      assert(reply, 'Unexpected extra request');
      return { status: reply.status, ok: reply.status === 200, json: async () => reply.body };
    }
  });
  return { timers, events, requests, window, removed: () => removed, async tick() {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); await timer.fn(); await flush();
  } };
}
(async () => {
  const auth = boot('session-watch.js', [
    { status: 502 }, new Error('offline'), { status: 200, body: {} },
    { status: 200, body: { success: true, data: { role: 'sales' } } }, { status: 401 }
  ]);
  await flush();
  assert(!auth.removed()); assert.equal([...auth.timers.values()][0].ms, 40000);
  await auth.tick(); assert(!auth.removed());
  await auth.tick(); assert(!auth.removed());
  await auth.tick(); assert.equal([...auth.timers.values()][0].ms, 20000);
  await auth.tick(); assert(auth.removed());
  await auth.tick(); assert.equal(auth.window.location.href, '/login.html');
  assert.equal(auth.timers.size, 0);
  assert(auth.requests.every(r => r.options.signal && r.options.cache === 'no-store'));
  const child = boot('session-watch.js', [], { __shipSessionWatch: true });
  assert.equal(child.requests.length, 0);
  let release;
  const pending = boot('session-watch.js', [() => new Promise(resolve => { release = resolve; })]);
  pending.events.online(); pending.events.online();
  assert.equal(pending.requests.length, 1);
  release({ status: 200, ok: true, json: async () => ({ success: true, data: {} }) });
  await flush(); assert.equal(pending.timers.size, 1);
  const progress = boot('model-build-progress.js', [
    { status: 500 }, new Error('timeout'), { status: 200, body: { data: [] } }, { status: 403 }
  ]);
  await flush(); assert.equal([...progress.timers.values()][0].ms, 6000);
  await progress.tick(); assert.equal([...progress.timers.values()][0].ms, 12000);
  await progress.tick(); assert.equal([...progress.timers.values()][0].ms, 15000);
  await progress.tick(); assert.equal(progress.timers.size, 0);
  progress.window.ShipBuildProgress.refresh(); assert.equal(progress.requests.length, 4);
  console.log('PASS: transient errors preserve login; 401 logs out; bounded serial polling, iframe deduplication, build backoff and permission stop');
})().catch(error => { console.error(error); process.exitCode = 1; });
