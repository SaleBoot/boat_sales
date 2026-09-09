const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/js/vr-screen.js'), 'utf8').replace(/\ntick\(\);\s*$/, '');
(async () => {
  for (const scenario of ['status-failure-live-video', 'sdk-reconnecting', 'publisher-connecting', 'unauthorized']) {
    const elements = Object.fromEntries(['frame','waiting','status','fit','play','back','exit','fullscreen','screen'].map(id => [id, { hidden: true, textContent: '', dataset: {} }]));
    Object.assign(elements.frame, { srcObject: {}, currentTime: 5, readyState: 2, paused: false });
    let disconnects = 0;
    const context = vm.createContext({
      document: { getElementById: id => elements[id] }, window: { addEventListener() {} },
      history: { length: 1 }, location: { assign() {} }, AbortSignal,
      Date: { now: () => 30000 }, setTimeout() {}, clearTimeout() {},
      disconnectSpy: () => { disconnects++; },
      fetch: async () => {
        if (scenario === 'status-failure-live-video') throw new Error('temporary network failure');
        return { status: scenario === 'unauthorized' ? 401 : 200, ok: scenario !== 'unauthorized', json: async () => ({ online: true, stage: 'connecting' }) };
      }
    });
    vm.runInContext(source, context);
    vm.runInContext('room={removeAllListeners(){},disconnect:disconnectSpy}; connectedAt=1;', context);
    if (scenario !== 'status-failure-live-video') Object.assign(elements.frame, { srcObject: null, currentTime: 0, readyState: 0 });
    if (scenario === 'sdk-reconnecting') vm.runInContext('reconnecting=true;', context);
    await vm.runInContext('tick()', context);
    assert.equal(disconnects, scenario === 'unauthorized' ? 1 : 0, scenario);
    if (scenario === 'status-failure-live-video') {
      assert.equal(elements.frame.hidden, false);
      assert.equal(elements.status.textContent, '正在直播 VR 视角');
    }
    if (scenario === 'unauthorized') assert.equal(elements.frame.srcObject, null);
  }
  console.log('PASS: live frames survive status failure; negotiation is not torn down; unauthorized viewers disconnect');
})().catch(error => { console.error(error); process.exitCode = 1; });
