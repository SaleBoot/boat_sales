const API_BASE = '';
const state = { shipyards: [], boats: [], categories: [], membership: [], bindingRequests: [], orders: [], editing: null, preview: null, editorStep: 'basic', transferPending: false, archivePending: false };
const COLOR_PRESETS = [
  ['极地白', '#F0F0F2'], ['远洋银', '#C7CCD4'], ['破浪青', '#2E8B8B'],
  ['深海蓝', '#1B3A5B'], ['炽焰红', '#E93442'], ['曜石黑', '#20242A']
];

document.addEventListener('DOMContentLoaded', async () => {
  bindUi();
  await loadAll();
});

function bindUi() {
  document.querySelectorAll('.admin-v2-tabs button').forEach(button => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
  document.getElementById('newBoatBtn').addEventListener('click', () => openBoatEditor());
  document.getElementById('boatSearch').addEventListener('input', renderHierarchy);
  document.getElementById('showArchived').addEventListener('change', loadBoats);
  document.getElementById('refreshMembership').addEventListener('click', loadMembershipRequests);
  document.getElementById('refreshBindings').addEventListener('click', loadBindingRequests);
  document.getElementById('closeBoatEditor').addEventListener('click', closeBoatEditor);
  document.getElementById('cancelBoatEditor').addEventListener('click', closeBoatEditor);
  document.getElementById('boatEditorOverlay').addEventListener('click', event => { if (event.target.id === 'boatEditorOverlay') closeBoatEditor(); });
  document.getElementById('boatEditorForm').addEventListener('submit', saveBoat);
  document.querySelectorAll('[data-editor-step]').forEach(button => button.addEventListener('click', () => showEditorStep(button.dataset.editorStep)));
  document.getElementById('editorPrevBtn').addEventListener('click', () => moveEditorStep(-1));
  document.getElementById('editorNextBtn').addEventListener('click', () => moveEditorStep(1));
  document.getElementById('editCategory').addEventListener('change', () => renderSubtypeOptions());
  document.getElementById('addTabBtn').addEventListener('click', addTab);
  document.getElementById('configTabEditor').addEventListener('click', handleConfigEditorClick);
  document.getElementById('configTabEditor').addEventListener('change', event => {
    if (event.target.matches('[data-field="kind"]')) { syncTabsFromDom(); renderConfigTabs(); }
    if (event.target.matches('[data-field="color"]')) updateColorPresetState(event.target.closest('.option-editor'), event.target.value);
  });
  document.getElementById('uploadImageBtn').addEventListener('click', () => {
    if (validateBasicForm()) document.getElementById('imageFile').click();
  });
  document.getElementById('imageFile').addEventListener('change', uploadImage);
  document.getElementById('uploadModelBtn').addEventListener('click', event => {
    if (!validateBasicForm()) event.preventDefault();
  });
  document.getElementById('modelFile').addEventListener('change', uploadModel);
  document.getElementById('variantList').addEventListener('click', event => {
    const button = event.target.closest('[data-preview-variant]');
    if (button) openVariantPreview(button.dataset.previewVariant);
  });
  document.getElementById('closeModelPreview').addEventListener('click', () => closeModelPreview(true));
  document.getElementById('cancelModelPreview').addEventListener('click', () => closeModelPreview(true));
  document.getElementById('modelPreviewOverlay').addEventListener('click', event => { if (event.target.id === 'modelPreviewOverlay') closeModelPreview(true); });
  document.getElementById('modelPreviewFrame').addEventListener('load', sendPreviewModel);
  document.getElementById('previewBowDirection').addEventListener('change', event => {
    if (!state.preview) return;
    state.preview.viewSettings.bowDirection = event.target.value;
    postPreview({ type: 'model-preview-direction', bowDirection: event.target.value });
  });
  document.getElementById('previewExteriorMode').addEventListener('click', () => postPreview({ type: 'model-preview-mode', mode: 'exterior' }));
  document.getElementById('previewInteriorMode').addEventListener('click', () => postPreview({ type: 'model-preview-mode', mode: 'interior' }));
  document.getElementById('saveExteriorPose').addEventListener('click', () => capturePreviewPose('exterior'));
  document.getElementById('saveInteriorPose').addEventListener('click', () => capturePreviewPose('interior'));
  document.getElementById('confirmModelPreview').addEventListener('click', confirmModelPreview);
  window.addEventListener('message', handlePreviewMessage);
  document.getElementById('archiveBoatBtn').addEventListener('click', archiveBoat);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (state.preview) closeModelPreview(true);
    else closeBoatEditor();
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({ message: '服务返回异常' }));
  if (response.status === 401) { location.href = 'login.html'; throw new Error('请先登录'); }
  if (!response.ok || json.success === false) throw new Error(json.message || '请求失败');
  return json;
}

