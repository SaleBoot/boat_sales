const API_BASE = '';
let allBoats = [];
let currentPage = 1;
const PAGE_SIZE = 4;
let currentBoats = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupNavigation();
  await loadCategoryTree();
  setupFilters();
  setupOverlay();
  updateLoginState();
  await loadBoats();
}

async function loadCategoryTree() {
  const tree = document.getElementById('filterTree');
  if (!tree) return;
  try {
    const response = await fetch(`${API_BASE}/api/boat-categories`);
    const json = await response.json();
    if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error(json.message || '分类加载失败');
    const chevron = '<span class="filter-node__chevron filter-node__chevron--open" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    const icon = '<span class="filter-node__icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 17h18M5 17l2-8h10l2 8M9 9V6h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    tree.innerHTML = `<div class="filter-group filter-group--all"><button class="filter-node filter-node--root active" data-level="all" data-kind="all"><span class="filter-node__chevron filter-node__chevron--hidden"></span><span class="filter-node__icon">${icon.replace('<span class="filter-node__icon">','').replace('</span>','')}</span><span class="filter-node__title">全部</span></button></div>${json.data.map(category => `<div class="filter-group"><button class="filter-node filter-node--group" data-kind="group" data-category="${escapeMarkup(category.id)}" aria-expanded="true">${chevron}${icon}<span class="filter-node__title">${escapeMarkup(category.name)}</span></button><div class="filter-children">${(category.children || []).map(child => `<button class="filter-node filter-node--leaf" data-kind="leaf" data-category="${escapeMarkup(category.id)}" data-subtype="${escapeMarkup(child.id)}"><span class="filter-node__bullet"></span><span class="filter-node__title">${escapeMarkup(child.name)}</span></button>`).join('')}</div></div>`).join('')}`;
  } catch (error) {
    console.warn('使用页面内置分类作为回退:', error);
  }
}

function escapeMarkup(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });

  document.querySelector('.nav-logo').addEventListener('click', () => {
    document.getElementById('catalogView').scrollIntoView({ behavior: 'smooth' });
  });
}

function setupFilters() {
  // 旧版 chip 已废弃,保留向后兼容:若页面还存在 .filter-chip,也绑定事件
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const type = chip.dataset.type;
      applyFilterLegacy(type);
    });
  });

  // ======== 新版 4 大类可折叠筛选树 ========
  const tree = document.getElementById('filterTree');
  if (!tree) return;

  // 1) 展开/收起:点击箭头区只展开;点击整行选中分组(= 筛选该大类)
  const groups = tree.querySelectorAll('.filter-group');
  groups.forEach(group => {
    const groupBtn = group.querySelector(':scope > .filter-node--group');
    if (!groupBtn) return;
    const chevron = groupBtn.querySelector(':scope > .filter-node__chevron');
    const icon = groupBtn.querySelector(':scope > .filter-node__icon');

    // 箭头点击 = 折叠/展开,不触发选中
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        group.classList.toggle('collapsed');
        groupBtn.setAttribute('aria-expanded', !group.classList.contains('collapsed'));
      });
    }
    // 图标点击 = 折叠/展开,不触发选中（更易点）
    if (icon) {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        group.classList.toggle('collapsed');
        groupBtn.setAttribute('aria-expanded', !group.classList.contains('collapsed'));
      });
    }
    // 组行点击 = 选中该大类(= 大类下全部子类)
    groupBtn.addEventListener('click', () => {
      setActiveNode(groupBtn);
      filterBoats({ category: groupBtn.dataset.category });
    });
  });

  // 2) 叶子节点 = 选具体子类型
  const leafNodes = tree.querySelectorAll('.filter-node--leaf');
  leafNodes.forEach(leaf => {
    leaf.addEventListener('click', () => {
      setActiveNode(leaf);
      filterBoats({
        category: leaf.dataset.category,
        subtype: leaf.dataset.subtype,
      });
    });
  });

  // 3) 根节点「全部」
  const rootAll = tree.querySelector('.filter-node--root');
  if (rootAll) {
    rootAll.addEventListener('click', () => {
      setActiveNode(rootAll);
      filterBoats({ all: true });
    });
  }

  function setActiveNode(target) {
    tree.querySelectorAll('.filter-node').forEach(n => n.classList.remove('active'));
    target.classList.add('active');
  }

  function applyFilterLegacy(type) {
    if (type === 'all') {
      const root = document.querySelector('.filter-node--root');
      if (root) setActiveNode(root);
      filterBoats({ all: true });
    } else {
      // 把旧 type 映射到对应的叶子或大类——找不到就兜底:按旧语义查 boat.type / category
      const leaf = tree.querySelector(`.filter-node--leaf[data-subtype="${type}"]`)
                 || tree.querySelector(`.filter-node--group[data-category="${type}"]`);
      if (leaf) {
        setActiveNode(leaf);
        if (leaf.dataset.subtype) filterBoats({ category: leaf.dataset.category, subtype: leaf.dataset.subtype });
        else filterBoats({ category: leaf.dataset.category });
      } else {
        filterBoats({ legacyType: type });
      }
    }
  }
}

