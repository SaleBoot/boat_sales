let dashboard = null;
let plans = [];

document.addEventListener('DOMContentLoaded', async () => {
  bindUi();
  await loadDashboard();
});

function bindUi() {
  document.getElementById('modelSearch').addEventListener('input', renderModels);
  document.querySelectorAll('.shipyard-tabs button').forEach(button => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
  document.getElementById('staffForm').addEventListener('submit', createStaff);
  document.getElementById('membershipForm').addEventListener('submit', submitMembershipRequest);
  document.getElementById('identityTrigger').addEventListener('click', event => { event.stopPropagation(); document.getElementById('accountPopover').classList.toggle('show'); });
  document.getElementById('accountPopover').addEventListener('click', handleAccountAction);
  document.addEventListener('click', event => { if (!event.target.closest('#accountPopover') && !event.target.closest('#identityTrigger')) document.getElementById('accountPopover').classList.remove('show'); });
  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModals()));
  document.querySelectorAll('.profile-modal-overlay').forEach(overlay => overlay.addEventListener('click', event => { if (event.target === overlay) closeModals(); }));
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('selectShipyardLogo').addEventListener('click', () => document.getElementById('shipyardLogoFile').click());
  document.getElementById('shipyardLogoFile').addEventListener('change', uploadShipyardLogo);
  document.getElementById('passwordForm').addEventListener('submit', changePassword);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModals(); });
}

