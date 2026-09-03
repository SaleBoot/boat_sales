const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp']);

function safeText(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fileExtension(file) {
  return path.extname(String(file.originalName || file.savedAs || '')).slice(1).toLowerCase();
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replaceAll('/', '-');
}

function normalizeDrawing(row) {
  return {
    orderId: row.orderId || row.id || '',
    contactName: row.contactName || row.contact_name || '',
    contactPhone: row.contactPhone || row.contact_phone || '',
    remark: row.remark || '',
    status: row.status || 'submitted',
    shipyardName: row.shipyardName || row.shipyard_name || '',
    adminNote: row.adminNote || row.admin_note || '',
    createdAt: row.createdAt || row.created_at || '',
    files: Array.isArray(row.files) ? row.files : []
  };
}

function fileUrl(baseUrl, file) {
  if (!file.savedAs) return '';
  return `${String(baseUrl || '').replace(/\/$/, '')}/uploads/${encodeURIComponent(file.savedAs)}`;
}

function styleWorksheet(sheet, columnWidths) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columnWidths.length).letter}1` };
  columnWidths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });

  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, cell => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } };
      if (rowIndex % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }
}

async function buildDrawingWorkbook(rows, options = {}) {
  const drawings = rows.map(normalizeDrawing);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '船舶定制系统';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('提交汇总');
  summary.addRow(['序号', '订单号', '联系人', '手机号', '备注', '文件数', '全部图纸文件名', '处理状态', '分配船厂', '管理员备注', '提交时间']);
  drawings.forEach((drawing, index) => {
    summary.addRow([
      index + 1,
      safeText(drawing.orderId),
      safeText(drawing.contactName),
      safeText(drawing.contactPhone),
      safeText(drawing.remark),
      drawing.files.length,
      drawing.files.map(file => safeText(file.originalName || file.savedAs)).join('\n'),
      safeText(drawing.status),
      safeText(drawing.shipyardName),
      safeText(drawing.adminNote),
      formatDateTime(drawing.createdAt)
    ]);
  });
  styleWorksheet(summary, [7, 24, 14, 18, 30, 9, 42, 14, 22, 30, 22]);
  summary.getColumn(2).numFmt = '@';
  summary.getColumn(4).numFmt = '@';

  const details = workbook.addWorksheet('图纸文件明细');
  details.addRow(['序号', '订单号', '联系人', '手机号', '文件序号', '图纸文件名', '文件格式', '文件大小', '图纸预览', '下载链接', '备注', '提交时间']);
  let detailIndex = 0;
  drawings.forEach(drawing => {
    drawing.files.forEach((file, fileIndex) => {
      detailIndex += 1;
      const extension = fileExtension(file);
      const url = fileUrl(options.baseUrl, file);
      const row = details.addRow([
        detailIndex,
        safeText(drawing.orderId),
        safeText(drawing.contactName),
        safeText(drawing.contactPhone),
        fileIndex + 1,
        safeText(file.originalName || file.savedAs),
        extension.toUpperCase(),
        formatBytes(file.size),
        IMAGE_EXTENSIONS.has(extension) ? '图片预览' : '—',
        url ? { text: '打开或下载图纸', hyperlink: url, tooltip: file.originalName || file.savedAs } : '',
        safeText(drawing.remark),
        formatDateTime(drawing.createdAt)
      ]);

      if (!IMAGE_EXTENSIONS.has(extension) || !options.uploadDir || !file.savedAs) return;
      const filePath = path.join(options.uploadDir, file.savedAs);
      if (!fs.existsSync(filePath)) return;
      try {
        const imageId = workbook.addImage({
          buffer: fs.readFileSync(filePath),
          extension: extension === 'jpg' ? 'jpeg' : extension
        });
        row.height = 76;
        details.addImage(imageId, {
          tl: { col: 8.08, row: row.number - 0.92 },
          ext: { width: 105, height: 68 },
          editAs: 'oneCell'
        });
      } catch (error) {
        details.getCell(row.number, 9).value = '预览生成失败';
      }
    });
  });
  styleWorksheet(details, [7, 24, 14, 18, 10, 38, 12, 14, 18, 24, 30, 22]);
  details.getColumn(2).numFmt = '@';
  details.getColumn(4).numFmt = '@';
  details.getColumn(10).font = { color: { argb: 'FF2563EB' }, underline: true };

  return workbook;
}

module.exports = { buildDrawingWorkbook, formatBytes, normalizeDrawing };
