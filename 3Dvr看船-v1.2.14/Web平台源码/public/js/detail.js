import Scene from './Scene.js?v=1.2.15';

let boatData = null;
let scene3d = null;
let currentTabId = '';
let currentVariantId = '';
let isAdminMode = false;
const selections = {};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.__detailBootClear === 'function') window.__detailBootClear();
  window.__detailInitialized = true;
  bindCustomerOrderDialog();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  isAdminMode = params.get('admin') === '1';
  if (id) loadDetail(id); else showPageError('未指定船型ID');
});

async function loadDetail(id) {
  try {
    const response = await fetch(`/api/boats/${encodeURIComponent(id)}`); const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || '未找到该船型');
    boatData = json.data; initializeSelections(); renderPage(); document.title = `${boatData.name} | 船舶定制系统`;
  } catch (error) { showPageError(error.message || '加载失败，请检查服务'); }
}

function tabs() { return (Array.isArray(boatData.configTabs) ? boatData.configTabs : []).filter(tab => tab.kind === 'overview' || (Array.isArray(tab.options) && tab.options.length)).slice().sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0)); }
function initializeSelections() { tabs().forEach(tab => { if (tab.options && tab.options[0]) selections[tab.id] = tab.options[0].id; }); currentTabId = tabs()[0] ? tabs()[0].id : ''; currentVariantId = boatData.primaryVariantId || ((boatData.variants || [])[0] || {}).variantId || ''; }

function renderPage() {
  if (scene3d) { try { scene3d.destroy(); } catch {} scene3d = null; }
  const tabList = tabs(); const layout = document.getElementById('configLayout');
  layout.innerHTML = `<div class="config-left"><div class="config-model-area"><div class="config-model-placeholder"><span class="model-fullscreen-hint">双击最大化查看模型</span><div id="model3dContainer" style="width:100%;height:100%;position:relative"><div id="model3dLoading" class="model-loading"><span>3D模型加载中…</span></div></div></div><div class="config-model-info"><span class="config-model-name">${escapeHtml(boatData.name)}</span><span class="config-model-type">${escapeHtml(boatData.typeName || '')}</span><span class="config-model-type">${escapeHtml(boatData.manufacturer || '')}</span></div></div><div class="config-price-bar"><div class="config-price-summary"><div class="config-price-current"><span class="config-price-label">模拟基础价</span><span class="config-price-subvalue" id="basePrice">—</span></div><div class="config-price-current"><span class="config-price-label">已选配置</span><span class="config-price-subvalue" id="extraPrice">—</span></div><div class="config-price-current config-price-total"><span class="config-price-label">方案参考总价</span><span class="config-price-value" id="totalPrice">—</span></div><small>${escapeHtml(boatData.pricingNote || '模拟参考价，仅供演示，最终以厂家正式报价为准')}</small></div><div class="config-action-group"><button class="config-compare-btn" onclick="toggleCompareMode()">方案对比</button><button class="btn-primary config-submit-btn" onclick="submitConfig()">提交定制方案</button></div></div></div><div class="config-right"><div class="config-tabs" id="configTabs">${tabList.map((tab,index) => `<button class="config-tab ${index === 0 ? 'active' : ''}" data-tab="${escapeAttr(tab.id)}" onclick="switchTab('${escapeJs(tab.id)}')">${escapeHtml(tab.label)}</button>`).join('')}</div><div class="config-tab-content" id="tabContent"></div></div>`;
  renderTab(); updatePrice(); requestAnimationFrame(() => loadCurrentModel('exterior'));
}

