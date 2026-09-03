/* ===== 用户管理逻辑 ===== */

const API_BASE = '';
let currentPage = 1;
const PAGE_SIZE = 10;
let selectedIds = new Set();
let totalMembers = 0;
let vendorCache = [];

document.addEventListener('DOMContentLoaded', () => {
  // 权限守卫：仅管理员可访问
  const session = getSession();
  if (!session || !session.username) {
    window.location.href = 'login.html';
    return;
  }
  if (!['admin', 'platform_admin'].includes(session.role)) {
    showToast('仅管理员可访问用户管理', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
    return;
  }
  const userEl = document.getElementById('navUserName');
  const initial = (session.displayName || session.username || '?').charAt(0).toUpperCase();
  document.getElementById('navUserInitial').textContent = initial;
  userEl.title = session.username;
  document.getElementById('adminAccountAvatar').textContent = initial;
  document.getElementById('adminAccountName').textContent = session.displayName || session.username || '平台管理员';

  initFilters();
  initModal();
  initSidebarNav();
  initAdminAccountMenu();
  document.getElementById('addMainCategoryBtn')?.addEventListener('click', addMainCategory);
  loadMembers();
  loadMembershipRules();
});

/* ---------- 会话 ---------- */
function getSession() {
  try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
}

function initAdminAccountMenu() {
  const trigger = document.getElementById('navUserName');
  const popover = document.getElementById('adminAccountPopover');
  const close = () => { popover.classList.remove('show'); trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const show = !popover.classList.contains('show');
    popover.classList.toggle('show', show);
    trigger.setAttribute('aria-expanded', String(show));
  });
  popover.addEventListener('click', async event => {
    event.stopPropagation();
    const action = event.target.closest('[data-admin-account]')?.dataset.adminAccount;
    if (!action) return;
    if (action === 'logout') {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
      localStorage.removeItem('auth_user');
      window.location.href = 'login.html';
      return;
    }
    const navButton = document.querySelector(`.mem-side-item[data-nav="${action}"]`);
    if (navButton) navButton.click();
    close();
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-account-wrap')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}

/* ---------- 加载用户列表 ---------- */
async function loadMembers() {
  const tbody = document.getElementById('memberTableBody');
  tbody.innerHTML = '<tr><td colspan="11" class="mem-loading">加载中...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/api/admin/shipyards`);
    const json = await res.json();
    if (json.success) {
      vendorCache = json.data || [];
      const keyword = document.getElementById('filterKeyword').value.trim().toLowerCase();
      const plan = document.getElementById('filterRole').value;
      const scope = document.getElementById('scopeSelect').value;
      let list = vendorCache.filter(v => {
        const matchesKeyword = !keyword || [v.name,v.owner_username,v.contact_name,v.contact_phone].some(x => String(x || '').toLowerCase().includes(keyword));
        const matchesPlan = plan === 'all' || v.plan_code === plan;
        const expired = v.membership_expires_at && new Date(v.membership_expires_at).getTime() <= Date.now();
        const matchesScope = scope === 'all' || (scope === 'normal' && v.status === 'active' && !expired) ||
          (scope === 'disabled' && v.status !== 'active') || (scope === 'expired' && expired);
        return matchesKeyword && matchesPlan && matchesScope;
      });
      totalMembers = list.length;
      const start = (currentPage - 1) * PAGE_SIZE;
      renderTable(list.slice(start, start + PAGE_SIZE), list.length);
      renderPagination();
    } else {
      tbody.innerHTML = `<tr><td colspan="11" class="mem-empty">${json.message || '加载失败'}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="11" class="mem-empty">网络异常，请稍后重试</td></tr>';
  }
}

function scopeToStatus(scope) {
  if (scope === 'normal') return '正常';
  if (scope === 'disabled') return '禁用';
  return 'all';
}

/* ---------- 渲染表格 ---------- */
function renderTable(list, total) {
  const tbody = document.getElementById('memberTableBody');
  document.getElementById('memTotalLabel').textContent = `共 ${total} 条`;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="mem-empty">暂无符合条件的厂商</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const expired = m.membership_expires_at && new Date(m.membership_expires_at).getTime() <= Date.now();
    const active = m.status === 'active' && !expired;
    return `
    <tr data-id="${m.id}">
      <td class="mem-id">#${m.id}</td>
      <td class="mem-username">${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.owner_username) || '<span class="mem-id">待开通</span>'}</td>
      <td><span class="mem-role-tag user">${escapeHtml(m.plan_name)}</span></td>
      <td>${m.model_quota} 个</td>
      <td>${m.bound_count} 个</td>
      <td>${escapeHtml(m.contact_name)}<br><span class="mem-id">${escapeHtml(m.contact_phone)}</span></td>
      <td>${m.membership_expires_at ? formatDate(m.membership_expires_at) : '长期'}</td>
      <td class="mem-time">${formatTime(m.created_at)}</td>
      <td><span class="mem-status-tag ${active ? 'normal' : 'disabled'}">${active ? '正常' : (expired ? '已到期' : '停用')}</span></td>
      <td class="mem-ops">
        <button class="mem-op-link" onclick="openDetail(${m.id})">详情</button>
        <button class="mem-op-link" onclick="openEditModal(${m.id})">编辑</button>
      </td>
    </tr>
  `}).join('');

}

function formatDate(value) {
  if (!value) return '长期';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

function intentTag(level) {
  const map = { '高意向': 'high', '中意向': 'mid', '低意向': 'low', '无意向': 'none' };
  const cls = map[level] || 'none';
  return `<span class="mem-intent-tag ${cls}">${escapeHtml(level || '无意向')}</span>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- 分页 ---------- */
function renderPagination() {
  const wrap = document.getElementById('pagination');
  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }

  let html = '';
  html += `<button class="mem-page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">‹</button>`;

  const maxShow = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxShow - 1);
  if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);

  if (start > 1) {
    html += `<button class="mem-page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span class="mem-page-ellipsis">…</span>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="mem-page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="mem-page-ellipsis">…</span>`;
    html += `<button class="mem-page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  html += `<button class="mem-page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">›</button>`;
  wrap.innerHTML = html;
}

function goToPage(p) {
  currentPage = p;
  loadMembers();
}
window.goToPage = goToPage;

/* ---------- 筛选 ---------- */
function initFilters() {
  document.getElementById('searchBtn').addEventListener('click', () => { currentPage = 1; loadMembers(); });
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('filterKeyword').value = '';
    document.getElementById('filterRole').value = 'all';
    document.getElementById('filterIntention').value = 'all';
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterDate').value = '';
    document.getElementById('scopeSelect').value = 'all';
    currentPage = 1;
    loadMembers();
  });
  ['filterKeyword', 'filterRole', 'filterIntention', 'scopeSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { currentPage = 1; loadMembers(); });
  });
  document.getElementById('filterKeyword').addEventListener('keydown', e => {
    if (e.key === 'Enter') { currentPage = 1; loadMembers(); }
  });
}

/* ---------- 表格选择 ---------- */
function initTableEvents() {
  document.getElementById('checkAll').addEventListener('change', e => {
    const checks = document.querySelectorAll('.row-check');
    checks.forEach(c => {
      c.checked = e.target.checked;
      const id = c.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
    });
    syncRowSelected();
    updateBatchBar();
  });

  document.getElementById('memberTableBody').addEventListener('change', e => {
    if (!e.target.classList.contains('row-check')) return;
    const id = e.target.dataset.id;
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    syncRowSelected();
    updateBatchBar();
  });
}

function syncRowSelected() {
  document.querySelectorAll('#memberTableBody tr').forEach(tr => {
    const id = tr.dataset.id;
    tr.classList.toggle('selected', selectedIds.has(id));
  });
}

function updateBatchBar() {
  const count = selectedIds.size;
  document.getElementById('batchCount').textContent = `已选 ${count} 条`;
  ['batchDisableBtn', 'batchEnableBtn', 'batchDeleteBtn'].forEach(id => {
    document.getElementById(id).disabled = count === 0;
  });
}

/* ---------- 批量操作 ---------- */
function initBatch() {
  document.getElementById('batchDisableBtn').addEventListener('click', () => batchAction('disable', '确定要禁用选中的用户吗？'));
document.getElementById('batchEnableBtn').addEventListener('click', () => batchAction('enable', '确定要启用选中的用户吗？'));
document.getElementById('batchDeleteBtn').addEventListener('click', () => batchAction('delete', '确定要删除选中的用户吗？此操作不可恢复。'));
}

async function batchAction(action, confirmMsg) {
  if (selectedIds.size === 0) return;
  if (!confirm(confirmMsg)) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/members/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), action })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      selectedIds.clear();
      loadMembers();
    } else {
      showToast(json.message || '操作失败', 'error');
    }
  } catch (err) {
    showToast('网络异常，请稍后重试', 'error');
  }
}

/* ---------- 新增/编辑弹窗 ---------- */
let editMode = false;

function initModal() {
  document.getElementById('addMemberBtn').addEventListener('click', () => openAddModal());
  document.getElementById('modalClose').addEventListener('click', () => closeModal('memberModal'));
  document.getElementById('modalCancel').addEventListener('click', () => closeModal('memberModal'));
  document.getElementById('memberForm').addEventListener('submit', submitMember);
  document.getElementById('detailClose').addEventListener('click', () => closeModal('detailModal'));
  [document.getElementById('memberModal'), document.getElementById('detailModal')].forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('memberModal');
      closeModal('detailModal');
    }
  });
}

function openAddModal() {
  editMode = false;
  document.getElementById('modalTitle').textContent = '新增厂商会员';
  document.getElementById('memberForm').reset();
  document.getElementById('memberId').value = '';
  document.getElementById('pwdLabel').innerHTML = '主账号初始密码 <span class="req">*</span>';
  document.getElementById('memberPassword').placeholder = '6-18 位数字、字母、符号任意两种组合';
  document.getElementById('pwdHint').style.display = '';
  document.getElementById('memberUsername').readOnly = false;
  document.getElementById('memberOwnerUsername').readOnly = false;
  document.getElementById('memberOwnerUsername').disabled = false;
  document.getElementById('memberPassword').disabled = false;
  document.getElementById('memberOwnerStatus').value = 'active';
  document.getElementById('memberStatus').value = 'active';
  document.getElementById('modalError').textContent = '';
  openModal('memberModal');
}

function openEditModal(id) {
      const member = vendorCache.find(m => String(m.id) === String(id));
      if (!member) return showToast('未找到该厂商', 'error');
  editMode = true;
  document.getElementById('modalTitle').textContent = '编辑厂商会员';
      document.getElementById('memberId').value = member.id;
      document.getElementById('memberUsername').value = member.name;
      document.getElementById('memberUsername').readOnly = false;
      document.getElementById('memberOwnerUsername').value = member.owner_username || '';
      document.getElementById('memberOwnerUsername').readOnly = false;
      document.getElementById('memberOwnerUsername').disabled = false;
      document.getElementById('memberPassword').value = '';
      document.getElementById('memberPassword').placeholder = member.owner_username ? '留空则不修改；填写后由管理员重置' : '未开通账号时必须设置初始密码';
      document.getElementById('memberPassword').disabled = false;
      document.getElementById('pwdLabel').innerHTML = member.owner_username ? '重置主账号密码' : '主账号初始密码 <span class="req">*</span>';
      document.getElementById('pwdHint').style.display = '';
      document.getElementById('memberPhone').value = member.contact_phone || '';
      document.getElementById('memberIntentionBoat').value = member.plan_code || 'free';
      document.getElementById('memberIntentionLevel').value = member.membership_expires_at ? formatDate(member.membership_expires_at) : '';
      document.getElementById('memberStatus').value = member.status || 'active';
      document.getElementById('memberConsultant').value = member.contact_name || '';
      document.getElementById('memberSource').value = member.address || '';
      document.getElementById('memberOwnerStatus').value = member.owner_status || 'active';
      document.getElementById('modalError').textContent = '';
      openModal('memberModal');
}
window.openEditModal = openEditModal;

function openModal(id) {
  const ov = document.getElementById(id);
  if (!ov) return;
  if (ov.hideTimer) clearTimeout(ov.hideTimer);
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('show'));
}
function closeModal(id = 'memberModal') {
  const ov = document.getElementById(id);
  if (!ov) return;
  ov.classList.remove('show');
  if (ov.hideTimer) clearTimeout(ov.hideTimer);
  ov.hideTimer = setTimeout(() => { ov.style.display = 'none'; }, 250);
}

async function submitMember(e) {
  e.preventDefault();
  const errEl = document.getElementById('modalError');
  errEl.textContent = '';

  const vendorName = document.getElementById('memberUsername').value.trim();
  const ownerUsername = document.getElementById('memberOwnerUsername').value.trim();
  const password = document.getElementById('memberPassword').value;
  const body = {
    name: vendorName,
    ownerUsername,
    ownerPassword: password,
    contactPhone: document.getElementById('memberPhone').value.trim(),
    planCode: document.getElementById('memberIntentionBoat').value,
    membershipExpiresAt: document.getElementById('memberIntentionLevel').value || null,
    status: document.getElementById('memberStatus').value,
    contactName: document.getElementById('memberConsultant').value.trim(),
    address: document.getElementById('memberSource').value.trim(),
    ownerStatus: document.getElementById('memberOwnerStatus').value
  };

  if (editMode) {
    const id = document.getElementById('memberId').value;
    const original = vendorCache.find(m => String(m.id) === String(id));
    if (!ownerUsername) return errEl.textContent = '请填写厂商主账号';
    if (original && !original.owner_username && !password) return errEl.textContent = '开通主账号时必须设置初始密码';
    setBtnLoading('modalSubmit', true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shipyards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        showToast('厂商会员资料已更新', 'success');
        closeModal();
        loadMembers();
      } else {
        errEl.textContent = json.message || '更新失败';
      }
    } catch { errEl.textContent = '网络异常，请稍后重试'; }
    finally { setBtnLoading('modalSubmit', false); }
  } else {
    if (!vendorName) return errEl.textContent = '请填写厂商名称';
    if (!ownerUsername) return errEl.textContent = '请填写厂商主账号';
    if (!password) return errEl.textContent = '请设置主账号初始密码';
    setBtnLoading('modalSubmit', true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        showToast('厂商会员及主账号已创建', 'success');
        closeModal();
        loadMembers();
      } else {
        errEl.textContent = json.message || '添加失败';
      }
    } catch { errEl.textContent = '网络异常，请稍后重试'; }
    finally { setBtnLoading('modalSubmit', false); }
  }
}

/* ---------- 删除 ---------- */
async function deleteMember(id) {
  if (!confirm('确定要删除该用户吗？此操作不可恢复。')) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/members/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('用户已删除', 'success');
      selectedIds.delete(String(id));
      loadMembers();
    } else {
      showToast(json.message || '删除失败', 'error');
    }
  } catch { showToast('网络异常', 'error'); }
}
window.deleteMember = deleteMember;

/* ---------- 详情 ---------- */
async function openDetail(id) {
  try {
    const m = vendorCache.find(x => String(x.id) === String(id));
    if (!m) return showToast('未找到该厂商', 'error');
    document.getElementById('detailBody').innerHTML = `
      <div class="mem-detail-row"><span class="mem-detail-label">厂商ID</span><span class="mem-detail-value">#${m.id}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">厂商名称</span><span class="mem-detail-value">${escapeHtml(m.name)}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">主账号</span><span class="mem-detail-value">${escapeHtml(m.owner_username) || '待开通'}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">会员等级</span><span class="mem-detail-value">${escapeHtml(m.plan_name)}（${m.model_quota}个模型）</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">已绑定船型</span><span class="mem-detail-value">${m.bound_count} 艘</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">联系人</span><span class="mem-detail-value">${escapeHtml(m.contact_name) || '—'}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">联系电话</span><span class="mem-detail-value">${escapeHtml(m.contact_phone) || '—'}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">会员到期</span><span class="mem-detail-value">${formatDate(m.membership_expires_at)}</span></div>
      <div class="mem-detail-row"><span class="mem-detail-label">创建时间</span><span class="mem-detail-value">${formatTime(m.created_at)}</span></div>
    `;
    openModal('detailModal');
  } catch { showToast('网络异常', 'error'); }
}
window.openDetail = openDetail;

/* ---------- 侧栏导航：面板切换（侧栏始终保留） ---------- */
function initSidebarNav() {
  document.querySelectorAll('.mem-side-item[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;

      switchPanel(nav, btn);
    });
  });
}

function switchPanel(nav, btn) {
  // 切换侧栏高亮
  document.querySelectorAll('.mem-side-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // 切换面板显隐
  document.querySelectorAll('.mem-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + nav);
  if (panel) panel.classList.add('active');

  // 面板切换后的回调
  if (nav === 'members') {
    currentPage = 1;
    loadMembers();
  } else if (nav === 'dashboard') {
    loadDashboard();
  } else if (nav === 'admin' || nav === 'platform') {
    const frame = panel.querySelector('.mem-admin-frame');
    if (frame && frame.dataset.src) {
      frame.src = frame.dataset.src;
      frame.dataset.src = '';
    }
  } else if (nav === 'drawings') {
    loadDrawings();
  } else if (nav === 'public-pool') {
    loadMembershipRules();
  } else if (nav === 'categories') {
    loadFieldManagement();
  }
}

async function loadMembershipRules() {
  const container = document.getElementById('membershipRuleGrid');
  if (!container) return;
  try {
    const response = await fetch(`${API_BASE}/api/membership/plans`);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || '加载失败');
    container.innerHTML = (json.data || []).map(plan => `<article><strong>${escapeHtml(plan.name)}</strong><b>${Number(plan.model_quota) || 0}</b><span>艘可绑定船型</span></article>`).join('');
  } catch {
    container.innerHTML = '<article><span>会员规则加载失败，请刷新重试</span></article>';
  }
}

/* ---------- 工作台数据 ---------- */
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/shipyards`);
    const json = await res.json();
    if (json.success) {
      document.getElementById('dashTotalMembers').textContent = json.data.length;
      const active = json.data.filter(x => x.status === 'active' && (!x.membership_expires_at || new Date(x.membership_expires_at).getTime() > Date.now())).length;
      document.getElementById('dashActiveMembers').textContent = active;
    }
  } catch {}
  try {
    const res = await fetch(`${API_BASE}/api/boats`);
    const json = await res.json();
    document.getElementById('dashBoats').textContent = json.count || (json.data && json.data.length) || 6;
  } catch {
    document.getElementById('dashBoats').textContent = '6';
  }
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders`);
    const json = await res.json();
    const orders = json.data || json.orders || [];
    document.getElementById('dashOrders').textContent = orders.length;
  } catch {
    document.getElementById('dashOrders').textContent = '0';
  }
}

/* ---------- 工具 ---------- */
function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (loading) { btn.dataset.text = btn.textContent; btn.textContent = '处理中...'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.text || btn.textContent; btn.disabled = false; }
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'memToastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------- 定制图纸管理 ---------- */
let drawingData = [];
let visibleDrawingData = [];
let selectedDrawingIds = new Set();

async function loadDrawings() {
  const tbody = document.getElementById('drawingTbody');
  tbody.innerHTML = '<tr><td colspan="9" class="mfr-empty">加载中…</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/api/admin/submissions`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || '加载失败');
    drawingData = (json.data || []).map(row => ({
      orderId: String(row.id || ''),
      contactName: String(row.contact_name || ''),
      contactPhone: String(row.contact_phone || ''),
      remark: String(row.remark || ''),
      files: Array.isArray(row.files) ? row.files : [],
      status: row.status,
      createdAt: row.created_at
    }));
    renderDrawings(drawingData);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="9" class="mfr-empty">加载失败，请检查服务</td></tr>';
    const countEl = document.getElementById('drawingCount');
    if (countEl) countEl.textContent = '';
    showToast(e.message || '图纸数据加载失败', 'error');
  }
}

