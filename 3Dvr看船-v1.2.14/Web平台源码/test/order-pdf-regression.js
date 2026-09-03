const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateOrderPdf } = require('../src/order-pdf');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const order = {
    orderId: 'CFG-PDF-QA-001', createdAt: '2026-09-02 12:00:00', customerName: '测试客户',
    customerPhone: '13800000000', customerNote: '用于PDF导出回归验证', manufacturer: '京穗船舶',
    boatName: 'JS-108客位铝合金游览船', shipId: 'js108', variantId: 'js108-standard', variantName: '标准内饰',
    categoryName: '商用船', typeName: '观光船', length: '22.15米', capacity: '108客位', maxSpeed: '资料待确认',
    selections: {
      appearance: { tabLabel: '外观', optionName: '深海蓝', color: '#1B3A5B', priceDeltaYuan: 18000 },
      interior: { tabLabel: '内饰', optionName: '标准内饰', priceDeltaYuan: 0 },
      power: { tabLabel: '动力', optionName: '增强动力', priceDeltaYuan: 120000 }
    },
    basePriceYuan: 12800000, optionPriceYuan: 138000, totalPriceYuan: 12938000,
    pricingNote: '系统模拟参考价，最终以厂家正式报价为准。'
  };
  const pdf = await generateOrderPdf(order, rootDir);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 3000, 'PDF文件必须包含完整报价内容');
  const outputDir = process.env.PDF_QA_OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'ship-order-pdf-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const output = path.join(outputDir, '定制方案报价单_测试样本.pdf');
  fs.writeFileSync(output, pdf);
  console.log(`订单PDF回归测试通过：${output}`);
}

main().catch(error => { console.error(error); process.exit(1); });
