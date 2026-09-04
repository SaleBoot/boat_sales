import Scene from './Scene.js?v=1.2.15';

let boatData = null;
let scene3d = null;
let currentTabId = '';
let currentVariantId = '';
let isAdminMode = false;
const selections = {};
const DIGITAL_TWIN_SHIPS = new Set(['js1300x']);

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
    updateDigitalTwinEntry();
  } catch (error) { showPageError(error.message || '加载失败，请检查服务'); }
}

function tabs() {
  let list = Array.isArray(boatData.configTabs) ? boatData.configTabs.slice() : [];
  const isUnmanned = /无人/.test(`${boatData.name || ''} ${boatData.typeName || ''}`);
  const profileType = `${boatData.typeName || ''} ${boatData.name || ''}`;
  const isElectric = /电动|新能源|纯电/i.test(profileType);
  const isPatrol = /执法|巡逻|公务/i.test(profileType);
  const isPassenger = /游览|观光|客舱|客船/i.test(profileType);

  // ====== 客户端兜底：对历史船型（已保存的老数据）自动注入丰富后的板块细节 ======
  // 1) 内饰板块（普通船型）
  if (!isUnmanned) {
    const interiorTab = list.find(t => t.id === 'interior' || /内饰/.test(t.label || ''));
    if (interiorTab) {
      // 如果内饰还是旧的"3个基础方案"（数量<6），则注入严谨配置大类（保留已有基础方案）
      const existingIds = new Set((interiorTab.options || []).map(o => String(o.id || '')));
      const layoutOptions = [
        { id: 'layout-std', name: '客舱布局 · 标准（标配）', description: '3 间客舱 + 1 间船员舱（主人套房+VIP+双床），可容纳 6-8 位客人', priceDelta: 0, sortOrder: 1 },
        { id: 'layout-4cabin', name: '客舱布局 · 四舱尊享（选配）', description: '4 间独立客舱（主人+VIP+两间双床）+ 1 间船员舱，共容纳 10 人（参考 Pardo E72）', priceDelta: 0, sortOrder: 2 },
        { id: 'layout-5cabin', name: '客舱布局 · 全宽五舱（长艇专用）', description: '5 间客舱（全船宽主人套房+独立VIP+3间双床），均配独立卫浴（参考 Benetti Oasis 34m）', priceDelta: 0, sortOrder: 3 },
        { id: 'layout-superyacht', name: '客舱布局 · 超级游艇主人甲板', description: '主人套房迁移主甲板，配私人露台和户外淋浴；下层另设 4 间客舱（参考丽娃 Riva 96 Argo Super）', priceDelta: 0, sortOrder: 4 }
      ];
      const woodVeneers = [
        { id: 'wood-rovere', name: '木饰面 · Rovere 缎面橡木（标配）', description: '意大利暖色调橡木缎面哑光清漆，标配家具地板饰面（参考 Princess F65 官方）', priceDelta: 0, sortOrder: 10 },
        { id: 'wood-ash', name: '木饰面 · Ash 缎面白蜡木（选配）', description: '浅色顺纹白蜡木，通透清爽，适合现代北欧风格舱室', priceDelta: 0, sortOrder: 11 },
        { id: 'wood-silver', name: '木饰面 · Silver Oak 银橡（选配）', description: '浅银灰水洗橡木，淡化木纹对比，与米白皮革完美搭', priceDelta: 0, sortOrder: 12 },
        { id: 'wood-walnut-matte', name: '木饰面 · Walnut 哑光胡桃木（选配）', description: '深褐条纹胡桃木，搭配铜金金属嵌条与真皮沙发（参考 Pardo E72）', priceDelta: 0, sortOrder: 13 },
        { id: 'wood-walnut-gloss', name: '木饰面 · Walnut 高光胡桃木（豪华）', description: '钢琴漆高光胡桃木 + 镜面不锈钢镶嵌（参考丽娃 Riva 96\' Argo Super 官方）', priceDelta: 0, sortOrder: 14 }
      ];
      const softLeathers = [
        { id: 'soft-std', name: '软装 · 标准布艺（标配）', description: '防污阻燃航海级布艺（米白/沙色/深蓝 三色可选），含全车窗帘与床品', priceDelta: 0, sortOrder: 20 },
        { id: 'soft-leather', name: '软装 · 半皮升级（选配）', description: '头枕/扶手/沙发接触面采用意大利真皮（头层牛皮、抗 UV 涂层），其余保持航海级布艺', priceDelta: 0, sortOrder: 21 },
        { id: 'soft-nappa', name: '软装 · Masterpiece 全 Nappa 真皮（豪华）', description: '全舱家具接触面替换 Masterpiece 级 Nappa 皮革，含专属三角绗缝工艺（参考 Brabus × Sunreef 官方）', priceDelta: 0, sortOrder: 22 }
      ];
      const galleyBath = [
        { id: 'galley-std', name: '厨卫 · 标准配置（标配）', description: '标准冰箱 + 电磁炉 2 灶头 + 电热水器 40L；每间卫浴配备淋浴、独立台盆', priceDelta: 0, sortOrder: 30 },
        { id: 'galley-up', name: '厨卫 · 高端升级（选配）', description: 'Sub-Zero 抽屉冰箱 + Miele 电磁灶/烤箱/洗碗机 + Krion 人造石台面 + Grohe 恒温花洒套件', priceDelta: 0, sortOrder: 31 },
        { id: 'galley-wine', name: '厨卫 · 酒柜冰吧豪华版', description: '主沙龙加配 48 瓶嵌入式恒温酒柜、船尾独立户外冰箱、吧台区制冰机', priceDelta: 0, sortOrder: 32 }
      ];
      const entertainment = [
        { id: 'av-std', name: '娱乐 · 标准影音（标配）', description: '主沙龙 55" 4K 电视 + 5.1 声道音响系统、客厅区域支持蓝牙/HDMI', priceDelta: 0, sortOrder: 40 },
        { id: 'av-bw', name: '娱乐 · Bowers & Wilkins Marine 高端音响', description: '全舱 B&W Marine 系列防水高保真音响（12 声道+低音炮），支持 Dolby Atmos（参考 Brabus 官方）', priceDelta: 0, sortOrder: 41 },
        { id: 'av-ktv', name: '娱乐 · 独立家庭影院/KTV 房', description: '下层甲板独立空间改家庭影院 + KTV 双模式：120"幕、专业卡包箱、点歌系统、氛围灯', priceDelta: 0, sortOrder: 42 },
        { id: 'av-spa', name: '娱乐 · 阳光甲板 SPA/按摩浴缸', description: '飞桥或阳光甲板加装冲浪按摩浴缸 + 蒸汽淋浴桑拿组合舱（参考 Benetti Oasis 系列）', priceDelta: 0, sortOrder: 43 }
      ];
      const toAdd = [];
      [].concat(layoutOptions, woodVeneers, softLeathers, galleyBath, entertainment).forEach(o => { if (!existingIds.has(String(o.id))) toAdd.push(o); });
      if (toAdd.length) interiorTab.options = [].concat(interiorTab.options || [], toAdd).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      interiorTab.description = '客舱布局 × 木饰面 × 软装皮革 × 厨卫升级 × 娱乐设施（参考 Princess / Pardo / Ferretti 官方选配）';
    }
  }

  // 2) 动力板块（全部船型：按类型匹配严谨方案）
  const powerTab = list.find(t => t.id === 'power' || /动力/.test(t.label || ''));
  if (powerTab) {
    const currentIds = new Set((powerTab.options || []).map(o => String(o.id || '')));
    // 判定：只有老选项（例如含 power-standard/power-enhanced/power-custom 这三个id之一）才替换为严谨方案
    const hasOldOptions = ['power-standard', 'power-enhanced', 'power-custom'].some(id => currentIds.has(id));
    if (hasOldOptions) {
      let powerOptions = [];
      if (isElectric) {
        powerOptions = [
          { id: 'pow-elec-std', name: '纯电推进 · 标准续航（标配）', description: '磷酸铁锂 CATL 电池组（总容量 200kWh）+ 双吊舱电机，6 节续航 8 小时，CCS2 直流快充 2h', priceDelta: 0, sortOrder: 0 },
          { id: 'pow-elec-plus', name: '纯电推进 · 长续航（选配）', description: '磷酸铁锂电池扩容至 400kWh + 双 100kW 电机 + 船载 DC 充电口，8 节 12 小时；兼容岸电与光伏充电', priceDelta: 0, sortOrder: 1 },
          { id: 'pow-elec-range-ext', name: '纯电 · 增程版（柴油发电机）', description: '在纯电基础上加装 80kW 静音柴油增程器（欧 V 排放），远洋作业续航可达 300 海里', priceDelta: 0, sortOrder: 2 },
          { id: 'pow-elec-solar', name: '纯电 · 光伏补能版', description: '顶篷铺设 2.5kW 柔性单晶光伏 + MPPT 控制器，日间平均补能 8-12kWh，零碳巡航 +15%', priceDelta: 0, sortOrder: 3 }
        ];
      } else if (isPatrol) {
        powerOptions = [
          { id: 'pow-diesel-std', name: '双机双桨 · 标准柴油（标配）', description: '两台国产高速柴油机（WD10 系列），总功率 2×280kW，艉机传动，最高航速 28 节', priceDelta: 0, sortOrder: 0 },
          { id: 'pow-man-v8', name: 'MAN V8 高功率执法版', description: '两台 MAN V8-1200 船用柴油发动机（2×882kW/1200HP）+ ZF 船用齿轮箱，极速 42 节', priceDelta: 0, sortOrder: 1 },
          { id: 'pow-waterjet', name: '喷水推进 · 执法高速版', description: '双 MJP 喷水推进器 + MAN 12V 发动机组合，浅水域可过，零到 30 节加速时间 < 40s', priceDelta: 0, sortOrder: 2 },
          { id: 'pow-hybrid', name: '柴电混动 · 巡逻静音版', description: '低速执法/靠近用纯电静音模式（航速 ≤6kn，续航 ≥ 4h）；高速接回柴油机驱动，节省油耗 25%', priceDelta: 0, sortOrder: 3 }
        ];
      } else if (isPassenger) {
        powerOptions = [
          { id: 'pow-passenger-std', name: '双机双桨 · 标准柴油推进（标配）', description: '两台潍柴 WP12 系列船机，单台功率 330kW ×2，定距桨推进，经济航速 12kn 载客 108', priceDelta: 0, sortOrder: 0 },
          { id: 'pow-passenger-4eng', name: '四机四桨 · 大运量高速版', description: '4 台高速柴油机 + 四桨双舵，额定载客 150 人，满载极速 18 节，满足观光高峰', priceDelta: 0, sortOrder: 1 },
          { id: 'pow-passenger-hybrid', name: '柴电混动 · 环保景区版', description: '近岸/码头 0 排放纯电模式（≥ 2kn/5h），开阔水域柴电混合，满足 A 级景区排放要求', priceDelta: 0, sortOrder: 2 },
          { id: 'pow-passenger-shaft', name: '对转桨 · 高效节能版（选配）', description: '前桨后置舵叶 + 对转螺旋桨组合，综合续航提升 15%，同等载荷油耗降低约 12%', priceDelta: 0, sortOrder: 3 }
        ];
      } else {
        powerOptions = [
          { id: 'pow-volvo-ips', name: 'Volvo Penta IPS 操纵系统（标配）', description: 'Volvo Penta IPS 系列（D6/D8/D11/D13）集成式吊舱推进，操控平顺、停靠一键 Joystick（参考 Pardo E72 官方）', priceDelta: 0, sortOrder: 0 },
          { id: 'pow-man-twin', name: 'MAN V8/V12 高性能双机（选配）', description: '两台 MAN V12 系列柴油机（总功率 2×1550HP）+ V 型驱动，极速突破 33 节（参考 Princess F65）', priceDelta: 0, sortOrder: 1 },
          { id: 'pow-mtu', name: 'MTU 12V/16V 超级游艇版', description: 'MTU 16V 2000 M96L / Rolls-Royce 动力组合，总功率可达 4000 马力，适用于 28m 以上豪华飞桥（参考丽娃 96 Argo Super）', priceDelta: 0, sortOrder: 2 },
          { id: 'pow-hybrid', name: '柴油电动混动 · 零排放模式', description: '巡航用柴油机驱动并为电池充电；近岸/码头/锚地切换纯电电动机（0 排放 0 噪音），航程+30%（参考 Benetti B.Now 混动选项）', priceDelta: 0, sortOrder: 3 },
          { id: 'pow-pods', name: 'Zeus / 水面吊舱高速推进版', description: 'Cummins Zeus 或 Aquadrive 水面吊舱推进器，响应比传统轴系快 40%，高速转弯船体无明显倾斜', priceDelta: 0, sortOrder: 4 },
          { id: 'pow-custom', name: '定制动力 · 厂家技术部核定', description: '按实际用途（商业/远洋/近海/作业）一对一工程师量身匹配动力方案，含机舱布局计算与 CCS 认证', priceDelta: 0, sortOrder: 9 }
        ];
      }
      powerTab.options = powerOptions;
    }
    powerTab.description = '推进系统严谨方案（按船型自动匹配：纯电/公务/客运/通用游艇系列。参考 Princess / Pardo / MTU / Volvo 官方）';
  }

  // 3) 智能板块（普通船型）：若无则新增，若只有3个旧选项则扩展为14项完整配置
  if (!isUnmanned) {
    let smartTab = list.find(t => t.id === 'smart' || (t.label && /^智能/.test(t.label) && t.id !== 'smart-system'));
    const smartExpanded = [
      { id: 'sm-nav-std', name: '导航安全 · 标配（Garmin 基础版）', description: 'Garmin GPSMAP 8410 10寸海图机 + AIS 收发器 + 磁罗经 + 电子罗盘 + 船位监控', priceDelta: 0, sortOrder: 0 },
      { id: 'sm-nav-raymarine', name: '导航安全 · Raymarine 专业版', description: 'Raymarine Axiom+ XL 22寸大屏 + Quantum 多普勒雷达 + FLIR M364C 热像仪夜视（参考 Pardo E72 22寸驾驶台大屏）', priceDelta: 0, sortOrder: 1 },
      { id: 'sm-nav-master', name: '导航安全 · 旗舰主控版', description: '双 24寸 Garmin 8624 海图 + Furuno 固态雷达 + 北斗 GPS 双定位冗余 + 自动舵 AP400 + NAVTEX 航行警告接收机', priceDelta: 0, sortOrder: 2 },
      { id: 'sm-safety-std', name: '安全设备 · 标配 SOLAS 标准', description: '救生筏/救生圈/灭火器/烟雾报警器 + 标准 EPIRB 应急示位标（符合 CCS 检验要求）', priceDelta: 0, sortOrder: 3 },
      { id: 'sm-safety-plus', name: '安全设备 · 远洋豪华增强', description: '加配：4 台外置环绕摄像头船坞视频、AIS-SART 搜救应答器、船载卫星电话 Iridium GO! exec、自动灭火器系统', priceDelta: 0, sortOrder: 4 },
      { id: 'sm-safety-maneuver', name: '安全设备 · 智能靠泊辅助', description: 'Dockmate 遥控靠泊系统 + 船首/船尾/侧推三向遥控 + 6 路 360° AI 距离雷达，距离预警 30cm 精度', priceDelta: 0, sortOrder: 5 },
      { id: 'sm-net-std', name: '通讯联网 · 船载 WiFi 标配', description: '双频段 4G LTE 船载路由器（海陆自动切换）+ 全舱 Wi-Fi 覆盖，支持船员手机 App', priceDelta: 0, sortOrder: 6 },
      { id: 'sm-net-vsat', name: '通讯联网 · VSAT 卫星宽带（远海）', description: 'KVH mini-VSAT 24cm 卫星宽带系统，全球海域高带宽联网，满足视频会议/直播/远程监控', priceDelta: 0, sortOrder: 7 },
      { id: 'sm-av-bw', name: '影音娱乐 · B&W Marine 定制音响', description: 'Bowers & Wilkins Marine 系列防水 16 音箱 + 4 炮 + 22" 折叠电视（参考 Brabus/Sunreef 联名款）', priceDelta: 0, sortOrder: 8 },
      { id: 'sm-av-synergy', name: '影音娱乐 · 全屋中控 C-Zone + 定制 KTV', description: 'C-Zone 数字船电中控统一控灯/窗帘/空调；独立 KTV 区含专业卡包箱、6T 点歌库、氛围灯联动', priceDelta: 0, sortOrder: 9 },
      { id: 'sm-ai-std', name: '智能航行 · 标准智能包', description: 'C-Zone 船况监测网关（油/电/水/舱底水位传感器 20 点 + 手机告警）、电子海图 + 航线自动规划', priceDelta: 0, sortOrder: 10 },
      { id: 'sm-ai-plus', name: '智能航行 · 增强智能包', description: '加配：AI 视觉感知 + 雷达 3D 目标识别（自动避障 3nmile 距离）、夜航识别、远程监控 App（实时视频/定位/告警）', priceDelta: 0, sortOrder: 11 },
      { id: 'sm-ai-pro', name: '智能航行 · 旗舰运维包', description: '船联网远程运维平台 + AI 故障诊断（MTU/Volvo/潍柴原厂接入）、油耗曲线预测、AI 航线规划、自动靠泊辅助系统', priceDelta: 0, sortOrder: 12 },
      { id: 'sm-ai-autopilot', name: '智能航行 · 全自动近海无人值守版', description: '高级 AI 自动舵 + 近岸水域环境建模 + 锚泊自动警戒，近海航线可做到船长远程监督下的全自动航行', priceDelta: 0, sortOrder: 13 }
    ];
    if (smartTab) {
      const oldIds = ['smart-std', 'smart-plus', 'smart-pro'];
      const hasOld = (smartTab.options || []).some(o => oldIds.includes(String(o.id)));
      if (hasOld || (smartTab.options || []).length <= 4) {
        smartTab.options = smartExpanded;
      }
      smartTab.description = '三大类：导航安全 × 通讯娱乐 × 智能航行运维（Garmin/Raymarine/B&W/C-Zone 官方品牌）';
    } else {
      const powerTabForSort = list.find(t => t.id === 'power' || /动力/.test(t.label || ''));
      list.push({
        id: 'smart', label: '智能', kind: 'accessory', cameraMode: 'exterior',
        sortOrder: powerTabForSort ? (powerTabForSort.sortOrder || 0) + 1 : 4,
        description: '三大类：导航安全 × 通讯娱乐 × 智能航行运维（Garmin/Raymarine/B&W/C-Zone 官方品牌）',
        options: smartExpanded
      });
    }
  }
  return list.filter(tab => tab.kind === 'overview' || (Array.isArray(tab.options) && tab.options.length)).slice().sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
function initializeSelections() { tabs().forEach(tab => { if (tab.options && tab.options[0]) selections[tab.id] = tab.options[0].id; }); currentTabId = tabs()[0] ? tabs()[0].id : ''; currentVariantId = boatData.primaryVariantId || ((boatData.variants || [])[0] || {}).variantId || ''; }

function updateDigitalTwinEntry() {
  const btn = document.getElementById('digitalTwinBtn');
  if (!btn) return;
  if (!btn._twinBound) { btn.addEventListener('click', openDigitalTwin); btn._twinBound = true; }
  try {
    const sess = JSON.parse(localStorage.getItem('auth_user'));
    const loggedIn = !!(sess && sess.username);
    const twin = boatData && boatData.shipId && DIGITAL_TWIN_SHIPS.has(boatData.shipId);
    btn.style.display = (loggedIn && twin) ? 'inline-flex' : 'none';
  } catch (e) { btn.style.display = 'none'; }
}
function openDigitalTwin() {
  if (!boatData || !boatData.shipId) return;
  location.href = '/twin?boat=' + encodeURIComponent(boatData.shipId);
}

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
  const twinEditor = (tab.kind === 'accessory' && isAdminMode) ? twinConfigHtml(tab) : '';
  container.innerHTML = `<div class="config-section"><div class="config-section-header"><div><h3 class="config-section-title">${escapeHtml(tab.label)}</h3><p class="config-section-desc">${escapeHtml(tab.description || '')}</p></div></div>${twinEditor}${options.length ? `<div class="config-option-grid">${options.map(option => optionHtml(tab, option)).join('')}</div>` : '<div class="detail-empty-option">该船型暂未配置此项，请联系厂家确认。</div>'}${editBtn}</div>`;
  const saveBtn = container.querySelector('.twin-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveTwinConfig);
}

const TWIN_GROUP_META = [
  { id: 'fire', name: '消防系统' }, { id: 'elec', name: '电气系统' }, { id: 'nav', name: '航行与通信' },
  { id: 'cam', name: '视频监控' }, { id: 'cnc', name: '船舶数控系统' }, { id: 'hvac', name: '空调系统' }
];
function twinSmartGroups(tab) {
  const opts = Array.isArray(tab.options) ? tab.options : []
  const groups = {}; const order = []
  opts.forEach(o => { const cat = String(o.name || '').split('·')[0].trim() || String(o.name || '智能'); if (!groups[cat]) { groups[cat] = []; order.push(cat) } groups[cat].push(o) })
  return order.map(cat => ({ category: cat, options: groups[cat] }))
}
function twinConfigHtml(tab) {
  const cfg = (boatData.twinConfig && boatData.twinConfig.systems) || ['fire', 'elec', 'nav', 'cam']
  const smartCfg = (boatData.twinConfig && boatData.twinConfig.smart) || {}
  const sysBoxes = TWIN_GROUP_META.map(s => `<label class="twin-sys-box"><input type="checkbox" data-twin-sys="${s.id}" ${cfg.includes(s.id) ? 'checked' : ''}><span>${escapeHtml(s.name)}</span></label>`).join('')
  const catSelects = twinSmartGroups(tab).map(g => {
    const enabled = !!smartCfg[g.category]
    const sel = smartCfg[g.category] || (g.options[0] && g.options[0].id) || ''
    return `<label class="twin-cat"><input type="checkbox" data-twin-cat-check="${escapeAttr(g.category)}" ${enabled ? 'checked' : ''}><span>${escapeHtml(g.category)}</span><select data-twin-cat="${escapeAttr(g.category)}" ${enabled ? '' : 'disabled'}>${g.options.map(o => `<option value="${escapeAttr(o.id)}" ${o.id === sel ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select></label>`
  }).join('')
  return `<div class="twin-config-card"><div class="twin-config-title">数字孪生配置（勾选后数字孪生左侧显示）</div>
    <div class="twin-config-block"><div class="twin-config-sub">展示的物理系统（可多选）</div><div class="twin-sys-grid">${sysBoxes}</div></div>
    <div class="twin-config-block"><div class="twin-config-sub">智能系统（每类单选）</div><div class="twin-cat-grid">${catSelects || '<span class="muted">智能板块暂无选项</span>'}</div></div>
    <button type="button" class="twin-save-btn">保存数字孪生配置</button></div>`
}
async function saveTwinConfig() {
  if (!boatData || !boatData.id) return toast('未找到船型', true)
  const systems = Array.from(document.querySelectorAll('[data-twin-sys]')).filter(i => i.checked).map(i => i.dataset.twinSys)
  const smart = {}
  document.querySelectorAll('[data-twin-cat-check]').forEach(chk => {
    const cat = chk.dataset.twinCatCheck
    if (chk.checked) { const sel = document.querySelector(`[data-twin-cat="${CSS.escape(cat)}"]`); if (sel) smart[cat] = sel.value }
  })
  try {
    const res = await fetch(`/api/boats/${boatData.id}/twin-config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systems, smart }), credentials: 'same-origin' })
    const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || '保存失败')
    boatData.twinConfig = json.data.twinConfig; toast('数字孪生配置已保存'); renderTab()
  } catch (e) { toast(e.message || '保存失败', true) }
}