function renderDrawings(list) {
  visibleDrawingData = list;
  const tbody = document.getElementById('drawingTbody');
  const countEl = document.getElementById('drawingCount');
  countEl.textContent = `共 ${list.length} 条图纸`;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="mfr-empty">暂无图纸数据</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((d, i) => {
    const files = (d.files || []).map(f => {
      const savedAs = String(f.savedAs || '');
      const originalName = String(f.originalName || savedAs || '未命名文件');
      const url = `/uploads/${encodeURIComponent(savedAs)}`;
      return `<span class="drawing-file-item">
        <button type="button" class="drawing-file-link" data-order-id="${escapeHtml(d.orderId)}" data-saved-as="${escapeHtml(savedAs)}" data-original-name="${escapeHtml(originalName)}" title="点击预览">${escapeHtml(originalName)}</button>
        <a href="${url}" download="${escapeHtml(originalName)}" class="drawing-download-link" title="下载此文件">⬇</a>
      </span>`;
    }).join('');
    const time = (d.createdAt || '').replace('T', ' ').slice(0, 16);
    const checked = selectedDrawingIds.has(d.orderId) ? 'checked' : '';
    return `<tr data-order-id="${escapeHtml(d.orderId)}">
      <td><input type="checkbox" class="drawing-row-check" data-order-id="${escapeHtml(d.orderId)}" ${checked} aria-label="选择订单 ${escapeHtml(d.orderId)}"></td>
      <td>${i + 1}</td>
      <td style="font-family:monospace;font-size:0.75rem;">${escapeHtml(d.orderId)}</td>
      <td>${escapeHtml(d.contactName) || '—'}</td>
      <td>${escapeHtml(d.contactPhone) || '—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(d.remark)}">${escapeHtml(d.remark) || '—'}</td>
      <td>${(d.files || []).length}</td>
      <td>${files || '—'}</td>
      <td style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHtml(time)}</td>
    </tr>`;
  }).join('');
  const checkAll = document.getElementById('drawingCheckAll');
  if (checkAll) {
    checkAll.checked = list.length > 0 && list.every(item => selectedDrawingIds.has(item.orderId));
    checkAll.indeterminate = !checkAll.checked && list.some(item => selectedDrawingIds.has(item.orderId));
  }
}