async function api(url, options = {}) {
  const response = await fetch(url, options); const json = await response.json().catch(() => ({ message: '服务返回异常' }));
  if (response.status === 401) { location.href = 'login.html'; throw new Error('请先登录'); }
  if (!response.ok || json.success === false) throw new Error(json.message || '请求失败'); return json;
}
function jsonOptions(method, body) { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

async function loadDashboard() {
  try {
    dashboard = (await api('/api/shipyard/dashboard')).data; const account = dashboard.account;
    renderAccount(account); renderModels();
    if (account.role === 'shipyard_owner') await Promise.all([loadStaff(), loadMembership()]);
  } catch (error) { toast(error.message, true); }
}

function renderAccount(account) {
  const display = account.role === 'shipyard_owner' ? account.shipyardName : (account.displayName || '销售人员');
  const initial = String(display || '船').slice(0, 1);
  const avatarUrl = account.role === 'shipyard_owner' ? account.shipyardLogoUrl : (account.avatarUrl || account.shipyardLogoUrl);
  ['identityAvatar','popoverAvatar'].forEach(id => renderAvatar(document.getElementById(id), avatarUrl, initial));
  document.getElementById('identityName').textContent = display; document.getElementById('popoverName').textContent = display;
  document.getElementById('popoverRole').textContent = account.role === 'shipyard_owner' ? '厂家主账号' : '销售人员';
  document.getElementById('popoverCompany').textContent = account.role === 'sales' ? `所属厂家：${account.shipyardName}` : account.shipyardName;
  document.getElementById('shipyardName').textContent = account.shipyardName;
  document.getElementById('planName').textContent = account.membership || '—'; document.getElementById('popoverPlan').textContent = account.membership || '—';
  document.getElementById('boundCount').textContent = account.boundModelCount || 0; document.getElementById('popoverBound').textContent = account.boundModelCount || 0;
  document.getElementById('quotaCount').textContent = account.modelQuota || 0; document.getElementById('popoverQuota').textContent = account.modelQuota || 0;
  const expiry = account.membershipExpiresAt ? new Date(account.membershipExpiresAt).toLocaleDateString('zh-CN') : '长期有效';
  document.getElementById('membershipExpiry').textContent = account.membershipActive ? `会员有效期至 ${expiry}` : `会员已于 ${expiry} 到期`;
  document.getElementById('popoverExpiry').textContent = account.membershipActive ? `有效期至 ${expiry}` : `已于 ${expiry} 到期`;
  document.getElementById('membershipExpiry').classList.toggle('expired', !account.membershipActive);
  document.getElementById('quotaBar').style.width = `${Math.min(100, ((account.boundModelCount || 0) / Math.max(account.modelQuota || 1, 1)) * 100)}%`;
  document.getElementById('roleHint').textContent = account.role === 'shipyard_owner' ? '可浏览全部船型、提交模型绑定申请，并管理本厂销售人员。' : '可浏览全部船型；PICO仅显示本厂家已绑定并上架的模型。';
  const isOwner = account.role === 'shipyard_owner';
  document.getElementById('staffTab').hidden = !isOwner; document.getElementById('membershipTab').hidden = !isOwner;
  document.getElementById('accountStaffAction').hidden = !isOwner; document.getElementById('accountMembershipAction').hidden = !isOwner;
  fillProfile(account);
}

function renderAvatar(element, imageUrl, fallback) {
  if (!element) return;
  element.innerHTML = imageUrl ? `<img src="${escapeAttr(imageUrl)}" alt="">` : escapeHtml(fallback);
}

function renderModels() {
  if (!dashboard) return; const keyword = document.getElementById('modelSearch').value.trim().toLowerCase();
  const models = dashboard.models.filter(item => `${item.shipName} ${item.variantName} ${item.category}`.toLowerCase().includes(keyword));
  document.getElementById('shipyardModels').innerHTML = models.length ? models.map(modelCard).join('') : '<div class="shipyard-empty">没有符合条件的模型</div>';
}

function modelCard(item) {
  const account = dashboard.account; let action = '', badge = '';
  if (item.bound) badge = '<span class="model-bound-badge">已绑定</span>';
  if (account.role === 'shipyard_owner' && !item.bound) {
    const quotaFull = account.boundModelCount >= account.modelQuota && !item.shipBound;
    const disabled = !account.membershipActive || item.requestStatus === 'pending' || quotaFull;
    const label = !account.membershipActive ? '会员已到期' : item.requestStatus === 'pending' ? '申请审核中' : quotaFull ? '额度已满' : '申请绑定';
    action = `<button ${disabled ? 'disabled' : ''} onclick="requestBinding('${escapeAttr(item.variantId)}')">${label}</button>`;
  }
  return `<article class="ship-model"><img src="${escapeAttr(item.thumbnailUrl || '')}" alt=""><div class="ship-model-body"><div class="ship-model-title"><h3>${escapeHtml(item.shipName)}</h3>${badge}</div><p>${escapeHtml(item.description || '')}</p><div class="ship-model-meta"><span>${escapeHtml(item.variantName)}</span><span>${escapeHtml(item.category)}</span><span>${Number(item.length) || '—'}米</span></div><div class="ship-model-foot">${item.boatId ? `<a href="detail.html?id=${item.boatId}">查看船型</a>` : '<span></span>'}${action}</div></div></article>`;
}

async function requestBinding(variantId) { try { await api('/api/shipyard/binding-requests', jsonOptions('POST', { variantId })); toast('绑定申请已提交'); await loadDashboard(); } catch (error) { toast(error.message, true); } }

function switchPanel(name) { document.querySelectorAll('.shipyard-tabs button').forEach(button => button.classList.toggle('active', button.dataset.panel === name)); document.querySelectorAll('.shipyard-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${name}`)); document.getElementById('accountPopover').classList.remove('show'); }

async function loadStaff() {
  try { const rows = (await api('/api/shipyard/sales')).data || []; document.getElementById('staffList').innerHTML = rows.length ? `<table><thead><tr><th>姓名</th><th>登录账号</th><th>电话</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows.map(item => `<tr><td><input id="staffName-${item.id}" value="${escapeAttr(item.display_name || '')}"></td><td>${escapeHtml(item.username)}</td><td><input id="staffPhone-${item.id}" value="${escapeAttr(item.phone || '')}"></td><td><span class="staff-status ${item.status === 'active' ? 'active' : ''}">${item.status === 'active' ? '正常' : '停用'}</span></td><td>${new Date(item.created_at).toLocaleString('zh-CN')}</td><td><button onclick="saveStaff(${item.id})">保存</button><button onclick="toggleStaff(${item.id},'${item.status === 'active' ? 'disabled' : 'active'}')">${item.status === 'active' ? '停用' : '启用'}</button><button onclick="resetStaffPassword(${item.id})">重置密码</button><button class="danger" onclick="prepareDeleteStaff(${item.id},this)">删除</button></td></tr>`).join('')}</tbody></table>` : '<div class="shipyard-empty">暂无销售人员</div>'; } catch (error) { toast(error.message, true); }
}
async function createStaff(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target).entries()); try { await api('/api/shipyard/sales', jsonOptions('POST', body)); event.target.reset(); toast('销售人员已创建'); await loadStaff(); } catch (error) { toast(error.message, true); } }
async function saveStaff(id) { try { await api(`/api/shipyard/sales/${id}`, jsonOptions('PUT', { displayName: document.getElementById(`staffName-${id}`).value.trim(), phone: document.getElementById(`staffPhone-${id}`).value.trim() })); toast('销售资料已保存'); await loadStaff(); } catch (error) { toast(error.message, true); } }
async function toggleStaff(id, status) { try { await api(`/api/shipyard/sales/${id}`, jsonOptions('PUT', { status })); toast('销售状态已更新'); await loadStaff(); } catch (error) { toast(error.message, true); } }
function resetStaffPassword(id) { openPasswordPrompt(async password => { try { await api(`/api/shipyard/sales/${id}`, jsonOptions('PUT', { password })); toast('销售密码已重置'); } catch (error) { toast(error.message, true); } }); }
async function prepareDeleteStaff(id, button) { if (button.dataset.confirm !== 'yes') { button.dataset.confirm = 'yes'; button.textContent = '再次点击确认'; setTimeout(() => { button.dataset.confirm = ''; button.textContent = '删除'; }, 3500); return; } try { await api(`/api/shipyard/sales/${id}`, { method: 'DELETE' }); toast('销售人员已删除'); await loadStaff(); } catch (error) { toast(error.message, true); } }

function handleAccountAction(event) { const button = event.target.closest('[data-account-action]'); if (!button) return; const action = button.dataset.accountAction; if (action === 'profile') openModal('profileModal'); if (action === 'staff') switchPanel('staff'); if (action === 'membership') switchPanel('membership'); if (action === 'password') openModal('passwordModal'); if (action === 'logout') logout(); }
function openModal(id) { document.getElementById(id).classList.add('show'); document.body.classList.add('modal-open'); document.getElementById('accountPopover').classList.remove('show'); }
function closeModals() { document.querySelectorAll('.profile-modal-overlay').forEach(item => item.classList.remove('show')); document.body.classList.remove('modal-open'); }
function fillProfile(account) { const form = document.getElementById('profileForm'); form.elements.displayName.value = account.displayName || ''; form.elements.phone.value = account.phone || ''; form.elements.avatarUrl.value = account.avatarUrl || ''; const owner = account.role === 'shipyard_owner'; document.getElementById('ownerProfileFields').hidden = !owner; ['shipyardName','contactName','contactPhone','address','businessScope','description'].forEach(name => { form.elements[name].disabled = !owner; }); if (owner) { form.elements.shipyardName.value = account.shipyardName || ''; form.elements.contactName.value = account.shipyardContactName || ''; form.elements.contactPhone.value = account.shipyardContactPhone || ''; form.elements.address.value = account.shipyardAddress || ''; form.elements.businessScope.value = account.shipyardBusinessScope || ''; form.elements.description.value = account.shipyardDescription || ''; renderAvatar(document.getElementById('shipyardLogoPreview'), account.shipyardLogoUrl, String(account.shipyardName || '厂').slice(0, 1)); } }
async function uploadShipyardLogo() { const input = document.getElementById('shipyardLogoFile'); const file = input.files[0]; if (!file) return; const form = new FormData(); form.append('logo', file); try { const json = await api('/api/shipyard/logo', { method: 'POST', body: form }); dashboard.account.shipyardLogoUrl = json.data.logoUrl; renderAccount(dashboard.account); localStorage.setItem('auth_user', JSON.stringify(dashboard.account)); toast('厂家图标已上传'); } catch (error) { toast(error.message, true); } finally { input.value = ''; } }
async function saveProfile(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target).entries()); try { const json = await api('/api/account/profile', jsonOptions('PUT', body)); dashboard.account = json.data; renderAccount(json.data); closeModals(); toast('资料已保存'); } catch (error) { toast(error.message, true); } }
async function changePassword(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target).entries()); if (body.newPassword !== body.confirmPassword) return toast('两次输入的新密码不一致', true); try { await api('/api/account/password', jsonOptions('PUT', body)); localStorage.removeItem('auth_user'); toast('密码已修改，请重新登录'); setTimeout(() => location.href = 'login.html', 900); } catch (error) { toast(error.message, true); } }
function openPasswordPrompt(onSubmit) { const password = window.prompt('请输入新的销售密码（6-18位，至少两种字符组合）'); if (password) onSubmit(password); }

