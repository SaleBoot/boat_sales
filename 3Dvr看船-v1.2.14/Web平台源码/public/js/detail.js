import Scene from './Scene.js?v=1.2.14';

let boatData = null;
let scene3d = null;
let currentTabId = '';
let currentVariantId = '';
const selections = {};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.__detailBootClear === 'function') window.__detailBootClear();
  window.__detailInitialized = true;
  bindCustomerOrderDialog();
  const id = new URLSearchParams(location.search).get('id');
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
  layout.innerHTML = `<div class="config-left"><div class="config-model-area"><div class="config-model-placeholder"><div id="model3dContainer" style="width:100%;height:100%;position:relative"><div id="model3dLoading" class="model-loading"><span>3D模型加载中…</span></div></div></div><div class="config-model-info"><span class="config-model-name">${escapeHtml(boatData.name)}</span><span class="config-model-type">${escapeHtml(boatData.typeName || '')}</span><span class="config-model-type">${escapeHtml(boatData.manufacturer || '')}</span></div></div><div class="config-price-bar"><div class="config-price-summary"><div class="config-price-current"><span class="config-price-label">模拟基础价</span><span class="config-price-subvalue" id="basePrice">—</span></div><div class="config-price-current"><span class="config-price-label">已选配置</span><span class="config-price-subvalue" id="extraPrice">—</span></div><div class="config-price-current config-price-total"><span class="config-price-label">方案参考总价</span><span class="config-price-value" id="totalPrice">—</span></div><small>${escapeHtml(boatData.pricingNote || '模拟参考价，仅供演示，最终以厂家正式报价为准')}</small></div><button class="btn-primary config-submit-btn" onclick="submitConfig()">提交定制方案</button></div></div><div class="config-right"><div class="config-tabs" id="configTabs">${tabList.map((tab,index) => `<button class="config-tab ${index === 0 ? 'active' : ''}" data-tab="${escapeAttr(tab.id)}" onclick="switchTab('${escapeJs(tab.id)}')">${escapeHtml(tab.label)}</button>`).join('')}</div><div class="config-tab-content" id="tabContent"></div></div>`;
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
  container.innerHTML = `<div class="config-section"><div class="config-section-header"><div><h3 class="config-section-title">${escapeHtml(tab.label)}</h3><p class="config-section-desc">${escapeHtml(tab.description || '')}</p></div></div>${options.length ? `<div class="config-option-grid">${options.map(option => optionHtml(tab, option)).join('')}</div>` : '<div class="detail-empty-option">该船型暂未配置此项，请联系厂家确认。</div>'}</div>`;
}

function overviewHtml(tab) {
  return `<div class="config-section"><h3 class="config-section-title">${escapeHtml(boatData.name)}</h3>${boatData.sceneImage ? `<img class="config-scene-image" src="${escapeAttr(boatData.sceneImage)}" alt="">` : ''}<p class="config-section-desc">${escapeHtml(boatData.description || '')}</p><div class="config-specs-grid"><div class="config-spec-item"><span class="config-spec-label">船长</span><span class="config-spec-value">${escapeHtml(boatData.length || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">载客/载荷</span><span class="config-spec-value">${escapeHtml(boatData.capacity || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">极速</span><span class="config-spec-value">${escapeHtml(boatData.maxSpeed || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">模拟基础价</span><span class="config-spec-value">${escapeHtml(formatYuan(boatData.basePriceYuan))}</span><small>${escapeHtml(boatData.pricingNote || '')}</small></div></div><div class="config-features">${(boatData.features || []).map(item => `<span class="config-feature-tag">${escapeHtml(item)}</span>`).join('')}</div></div>`;
}

function optionHtml(tab, option) {
  const selected = selections[tab.id] === option.id;
  const priceDeltaYuan = optionPrice(option);
  return `<button class="config-option-card ${selected ? 'selected' : ''}" onclick="selectOption('${escapeJs(tab.id)}','${escapeJs(option.id)}')">${option.imageUrl ? `<img class="config-option-image" src="${escapeAttr(option.imageUrl)}" alt="">` : ''}${tab.kind === 'color' && option.color ? `<span class="color-swatch" style="background:${escapeAttr(option.color)}"></span>` : ''}<span class="config-option-name">${escapeHtml(option.name)}</span><span class="config-option-detail">${escapeHtml(option.description || '')}</span>${priceDeltaYuan > 0 ? `<span class="config-option-tag tag-price">+${escapeHtml(formatYuan(priceDeltaYuan))}</span>` : ''}</button>`;
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
  try {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
      history.back();
      return;
    }
  } catch {}
  window.location.href = 'index.html';
}
function toast(message, error = false) { const container = document.getElementById('toastContainer'); const item = document.createElement('div'); item.className = `toast ${error ? 'error' : 'success'}`; item.textContent = message; container.appendChild(item); setTimeout(() => item.remove(), 3500); }
function escapeHtml(value) { const span = document.createElement('span'); span.textContent = value == null ? '' : String(value); return span.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g,'&quot;'); }
function escapeJs(value) { return String(value || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
Object.assign(window, { switchTab, selectOption, submitConfig, returnToCatalog });