function resetDrawingSearch() {
  const input = document.getElementById('drawingSearch');
  if (input) input.value = '';
  renderDrawings(drawingData);
}

// 图纸搜索
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('drawingSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { renderDrawings(drawingData); return; }
      const filtered = drawingData.filter(d =>
        (d.contactName || '').toLowerCase().includes(q) ||
        (d.contactPhone || '').toLowerCase().includes(q) ||
        (d.orderId || '').toLowerCase().includes(q)
      );
      renderDrawings(filtered);
    });
  }
});

/* ---------- 图纸在线预览 ---------- */
function previewDrawingFile(orderId, savedAs, originalName) {
  const overlay = document.getElementById('drawingPreviewOverlay');
  const modal = document.getElementById('drawingPreviewModal');
  const title = document.getElementById('drawingPreviewTitle');
  const body = document.getElementById('drawingPreviewBody');

  title.textContent = originalName || '图纸预览';
  const url = `/uploads/${encodeURIComponent(savedAs)}`;
  const ext = (originalName || savedAs).split('.').pop().toLowerCase();
  const safeOriginalName = escapeHtml(originalName || '图纸文件');

  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
    body.innerHTML = `
      <div style="text-align:center;padding:16px;">
        <img src="${url}" alt="${safeOriginalName}" style="max-width:100%;max-height:70vh;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
      </div>`;
  } else if (ext === 'pdf') {
    body.innerHTML = `
      <iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:8px;"></iframe>`;
  } else {
    body.innerHTML = `
      <div style="text-align:center;padding:48px 24px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);margin-bottom:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">该格式（.${escapeHtml(ext)}）暂不支持在线预览</p>
        <a href="${url}" download="${safeOriginalName}" style="display:inline-block;padding:8px 24px;background:var(--accent);color:#fff;border-radius:8px;text-decoration:none;font-size:0.8125rem;">下载文件</a>
      </div>`;
  }

  overlay.classList.add('show');
  modal.classList.add('show');
}
window.previewDrawingFile = previewDrawingFile;

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('drawingPreviewOverlay');
  const closeBtn = document.getElementById('drawingPreviewClose');
  const closeModal = () => {
    overlay.classList.remove('show');
    document.getElementById('drawingPreviewModal').classList.remove('show');
    document.getElementById('drawingPreviewBody').innerHTML = '';
  };
  if (overlay) overlay.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('show')) closeModal();
  });
});