function overviewHtml(tab) {
  const editBtn = isAdminMode ? `<button class="section-edit-btn" onclick="openSectionEditor('${escapeJs(tab.id)}')">编辑</button>` : '';
  const sceneImageHtml = boatData.sceneImage
    ? `<div class="config-scene-image-wrap" title="双击查看全图" ondblclick="event.stopPropagation(); previewImage('${escapeJs(boatData.sceneImage)}')">
         <img class="config-scene-image" src="${escapeAttr(boatData.sceneImage)}" alt="">
       </div>`
    : '';
  return `<div class="config-section"><h3 class="config-section-title">${escapeHtml(boatData.name)}</h3>${sceneImageHtml}<p class="config-section-desc">${escapeHtml(boatData.description || '')}</p><div class="config-specs-grid"><div class="config-spec-item"><span class="config-spec-label">船长</span><span class="config-spec-value">${escapeHtml(boatData.length || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">载客/载荷</span><span class="config-spec-value">${escapeHtml(boatData.capacity || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">极速</span><span class="config-spec-value">${escapeHtml(boatData.maxSpeed || '—')}</span></div><div class="config-spec-item"><span class="config-spec-label">模拟基础价</span><span class="config-spec-value">${escapeHtml(formatYuan(boatData.basePriceYuan))}</span><small>${escapeHtml(boatData.pricingNote || '')}</small></div></div><div class="config-features">${(boatData.features || []).map(item => `<span class="config-feature-tag">${escapeHtml(item)}</span>`).join('')}</div>${editBtn}</div>`;
}

