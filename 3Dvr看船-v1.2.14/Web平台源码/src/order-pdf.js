const path = require('path');
const { spawn } = require('child_process');

function generateOrderPdf(order, rootDir) {
  return new Promise((resolve, reject) => {
    const executable = process.env.PDF_PYTHON || 'python3';
    const script = path.join(rootDir, 'scripts', 'generate_order_pdf.py');
    const child = spawn(executable, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    const errors = [];
    child.stdout.on('data', chunk => output.push(chunk));
    child.stderr.on('data', chunk => errors.push(chunk));
    child.on('error', error => reject(Object.assign(new Error(`PDF生成器无法启动：${error.message}`), { status: 500 })));
    child.on('close', code => {
      if (code !== 0) return reject(Object.assign(new Error(`PDF生成失败：${Buffer.concat(errors).toString('utf8').trim() || `退出码 ${code}`}`), { status: 500 }));
      const pdf = Buffer.concat(output);
      if (pdf.length < 100 || pdf.subarray(0, 4).toString() !== '%PDF') {
        return reject(Object.assign(new Error('PDF生成结果无效'), { status: 500 }));
      }
      resolve(pdf);
    });
    child.stdin.end(JSON.stringify(order));
  });
}

module.exports = { generateOrderPdf };