/* ---------- 图纸导出Excel ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const checkAll = document.getElementById('drawingCheckAll');
  if (checkAll) {
    checkAll.addEventListener('change', e => {
      const checks = document.querySelectorAll('.drawing-row-check');
      checks.forEach(c => {
        c.checked = e.target.checked;
        const oid = c.dataset.orderId;
        if (e.target.checked) selectedDrawingIds.add(oid);
        else selectedDrawingIds.delete(oid);
      });
    });
  }

  const tbody = document.getElementById('drawingTbody');
  if (tbody) {
    tbody.addEventListener('click', e => {
      const previewButton = e.target.closest('.drawing-file-link');
      if (!previewButton) return;
      previewDrawingFile(
        previewButton.dataset.orderId || '',
        previewButton.dataset.savedAs || '',
        previewButton.dataset.originalName || ''
      );
    });
    tbody.addEventListener('change', e => {
      if (!e.target.classList.contains('drawing-row-check')) return;
      const oid = e.target.dataset.orderId;
      if (e.target.checked) selectedDrawingIds.add(oid);
      else selectedDrawingIds.delete(oid);
      const checkAll = document.getElementById('drawingCheckAll');
      const visibleChecks = tbody.querySelectorAll('.drawing-row-check');
      checkAll.checked = visibleChecks.length > 0 && Array.from(visibleChecks).every(c => c.checked);
    });
  }

  const exportBtn = document.getElementById('drawingExportExcel');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const orderIds = selectedDrawingIds.size > 0
        ? Array.from(selectedDrawingIds)
        : visibleDrawingData.map(item => item.orderId);
      const count = orderIds.length;
      if (count === 0) {
        showToast('暂无可导出的图纸数据', 'error');
        return;
      }

      exportBtn.textContent = '导出中…';
      exportBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/admin/drawings/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || '导出失败');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `定制图纸_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`已导出 ${count} 条图纸数据`, 'success');
      } catch (e) {
        showToast(e.message || '导出失败，请重试', 'error');
      }
      exportBtn.textContent = '导出当前结果 Excel';
      exportBtn.disabled = false;
    });
  }
});

/* ---------- 字段管理 ---------- */
let categoryData = [];