async function loadMembership() {
  try {
    const [planJson, historyJson] = await Promise.all([api('/api/membership/plans'), api('/api/shipyard/membership-requests')]);
    plans = planJson.data || []; renderPlans(); renderMembershipHistory(historyJson.data || []);
  } catch (error) {
    // 厂家账号不能访问管理员套餐接口时，使用系统固定等级；配额仍以后端审批结果为准。
    plans = [{code:'free',name:'普通会员',model_quota:5},{code:'silver',name:'白银会员',model_quota:10},{code:'gold',name:'黄金会员',model_quota:20},{code:'platinum',name:'铂金会员',model_quota:30},{code:'diamond',name:'钻石会员',model_quota:40}];
    renderPlans(); try { renderMembershipHistory((await api('/api/shipyard/membership-requests')).data || []); } catch (inner) { toast(inner.message, true); }
  }
}
function renderPlans() { document.getElementById('planCards').innerHTML = plans.map(plan => `<article class="${plan.code === dashboard.account.membershipCode ? 'current' : ''}"><span>${escapeHtml(plan.name)}</span><strong>${plan.model_quota}</strong><small>艘可绑定船型</small>${plan.code === dashboard.account.membershipCode ? '<b>当前等级</b>' : ''}</article>`).join(''); const currentIndex = plans.findIndex(plan => plan.code === dashboard.account.membershipCode); const targets = plans.filter((plan, index) => index > currentIndex); document.getElementById('targetPlanCode').innerHTML = targets.map(plan => `<option value="${escapeAttr(plan.code)}">${escapeHtml(plan.name)}（${plan.model_quota}艘船型）</option>`).join('') || '<option value="">已是最高等级</option>'; document.getElementById('upgradeContactName').value = dashboard.account.shipyardContactName || dashboard.account.displayName || ''; document.getElementById('upgradeContactPhone').value = dashboard.account.shipyardContactPhone || dashboard.account.phone || ''; }
function renderMembershipHistory(rows) {
  const el = document.getElementById('membershipHistory');
  el.innerHTML = rows.length
    ? `<h3>申请记录</h3>${rows.map(item => `<article><div><strong>${escapeHtml(item.current_plan_name)} → ${escapeHtml(item.target_plan_name)}</strong><small>${new Date(item.created_at).toLocaleString('zh-CN')}</small></div><span class="request-${item.status}">${item.status === 'pending' ? '审核中' : item.status === 'approved' ? '已通过' : '已拒绝'}</span><p>${escapeHtml(item.review_note || item.note || '')}</p></article>`).join('')}`
    : '<div class="shipyard-empty">暂无升级申请</div>';
}
async function submitMembershipRequest(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target).entries()); if (!body.targetPlanCode) return toast('当前已经是最高会员等级', true); try { await api('/api/shipyard/membership-requests', jsonOptions('POST', body)); toast('会员升级申请已提交'); await loadMembership(); } catch (error) { toast(error.message, true); } }

async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} localStorage.removeItem('auth_user'); location.href = 'login.html'; }
function toast(message, error = false) { const el = document.getElementById('shipyardToast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show'); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove('show'), 2800); }
function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value == null ? '' : String(value); return el.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
Object.assign(window, { requestBinding, saveStaff, toggleStaff, resetStaffPassword, prepareDeleteStaff });