function optionHtml(tab, option) {
  const selected = selections[tab.id] === option.id;
  const priceDeltaYuan = optionPrice(option);
  // 仅「内饰」板块(kind === 'model')选项图显示为16:9卡片，并支持双击查看全图
  const imageHtml = (tab.kind === 'model' && option.imageUrl)
    ? `<div class="config-option-image-wrap" title="双击查看全图" ondblclick="event.stopPropagation(); previewImage('${escapeJs(option.imageUrl)}')">
         <img class="config-option-image-169 is-zoomable" src="${escapeAttr(option.imageUrl)}" alt="">
       </div>`
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
    const sceneImg = escapeAttr(boatData.sceneImage || '');
    // 船型基本信息编辑
    formHtml = `
      <div class="editor-field"><label>船型名称</label><input type="text" id="editName" value="${escapeAttr(boatData.name || '')}"></div>
      <div class="editor-field editor-scene-image-field">
        <label>场景图片（16:9展示，双击看全图）</label>
        <div class="editor-scene-image-row">
          <input type="text" id="editSceneImage" value="${sceneImg}" placeholder="图片URL（可选）">
          <button type="button" class="ui-button ui-button--ghost" onclick="uploadSceneImage(this)">上传图片</button>
        </div>
        ${sceneImg ? `
        <div class="editor-scene-image-preview" title="双击查看全图" ondblclick="event.stopPropagation(); previewImage('${escapeJs(sceneImg)}')">
          <img src="${sceneImg}" alt="">
          <span>16:9 · 双击看全图</span>
        </div>` : ''}
      </div>
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
  // 仅「内饰」板块(kind === 'model')保留选项图片上传功能
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
        <div class="opt-image-input-row">
          <input type="text" class="opt-image-url" placeholder="图片URL（可选）" value="${imgUrl}">
          <button type="button" class="opt-image-upload" onclick="uploadOptionImage(this)">上传图片</button>
        </div>
        ${imgUrl ? `
        <div class="opt-image-preview-wrap" title="双击查看全图" ondblclick="event.stopPropagation(); previewImage('${escapeJs(imgUrl)}')">
          <img class="opt-image-preview-169" src="${imgUrl}" alt="">
          <span class="opt-image-hint">16:9 · 双击看全图</span>
        </div>` : ''}
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
  const canUploadImage = tab.kind === 'model';
  div.innerHTML = `
    <div class="opt-row-main">
      ${isColor ? `<input type="color" class="opt-color" value="#000000" oninput="this.nextElementSibling.value=this.value">` : ''}
      ${isColor ? `<input type="text" class="opt-color-text" value="#000000" maxlength="7" oninput="this.previousElementSibling.value=this.value">` : ''}
      <input type="text" class="opt-name" placeholder="名称" value="">
      <div class="opt-price-wrap"><input type="number" class="opt-price" placeholder="0" value="0" step="0.1"><span class="opt-price-unit">万</span></div>
      <button type="button" class="opt-remove" onclick="this.closest('.editor-option-row').remove()">×</button>
    </div>
    <div class="opt-row-desc"><input type="text" class="opt-desc" placeholder="说明文字" value=""></div>
    ${canUploadImage ? `
    <div class="opt-row-image">
      <div class="opt-image-input-row">
        <input type="text" class="opt-image-url" placeholder="图片URL（可选）" value="">
        <button type="button" class="opt-image-upload" onclick="uploadOptionImage(this)">上传图片</button>
      </div>
    </div>` : ''}
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
        // 检查是否已有预览包装容器
        let wrap = row.querySelector('.opt-image-preview-wrap');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.className = 'opt-image-preview-wrap';
          wrap.title = '双击查看全图';
          wrap.setAttribute('ondblclick', `event.stopPropagation(); previewImage('${escapeJs(json.image)}')`);
          wrap.innerHTML = `<img class="opt-image-preview-169" src="${json.image}" alt=""><span class="opt-image-hint">16:9 · 双击看全图</span>`;
          row.querySelector('.opt-row-image').appendChild(wrap);
        } else {
          wrap.querySelector('img').src = json.image;
          wrap.setAttribute('ondblclick', `event.stopPropagation(); previewImage('${escapeJs(json.image)}')`);
        }
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