async function loadFieldManagement() {
  const wrap = document.getElementById('fieldManageWrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="mfr-empty" style="padding:24px;">加载中…</p>';
  try {
    const res = await fetch('/api/boat-categories');
    const json = await res.json();
    if (json.success) {
      categoryData = json.data;
      renderFieldTree();
    }
  } catch (e) {
    wrap.innerHTML = '<p class="mfr-empty" style="padding:24px;">加载失败</p>';
  }
}

function renderFieldTree() {
  const wrap = document.getElementById('fieldManageWrap');
  let html = categoryData.map((cat, i) => {
    const subHtml = cat.children.map((sub, j) => `
      <div class="field-sub-row">
        <span class="field-sub-bullet"></span>
        <span class="field-sub-name">${escapeHtml(sub.name)}</span>
        <button class="field-mini-btn" onclick="moveSubCategory('${cat.id}',${j},-1)" ${j === 0 ? 'disabled' : ''}>↑</button>
        <button class="field-mini-btn" onclick="moveSubCategory('${cat.id}',${j},1)" ${j === cat.children.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="field-mini-btn field-edit-btn" onclick="editSubCategory('${cat.id}','${sub.id}','${sub.name.replace(/'/g, "\\'")}')">改名</button>
        <button class="field-mini-btn field-del-btn" onclick="deleteSubCategory('${cat.id}','${sub.id}','${sub.name.replace(/'/g, "\\'")}')">删除</button>
      </div>
    `).join('');

    return `
      <div class="field-cat-card">
        <div class="field-cat-head">
          <span class="field-cat-name">${escapeHtml(cat.name)}</span>
          <span class="field-cat-count">${cat.children.length} 个小类</span>
          <button class="field-mini-btn" onclick="moveMainCategory(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="field-mini-btn" onclick="moveMainCategory(${i},1)" ${i === categoryData.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="field-mini-btn field-add-btn" onclick="addSubCategory('${cat.id}')">+ 小类</button>
          <button class="field-mini-btn field-edit-btn" onclick="editMainCategory('${cat.id}','${cat.name.replace(/'/g, "\\'")}')">改名</button>
          <button class="field-mini-btn field-del-btn" onclick="deleteMainCategory('${cat.id}','${cat.name.replace(/'/g, "\\'")}')">删除</button>
        </div>
        <div class="field-sub-list">${subHtml || '<div class="field-sub-empty">暂无小类</div>'}</div>
      </div>
    `;
  }).join('');

  wrap.innerHTML = html || '<p class="mfr-empty" style="padding:24px;">暂无数据</p>';
}

function addMainCategory() {
  const name = prompt('请输入大类名称：');
  if (!name || !name.trim()) return;
  fetch('/api/admin/boat-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  }).then(r => r.json()).then(json => {
    if (json.success) { showToast('大类已添加', 'success'); loadFieldManagement(); }
    else showToast(json.message || '添加失败', 'error');
  });
}