function switchTab(tabId) {
  const tab = tabs().find(item => item.id === tabId); if (!tab) return; currentTabId = tabId;
  document.querySelectorAll('.config-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabId));
  const selected = selectedOption(tab); if (tab.kind === 'model' && selected && selected.modelVariantId && selected.modelVariantId !== currentVariantId) { currentVariantId = selected.modelVariantId; loadCurrentModel(tab.cameraMode, selected.entryView); }
  else if (scene3d) applyOptionEntryView(tab, selected);
  renderTab();
}

function renderTab() {
  const tab = tabs().find(item => item.id === currentTabId); const container = document.getElementById('tabContent'); if (!tab || !container) return;
  if (tab.kind === 'overview') { container.innerHTML = overviewHtml(tab); return; }
  const options = Array.isArray(tab.options) ? tab.options : [];
  const editBtn = isAdminMode ? `<button class="section-edit-btn" onclick="openSectionEditor('${escapeJs(tab.id)}')">编辑</button>` : '';
  container.innerHTML = `<div class="config-section"><div class="config-section-header"><div><h3 class="config-section-title">${escapeHtml(tab.label)}</h3><p class="config-section-desc">${escapeHtml(tab.description || '')}</p></div></div>${options.length ? `<div class="config-option-grid">${options.map(option => optionHtml(tab, option)).join('')}</div>` : '<div class="detail-empty-option">该船型暂未配置此项，请联系厂家确认。</div>'}${editBtn}</div>`;
}

function overviewHtml(tab) {
  const editBtn = isAdminMode ? `<button class="section-edit-btn" onclick="openSectionEditor('${escapeJs(tab.id)}')">编辑</button>` : '';
  return `<div class="config-section"><h3 class="config-section-title">${escapeHtml(boatData.name)}</h3>${boatData.sceneImage ? `<img class="config-scene-image" src="${escapeAttr(boatData.sceneImage)}" alt="">` : ''}<p class="config-section-desc">${escapeHtml(boatData.description || '')}</p><div class="config-specs-grid"><div class="config-spec-item"><span class="config-spec-label">船长</span><span class="config-spec-value">${escapeHtml(boatData.length || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">载客/载荷</span><span class="config-spec-value">${escapeHtml(boatData.capacity || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">极速</span><span class="config-spec-value">${escapeHtml(boatData.maxSpeed || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">模拟基础价</span><span class="config-spec-value">${escapeHtml(formatYuan(boatData.basePriceYuan))}</span><small>${escapeHtml(boatData.pricingNote || '')}</small></div></div><div class="config-features">${(boatData.features || []).map(item => `<span class="config-feature-tag">${escapeHtml(item)}</span>`).join('')}</div>${editBtn}</div>`;
}

function optionHtml(tab, option) {
  const selected = selections[tab.id] === option.id;
  const priceDeltaYuan = optionPrice(option);
  // 内饰板块(kind === 'model')的图片支持双击查看全图,其他板块仅展示缩略图
  const imageHtml = option.imageUrl
    ? (tab.kind === 'model'
        ? `<img class="config-option-image is-zoomable" src="${escapeAttr(option.imageUrl)}" alt="" title="双击查看全图" ondblclick="event.stopPropagation(); previewImage('${escapeJs(option.imageUrl)}')">`
        : `<img class="config-option-image" src="${escapeAttr(option.imageUrl)}" alt="">`)
    : '';
  return `<button class="config-option-card ${selected ? 'selected' : ''}" onclick="selectOption('${escapeJs(tab.id)}','${escapeJs(option.id)}')">${imageHtml}${tab.kind === 'color' && option.color ? `<span class="color-swatch" style="background:${escapeAttr(option.color)}"></span>` : ''}<span class="config-option-name">${escapeHtml(option.name)}</span><span class="config-option-detail">${escapeHtml(option.description || '')}</span>${priceDeltaYuan > 0 ? `<span class="config-option-tag tag-price">+${escapeHtml(formatYuan(priceDeltaYuan))}</span>` : ''}</button>`;
}

async function selectOption(tabId, optionId) {
  const tab = tabs().find(item => item.id === tabId); if (!tab) return; const option = (tab.options || []).find(item => item.id === optionId); if (!option) return;
  selections[tabId] = optionId;
  // 价格与选中态应立即反馈，不能等待大型模型下载完成后才更新。
  renderTab(); updatePrice();
  if (tab.kind === 'model' && option.modelVariantId && option.modelVariantId !== currentVariantId) { currentVariantId = option.modelVariantId; await loadCurrentModel(tab.cameraMode, option.entryView); }
  else {
    if (tab.kind === 'color' && scene3d && option.color) scene3d.setHullColor(option.color, selectedVariant() && selectedVariant().hullMaterial);
    if (tab.kind === 'accessory' && scene3d) await applyConfiguredAccessories();
    if (scene3d) applyOptionEntryView(tab, option);
  }
  renderTab(); updatePrice();
}

function selectedOption(tab) { const id = selections[tab.id]; return (tab.options || []).find(item => item.id === id) || (tab.options || [])[0] || null; }
function selectedVariant() { return (boatData.variants || []).find(item => item.variantId === currentVariantId) || (boatData.variants || [])[0] || null; }

function applyOptionEntryView(tab, option) {
  if (!scene3d) return;
  const entryView = option && option.entryView;
  scene3d.setCameraMode((entryView && entryView.mode) || tab.cameraMode || 'exterior');
  if (entryView && Array.isArray(entryView.position) && Array.isArray(entryView.target)) scene3d.applyCameraPose(entryView);
}

async function loadCurrentModel(cameraMode, entryView = null) {
  const container = document.getElementById('model3dContainer'); if (!container) return;
  if (scene3d) { try { scene3d.destroy(); } catch {} scene3d = null; }
  container.innerHTML = '<div id="model3dLoading" class="model-loading"><span>正在加载模型与原始贴图…</span></div>';
  const loading = document.getElementById('model3dLoading'); const variant = selectedVariant();
  try {
    scene3d = new Scene(container);
    if (!variant || !variant.modelFiles || !variant.modelFiles.length) throw new Error('该船型尚未关联网页模型');
    await scene3d.loadVariant(variant, progress => { const span = loading && loading.querySelector('span'); if (span) span.textContent = `3D模型加载中… ${Math.round(progress * 100)}%`; });
    applyConfiguredColor(); await applyConfiguredAccessories(); scene3d.setCameraMode((entryView && entryView.mode) || cameraMode || 'exterior');
    if (entryView && Array.isArray(entryView.position) && Array.isArray(entryView.target)) scene3d.applyCameraPose(entryView);
    if (loading) { loading.style.opacity = '0'; setTimeout(() => loading.remove(), 300); }
  } catch (error) { if (loading) loading.innerHTML = `<span>3D加载失败：${escapeHtml(error.message || error)}</span>`; }
}

function applyConfiguredColor() { const tab = tabs().find(item => item.kind === 'color'); const option = tab && selectedOption(tab); if (scene3d && option && option.color) scene3d.setHullColor(option.color, selectedVariant() && selectedVariant().hullMaterial); }
async function applyConfiguredAccessories() { const assets = tabs().filter(item => item.kind === 'accessory').flatMap(tab => { const option = selectedOption(tab); return option && Array.isArray(option.accessories) ? option.accessories : []; }); if (scene3d) await scene3d.setAccessories(assets); }

function optionPrice(option) { return Math.max(0, Math.round(Number(option && option.priceDeltaYuan) || (Number(option && option.priceDelta) || 0) * 10000)); }
function formatYuan(value, zeroText = '¥0') { const yuan = Math.max(0, Math.round(Number(value) || 0)); if (!yuan) return zeroText; if (yuan >= 10000) { const wan = yuan / 10000; return `¥${wan.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`; } return `¥${yuan.toLocaleString('zh-CN')}`; }
function pricingTotals() { const basePriceYuan = Math.max(0, Math.round(Number(boatData.basePriceYuan) || 0)); const optionPriceYuan = tabs().reduce((sum, tab) => { const option = selectedOption(tab); return sum + optionPrice(option); }, 0); return { basePriceYuan, optionPriceYuan, totalPriceYuan: basePriceYuan + optionPriceYuan }; }
function updatePrice() { const totals = pricingTotals(); const base = document.getElementById('basePrice'); const extra = document.getElementById('extraPrice'); const total = document.getElementById('totalPrice'); if (base) base.textContent = formatYuan(totals.basePriceYuan, '待厂家确认'); if (extra) extra.textContent = formatYuan(totals.optionPriceYuan); if (total) total.textContent = totals.basePriceYuan ? formatYuan(totals.totalPriceYuan) : '待厂家确认'; }

function submitConfig() {
  const overlay = document.getElementById('customerOrderOverlay');
  overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => overlay.querySelector('[name="customerName"]').focus(), 0);
}

