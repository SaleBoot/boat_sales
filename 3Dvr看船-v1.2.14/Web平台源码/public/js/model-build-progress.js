(function () {
  if (window.ShipBuildProgress) return;
  const tasks = new Map();
  const dismissed = new Set();
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = '/css/model-build-progress.css'; document.head.appendChild(sheet);
  const panel = document.createElement('aside');
  panel.className = 'model-build-progress'; panel.hidden = true;
  panel.setAttribute('aria-label', 'VR 模型处理进度');
  (document.querySelector('.mem-main, .admin-v2-shell') || document.body).prepend(panel);
  let expanded = true, closed = false;
  let timer, running = false, stopped = false, rerun = false, retryDelay = 0;
  function render() {
    panel.replaceChildren(); panel.hidden = closed || tasks.size === 0;
    const details = document.createElement('details'); details.open = expanded;
    details.ontoggle = () => { expanded = details.open; };
    const summary = document.createElement('summary'); summary.textContent = `模型处理（${tasks.size}）`;
    const close = document.createElement('button'); close.textContent = '×'; close.title = '关闭提示'; close.setAttribute('aria-label', '关闭模型处理提示');
    close.onclick = () => { closed = true; panel.hidden = true; };
    details.appendChild(summary); panel.append(close, details);
    for (const [id, task] of tasks) {
      const row = document.createElement('section');
      const title = document.createElement('strong'); title.textContent = `${task.ship_name} · ${task.variant_name}`;
      const status = document.createElement('span'); status.setAttribute('role', 'status');
      status.textContent = task.processing_error || ({ pending: '等待处理', building: '正在生成 VR 模型', ready: '已完成，待确认上架', failed: '处理失败' }[task.processing_status] || '正在检查');
      const progress = document.createElement('progress'); progress.max = 1;
      progress.setAttribute('aria-label', title.textContent + ' VR 模型处理进度');
      if (task.processing_status === 'ready') progress.value = 1;
      if (task.processing_status === 'pending' || task.processing_status === 'failed') progress.value = 0;
      row.append(title, status, progress);
      if (task.processing_status === 'failed') {
        row.classList.add('failed');
        const retry = document.createElement('button'); retry.textContent = '重试'; retry.className = 'ui-button ui-button--ghost';
        retry.onclick = async () => {
          retry.disabled = true;
          try {
            const response = await fetch(`/api/admin/boats/${task.boat_id}/builds/${encodeURIComponent(id)}/retry`, { method: 'POST', signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error('重试未成功，请稍后再试');
            task.processing_status = 'pending'; task.processing_error = ''; render(); refresh();
          } catch (error) { status.textContent = '重试结果未确认，正在查询状态'; retry.disabled = false; refresh(); }
        };
        const close = document.createElement('button'); close.textContent = '×'; close.title = '关闭提示'; close.setAttribute('aria-label', '关闭提示');
        close.onclick = () => { dismissed.add(id); tasks.delete(id); render(); };
        row.append(retry, close);
      }
      details.appendChild(row);
    }
  }
  async function refresh() {
    clearTimeout(timer);
    if (stopped) return;
    if (running) { rerun = true; return; }
    running = true;
    try {
      const response = await fetch('/api/admin/model-builds', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) { stopped = true; tasks.clear(); render(); return; }
      if (!response.ok) throw new Error('进度连接中断，正在重试');
      const result = await response.json();
      if (!Array.isArray(result.data)) throw new Error('Invalid build response');
      retryDelay = 0;
      const seen = new Set();
      for (const item of result.data) {
        const id = item.variant_id; seen.add(id);
        if (['pending', 'building'].includes(item.processing_status)) dismissed.delete(id);
        if (!tasks.has(id) && (!['pending', 'building', 'failed'].includes(item.processing_status) || dismissed.has(id))) continue;
        const previous = tasks.get(id);
        tasks.set(id, item);
        if (previous && previous.processing_status !== item.processing_status) {
          const message = { type: 'model-build-change', boatId: item.boat_id };
          window.postMessage(message, location.origin);
          document.querySelectorAll('iframe').forEach(frame => frame.contentWindow?.postMessage(message, location.origin));
        }
        if (item.processing_status === 'ready' && previous?.processing_status !== 'ready') {
          setTimeout(() => { if (tasks.get(id)?.processing_status === 'ready') { tasks.delete(id); render(); } }, 1800);
        }
      }
      for (const id of tasks.keys()) if (!seen.has(id)) tasks.delete(id);
      render();
    } catch (error) {
      retryDelay = Math.min(retryDelay ? retryDelay * 2 : 6000, 60000);
      panel.querySelectorAll('[role="status"]').forEach(label => { label.textContent = '进度连接中断，正在重试'; });
    } finally { running = false; if (!stopped) timer = setTimeout(refresh, retryDelay || (rerun ? 0 : tasks.size ? 3000 : 15000)); rerun = false; }
  }
  window.ShipBuildProgress = { refresh, track: task => { closed = false; expanded = true; tasks.set(task.variant_id, task); render(); refresh(); } };
  refresh();
})();