function editMainCategory(id, oldName) {
  const name = prompt('请输入新名称：', oldName);
  if (!name || !name.trim() || name.trim() === oldName) return;
  fetch(`/api/admin/boat-categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  }).then(r => r.json()).then(json => {
    if (json.success) { showToast('大类已改名', 'success'); loadFieldManagement(); }
    else showToast(json.message || '修改失败', 'error');
  });
}

function deleteMainCategory(id, name) {
  if (!confirm(`确定删除大类「${name}」及其所有小类吗？`)) return;
  fetch(`/api/admin/boat-categories/${id}`, { method: 'DELETE' })
    .then(r => r.json()).then(json => { if (json.success) { showToast('大类已删除', 'success'); loadFieldManagement(); } else showToast(json.message || '删除失败', 'error'); });
}

function addSubCategory(catId) {
  const name = prompt('请输入小类名称：');
  if (!name || !name.trim()) return;
  fetch(`/api/admin/boat-categories/${catId}/sub`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  }).then(r => r.json()).then(json => {
    if (json.success) { showToast('小类已添加', 'success'); loadFieldManagement(); }
    else showToast(json.message || '添加失败', 'error');
  });
}

function editSubCategory(catId, subId, oldName) {
  const name = prompt('请输入新名称：', oldName);
  if (!name || !name.trim() || name.trim() === oldName) return;
  fetch(`/api/admin/boat-categories/${catId}/sub/${subId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  }).then(r => r.json()).then(json => {
    if (json.success) { showToast('小类已改名', 'success'); loadFieldManagement(); }
    else showToast(json.message || '修改失败', 'error');
  });
}