/* ---------- 新版筛选(取代原先基于 data-type 的 filterBoats) ---------- */
function filterBoats(opts = {}) {
  let filtered = allBoats;

  if (opts.all) {
    filtered = allBoats;
  } else if (opts.subtype) {
    // 优先按叶子 subtype 精确查
    filtered = allBoats.filter(b => b.subtype === opts.subtype);
  } else if (opts.category) {
    // 按大类查(选中分组标题 = 该大类全部)
    filtered = allBoats.filter(b => b.category === opts.category);
  } else if (opts.legacyType) {
    // 旧 URL / 旧 UI 兜底
    const t = opts.legacyType;
    filtered = allBoats.filter(b =>
      b.type === t || b.subtype === t || b.category === t || (b.typeName && b.typeName.includes(t))
    );
  }

  renderBoats(filtered);
}

function setupOverlay() {
  const overlay = document.getElementById('detailOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDetail();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetail();
    }
  });
}

async function loadBoats() {
  try {
    const res = await fetch(`${API_BASE}/api/boats`);
    const json = await res.json();
    if (json.success) {
      allBoats = json.data;
      const countEl = document.getElementById('catalogCount');
      if (countEl) countEl.textContent = `共 ${allBoats.length} 艘 · ${allBoats.reduce((total, boat) => total + Math.max((boat.variants || []).length, 1), 0)} 个模型版本`;
      renderBoats(allBoats);
    }
  } catch (err) {
    showToast('加载数据失败，请检查服务是否启动', 'error');
    console.error(err);
  }
}

async function loadCustomizeOptions() {
  try {
    const res = await fetch(`${API_BASE}/api/customize/options`);
    const json = await res.json();
    if (json.success) {
      customizeOptions = json.data;
      renderCustomizeOptions();
    }
  } catch (err) {
    console.error('Failed to load customize options:', err);
  }
}

function renderBoats(boats) {
  currentBoats = boats || [];
  currentPage = 1;
  renderBoatPage();
}

function renderBoatPage() {
  const grid = document.getElementById('boatGrid');
  if (!currentBoats || currentBoats.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-secondary);padding:2rem;">暂无符合条件的船型</p>';
    const pagination = document.getElementById('boatPagination');
    if (pagination) pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(currentBoats.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageBoats = currentBoats.slice(start, start + PAGE_SIZE);

  grid.innerHTML = pageBoats.map((boat, i) => `
    <div class="boat-card" style="animation-delay:${i * 0.08}s;" onclick="openDetail(${boat.id})">
      <div class="boat-card-img-wrap">
        <img class="boat-card-img" src="${boat.sceneImage || boat.image}" alt="${boat.name}" loading="lazy">
      </div>
      <div class="boat-card-body">
        <div class="boat-card-type">${boat.typeName}</div>
        <h3 class="boat-card-name">${boat.name}</h3>
        <p class="boat-card-desc">${boat.description}</p>
        <div class="boat-card-specs">
          <div class="spec-item">
            <span class="spec-label">船长</span>
            <span class="spec-value">${boat.length}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">载客</span>
            <span class="spec-value">${boat.capacity}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">极速</span>
            <span class="spec-value">${boat.maxSpeed}</span>
          </div>
        </div>
        <div class="boat-card-footer">
          <span class="boat-card-price">${boat.price}</span>
        </div>
      </div>
    </div>
  `).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('boatPagination');
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';
  let html = '';

  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      上一页
    </button>`;
  } else {
    html += `<button class="page-btn disabled" disabled>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      上一页
    </button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-num ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">
      下一页
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  } else {
    html += `<button class="page-btn disabled" disabled>
      下一页
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  }

  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderBoatPage();
  const grid = document.getElementById('boatGrid');
  grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDetail(id) {
  window.location.href = `detail.html?id=${id}`;
}

function closeDetail() {
  window.location.href = 'index.html';
}

function scrollToCatalog() {
  document.querySelector('.nav-logo').click();
  setTimeout(() => {
    document.getElementById('catalogView').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function updateLoginState() {
  const loginBtn = document.querySelector('.nav-login-btn');
  const consoleBtn = document.getElementById('navConsoleBtn');
  const adminBtn = document.getElementById('navAdminBtn');
  if (!loginBtn) return;
  let session = getSession();
  if (session && session.username) {
    try {
      const response = await fetch('/api/auth/me');
      const json = await response.json();
      if (response.ok && json.success) { session = json.data; localStorage.setItem('auth_user', JSON.stringify(session)); }
    } catch {}
  }
  if (session && session.username) {
    const isAdmin = session.role === 'admin' || session.role === 'platform_admin';
    const isShipyard = session.role === 'shipyard_owner' || session.role === 'sales';
    loginBtn.textContent = isAdmin ? '平台管理员' : session.role === 'shipyard_owner' ? (session.shipyardName || '厂家控制台') : (session.displayName || '销售人员');
    loginBtn.onclick = () => { window.location.href = isAdmin ? 'members.html' : isShipyard ? 'shipyard.html' : 'login.html'; };
    if (consoleBtn) {
      consoleBtn.style.display = (isAdmin || isShipyard) ? 'inline-flex' : 'none';
      consoleBtn.onclick = () => { window.location.href = isAdmin ? 'members.html' : 'shipyard.html'; };
    }
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  } else {
    loginBtn.textContent = '登录';
    loginBtn.onclick = () => { window.location.href = 'login.html'; };
    if (consoleBtn) consoleBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
}
function clearSession() {
  localStorage.removeItem('auth_user');
}