function jsonOptions(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function loadAll() {
  try {
    const [shipyards, categories] = await Promise.all([api('/api/admin/shipyards'), api('/api/boat-categories')]);
    state.shipyards = shipyards.data || [];
    state.categories = categories.data || [];
    await Promise.all([loadBoats(), loadMembershipRequests(), loadBindingRequests(), loadOrders()]);
  } catch (error) { toast(error.message, true); }
}

async function loadBoats() {
  try {
    const includeArchived = document.getElementById('showArchived').checked;
    state.boats = (await api(`/api/admin/boats?includeArchived=${includeArchived}`)).data || [];
    renderHierarchy();
  } catch (error) { toast(error.message, true); }
}

function renderHierarchy() {
  const keyword = document.getElementById('boatSearch').value.trim().toLowerCase();
  const container = document.getElementById('shipyardHierarchy');
  let visibleCount = 0;
  const groups = state.shipyards.map(shipyard => {
    const matches = boat => !keyword || `${shipyard.name} ${boat.name} ${boat.shipId} ${boat.typeName} ${boat.manufacturer}`.toLowerCase().includes(keyword);
    const visibleBoats = state.boats.filter(boat => isBoatVisibleInRoot(boat));
    const ownedBoats = visibleBoats.filter(boat => Number(boat.ownerShipyardId) === Number(shipyard.id) && matches(boat));
    const boundBoats = visibleBoats.filter(boat => Number(boat.ownerShipyardId) !== Number(shipyard.id) && (boat.boundShipyardIds || []).map(Number).includes(Number(shipyard.id)) && matches(boat));
    if (keyword && !ownedBoats.length && !boundBoats.length && !String(shipyard.name).toLowerCase().includes(keyword)) return '';
    visibleCount += ownedBoats.length + boundBoats.length;
    return `<article class="shipyard-group">
      <header class="shipyard-group-head">
        <div class="shipyard-title"><span class="shipyard-avatar">${shipyard.logo_url ? `<img src="${escapeAttr(shipyard.logo_url)}" alt="${escapeAttr(shipyard.name)}图标">` : escapeHtml(String(shipyard.name || '厂').slice(0, 1))}</span><div><h2>${escapeHtml(shipyard.name)}</h2><p>${escapeHtml(shipyard.plan_name)} · ${shipyard.bound_count || 0}/${shipyard.model_quota} 艘已绑定船型</p></div></div>
        <div class="shipyard-head-actions"><span>自有 ${ownedBoats.length} 艘 · 跨厂绑定 ${boundBoats.length} 艘</span><button class="ui-button ui-button--ghost" onclick="openBoatEditor(null,${Number(shipyard.id)})">＋ 添加该厂船型</button></div>
      </header>
      ${boatDirectoryTable('本厂自有船型', ownedBoats, false)}
      ${boundBoats.length ? boatDirectoryTable('已绑定其他厂家船型', boundBoats, true) : ''}
      ${!ownedBoats.length && !boundBoats.length ? '<div class="empty-small">该厂家暂无船型</div>' : ''}
    </article>`;
  }).filter(Boolean);
  document.getElementById('boatCount').textContent = `共 ${visibleCount} 艘船型`;
  container.innerHTML = groups.length ? groups.join('') : '<div class="admin-empty-v2">没有符合条件的厂家或船型</div>';
}

function isInteriorVariant(variant) {
  const name = String(variant.variantName || '').trim();
  const id = String(variant.variantId || '').trim();
  return (
    Boolean(variant.detailedInterior) ||
    /内饰|客舱|空间/.test(name) ||
    /interior/i.test(id)
  );
}

function isBoatVisibleInRoot(boat) {
  if (boat && boat.published === false) return false;
  const variants = Array.isArray(boat && boat.variants) ? boat.variants : [];
  if (!variants.length) return true;
  return variants.some(variant => !isInteriorVariant(variant));
}

function boatDirectoryTable(title, boats, boundReference) {
  if (!boats.length) return '';
  return `<div class="boat-directory-section"><h3>${escapeHtml(title)}</h3><div class="boat-table-wrap"><table class="admin-data-table"><thead><tr><th>图片</th><th>船型/型号</th><th>分类</th><th>船长</th><th>载客/载荷</th><th>极速</th><th>状态</th><th>操作</th></tr></thead><tbody>${boats.map(boat => boatRow(boat, boundReference)).join('')}</tbody></table></div></div>`;
}

function boatRow(boat, boundReference = false) {
  return `<tr class="${boat.archived ? 'is-archived' : ''}">
    <td><img class="boat-admin-thumb" src="${escapeAttr(boat.image || '')}" alt=""></td>
    <td><strong>${escapeHtml(boat.name)}</strong><small>${escapeHtml(boat.shipId)}${boundReference ? ` · 原所属：${escapeHtml(boat.manufacturer)}` : ''}</small></td>
    <td>${escapeHtml(boat.categoryName)}<small>${escapeHtml(boat.typeName)}</small></td>
    <td>${escapeHtml(boat.length || '—')}</td><td>${escapeHtml(boat.capacity || '—')}</td><td>${escapeHtml(boat.maxSpeed || '—')}</td>
    <td><span class="status-pill ${boat.archived || !boat.published ? 'off' : 'on'}">${boat.archived ? '已归档' : boat.published ? '已上架' : '未上架'}</span></td>
    <td><button class="table-action" onclick="openBoatEditor(${boat.id})">${boundReference ? '查看原船型' : '完整编辑'}</button></td>
  </tr>`;
}

function switchPanel(name) {
  document.querySelectorAll('.admin-v2-tabs button').forEach(button => button.classList.toggle('active', button.dataset.panel === name));
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${name}`));
}

function defaultTabs(isUnmanned = false) {
  const common = [
    { id: uid('overview'), label: '船型', kind: 'overview', cameraMode: 'exterior', description: '查看船型资料与主要参数', options: [] },
    { id: uid('appearance'), label: '外观', kind: 'color', cameraMode: 'exterior', description: '选择船体涂装颜色', options: [
      { id: uid('white'), name: '极地白', color: '#F0F0F2', description: '', priceDelta: 0, accessories: [] },
      { id: uid('blue'), name: '深渊蓝', color: '#1B3A5B', description: '', priceDelta: 0, accessories: [] }
    ] }
  ];
  common.push(isUnmanned
    ? { id: uid('smart'), label: '智能系统', kind: 'accessory', cameraMode: 'exterior', description: '选择智能系统与任务配件', options: [] }
    : { id: uid('interior'), label: '内饰', kind: 'model', cameraMode: 'interior', description: '选择内饰并进入船舱视角', options: [] });
  common.push({ id: uid('power'), label: '动力', kind: 'config', cameraMode: 'exterior', description: '选择动力系统方案', options: [] });
  return common;
}

function openBoatEditor(id = null, ownerId = null) {
  const boat = id ? state.boats.find(item => Number(item.id) === Number(id)) : null;
  state.editing = boat ? structuredClone(boat) : {
    id: null, ownerShipyardId: Number(ownerId || (state.shipyards[0] && state.shipyards[0].id)), shipId: '', name: '',
    category: state.categories[0] ? state.categories[0].id : 'commercial', categoryName: state.categories[0] ? state.categories[0].name : '商用船',
    subtype: '', typeName: '', length: '', capacity: '', maxSpeed: '资料待确认', basePriceYuan: 0, description: '', features: [],
    image: '', sceneImage: '', customizable: true, published: true, archived: false, variants: [], configTabs: defaultTabs(false)
  };
  state.transferPending = false;
  state.archivePending = false;
  state.editorStep = 'basic';
  document.getElementById('boatEditorTitle').textContent = boat ? `编辑船型 · ${boat.name}` : '新增船型';
  document.getElementById('boatId').value = state.editing.id || '';
  renderOwnerOptions(); renderCategoryOptions(); fillBasicFields(); renderVariants(); renderConfigTabs();
  const archive = document.getElementById('archiveBoatBtn');
  archive.hidden = !boat; archive.textContent = boat && boat.archived ? '恢复船型' : '归档船型';
  document.getElementById('uploadImageBtn').disabled = false;
  document.getElementById('uploadModelBtn').classList.remove('is-disabled');
  document.getElementById('editorStatus').textContent = boat ? '修改完成后点击“保存并完成”' : '填写带 * 的基本资料后，即可直接选择并预览模型';
  showEditorStep('basic');
  const overlay = document.getElementById('boatEditorOverlay');
  overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
}

function showEditorStep(step) {
  const steps = ['basic', 'model', 'config'];
  state.editorStep = steps.includes(step) ? step : 'basic';
  document.querySelectorAll('[data-editor-step]').forEach(button => button.classList.toggle('active', button.dataset.editorStep === state.editorStep));
  document.querySelectorAll('[data-editor-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.editorPanel === state.editorStep));
  const index = steps.indexOf(state.editorStep);
  document.getElementById('editorPrevBtn').hidden = index === 0;
  document.getElementById('editorNextBtn').hidden = index === steps.length - 1;
  document.querySelector('.editor-scroll').scrollTop = 0;
}

function moveEditorStep(offset) {
  const steps = ['basic', 'model', 'config'];
  const current = Math.max(0, steps.indexOf(state.editorStep));
  if (offset > 0 && current === 0 && !validateBasicForm()) return;
  showEditorStep(steps[Math.max(0, Math.min(steps.length - 1, current + offset))]);
}

function closeBoatEditor() {
  const overlay = document.getElementById('boatEditorOverlay');
  overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open');
}

function renderOwnerOptions() {
  document.getElementById('editOwner').innerHTML = state.shipyards.map(item => `<option value="${item.id}" ${Number(item.id) === Number(state.editing.ownerShipyardId) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}

function renderCategoryOptions() {
  document.getElementById('editCategory').innerHTML = state.categories.map(item => `<option value="${escapeAttr(item.id)}" ${item.id === state.editing.category ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
  renderSubtypeOptions(state.editing.subtype);
}

function renderSubtypeOptions(selected = '') {
  const categoryId = document.getElementById('editCategory').value;
  const category = state.categories.find(item => item.id === categoryId);
  const children = category && Array.isArray(category.children) ? category.children : [];
  document.getElementById('editSubtype').innerHTML = children.map(item => `<option value="${escapeAttr(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('') || '<option value="">未设置小类</option>';
}

function fillBasicFields() {
  const values = { editShipId: 'shipId', editName: 'name', editTypeName: 'typeName', editLength: 'length', editCapacity: 'capacity', editMaxSpeed: 'maxSpeed', editImage: 'image', editSceneImage: 'sceneImage', editDescription: 'description' };
  Object.entries(values).forEach(([id, key]) => { document.getElementById(id).value = state.editing[key] || ''; });
  document.getElementById('editPrice').value = state.editing.basePriceYuan ? state.editing.basePriceYuan / 10000 : '';
  document.getElementById('editShipId').readOnly = Boolean(state.editing.id);
  document.getElementById('editFeatures').value = (state.editing.features || []).join('\n');
  document.getElementById('editCustomizable').checked = state.editing.customizable !== false;
  document.getElementById('editPublished').checked = state.editing.published !== false;
}

function renderVariants() {
  const variants = state.editing.variants || [];
  const modelCards = variants.map(item => `<article><img src="${escapeAttr(item.thumbnailUrl || state.editing.image || '')}" alt=""><div><strong>${escapeHtml(item.variantName)}</strong><small>${escapeHtml(item.variantId)}</small><span>${(item.modelFiles || []).length} 个主模型 · ${item.detailedInterior ? '包含内饰' : '标准/外观模型'}</span><em class="model-ready-state">已确认入库</em></div></article>`).join('');
  document.getElementById('variantList').innerHTML = modelCards || '<div class="empty-small">尚未上传3D模型版本</div>';
}

function renderConfigTabs() {
  const container = document.getElementById('configTabEditor');
  const tabs = state.editing.configTabs || [];
  container.innerHTML = tabs.length ? tabs.map((tab, ti) => `<article class="tab-editor-card" data-tab-index="${ti}">
    <header><span class="drag-index">${ti + 1}</span><input class="tab-label-input" data-field="label" value="${escapeAttr(tab.label)}" aria-label="页签名称"><select data-field="kind">${kindOptions(tab.kind)}</select><select data-field="cameraMode" aria-label="该页展示视角"><option value="exterior" ${tab.cameraMode !== 'interior' ? 'selected' : ''}>外观视角</option><option value="interior" ${tab.cameraMode === 'interior' ? 'selected' : ''}>船内视角</option></select><div class="mini-actions"><button type="button" data-action="tab-up">↑</button><button type="button" data-action="tab-down">↓</button><button type="button" data-action="tab-remove" class="danger">删除</button></div></header>
    <input class="tab-description" data-field="description" value="${escapeAttr(tab.description || '')}" placeholder="页签说明">
    <div class="option-editor-list">${(tab.options || []).map((option, oi) => optionEditor(option, ti, oi, tab.kind)).join('')}</div>
    ${tab.kind !== 'overview' ? '<button type="button" class="add-option-button" data-action="option-add">＋ 添加选项</button>' : '<p class="overview-note">船型资料页不需要选项，将直接展示基本参数。</p>'}
  </article>`).join('') : '<div class="empty-small">暂无定制页签，请点击“添加页签”</div>';
}

function optionEditor(option, ti, oi, kind) {
  const variants = state.editing.variants || [];
  const selectedColor = normalizeColor(option.color);
  const specificControl = kind === 'color'
    ? `<div class="option-control color-palette-control"><span>选择颜色</span><div class="color-picker-row"><label class="native-color-picker" title="打开完整调色盘"><input type="color" data-field="color" value="${selectedColor}" aria-label="打开完整调色盘"><span>调色盘</span></label><div class="color-presets" aria-label="常用船体颜色">${COLOR_PRESETS.map(([name, color]) => `<button type="button" class="color-preset${color.toLowerCase() === selectedColor.toLowerCase() ? ' active' : ''}" data-color-preset="${color}" style="--swatch:${color}" title="${name}" aria-label="选择${name}"><i></i><small>${name}</small></button>`).join('')}</div></div></div>`
    : kind === 'model'
      ? `<label class="option-control option-control--model"><span>关联3D模型</span><select data-field="modelVariantId"><option value="">暂不关联模型</option>${variants.map(variant => `<option value="${escapeAttr(variant.variantId)}" ${variant.variantId === option.modelVariantId ? 'selected' : ''}>${escapeHtml(variant.variantName)}</option>`).join('')}</select></label>`
      : kind === 'accessory'
        ? '<button type="button" class="option-primary-action" data-action="accessory-upload">上传智能配件</button>'
        : '';
  return `<article class="option-editor" data-option-index="${oi}"><div class="option-editor-main">
    <input class="option-name" data-field="name" value="${escapeAttr(option.name || '')}" placeholder="选项名称">
    <input class="option-description" data-field="description" value="${escapeAttr(option.description || '')}" placeholder="选项说明">
    <label class="option-control"><span>选配价（万元）</span><input type="number" min="0" step="0.1" data-field="priceDeltaWan" value="${Number(option.priceDeltaYuan || 0) / 10000}"></label>
    ${specificControl}
    <button type="button" class="table-action option-entry-view-action" data-action="option-view">${option.entryView ? '重设切入视角' : '编辑切入视角'}</button>
    <div class="mini-actions"><button type="button" data-action="option-up" title="上移">↑</button><button type="button" data-action="option-down" title="下移">↓</button><button type="button" data-action="option-remove" class="danger">删除</button></div>
  </div><div class="accessory-list">${(option.accessories || []).map((asset, ai) => accessoryEditor(asset, ai)).join('')}</div></article>`;
}

function normalizeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : '#F0F0F2';
}

function updateColorPresetState(optionCard, value) {
  if (!optionCard) return;
  optionCard.querySelectorAll('[data-color-preset]').forEach(button => {
    button.classList.toggle('active', button.dataset.colorPreset.toLowerCase() === String(value || '').toLowerCase());
  });
}

function accessoryEditor(asset, ai) {
  const position = asset.position || [0, 0, 0], rotation = asset.rotation || [0, 0, 0], scale = asset.scale || [1, 1, 1];
  return `<div class="accessory-row" data-accessory-index="${ai}"><strong>${escapeHtml(asset.name || `配件${ai + 1}`)}</strong><input data-field="modelUrl" value="${escapeAttr(asset.modelUrl || '')}" placeholder="模型地址"><span>位置</span>${position.map((v, i) => `<input type="number" step="0.01" data-vector="position" data-vector-index="${i}" value="${Number(v) || 0}">`).join('')}<span>旋转°</span>${rotation.map((v, i) => `<input type="number" step="1" data-vector="rotation" data-vector-index="${i}" value="${Number(v) || 0}">`).join('')}<span>缩放</span>${scale.map((v, i) => `<input type="number" step="0.01" data-vector="scale" data-vector-index="${i}" value="${Number(v) || 1}">`).join('')}<button type="button" data-action="accessory-remove" class="danger">删除配件</button></div>`;
}

function kindOptions(selected) {
  return [['overview','资料页'],['color','颜色/材质'],['model','完整模型'],['accessory','智能配件'],['config','普通配置']].map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function collectTabs() {
  return Array.from(document.querySelectorAll('.tab-editor-card')).map((card, ti) => ({
    id: (state.editing.configTabs[ti] && state.editing.configTabs[ti].id) || uid('tab'),
    label: card.querySelector('[data-field="label"]').value.trim(), kind: card.querySelector('[data-field="kind"]').value,
    cameraMode: card.querySelector('[data-field="cameraMode"]').value, description: card.querySelector('[data-field="description"]').value.trim(), sortOrder: ti,
    options: Array.from(card.querySelectorAll('.option-editor')).map((optionEl, oi) => {
      const oldOption = (((state.editing.configTabs[ti] || {}).options || [])[oi] || {});
      const colorInput = optionEl.querySelector('[data-field="color"]');
      const modelSelect = optionEl.querySelector('[data-field="modelVariantId"]');
      const priceInput = optionEl.querySelector('[data-field="priceDeltaWan"]');
      const accessoryRows = Array.from(optionEl.querySelectorAll('.accessory-row'));
      return {
      id: oldOption.id || uid('option'),
      name: optionEl.querySelector('[data-field="name"]').value.trim(), description: optionEl.querySelector('[data-field="description"]').value.trim(),
      color: colorInput ? colorInput.value.trim() : (oldOption.color || ''),
      entryView: oldOption.entryView || null,
      priceDeltaYuan: Math.max(0, Math.round((Number(priceInput && priceInput.value) || 0) * 10000)),
      modelVariantId: modelSelect ? modelSelect.value : (oldOption.modelVariantId || ''), sortOrder: oi,
      accessories: accessoryRows.length ? accessoryRows.map((assetEl, ai) => {
        const old = (oldOption.accessories || [])[ai] || {};
        const vector = name => Array.from(assetEl.querySelectorAll(`[data-vector="${name}"]`)).sort((a,b) => a.dataset.vectorIndex-b.dataset.vectorIndex).map(input => Number(input.value) || (name === 'scale' ? 1 : 0));
        return { id: old.id || uid('asset'), name: old.name || `配件${ai + 1}`, modelUrl: assetEl.querySelector('[data-field="modelUrl"]').value.trim(), position: vector('position'), rotation: vector('rotation'), scale: vector('scale') };
      }) : (oldOption.accessories || [])
    };})
  }));
}

function syncTabsFromDom() { if (document.querySelector('.tab-editor-card')) state.editing.configTabs = collectTabs(); }

function addTab() { syncTabsFromDom(); state.editing.configTabs.push({ id: uid('tab'), label: '新配置', kind: 'config', cameraMode: 'exterior', description: '', options: [] }); renderConfigTabs(); }

async function handleConfigEditorClick(event) {
  const colorPreset = event.target.closest('[data-color-preset]');
  if (colorPreset) {
    const optionCard = colorPreset.closest('.option-editor');
    const colorInput = optionCard && optionCard.querySelector('[data-field="color"]');
    if (colorInput) {
      colorInput.value = colorPreset.dataset.colorPreset;
      updateColorPresetState(optionCard, colorInput.value);
    }
    return;
  }
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const tabCard = button.closest('.tab-editor-card'); const optionCard = button.closest('.option-editor');
  const ti = Number(tabCard.dataset.tabIndex), oi = optionCard ? Number(optionCard.dataset.optionIndex) : -1;
  syncTabsFromDom(); const tabs = state.editing.configTabs; const action = button.dataset.action;
  if (action === 'option-view') {
    const option = tabs[ti].options[oi];
    const variantId = option.modelVariantId || ((state.editing.variants || [])[0] || {}).variantId;
    if (!variantId) return toast('请先在“3D模型”步骤上传并确认模型', true);
    openOptionViewPreview(variantId, tabs[ti], option);
    return;
  }
  if (action === 'tab-up' && ti > 0) [tabs[ti-1], tabs[ti]] = [tabs[ti], tabs[ti-1]];
  if (action === 'tab-down' && ti < tabs.length - 1) [tabs[ti+1], tabs[ti]] = [tabs[ti], tabs[ti+1]];
  if (action === 'tab-remove') tabs.splice(ti, 1);
  if (action === 'option-add') tabs[ti].options.push({ id: uid('option'), name: '新选项', description: '', color: '', priceDeltaYuan: 0, modelVariantId: '', accessories: [] });
  if (action === 'option-up' && oi > 0) [tabs[ti].options[oi-1], tabs[ti].options[oi]] = [tabs[ti].options[oi], tabs[ti].options[oi-1]];
  if (action === 'option-down' && oi < tabs[ti].options.length - 1) [tabs[ti].options[oi+1], tabs[ti].options[oi]] = [tabs[ti].options[oi], tabs[ti].options[oi+1]];
  if (action === 'option-remove') tabs[ti].options.splice(oi, 1);
  if (action === 'accessory-remove') { const ai = Number(button.closest('.accessory-row').dataset.accessoryIndex); tabs[ti].options[oi].accessories.splice(ai, 1); }
  if (action === 'accessory-upload') { await uploadAccessory(ti, oi); return; }
  renderConfigTabs();
}

async function uploadAccessory(ti, oi) {
  if (!state.editing.id) return toast('请先保存船型，再上传配件模型', true);
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.fbx,.gltf,.glb,.obj';
  input.addEventListener('change', async () => {
    if (!input.files[0]) return; const form = new FormData(); form.append('model', input.files[0]);
    try { const json = await api(`/api/admin/boats/${state.editing.id}/accessory`, { method: 'POST', body: form }); syncTabsFromDom(); state.editing.configTabs[ti].options[oi].accessories.push(json.data); renderConfigTabs(); toast('配件模型已加入该选项'); } catch (error) { toast(error.message, true); }
  }); input.click();
}

function collectBoatForm() {
  syncTabsFromDom(); const category = state.categories.find(item => item.id === document.getElementById('editCategory').value); const subtype = category && (category.children || []).find(item => item.id === document.getElementById('editSubtype').value);
  return { ownerShipyardId: Number(document.getElementById('editOwner').value), shipId: document.getElementById('editShipId').value.trim(), name: document.getElementById('editName').value.trim(), category: category ? category.id : '', categoryName: category ? category.name : '', subtype: subtype ? subtype.id : '', typeName: document.getElementById('editTypeName').value.trim() || (subtype ? subtype.name : ''), length: document.getElementById('editLength').value.trim(), capacity: document.getElementById('editCapacity').value.trim(), maxSpeed: document.getElementById('editMaxSpeed').value.trim(), basePriceYuan: Math.max(0, Math.round((Number(document.getElementById('editPrice').value) || 0) * 10000)), image: document.getElementById('editImage').value.trim(), sceneImage: document.getElementById('editSceneImage').value.trim(), description: document.getElementById('editDescription').value.trim(), features: document.getElementById('editFeatures').value.split(/\n|、/).map(x => x.trim()).filter(Boolean), customizable: document.getElementById('editCustomizable').checked, published: document.getElementById('editPublished').checked, configTabs: state.editing.configTabs };
}

function validateBasicForm() {
  const required = [
    ['editOwner', '请选择所属厂家'], ['editShipId', '请填写内部型号'], ['editName', '请填写船型名称'],
    ['editCategory', '请选择船型大类'], ['editSubtype', '请选择船型小类']
  ];
  for (const [id, message] of required) {
    const element = document.getElementById(id);
    if (!String(element.value || '').trim()) {
      showEditorStep('basic'); setEditorStatus(message, true); toast(message, true); element.focus(); return false;
    }
  }
  setEditorStatus(state.editing && state.editing.id ? '基本资料完整，可以上传模型' : '选择文件后会自动保存基本资料，再进入模型预览');
  return true;
}

async function ensureBoatSavedForUpload() {
  if (state.editing.id) return true;
  if (!validateBasicForm()) return false;
  const body = collectBoatForm();
  setEditorStatus('正在保存基本资料…');
  try {
    const json = await api('/api/admin/boats', jsonOptions('POST', body));
    state.editing = json.data;
    document.getElementById('boatId').value = state.editing.id;
    document.getElementById('editShipId').readOnly = true;
    document.getElementById('archiveBoatBtn').hidden = false;
    document.getElementById('boatEditorTitle').textContent = `编辑船型 · ${state.editing.name}`;
    setEditorStatus('基本资料已自动保存，模型仍为暂存，预览确认后才会入库');
    toast('基本资料已保存，正在上传模型');
    return true;
  } catch (error) {
    setEditorStatus(error.message, true); toast(error.message, true); return false;
  }
}

async function saveBoat(event) {
  event.preventDefault(); if (!validateBasicForm()) return; const body = collectBoatForm(); const wasNew = !state.editing.id;
  if (state.editing.id && Number(body.ownerShipyardId) !== Number(state.editing.ownerShipyardId) && !state.transferPending) { state.transferPending = true; setEditorStatus('更换所属厂家会影响后台层级。请再次点击“确认转移并保存”。', true); document.getElementById('saveBoatBtn').textContent = '确认转移并保存'; return; }
  setSaving(true);
  try {
    const json = state.editing.id ? await api(`/api/admin/boats/${state.editing.id}`, jsonOptions('PUT', body)) : await api('/api/admin/boats', jsonOptions('POST', body));
    state.editing = json.data; toast(wasNew ? '船型已创建' : '船型资料与定制配置已保存'); closeBoatEditor(); await loadBoats();
  } catch (error) { setEditorStatus(error.message, true); } finally { setSaving(false); }
}

async function uploadImage() {
  const input = document.getElementById('imageFile'); const file = input.files[0]; if (!file) return;
  if (!(await ensureBoatSavedForUpload())) { input.value = ''; return; }
  const form = new FormData(); form.append('image', file);
  try { const json = await api(`/api/admin/boats/${state.editing.id}/image`, { method: 'POST', body: form }); document.getElementById('editImage').value = json.image; state.editing.image = json.image; toast('封面图片已上传'); } catch (error) { toast(error.message, true); }
  input.value = '';
}

async function uploadModel() {
  const input = document.getElementById('modelFile');
  const files = Array.from(input.files || []); if (!files.length) return;
  const entry = files.find(file => /\.(fbx|gltf|glb|obj)$/i.test(file.name));
  if (!entry) { input.value = ''; return toast('请选择 FBX、GLTF、GLB 或 OBJ 主模型文件', true); }
  if (!(await ensureBoatSavedForUpload())) { input.value = ''; return; }
  const form = new FormData(); files.forEach(file => form.append('files', file)); form.append('variantName', entry.name.replace(/\.[^.]+$/, ''));
  document.getElementById('uploadModelBtn').classList.add('is-disabled');
  document.getElementById('uploadModelBtn').setAttribute('aria-disabled', 'true');
  setEditorStatus(`正在暂存并解析 ${files.length} 个模型/贴图文件…`);
  try {
    const json = await api(`/api/admin/boats/${state.editing.id}/model-drafts`, { method: 'POST', body: form });
    openDraftPreview(json.data);
  } catch (error) { toast(error.message, true); setEditorStatus(error.message, true); }
  finally { input.value = ''; document.getElementById('uploadModelBtn').classList.remove('is-disabled'); document.getElementById('uploadModelBtn').removeAttribute('aria-disabled'); }
}

function defaultViewSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return { bowDirection: source.bowDirection || 'auto', exterior: source.exterior || null, interior: source.interior || null };
}

function openDraftPreview(draft) {
  state.preview = {
    kind: 'draft', draftId: draft.draftId, variantId: '', variantName: draft.variantName,
    variant: { variantName: draft.variantName, modelFiles: [draft.modelUrl], viewSettings: defaultViewSettings() },
    viewSettings: defaultViewSettings(), detailedInterior: false, ready: false
  };
  showModelPreview();
}

function openVariantPreview(variantId, initialMode = 'exterior') {
  const variant = (state.editing.variants || []).find(item => item.variantId === variantId);
  if (!variant) return toast('模型版本不存在', true);
  state.preview = {
    kind: 'existing', draftId: '', variantId, variantName: variant.variantName,
    variant: structuredClone(variant), viewSettings: defaultViewSettings(variant.viewSettings),
    detailedInterior: Boolean(variant.detailedInterior), initialMode, ready: false
  };
  showModelPreview();
}

function openOptionViewPreview(variantId, tab, option) {
  const variant = (state.editing.variants || []).find(item => item.variantId === variantId);
  if (!variant) return toast('模型版本不存在', true);
  const initialMode = tab.cameraMode === 'interior' ? 'interior' : 'exterior';
  const viewSettings = defaultViewSettings(variant.viewSettings);
  if (option.entryView && Array.isArray(option.entryView.position) && Array.isArray(option.entryView.target)) viewSettings[initialMode] = structuredClone(option.entryView);
  state.preview = {
    kind: 'option', draftId: '', variantId, variantName: variant.variantName,
    tabId: tab.id, optionId: option.id, optionName: option.name, initialMode,
    variant: structuredClone(variant), viewSettings,
    detailedInterior: Boolean(variant.detailedInterior), ready: false, capturePending: false
  };
  showModelPreview();
}

function showModelPreview() {
  const preview = state.preview;
  document.getElementById('modelPreviewTitle').textContent = preview.kind === 'draft' ? '3D模型上传预览' : preview.kind === 'option' ? `编辑选配切入视角 · ${preview.optionName}` : '模型展示视角';
  document.getElementById('previewVariantName').value = preview.variantName || '';
  document.getElementById('previewBowDirection').value = preview.viewSettings.bowDirection || 'auto';
  document.getElementById('previewDetailedInterior').checked = preview.detailedInterior;
  document.getElementById('confirmModelPreview').disabled = true;
  document.getElementById('confirmModelPreview').textContent = preview.kind === 'draft' ? '确认并存入数据库' : preview.kind === 'option' ? '保存为此选配切入视角' : '保存模型设置';
  document.getElementById('modelPreviewStatus').textContent = preview.kind === 'draft' ? '模型仅为暂存，确认前不会写入数据库' : preview.kind === 'option' ? '点击左侧画面后，使用鼠标和 W/A/S/D + Q/E 调整第一人称位置' : '保存后将用于网页厂商端和访客端展示';
  document.getElementById('modelPreviewLoading').hidden = false;
  document.getElementById('modelPreviewLoading').textContent = '正在解析模型与贴图…';
  document.querySelectorAll('.view-edit-control').forEach(element => { element.hidden = preview.kind === 'draft'; });
  document.getElementById('previewHelpText').textContent = preview.kind === 'option' ? '点击左侧画面后，用鼠标拖动转向；W/A/S/D 前后左右移动，Q/E 下降/上升。位置确定后点击右下角保存。' : '先在左侧拖动旋转、滚轮缩放到合适位置，再保存。内饰视角请把镜头放在船舱内并朝向船头。';
  ['previewExteriorMode', 'saveExteriorPose', 'previewInteriorMode', 'saveInteriorPose'].forEach(id => { document.getElementById(id).hidden = preview.kind === 'option' || preview.kind === 'draft'; });
  updatePreviewPoseStatus();
  const overlay = document.getElementById('modelPreviewOverlay'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('modelPreviewFrame').src = `model-preview.html?v=${Date.now()}`;
}

async function closeModelPreview(cancelDraft = false) {
  const preview = state.preview;
  state.preview = null;
  document.getElementById('modelPreviewOverlay').classList.remove('show');
  document.getElementById('modelPreviewOverlay').setAttribute('aria-hidden', 'true');
  document.getElementById('modelPreviewFrame').src = 'about:blank';
  if (cancelDraft && preview && preview.kind === 'draft' && preview.draftId) {
    try { await api(`/api/admin/model-drafts/${preview.draftId}`, { method: 'DELETE' }); } catch {}
    setEditorStatus('已取消本次模型上传，暂存文件已清理，数据库中未新增模型版本');
  } else if (cancelDraft && preview) {
    setEditorStatus('已取消本次模型设置，原模型数据没有变化');
  }
}

function sendPreviewModel() {
  if (!state.preview || document.getElementById('modelPreviewFrame').src.endsWith('about:blank')) return;
  postPreview({ type: 'model-preview-load', variant: { ...state.preview.variant, viewSettings: state.preview.viewSettings } });
}

function postPreview(message) {
  const frame = document.getElementById('modelPreviewFrame');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage(message, location.origin);
}

function capturePreviewPose(mode) {
  if (!state.preview || !state.preview.ready) return toast('请等待模型加载完成', true);
  postPreview({ type: 'model-preview-capture', mode });
}

function handlePreviewMessage(event) {
  if (event.origin !== location.origin || event.source !== document.getElementById('modelPreviewFrame').contentWindow || !state.preview) return;
  const message = event.data || {};
  if (message.type === 'model-preview-ready') {
    state.preview.ready = true;
    document.getElementById('modelPreviewLoading').hidden = true;
    document.getElementById('confirmModelPreview').disabled = false;
    document.getElementById('modelPreviewStatus').textContent = state.preview.kind === 'option' ? '第一人称编辑已就绪：鼠标转向，W/A/S/D 移动，Q/E 升降' : '模型已成功显示，请检查贴图、方向和视角后确认';
    postPreview({ type: 'model-preview-mode', mode: state.preview.initialMode || 'exterior' });
    postPreview({ type: 'model-preview-navigation', enabled: state.preview.kind === 'option' });
  } else if (message.type === 'model-preview-error') {
    state.preview.ready = false;
    document.getElementById('modelPreviewLoading').hidden = false;
    document.getElementById('modelPreviewLoading').textContent = `模型预览失败：${message.message || '文件无法解析'}`;
    document.getElementById('confirmModelPreview').disabled = true;
  } else if (message.type === 'model-preview-pose' && ['exterior', 'interior'].includes(message.mode)) {
    state.preview.viewSettings[message.mode] = message.pose;
    updatePreviewPoseStatus();
    if (state.preview.kind === 'option' && state.preview.capturePending) {
      state.preview.capturePending = false;
      persistOptionEntryView(message.pose);
      return;
    }
    toast(message.mode === 'interior' ? '内饰视角已记录，确认后生效' : '外观视角已记录，确认后生效');
  }
}

function updatePreviewPoseStatus() {
  if (!state.preview) return;
  const settings = state.preview.viewSettings;
  document.getElementById('previewPoseStatus').textContent = `外观视角：${settings.exterior ? '已保存' : '自动'} · 内饰视角：${settings.interior ? '已保存' : '自动'}`;
}

async function confirmModelPreview() {
  if (!state.preview || !state.preview.ready) return;
  const preview = state.preview;
  const button = document.getElementById('confirmModelPreview'); button.disabled = true; button.textContent = '保存中…';
  if (preview.kind === 'option') {
    preview.capturePending = true;
    postPreview({ type: 'model-preview-capture', mode: preview.initialMode || 'exterior' });
    return;
  }
  const payload = {
    variantName: document.getElementById('previewVariantName').value.trim() || preview.variantName,
    detailedInterior: document.getElementById('previewDetailedInterior').checked,
    viewSettings: { ...preview.viewSettings, bowDirection: document.getElementById('previewBowDirection').value }
  };
  try {
    syncTabsFromDom(); const pendingTabs = structuredClone(state.editing.configTabs || []);
    const url = preview.kind === 'draft'
      ? `/api/admin/boats/${state.editing.id}/model-drafts/${preview.draftId}/confirm`
      : `/api/admin/boats/${state.editing.id}/variants/${encodeURIComponent(preview.variantId)}`;
    const json = await api(url, jsonOptions(preview.kind === 'draft' ? 'POST' : 'PUT', payload));
    state.editing = json.data; state.editing.configTabs = pendingTabs;
    if (preview.kind === 'draft') preview.draftId = '';
    await closeModelPreview(false); renderVariants(); renderConfigTabs();
    setEditorStatus(preview.kind === 'draft' ? '模型已确认入库，可继续配置或保存完成' : '模型展示视角已保存');
    toast(preview.kind === 'draft' ? '模型已确认并存入数据库' : '模型展示视角已保存');
  } catch (error) {
    toast(error.message, true); button.disabled = false;
    button.textContent = preview.kind === 'draft' ? '确认并存入数据库' : '保存模型设置';
  }
}

async function persistOptionEntryView(pose) {
  const preview = state.preview;
  if (!preview) return;
  try {
    syncTabsFromDom();
    const tab = (state.editing.configTabs || []).find(item => item.id === preview.tabId);
    const option = tab && (tab.options || []).find(item => item.id === preview.optionId);
    if (!option) throw new Error('选配项目不存在，请重新打开编辑');
    option.entryView = { mode: preview.initialMode || 'exterior', ...pose };
    const json = await api(`/api/admin/boats/${state.editing.id}`, jsonOptions('PUT', collectBoatForm()));
    state.editing = json.data;
    await closeModelPreview(false); renderVariants(); renderConfigTabs();
    setEditorStatus(`“${preview.optionName}”切入视角已保存`);
    toast('选配切入视角已保存');
  } catch (error) {
    toast(error.message, true);
    const button = document.getElementById('confirmModelPreview');
    button.disabled = false; button.textContent = '保存为此选配切入视角';
  }
}

async function archiveBoat() {
  if (!state.editing || !state.editing.id) return;
  if (!state.archivePending) { state.archivePending = true; document.getElementById('archiveBoatBtn').textContent = state.editing.archived ? '再次点击确认恢复' : '再次点击确认归档'; setEditorStatus(state.editing.archived ? '恢复后仍需确认是否重新上架。' : '归档不会删除模型、绑定和历史订单。'); return; }
  try { await api(`/api/admin/boats/${state.editing.id}/archive`, jsonOptions('PUT', { archived: !state.editing.archived })); toast(state.editing.archived ? '船型已恢复' : '船型已安全归档'); closeBoatEditor(); await loadBoats(); } catch (error) { toast(error.message, true); }
}

async function loadMembershipRequests() {
  try { state.membership = (await api('/api/admin/membership-requests')).data || []; renderMembershipRequests(); } catch (error) { document.getElementById('membershipRequests').innerHTML = `<div class="admin-empty-v2">${escapeHtml(error.message)}</div>`; }
}

function renderMembershipRequests() {
  const el = document.getElementById('membershipRequests'); if (!state.membership.length) { el.innerHTML = '<div class="admin-empty-v2">暂无会员升级申请</div>'; return; }
  el.innerHTML = `<table class="admin-data-table"><thead><tr><th>厂家</th><th>当前→申请</th><th>联系人</th><th>备注</th><th>时间</th><th>状态/处理</th></tr></thead><tbody>${state.membership.map(item => `<tr><td>${escapeHtml(item.shipyard_name)}</td><td>${escapeHtml(item.current_plan_name)} → <strong>${escapeHtml(item.target_plan_name)}</strong></td><td>${escapeHtml(item.contact_name)}<small>${escapeHtml(item.contact_phone)}</small></td><td>${escapeHtml(item.note || '—')}</td><td>${formatTime(item.created_at)}</td><td>${item.status === 'pending' ? `<div class="membership-actions"><input type="date" id="membershipDate-${item.id}" title="新到期日期"><input id="membershipNote-${item.id}" placeholder="审核备注"><button onclick="decideMembership(${item.id},'approve')">通过</button><button class="danger" onclick="decideMembership(${item.id},'reject')">拒绝</button></div>` : `<span class="status-pill ${item.status === 'approved' ? 'on' : 'off'}">${item.status === 'approved' ? '已通过' : '已拒绝'}</span><small>${escapeHtml(item.review_note || '')}</small>`}</td></tr>`).join('')}</tbody></table>`;
}

async function decideMembership(id, decision) {
  const membershipExpiresAt = document.getElementById(`membershipDate-${id}`).value || null; const reviewNote = document.getElementById(`membershipNote-${id}`).value.trim();
  if (decision === 'approve' && !membershipExpiresAt) return toast('通过申请前请设置新的会员到期日期', true);
  try { await api(`/api/admin/membership-requests/${id}`, jsonOptions('PUT', { decision, membershipExpiresAt, reviewNote })); toast(decision === 'approve' ? '会员等级和到期日期已更新' : '申请已拒绝'); await Promise.all([loadMembershipRequests(), loadAllShipyardsOnly()]); } catch (error) { toast(error.message, true); }
}

async function loadAllShipyardsOnly() { state.shipyards = (await api('/api/admin/shipyards')).data || []; renderHierarchy(); }

async function loadBindingRequests() {
  try { state.bindingRequests = (await api('/api/admin/binding-requests')).data || []; renderBindingRequests(); }
  catch (error) { document.getElementById('bindingRequests').innerHTML = `<div class="admin-empty-v2">${escapeHtml(error.message)}</div>`; }
}

function renderBindingRequests() {
  const el = document.getElementById('bindingRequests');
  if (!state.bindingRequests.length) { el.innerHTML = '<div class="admin-empty-v2">暂无船型绑定申请</div>'; return; }
  el.innerHTML = `<table class="admin-data-table"><thead><tr><th>申请厂家</th><th>申请船型</th><th>模型版本</th><th>原所属厂家</th><th>额度</th><th>申请人/备注</th><th>时间</th><th>状态/处理</th></tr></thead><tbody>${state.bindingRequests.map(item => `<tr><td><strong>${escapeHtml(item.shipyard_name)}</strong></td><td>${escapeHtml(item.ship_name)}<small>${escapeHtml(item.ship_id)}</small></td><td>${escapeHtml(item.variant_name)}</td><td>${escapeHtml(item.owner_shipyard_name || '—')}</td><td><strong>${Number(item.bound_ship_count) || 0}/${Number(item.model_quota) || 0} 艘</strong><small>同船多版本只占1艘</small></td><td>${escapeHtml(item.requester)}<small>${escapeHtml(item.note || '无备注')}</small></td><td>${formatTime(item.created_at)}</td><td>${item.status === 'pending' ? `<div class="membership-actions"><input id="bindingNote-${item.id}" placeholder="审核备注"><button onclick="decideBinding(${item.id},'approve')">通过绑定</button><button class="danger" onclick="decideBinding(${item.id},'reject')">拒绝</button></div>` : `<span class="status-pill ${item.status === 'approved' ? 'on' : 'off'}">${item.status === 'approved' ? '已通过' : '已拒绝'}</span><small>${escapeHtml(item.review_note || '')}</small>`}</td></tr>`).join('')}</tbody></table>`;
}

async function decideBinding(id, decision) {
  const reviewNote = document.getElementById(`bindingNote-${id}`)?.value.trim() || '';
  try {
    await api(`/api/admin/binding-requests/${id}`, jsonOptions('PUT', { decision, reviewNote }));
    toast(decision === 'approve' ? '船型绑定已通过，厂家额度与目录已同步更新' : '绑定申请已拒绝');
    await Promise.all([loadBindingRequests(), loadAllShipyardsOnly(), loadBoats()]);
  } catch (error) { toast(error.message, true); }
}

async function loadOrders() {
  try { state.orders = (await api('/api/admin/orders')).data || []; document.getElementById('orderTableBody').innerHTML = state.orders.length ? state.orders.map(item => `<tr><td>${escapeHtml(item.orderId)}</td><td>${escapeHtml(item.customerName || '未填写')}<small>${escapeHtml(item.customerPhone || '')}</small></td><td>${escapeHtml(item.boatName || '—')}<small>${escapeHtml(item.manufacturer || '')}</small></td><td>${escapeHtml(item.hullColor || '—')}</td><td>${escapeHtml(item.interiorStyle || '—')}</td><td>${escapeHtml(item.enginePackage || '—')}</td><td>${escapeHtml(item.smartSystem || '—')}</td><td>${escapeHtml(formatYuan(item.basePriceYuan))}</td><td>${escapeHtml(formatYuan(item.optionPriceYuan))}</td><td><strong>${escapeHtml(formatYuan(item.totalPriceYuan))}</strong></td><td>${formatTime(item.createdAt)}</td><td><button class="table-action" onclick="exportOrderPdf('${escapeAttr(item.orderId)}')">导出PDF</button></td></tr>`).join('') : '<tr><td colspan="12">暂无订单</td></tr>'; } catch (error) { document.getElementById('orderTableBody').innerHTML = `<tr><td colspan="12">${escapeHtml(error.message)}</td></tr>`; }
}

function exportOrderPdf(orderId) { window.location.href = `/api/admin/orders/${encodeURIComponent(orderId)}/pdf`; }

async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} localStorage.removeItem('auth_user'); location.href = 'login.html'; }
function setSaving(saving) { const button = document.getElementById('saveBoatBtn'); button.disabled = saving; button.textContent = saving ? '保存中…' : '保存并完成'; if (!saving) state.transferPending = false; }
function setEditorStatus(message, error = false) { const el = document.getElementById('editorStatus'); el.textContent = message; el.classList.toggle('error', error); }
function toast(message, error = false) { const el = document.getElementById('adminToast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show'); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove('show'), 3000); }
function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value == null ? '' : String(value); return el.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
function formatTime(value) { if (!value) return '—'; return new Date(value).toLocaleString('zh-CN'); }
function formatYuan(value) { const yuan = Math.max(0, Math.round(Number(value) || 0)); if (!yuan) return '¥0'; if (yuan >= 10000) return `¥${(yuan / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`; return `¥${yuan.toLocaleString('zh-CN')}`; }

Object.assign(window, { openBoatEditor, decideMembership, decideBinding, exportOrderPdf });