function deleteSubCategory(catId, subId, name) {
  if (!confirm(`确定删除小类「${name}」吗？`)) return;
  fetch(`/api/admin/boat-categories/${catId}/sub/${subId}`, { method: 'DELETE' })
    .then(r => r.json()).then(json => { if (json.success) { showToast('小类已删除', 'success'); loadFieldManagement(); } else showToast(json.message || '删除失败', 'error'); });
}

async function saveCategoryOrder(payload) {
  try {
    const response = await fetch('/api/admin/boat-categories/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || '排序保存失败');
    categoryData = json.data; renderFieldTree(); showToast('分类顺序已保存', 'success');
  } catch (error) { showToast(error.message || '排序保存失败', 'error'); }
}

function moveMainCategory(index, offset) {
  const target = index + offset; if (target < 0 || target >= categoryData.length) return;
  [categoryData[index], categoryData[target]] = [categoryData[target], categoryData[index]];
  saveCategoryOrder({ categoryIds: categoryData.map(item => item.id) });
}

function moveSubCategory(categoryId, index, offset) {
  const category = categoryData.find(item => item.id === categoryId); if (!category) return;
  const target = index + offset; if (target < 0 || target >= category.children.length) return;
  [category.children[index], category.children[target]] = [category.children[target], category.children[index]];
  saveCategoryOrder({ categoryId, subcategoryIds: category.children.map(item => item.id) });
}

Object.assign(window, { moveMainCategory, moveSubCategory });