// 船型(overview)场景图上传
async function uploadSceneImage(btn) {
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
        const urlInput = document.getElementById('editSceneImage');
        if (urlInput) urlInput.value = json.image;
        const field = document.querySelector('.editor-scene-image-field');
        let wrap = field && field.querySelector('.editor-scene-image-preview');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.className = 'editor-scene-image-preview';
          wrap.title = '双击查看全图';
          field.appendChild(wrap);
        }
        wrap.setAttribute('ondblclick', `event.stopPropagation(); previewImage('${escapeJs(json.image)}')`);
        wrap.innerHTML = `<img src="${json.image}" alt=""><span>16:9 · 双击看全图</span>`;
      } else { alert(json.message || '上传失败'); }
    } catch (e) { alert('上传失败: ' + e.message); }
    btn.disabled = false; btn.textContent = '上传图片';
  };
  input.click();
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
      const sceneImage = document.getElementById('editSceneImage').value.trim();
      const body = {
        name: document.getElementById('editName').value,
        description: document.getElementById('editDesc').value,
        length: document.getElementById('editLength').value,
        capacity: document.getElementById('editCapacity').value,
        maxSpeed: document.getElementById('editMaxSpeed').value,
        price: parseInt(document.getElementById('editBasePrice').value) || 0,
        sceneImage,
        features
      };
      // 更新本地数据
      Object.assign(boatData, body);
      boatData.basePriceYuan = body.price;
      boatData.sceneImage = sceneImage;
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

Object.assign(window, { switchTab, selectOption, submitConfig, syncCurrentVariantToVr, returnToCatalog, openSectionEditor, closeSectionEditor, addEditOption, uploadOptionImage, uploadSceneImage, previewImage, saveSection, toggleCompareMode, loadCompareBoat, loadCompareCurrentBoat, loadCompareHome, loadCompareCurrentHome, exitCompareMode });
