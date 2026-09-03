const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function escapedHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function element() {
  return {
    innerHTML: '',
    textContent: '',
    checked: false,
    indeterminate: false,
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}
  };
}

const elements = {
  drawingTbody: element(),
  drawingCount: element(),
  drawingCheckAll: element(),
  drawingPreviewOverlay: element(),
  drawingPreviewModal: element(),
  drawingPreviewTitle: element(),
  drawingPreviewBody: element()
};

const document = {
  addEventListener() {},
  querySelectorAll() { return []; },
  getElementById(id) { return elements[id] || null; },
  createElement() {
    let html = '';
    return {
      set textContent(value) { html = escapedHtml(value); },
      get innerHTML() { return html; }
    };
  }
};

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'members.js'), 'utf8');
const context = vm.createContext({
  document,
  window: {},
  localStorage: { getItem() { return null; }, removeItem() {} },
  location: { href: '' },
  console,
  setTimeout() {},
  clearTimeout() {},
  fetch: async () => { throw new Error('测试不应发起网络请求'); },
  URL,
  Blob,
  confirm() { return false; },
  prompt() { return null; }
});

vm.runInContext(source, context, { filename: 'members.js' });
vm.runInContext(`
  selectedDrawingIds = new Set();
  renderDrawings([{
    orderId: 'ORD-XSS',
    contactName: '<img src=x onerror=alert(1)>',
    contactPhone: '\"><script>alert(1)</script>',
    remark: '\"><iframe srcdoc="<script>alert(1)</script>"></iframe>',
    files: [{ savedAs: 'safe.png', originalName: '<svg onload=alert(1)>.png' }],
    createdAt: '2026-09-02T12:00:00.000Z'
  }]);
`, context);

const html = elements.drawingTbody.innerHTML;
assert(!html.includes('<script>'), '用户提交内容不能生成 script 元素');
assert(!html.includes('<iframe'), '用户提交内容不能生成 iframe 元素');
assert(!html.includes('<svg onload='), '文件名不能生成可执行 SVG 元素');
assert(!html.includes('onclick="previewDrawingFile'), '图纸预览不能通过内联脚本绑定');
assert(html.includes('&lt;iframe'), '恶意备注应作为普通文字显示');
assert(html.includes('&lt;svg onload=alert(1)&gt;.png'), '恶意文件名应作为普通文字显示');

console.log('drawing-ui-security-regression: ok (stored XSS rendered as text)');
