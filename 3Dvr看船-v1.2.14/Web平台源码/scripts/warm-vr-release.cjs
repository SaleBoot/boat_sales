const fs = require('node:fs');
const path = require('node:path');
const { verifyDownload } = require('../src/model-build-worker');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (const [index, asset] of manifest.assets.entries()) {
    const file = `/vr-content/android/uploads/${path.basename(asset.output)}/${asset.sha256}.bundle`;
    await verifyDownload(new URL(file, process.argv[3]), asset.sha256, true);
    console.log(`Verified cache ${index + 1}/${manifest.assets.length}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