async function syncCurrentVariantToVr() {
  const button = document.getElementById('syncCurrentVrBtn');
  if (!currentVariantId) return toast('当前船型没有可同步的3D模型', true);
  const original = button.textContent;
  button.disabled = true; button.textContent = '同步中…';
  try {
    const response = await fetch('/api/vr/current-model', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ variantId:currentVariantId }) });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || '同步失败');
    button.textContent = '已同步到VR';
    toast('同步成功，PICO将在30秒内自动切换');
    setTimeout(() => { button.textContent = original; }, 3000);
  } catch (error) { button.textContent = original; toast(error.message || '同步失败', true); }
  finally { button.disabled = false; }
}

function bindCustomerOrderDialog() {
  const overlay = document.getElementById('customerOrderOverlay');
  const close = () => { overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); };
  document.getElementById('closeCustomerOrder').addEventListener('click', close);
  document.getElementById('cancelCustomerOrder').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.getElementById('customerOrderForm').addEventListener('submit', event => submitCustomerOrder(event, close));
}

async function submitCustomerOrder(event, closeDialog) {
  event.preventDefault();
  const selectedValues = {}; tabs().forEach(tab => { const option = selectedOption(tab); if (option) selectedValues[tab.id] = { optionId: option.id }; });
  const form = event.currentTarget; const button = document.getElementById('confirmCustomerOrder'); const formData = new FormData(form);
  button.disabled = true; button.textContent = '提交中…';
  try {
    const response = await fetch('/api/customize', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ boatId:boatData.id, variantId:currentVariantId, selections:selectedValues, customerName:formData.get('customerName'), customerPhone:formData.get('customerPhone'), customerNote:formData.get('customerNote') }) });
    const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.message || '提交失败');
    const data = json.data || {}; closeDialog(); form.reset(); toast(`定制方案已提交：${data.orderId}，参考总价 ${data.totalPrice || formatYuan(data.totalPriceYuan)}`);
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = '确认提交'; }
}

