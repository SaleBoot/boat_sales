const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { buildDrawingWorkbook } = require('../src/drawing-workbook');

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawing-export-'));
  const pngName = 'sample.png';
  fs.writeFileSync(path.join(tempDir, pngName), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lHhZVAAAAABJRU5ErkJggg==',
    'base64'
  ));

  const workbook = await buildDrawingWorkbook([
    {
      id: 'ORD-001', contact_name: '张三', contact_phone: '013800000001', remark: '需要报价',
      status: 'submitted', shipyard_name: '', created_at: '2026-09-01T06:50:00.000Z',
      files: [
        { originalName: '总布置图.png', savedAs: pngName, size: 1024 },
        { originalName: '船体参数.pdf', savedAs: 'drawing.pdf', size: 204800 }
      ]
    },
    {
      id: 'ORD-002', contact_name: '李四', contact_phone: '13900000002', remark: '=危险公式',
      status: 'contacted', shipyard_name: '测试船厂', created_at: '2026-09-01T07:50:00.000Z',
      files: [{ originalName: '结构图.dwg', savedAs: 'drawing.dwg', size: 3145728 }]
    }
  ], { uploadDir: tempDir, baseUrl: 'https://ship.example.com' });

  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);

  const summary = reloaded.getWorksheet('提交汇总');
  const details = reloaded.getWorksheet('图纸文件明细');
  assert(summary && details, '应包含汇总和文件明细工作表');
  assert.strictEqual(summary.rowCount, 3, '两位用户应生成两条提交汇总');
  assert.strictEqual(details.rowCount, 4, '三个文件应生成三条文件明细');
  assert.strictEqual(summary.getCell('D2').value, '013800000001', '手机号必须按文本完整保留');
  assert(String(summary.getCell('G2').value).includes('船体参数.pdf'), '汇总必须包含全部文件名');
  assert.strictEqual(details.getCell('F4').value, '结构图.dwg', '多用户最后一份文件不可遗漏');
  assert.strictEqual(details.getCell('J2').value.hyperlink, 'https://ship.example.com/uploads/sample.png', '应生成图纸下载链接');
  assert.strictEqual(summary.getCell('E3').value, "'=危险公式", '用户文本必须防止公式注入');
  assert(reloaded.model.media.length >= 1, '图片图纸应嵌入预览');

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('drawing-export-regression: ok (2 submissions, 3 files, 2 sheets, image preview)');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
