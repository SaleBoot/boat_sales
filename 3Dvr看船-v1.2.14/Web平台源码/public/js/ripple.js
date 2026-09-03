/* ===== 水波纹交互效果 ===== */
/* 高度图波传播 + 预计算位移缓冲 + 双线性插值折射 */

(function () {
  const canvas = document.getElementById('rippleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const bgImg = new Image();
  bgImg.src = '/assets/harbor-bg.png';

  let W = 0, H = 0;
  const SCALE = 3;
  let rw = 0, rh = 0;
  let prev = null;
  let curr = null;
  let dispX = null;
  let dispY = null;
  let offscreen = null;
  let offCtx = null;
  let imgData = null;
  let outData = null;

  function init() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    rw = Math.max(4, Math.floor(W / SCALE));
    rh = Math.max(4, Math.floor(H / SCALE));
    prev = new Float32Array(rw * rh);
    curr = new Float32Array(rw * rh);
    dispX = new Float32Array(rw * rh);
    dispY = new Float32Array(rw * rh);

    offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    offCtx = offscreen.getContext('2d');

    imgData = offCtx.createImageData(W, H);
    outData = ctx.createImageData(W, H);
  }

  function drawBackground() {
    offCtx.drawImage(bgImg, 0, 0, W, H);
    imgData = offCtx.getImageData(0, 0, W, H);
  }

  function disturb(x, y, strength) {
    const px = Math.floor(x / SCALE);
    const py = Math.floor(y / SCALE);
    const radius = 3;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx > 0 && nx < rw - 1 && ny > 0 && ny < rh - 1) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            curr[ny * rw + nx] += strength * (1 - dist / radius);
          }
        }
      }
    }
  }

  function updateRipples() {
    for (let y = 1; y < rh - 1; y++) {
      const row = y * rw;
      for (let x = 1; x < rw - 1; x++) {
        const i = row + x;
        const newH = (curr[i - 1] + curr[i + 1] + curr[i - rw] + curr[i + rw]) * 0.5 - prev[i];
        prev[i] = newH * 0.985;
      }
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  /* 预计算位移缓冲（模拟分辨率级，开销极小） */
  function computeDisplacement() {
    const REFRACT = 8;
    for (let y = 1; y < rh - 1; y++) {
      const row = y * rw;
      for (let x = 1; x < rw - 1; x++) {
        const i = row + x;
        dispX[i] = (curr[i - 1] - curr[i + 1]) * REFRACT;
        dispY[i] = (curr[i - rw] - curr[i + rw]) * REFRACT;
      }
    }
  }

  function render() {
    const src = imgData.data;
    const dst = outData.data;

    for (let y = 0; y < H; y++) {
      const fy = y / SCALE;
      let iy = fy | 0;
      if (iy < 1) iy = 1; else if (iy >= rh - 1) iy = rh - 2;
      const ty = fy - (fy | 0);
      const iy1 = iy + 1;
      const row0 = iy * rw;
      const row1 = iy1 * rw;

      for (let x = 0; x < W; x++) {
        const fx = x / SCALE;
        let ix = fx | 0;
        if (ix < 1) ix = 1; else if (ix >= rw - 1) ix = rw - 2;
        const tx = fx - (fx | 0);
        const ix1 = ix + 1;

        const i00 = row0 + ix;
        const i10 = row0 + ix1;
        const i01 = row1 + ix;
        const i11 = row1 + ix1;

        const itx = 1 - tx;
        const ity = 1 - ty;

        const dx = ((dispX[i00] * itx + dispX[i10] * tx) * ity + (dispX[i01] * itx + dispX[i11] * tx) * ty) | 0;
        const dy = ((dispY[i00] * itx + dispY[i10] * tx) * ity + (dispY[i01] * itx + dispY[i11] * tx) * ty) | 0;

        let nx = x + dx;
        let ny = y + dy;
        if (nx < 0) nx = 0; else if (nx >= W) nx = W - 1;
        if (ny < 0) ny = 0; else if (ny >= H) ny = H - 1;

        const si = (ny * W + nx) * 4;
        const di = (y * W + x) * 4;

        const grad = dx < 0 ? -dx : dx;
        const spec = grad > 3 ? Math.min(35, (grad - 3) * 6) | 0 : 0;

        dst[di] = src[si] + spec > 255 ? 255 : src[si] + spec;
        dst[di + 1] = src[si + 1] + spec > 255 ? 255 : src[si + 1] + spec;
        dst[di + 2] = src[si + 2] + (spec >> 1) > 255 ? 255 : src[si + 2] + (spec >> 1);
        dst[di + 3] = 255;
      }
    }
    ctx.putImageData(outData, 0, 0);
  }

  let lastDisturb = 0;
  let mouseDown = false;
  let lastX = 0, lastY = 0;

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    if (now - lastDisturb < 16) return;
    lastDisturb = now;

    const strength = mouseDown ? 800 : 200;
    const dx = x - lastX;
    const dy = y - lastY;
    const speed = Math.min(Math.sqrt(dx * dx + dy * dy), 50);
    disturb(x, y, strength * (0.5 + speed / 50));

    lastX = x;
    lastY = y;
  }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', e => { mouseDown = true; onMove(e); });
  canvas.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('mouseleave', () => { mouseDown = false; });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
  canvas.addEventListener('touchstart', e => {
    mouseDown = true;
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  });
  canvas.addEventListener('touchend', () => { mouseDown = false; });

  let running = true;
  function loop() {
    if (!running) return;
    updateRipples();
    computeDisplacement();
    render();
    requestAnimationFrame(loop);
  }

  function start() {
    init();
    drawBackground();
    for (let i = 0; i < 5; i++) {
      disturb(
        Math.random() * W,
        Math.random() * H,
        300
      );
    }
    loop();
  }

  if (bgImg.complete) {
    start();
  } else {
    bgImg.onload = start;
  }

  window.addEventListener('resize', () => {
    running = false;
    setTimeout(() => {
      running = true;
      start();
    }, 200);
  });

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) loop();
  });
})();