function showPageError(message) { document.getElementById('configLayout').innerHTML = `<div class="detail-error">${escapeHtml(message)}<button class="detail-loading-retry" onclick="location.reload()">重新加载</button></div>`; }
function returnToCatalog() {
  var params = new URLSearchParams(window.location.search);
  var isAdmin = params.get('admin') === '1';
  if (isAdmin) {
    try { window.close(); } catch (e) {}
    setTimeout(function () { window.location.href = 'members.html'; }, 150);
    return;
  }
  try {
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
      history.back();
      return;
    }
  } catch (e) {}
  window.location.href = 'index.html';
}
function toast(message, error = false) { const container = document.getElementById('toastContainer'); const item = document.createElement('div'); item.className = `toast ${error ? 'error' : 'success'}`; item.textContent = message; container.appendChild(item); setTimeout(() => item.remove(), 3500); }
function escapeHtml(value) { const span = document.createElement('span'); span.textContent = value == null ? '' : String(value); return span.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g,'&quot;'); }
function escapeJs(value) { return String(value || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ===== 管理员编辑弹窗 =====
function openSectionEditor(tabId) {
  const tab = tabs().find(t => t.id === tabId);
  if (!tab) return;
  const isOverview = tab.kind === 'overview';
  const options = Array.isArray(tab.options) ? tab.options : [];

  let formHtml = '';
  if (isOverview) {
    // 船型基本信息编辑
    formHtml = `
      <div class="editor-field"><label>船型名称</label><input type="text" id="editName" value="${escapeAttr(boatData.name || '')}"></div>
      <div class="editor-field"><label>描述</label><textarea id="editDesc" rows="3">${escapeHtml(boatData.description || '')}</textarea></div>
      <div class="editor-field-row">
        <div class="editor-field"><label>船长</label><input type="text" id="editLength" value="${escapeAttr(boatData.length || '')}"></div>
        <div class="editor-field"><label>载客/载荷</label><input type="text" id="editCapacity" value="${escapeAttr(boatData.capacity || '')}"></div>
      </div>
      <div class="editor-field-row">
        <div class="editor-field"><label>极速</label><input type="text" id="editMaxSpeed" value="${escapeAttr(boatData.maxSpeed || '')}"></div>
        <div class="editor-field"><label>模拟基础价(元)</label><input type="number" id="editBasePrice" value="${escapeAttr(boatData.basePriceYuan || 0)}"></div>
      </div>
      <div class="editor-field"><label>特点标签(用、分隔)</label><input type="text" id="editFeatures" value="${escapeAttr((boatData.features || []).join('、'))}"></div>
    `;
  } else {
    // 配置板块编辑（外观/内饰/动力）
    formHtml = `
      <div class="editor-field"><label>板块标题</label><input type="text" id="editTabLabel" value="${escapeAttr(tab.label || '')}"></div>
      <div class="editor-field"><label>选项列表</label><div id="editOptionsList">${options.map((opt, i) => renderOptionRow(opt, i, tab)).join('')}</div></div>
      <button type="button" class="editor-add-option-btn" onclick="addEditOption()">+ 添加选项</button>
    `;
  }

  const overlay = document.createElement('div');
  overlay.id = 'sectionEditorOverlay';
  overlay.className = 'section-editor-overlay';
  overlay.innerHTML = `
    <div class="section-editor-modal">
      <div class="section-editor-header">
        <h3>编辑 · ${escapeHtml(tab.label)}</h3>
        <button class="section-editor-close" onclick="closeSectionEditor()">&times;</button>
      </div>
      <form class="section-editor-form" onsubmit="saveSection(event, '${escapeJs(tabId)}', ${isOverview})">
        ${formHtml}
        <div class="section-editor-footer">
          <button type="button" onclick="closeSectionEditor()">取消</button>
          <button type="submit" class="section-editor-save">保存</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.classList.add('show');
  document.body.classList.add('modal-open');
  // 拖动功能
  const modal = overlay.querySelector('.section-editor-modal');
  const header = overlay.querySelector('.section-editor-header');
  let isDragging = false, startX = 0, startY = 0, offsetX = 0, offsetY = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.section-editor-close')) return;
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    modal.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    header.style.cursor = 'move';
  });
}

function renderOptionRow(opt, index, tab) {
  const isColor = tab.kind === 'color';
  // 仅「内饰」板块(kind === 'model')保留图片上传功能,其他板块隐藏
  const canUploadImage = tab.kind === 'model';
  const colorVal = escapeAttr(opt.color || '#000000');
  const priceWan = (opt.priceDelta || 0);
  const imgUrl = escapeAttr(opt.imageUrl || '');
  const desc = escapeAttr(opt.description || '');
  return `
    <div class="editor-option-row" data-index="${index}">
      <div class="opt-row-main">
        ${isColor ? `<input type="color" class="opt-color" value="${colorVal}" oninput="this.nextElementSibling.value=this.value">` : ''}
        ${isColor ? `<input type="text" class="opt-color-text" value="${colorVal}" maxlength="7" oninput="this.previousElementSibling.value=this.value">` : ''}
        <input type="text" class="opt-name" placeholder="名称" value="${escapeAttr(opt.name || '')}">
        <div class="opt-price-wrap"><input type="number" class="opt-price" placeholder="0" value="${escapeAttr(priceWan)}" step="0.1"><span class="opt-price-unit">万</span></div>
        <button type="button" class="opt-remove" onclick="this.closest('.editor-option-row').remove()">×</button>
      </div>
      <div class="opt-row-desc"><input type="text" class="opt-desc" placeholder="说明文字" value="${desc}"></div>
      ${canUploadImage ? `
      <div class="opt-row-image">
        <input type="text" class="opt-image-url" placeholder="图片URL（可选）" value="${imgUrl}">
        <button type="button" class="opt-image-upload" onclick="uploadOptionImage(this)">上传图片</button>
        ${imgUrl ? `<img class="opt-image-preview" src="${imgUrl}" alt="" onclick="previewImage('${escapeJs(imgUrl)}')" title="点击放大查看">` : ''}
      </div>` : ''}
    </div>
  `;
}

function addEditOption() {
  const list = document.getElementById('editOptionsList');
  const tab = tabs().find(t => t.id === currentTabId);
  if (!list || !tab) return;
  const div = document.createElement('div');
  div.className = 'editor-option-row';
  div.dataset.index = list.children.length;
  const isColor = tab.kind === 'color';
  div.innerHTML = `
    <div class="opt-row-main">
      ${isColor ? `<input type="color" class="opt-color" value="#000000" oninput="this.nextElementSibling.value=this.value">` : ''}
      ${isColor ? `<input type="text" class="opt-color-text" value="#000000" maxlength="7" oninput="this.previousElementSibling.value=this.value">` : ''}
      <input type="text" class="opt-name" placeholder="名称" value="">
      <div class="opt-price-wrap"><input type="number" class="opt-price" placeholder="0" value="0" step="0.1"><span class="opt-price-unit">万</span></div>
      <button type="button" class="opt-remove" onclick="this.closest('.editor-option-row').remove()">×</button>
    </div>
    <div class="opt-row-desc"><input type="text" class="opt-desc" placeholder="说明文字" value=""></div>
    <div class="opt-row-image">
      <input type="text" class="opt-image-url" placeholder="图片URL（可选）" value="">
      <button type="button" class="opt-image-upload" onclick="uploadOptionImage(this)">上传图片</button>
    </div>
  `;
  list.appendChild(div);
}

async function uploadOptionImage(btn) {
  const boatId = new URLSearchParams(location.search).get('id');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const fd = new FormData();
    fd.append('image', input.files[0]);
    btn.disabled = true; btn.textContent = '上传中...';
    try {
      const res = await fetch(`/api/admin/boats/${boatId}/option-image`, { method: 'POST', body: fd, credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        const row = btn.closest('.editor-option-row');
        const urlInput = row.querySelector('.opt-image-url');
        urlInput.value = json.image;
        let preview = row.querySelector('.opt-image-preview');
        if (!preview) { preview = document.createElement('img'); preview.className = 'opt-image-preview'; row.querySelector('.opt-row-image').appendChild(preview); }
        preview.src = json.image;
      } else { alert(json.message || '上传失败'); }
    } catch (e) { alert('上传失败: ' + e.message); }
    btn.disabled = false; btn.textContent = '上传图片';
  };
  input.click();
}

function closeSectionEditor() {
  const overlay = document.getElementById('sectionEditorOverlay');
  if (overlay) overlay.remove();
  document.body.classList.remove('modal-open');
}

function previewImage(url) {
  const overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<img src="${url}" alt="">`;
  document.body.appendChild(overlay);
}

async function saveSection(event, tabId, isOverview) {
  event.preventDefault();
  const boatId = new URLSearchParams(location.search).get('id');
  try {
    if (isOverview) {
      // 保存基本信息
      const features = document.getElementById('editFeatures').value.split('、').map(s => s.trim()).filter(Boolean);
      const body = {
        name: document.getElementById('editName').value,
        description: document.getElementById('editDesc').value,
        length: document.getElementById('editLength').value,
        capacity: document.getElementById('editCapacity').value,
        maxSpeed: document.getElementById('editMaxSpeed').value,
        price: parseInt(document.getElementById('editBasePrice').value) || 0,
        features
      };
      // 更新本地数据
      Object.assign(boatData, body);
      boatData.basePriceYuan = body.price;
      const res = await fetch(`/api/admin/boats/${boatId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    } else {
      // 保存配置板块
      const tab = tabs().find(t => t.id === tabId);
      const rows = document.querySelectorAll('.editor-option-row');
      const options = Array.from(rows).map((row, i) => {
        const existing = (tab.options || [])[i] || {};
        return {
          ...existing,
          id: existing.id || `opt_${Date.now()}_${i}`,
          name: row.querySelector('.opt-name').value,
          description: (row.querySelector('.opt-desc') || {}).value || '',
          imageUrl: (row.querySelector('.opt-image-url') || {}).value || existing.imageUrl || '',
          priceDelta: parseFloat(row.querySelector('.opt-price').value) || 0,
          priceDeltaYuan: Math.round((parseFloat(row.querySelector('.opt-price').value) || 0) * 10000),
          ...(tab.kind === 'color' ? { color: (row.querySelector('.opt-color-text') || row.querySelector('.opt-color')).value } : {})
        };
      });
      const label = document.getElementById('editTabLabel').value;
      // 更新本地数据
      tab.label = label; tab.options = options;
      const res = await fetch(`/api/admin/boats/${boatId}/config-tabs`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId, options, label })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    }
    closeSectionEditor();
    renderTab();
    updatePrice();
    toast('保存成功');
  } catch (error) {
    toast(error.message, true);
  }
}

// ===== 方案对比模式:左侧加载另一船型 detail.html,右侧当前页缩小,直观对比 =====
let compareModeLock = false;  // 防抖锁,防止 async 期间重复触发
async function toggleCompareMode() {
  // 在 iframe 内(对比模式加载的子页面)禁止触发嵌套对比,避免无限套娃
  if (window.self !== window.top) return;
  if (compareModeLock) return;  // 正在处理中,忽略重复点击
  if (document.body.classList.contains('compare-active')) { exitCompareMode(); return; }
  compareModeLock = true;  // 加锁
  // 创建左右对称的双栏对比面板(每栏一个 iframe,等比例 0.7 缩放显示,样式不变形且文字可读)
  const overlay = document.createElement('div');
  overlay.id = 'compareOverlay';
  overlay.className = 'compare-overlay';
  overlay.innerHTML = `
    <button type="button" class="compare-exit-floating" onclick="exitCompareMode()" title="退出对比">退出对比 ×</button>
    <div class="compare-vs-badge">VS</div>
    <div class="compare-side compare-left">
      <div class="compare-header">
        <span class="compare-tag">船型 A</span>
        <span class="compare-current-name" id="compareLeftName">待选择</span>
        <select id="compareBoatSelect" class="compare-boat-select" onchange="loadCompareBoat(this.value)">
          <option value="">请选择对比船型…</option>
        </select>
        <button type="button" class="compare-home-btn" onclick="loadCompareHome()" title="返回首页浏览选择">返回首页选择</button>
      </div>
      <div class="compare-frame-wrap">
        <div class="compare-frame-placeholder" id="compareFramePlaceholder">
          <span>从上方下拉选择,或点击「返回首页选择」</span>
          <small>左侧将加载所选船型的 3D 模型与配置</small>
        </div>
        <iframe id="compareFrame" class="compare-frame" src="about:blank" style="display:none;"></iframe>
      </div>
    </div>
    <div class="compare-side compare-right">
      <div class="compare-header">
        <span class="compare-tag compare-tag-current">船型 B</span>
        <span class="compare-current-name" id="compareRightName">${escapeHtml(boatData.name || '')}</span>
        <select id="compareCurrentSelect" class="compare-boat-select" onchange="loadCompareCurrentBoat(this.value)">
          <option value="">更换当前船型…</option>
        </select>
        <button type="button" class="compare-home-btn" onclick="loadCompareCurrentHome()" title="当前栏返回首页浏览">返回首页选择</button>
      </div>
      <div class="compare-frame-wrap">
        <iframe id="compareCurrentFrame" class="compare-frame" src="detail.html?id=${encodeURIComponent(boatData.id)}&inframe=1"></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('compare-active');
  // 切换底部按钮文字:方案对比 → 退出对比
  const toggleBtn = document.querySelector('.config-compare-btn');
  if (toggleBtn) {
    toggleBtn.textContent = '退出对比';
    toggleBtn.classList.add('is-active');
  }
  // 左侧默认加载首页,用户在首页浏览并点击船型卡片即可在 iframe 内跳到 detail.html
  loadCompareHome();
  // 左右两栏下拉:加载船型列表
  try {
    const res = await fetch('/api/boats'); const json = await res.json();
    const leftSel = document.getElementById('compareBoatSelect');
    const rightSel = document.getElementById('compareCurrentSelect');
    (json.data || []).forEach(b => {
      // 左侧排除当前船型
      if (b.id !== boatData.id) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name}${b.typeName ? ' · ' + b.typeName : ''}`;
        leftSel.appendChild(opt);
      }
      // 右侧"更换当前船型"包含全部船型
      const opt2 = document.createElement('option');
      opt2.value = b.id;
      opt2.textContent = `${b.name}${b.typeName ? ' · ' + b.typeName : ''}`;
      rightSel.appendChild(opt2);
    });
  } catch (e) {
    document.getElementById('compareFramePlaceholder').querySelector('span').textContent = '船型列表加载失败,请检查网络';
  } finally {
    compareModeLock = false;  // 释放锁,允许下次操作
  }
}

// 左侧 iframe 加载指定船型
function loadCompareBoat(boatId) {
  const frame = document.getElementById('compareFrame');
  const placeholder = document.getElementById('compareFramePlaceholder');
  if (!frame || !placeholder) return;
  if (!boatId) {
    frame.style.display = 'none';
    placeholder.style.display = 'flex';
    frame.src = 'about:blank';
    return;
  }
  placeholder.style.display = 'none';
  frame.style.display = 'block';
  frame.src = `detail.html?id=${encodeURIComponent(boatId)}&inframe=1`;
  const select = document.getElementById('compareBoatSelect');
  if (select && select.value !== boatId) select.value = boatId;
  // 同步更新左侧船型名显示
  if (select) {
    const opt = select.querySelector(`option[value="${boatId}"]`);
    const nameEl = document.getElementById('compareLeftName');
    if (opt && nameEl) nameEl.textContent = opt.textContent;
  }
}

// 右侧(当前方案) iframe 加载指定船型
function loadCompareCurrentBoat(boatId) {
  const frame = document.getElementById('compareCurrentFrame');
  if (!frame || !boatId) return;
  frame.src = `detail.html?id=${encodeURIComponent(boatId)}&inframe=1`;
  const nameEl = document.getElementById('compareRightName');
  const select = document.getElementById('compareCurrentSelect');
  if (select) {
    const opt = select.querySelector(`option[value="${boatId}"]`);
    if (opt && nameEl) nameEl.textContent = opt.textContent;
  }
}

// 左侧 iframe 加载首页(用户在首页点击船型后留在 iframe 内跳转)
function loadCompareHome() {
  const frame = document.getElementById('compareFrame');
  const placeholder = document.getElementById('compareFramePlaceholder');
  if (!frame || !placeholder) return;
  placeholder.style.display = 'none';
  frame.style.display = 'block';
  frame.src = 'index.html?inframe=1';
  const select = document.getElementById('compareBoatSelect');
  if (select) select.value = '';
  const nameEl = document.getElementById('compareLeftName');
  if (nameEl) nameEl.textContent = '首页浏览中';
}

// 右侧 iframe 加载首页
function loadCompareCurrentHome() {
  const frame = document.getElementById('compareCurrentFrame');
  if (!frame) return;
  frame.src = 'index.html?inframe=1';
  const nameEl = document.getElementById('compareRightName');
  if (nameEl) nameEl.textContent = '首页浏览中';
  const select = document.getElementById('compareCurrentSelect');
  if (select) select.value = '';
}

function exitCompareMode() {
  document.body.classList.remove('compare-active');
  const overlay = document.getElementById('compareOverlay');
  if (overlay) overlay.remove();
  // 恢复底部按钮文字:退出对比 → 方案对比
  const toggleBtn = document.querySelector('.config-compare-btn');
  if (toggleBtn) {
    toggleBtn.textContent = '方案对比';
    toggleBtn.classList.remove('is-active');
  }
  // 重置防抖锁,确保用户可重新进入对比模式
  compareModeLock = false;
}

Object.assign(window, { switchTab, selectOption, submitConfig, syncCurrentVariantToVr, returnToCatalog, openSectionEditor, closeSectionEditor, addEditOption, uploadOptionImage, previewImage, saveSection, toggleCompareMode, loadCompareBoat, loadCompareCurrentBoat, loadCompareHome, loadCompareCurrentHome, exitCompareMode });
