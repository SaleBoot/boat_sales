const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  verifyPassword,
  makePassword,
  makeToken,
  hashToken,
  hashAnswer
} = require('./security');

const PLANS = [
  ['free', '普通会员', 5, 0],
  ['silver', '白银会员', 10, 1],
  ['gold', '黄金会员', 20, 2],
  ['platinum', '铂金会员', 30, 3],
  ['diamond', '钻石会员', 40, 4]
];

const DEFAULT_COLORS = [
  ['polar-white', '极地白', '#F0F0F2'],
  ['ocean-silver', '远洋银', '#C4C9D2'],
  ['wave-cyan', '破浪青', '#2E8B8B'],
  ['deep-blue', '深渊蓝', '#1B3A5B'],
  ['flame-red', '炽焰红', '#E63946']
];

const DEFAULT_BOAT_CATEGORIES = [
  ['leisure', '民用休闲', 'leisure', ['luxury-yacht', '豪华游艇'], ['sport-yacht', '运动游艇'], ['speedboat', '快艇'], ['fishing', '钓鱼艇'], ['sailboat', '帆船'], ['leisure-boat', '休闲船']],
  ['commercial', '商用船', 'commercial', ['passenger', '客船'], ['sightseeing', '观光船'], ['transport', '运输船'], ['fishing-commercial', '渔船'], ['workboat', '工作船'], ['engineering', '工程船'], ['tugboat', '拖船']],
  ['government', '公务船', 'government', ['patrol', '巡逻艇'], ['enforcement', '执法艇'], ['fireboat', '消防船'], ['rescue', '救援船'], ['pilot', '引航艇'], ['research', '科考船'], ['survey', '测量船']],
  ['military', '军用船', 'military', ['patrol-mil', '巡逻艇'], ['interceptor', '拦截艇'], ['landing', '登陆艇'], ['transport-mil', '运输艇'], ['training', '训练艇'], ['support', '保障艇'], ['unmanned', '无人艇']]
];

// 仅用于演示页面的市场参考价。单位统一为人民币元，最终报价仍由厂家线下确认。
const BASE_PRICE_YUAN_BY_SHIP_ID = Object.freeze({
  js108: 12800000,
  js119b: 2680000,
  js11: 1980000,
  js1300x: 6800000,
  barge40: 11800000,
  js57: 5680000,
  js580w: 188000,
  js655: 258000,
  js78: 880000,
  js828b: 1580000,
  js950_retro_series: 2380000,
  js950: 2280000,
  js1198: 2880000,
  js1398: 3980000,
  js1588: 4980000,
  js4028: 9800000,
  pwc: 98000,
  usv1: 680000,
  usv2: 1680000
});

// 官网公开船厂资料：作为演示厂商会员写入现有厂商列表，不关联任何船型、模型或绑定关系。
const REAL_SHIPYARD_DIRECTORY = Object.freeze([
  { name: '江南造船（集团）有限责任公司', shortName: '江南造船', phone: '021-66993388', address: '上海市崇明区长兴江南大道988号', businessScope: '防务装备、科考公务船、液化气船、集装箱船及海工装备', website: 'https://www.jnshipyard.com.cn/', sourceUrl: 'https://www.jnshipyard.com.cn/cms/document/show/7.html' },
  { name: '上海外高桥造船有限公司', shortName: '外高桥造船', phone: '021-38864500', address: '上海市浦东新区洲海路3001号', businessScope: '大型邮轮、散货船、油轮、集装箱船、汽车运输船及海工装备', website: 'https://www.chinasws.com/', sourceUrl: 'https://www.chinasws.com/index.php' },
  { name: '大连船舶重工集团有限公司', shortName: '大连造船', phone: '0411-84482888', address: '辽宁省大连市西岗区海防街1号', businessScope: '民用船舶、海洋工程、船舶修理改装及重工装备', website: 'https://www.dsic.cn/', sourceUrl: 'https://www.dsic.cn/' },
  { name: '广船国际有限公司', shortName: '广船国际', phone: '020-36663046', address: '广东省广州市南沙区龙穴街启航路18号', businessScope: '综合舰船建造、修理与海洋装备', website: 'https://www.chinagsi.com/', sourceUrl: 'https://www.chinagsi.com/' },
  { name: '武昌船舶重工集团有限公司', shortName: '武昌造船', phone: '027-68887022', address: '湖北省武汉市新洲区双柳街星谷大道66号', businessScope: '防务装备、船海装备及应用产业', website: 'https://www.wuchuan.com.cn/', sourceUrl: 'https://www.wuchuan.com.cn/qt2/lxwm/index.htm' },
  { name: '中国船舶集团青岛北海造船有限公司', shortName: '北海造船', phone: '0532-86756189', address: '山东省青岛经济技术开发区漓江东路369号', businessScope: '造船、修船、海工、特种船艇及特种装备', website: 'https://www.bhshipyard.com.cn/', sourceUrl: 'https://www.bhshipyard.com.cn/lxwm/index.htm' },
  { name: '江苏扬子江船业集团有限公司', shortName: '扬子江船业', phone: '0523-84660022', address: '江苏省靖江市江阴—靖江工业园区联谊路1号', businessScope: '集装箱船、散货船、油化船、清洁能源船及海洋工程', website: 'https://www.yzjship.com/', sourceUrl: 'https://www.yzjship.com/en/about/67.html' },
  { name: '福建船政重工股份有限公司', shortName: '福建船政', phone: '0591-83682412', address: '福建省福州市连江县粗芦岛船政大道1号', businessScope: '船舶和海工装备修造、钢结构工程及海洋工程设备', website: 'https://www.fcsic.cn/', sourceUrl: 'https://www.fcsic.cn/' },
  { name: '恒力集团重工有限公司', shortName: '恒力重工', phone: '0411-62915117', address: '辽宁省大连长兴岛经济区兴港路315号办公大楼', businessScope: '绿色船舶、高端海工装备、散货船、油轮及气体船', website: 'https://www.henglihi.com/', sourceUrl: 'https://www.henglihi.com/zh/contact' },
  { name: '招商局船舶工业集团有限公司', shortName: '招商船舶', phone: '00852-24367899', address: '香港新界青衣西草湾路1-7号', businessScope: '船舶研发设计、船舶建造、海工装备、船舶维修改装及船舶配套', website: 'https://www.cmindustry.com.hk/', sourceUrl: 'https://www.cmindustry.com.hk/zh-CN/aboutUs/company.html' }
]);

function normalizeMoneyYuan(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function optionPriceYuan(option) {
  if (option && Object.prototype.hasOwnProperty.call(option, 'priceDeltaYuan')) {
    return normalizeMoneyYuan(option.priceDeltaYuan);
  }
  return normalizeMoneyYuan((Number(option && option.priceDelta) || 0) * 10000);
}

function formatReferencePrice(yuan) {
  const normalized = normalizeMoneyYuan(yuan);
  if (!normalized) return '价格待厂家确认';
  const wan = normalized / 10000;
  const text = Number.isInteger(wan) ? wan.toLocaleString('zh-CN') : wan.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `¥${text}万`;
}

function roundToThousand(value) {
  return Math.round(Number(value || 0) / 1000) * 1000;
}

function suggestedOptionPrice(shipId, basePriceYuan, tab, option) {
  if (tab.kind === 'color') {
    const rates = { 'ocean-silver': 0.008, 'wave-cyan': 0.011, 'deep-blue': 0.014, 'flame-red': 0.017 };
    return roundToThousand(basePriceYuan * (rates[option.id] || 0));
  }
  if (tab.id === 'power' || /动力/.test(tab.label || '')) {
    if (option.id === 'power-enhanced') return roundToThousand(basePriceYuan * 0.08);
    if (option.id === 'power-custom') return roundToThousand(basePriceYuan * 0.18);
    return 0;
  }
  const fixed = {
    js1300x: { 'interior-js1300x-interior': 450000 },
    js950: { 'interior-js950-modern-b': 180000 },
    js1398: { 'interior-js1398-interior': 380000 },
    js4028: { 'interior-js4028-interior-b': 450000, 'interior-js4028-interior-c': 880000 },
    usv1: { 'smart-obstacle': 180000, 'smart-remote': 320000 },
    usv2: { 'smart-obstacle': 280000, 'smart-remote': 580000 }
  };
  return normalizeMoneyYuan((fixed[shipId] || {})[option.id]);
}

function applySuggestedOptionPrices(shipId, basePriceYuan, value) {
  const tabs = normalizeConfigTabs(value);
  return tabs
    .filter(tab => !(shipId === 'barge40' && (tab.id === 'power' || /动力/.test(tab.label || ''))))
    .map(tab => ({
      ...tab,
      options: tab.options.map(option => {
        const existing = optionPriceYuan(option);
        const priceDeltaYuan = existing || suggestedOptionPrice(shipId, basePriceYuan, tab, option);
        return { ...option, priceDeltaYuan, priceDelta: priceDeltaYuan / 10000 };
      })
    }));
}

function optionId(prefix, value, index) {
  return `${prefix}-${String(value || index + 1).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || index + 1}`;
}

function databaseKey(value, prefix) {
  const normalized = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${normalized || crypto.randomBytes(4).toString('hex')}`.slice(0, 80);
}

function defaultConfigTabs(profile, variants) {
  const modelVariants = Array.isArray(variants) ? variants : [];
  const isUnmanned = profile.subtype === 'unmanned' || /无人/.test(`${profile.name} ${profile.typeName}`);
  const interiorVariants = modelVariants.filter(item => item.detailedInterior || /内饰|客舱|配置/.test(item.variantName || ''));
  const tabs = [
    { id: 'overview', label: '船型', kind: 'overview', cameraMode: 'exterior', sortOrder: 0, description: '查看船型资料与主要参数', options: [] },
    {
      id: 'appearance', label: '外观', kind: 'color', cameraMode: 'exterior', sortOrder: 1,
      description: '选择船体涂装颜色',
      options: DEFAULT_COLORS.map(([id, name, color], index) => ({ id, name, color, priceDelta: 0, sortOrder: index }))
    }
  ];
  if (isUnmanned) {
    tabs.push({
      id: 'smart-system', label: '智能系统', kind: 'accessory', cameraMode: 'exterior', sortOrder: 2,
      description: '选择任务载荷与智能航行配件',
      options: [
        { id: 'smart-basic', name: '基础智能航行', description: '自动导航与船况监测', priceDelta: 0, accessories: [], sortOrder: 0 },
        { id: 'smart-obstacle', name: '智能避障系统', description: '雷达、视觉感知与自动避障', priceDelta: 0, accessories: [], sortOrder: 1 },
        { id: 'smart-remote', name: '远程任务系统', description: '远程控制、图传与任务载荷接口', priceDelta: 0, accessories: [], sortOrder: 2 }
      ]
    });
  } else {
    // ========= 内饰：布局 × 木饰面 × 软装皮革 × 厨卫 × 娱乐（参考 Princess F 系列 & 丽娃 Riva） =========
    const interiorBase = (interiorVariants.length ? interiorVariants : modelVariants).map((variant, index) => ({
      id: optionId('interior', variant.variantId, index), name: variant.variantName || `内饰方案${index + 1}`,
      description: variant.detailedInterior ? '完整内饰与原始贴图（3D 场景可切换）' : '标准舱内配置方案',
      modelVariantId: variant.variantId, priceDelta: 0, sortOrder: index
    }));
    const woodVeneers = [
      // 参考 Princess F65 官方 4 档木饰面：Rovere 橡木 / Ash 白蜡木 / Silver 银橡木 / Walnut 胡桃木
      { id: 'wood-rovere', name: '木饰面 · Rovere 缎面橡木（标配）', description: '意大利暖色调橡木缎面哑光清漆，标配家具地板饰面', priceDelta: 0, sortOrder: 10 },
      { id: 'wood-ash', name: '木饰面 · Ash 缎面白蜡木（选配）', description: '浅色顺纹白蜡木，通透清爽，适合现代北欧风格舱室', priceDelta: 0, sortOrder: 11 },
      { id: 'wood-silver', name: '木饰面 · Silver Oak 银橡（选配）', description: '浅银灰水洗橡木，淡化木纹对比，与米白皮革完美搭', priceDelta: 0, sortOrder: 12 },
      { id: 'wood-walnut-matte', name: '木饰面 · Walnut 哑光胡桃木（选配）', description: '深褐条纹胡桃木，搭配铜金金属嵌条与真皮沙发（参考 Pardo E72）', priceDelta: 0, sortOrder: 13 },
      { id: 'wood-walnut-gloss', name: '木饰面 · Walnut 高光胡桃木（豪华）', description: '钢琴漆高光胡桃木 + 镜面不锈钢镶嵌（参考丽娃 Riva 96\' Argo Super 官方）', priceDelta: 0, sortOrder: 14 }
    ];
    const softLeathers = [
      // 参考 BRABUS × Sunreef 皮革等级
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
    const layoutOptions = [
      // 参考 Pardo E72 四舱布局 / 丽娃 96 三间+双床 两种方案
      { id: 'layout-std', name: '客舱布局 · 标准（标配）', description: '3 间客舱 + 1 间船员舱（主人套房+VIP+双床），可容纳 6-8 位客人', priceDelta: 0, sortOrder: 1 },
      { id: 'layout-4cabin', name: '客舱布局 · 四舱尊享（选配）', description: '4 间独立客舱（主人+VIP+两间双床）+ 1 间船员舱，共容纳 10 人（参考 Pardo E72）', priceDelta: 0, sortOrder: 2 },
      { id: 'layout-5cabin', name: '客舱布局 · 全宽五舱（长艇专用）', description: '5 间客舱（全船宽主人套房+独立VIP+3间双床），均配独立卫浴（参考 Benetti Oasis 34m）', priceDelta: 0, sortOrder: 3 },
      { id: 'layout-superyacht', name: '客舱布局 · 超级游艇主人甲板', description: '主人套房迁移主甲板，配私人露台和户外淋浴；下层另设 4 间客舱（参考丽娃 Riva 96 Argo Super）', priceDelta: 0, sortOrder: 4 }
    ];
    tabs.push({
      id: 'interior', label: '内饰', kind: 'model', cameraMode: 'interior', sortOrder: 2,
      description: '客舱布局 × 木饰面 × 软装皮革 × 厨卫升级 × 娱乐设施（参考 Princess / Pardo / Ferretti 官方选配）',
      options: [].concat(layoutOptions, interiorBase, woodVeneers, softLeathers, galleyBath, entertainment)
    });
  }
  // ========= 动力：Volvo IPS / MAN / MTU / 柴电混动 / 纯电 / 双机双桨（严谨方案） =========
  const isElectric = profile.typeName && /电动|新能源|纯电/i.test(profile.typeName);
  const isPatrol = profile.typeName && /执法|巡逻|公务/i.test(profile.typeName);
  const isPassenger = profile.typeName && /游览|观光|客舱|客船/i.test(profile.typeName);
  const powerOptions = [];

  if (isElectric) {
    // 新能源电动游船（参考：长江新能源 / JS-11米电动观光船）
    powerOptions.push(
      { id: 'pow-elec-std', name: '纯电推进 · 标准续航（标配）', description: '磷酸铁锂 CATL 电池组（总容量 200kWh）+ 双吊舱电机，6 节续航 8 小时，CCS2 直流快充 2h', priceDelta: 0, sortOrder: 0 },
      { id: 'pow-elec-plus', name: '纯电推进 · 长续航（选配）', description: '磷酸铁锂电池扩容至 400kWh + 双 100kW 电机 + 船载 DC 充电口，8 节 12 小时；兼容岸电与光伏充电', priceDelta: 0, sortOrder: 1 },
      { id: 'pow-elec-range-ext', name: '纯电 · 增程版（柴油发电机）', description: '在纯电基础上加装 80kW 静音柴油增程器（欧 V 排放），远洋作业续航可达 300 海里', priceDelta: 0, sortOrder: 2 },
      { id: 'pow-elec-solar', name: '纯电 · 光伏补能版', description: '顶篷铺设 2.5kW 柔性单晶光伏 + MPPT 控制器，日间平均补能 8-12kWh，零碳巡航 +15%', priceDelta: 0, sortOrder: 3 }
    );
  } else if (isPatrol) {
    // 公务/执法艇（参考 JS-119B / JS-828B）
    powerOptions.push(
      { id: 'pow-diesel-std', name: '双机双桨 · 标准柴油（标配）', description: '两台国产高速柴油机（WD10 系列），总功率 2×280kW，艉机传动，最高航速 28 节', priceDelta: 0, sortOrder: 0 },
      { id: 'pow-man-v8', name: 'MAN V8 高功率执法版', description: '两台 MAN V8-1200 船用柴油发动机（2×882kW/1200HP）+ ZF 船用齿轮箱，极速 42 节', priceDelta: 0, sortOrder: 1 },
      { id: 'pow-waterjet', name: '喷水推进 · 执法高速版', description: '双 MJP 喷水推进器 + MAN 12V 发动机组合，浅水域可过，零到 30 节加速时间 < 40s', priceDelta: 0, sortOrder: 2 },
      { id: 'pow-hybrid', name: '柴电混动 · 巡逻静音版', description: '低速执法/靠近用纯电静音模式（航速 ≤6kn，续航 ≥ 4h）；高速接回柴油机驱动，节省油耗 25%', priceDelta: 0, sortOrder: 3 }
    );
  } else if (isPassenger) {
    // 游览/观光客船（参考 JS-108 108客位）
    powerOptions.push(
      { id: 'pow-passenger-std', name: '双机双桨 · 标准柴油推进（标配）', description: '两台潍柴 WP12 系列船机，单台功率 330kW ×2，定距桨推进，经济航速 12kn 载客 108', priceDelta: 0, sortOrder: 0 },
      { id: 'pow-passenger-4eng', name: '四机四桨 · 大运量高速版', description: '4 台高速柴油机 + 四桨双舵，额定载客 150 人，满载极速 18 节，满足观光高峰', priceDelta: 0, sortOrder: 1 },
      { id: 'pow-passenger-hybrid', name: '柴电混动 · 环保景区版', description: '近岸/码头 0 排放纯电模式（≥ 2kn/5h），开阔水域柴电混合，满足 A 级景区排放要求', priceDelta: 0, sortOrder: 2 },
      { id: 'pow-passenger-shaft', name: '对转桨 · 高效节能版（选配）', description: '前桨后置舵叶 + 对转螺旋桨组合，综合续航提升 15%，同等载荷油耗降低约 12%', priceDelta: 0, sortOrder: 3 }
    );
  } else {
    // 通用豪华游艇 / 钓鱼艇 / 运动艇（参考 Princess F65 / Pardo E72 / Brabus）
    powerOptions.push(
      { id: 'pow-volvo-ips', name: 'Volvo Penta IPS 操纵系统（标配）', description: 'Volvo Penta IPS 系列（D6/D8/D11/D13）集成式吊舱推进，操控平顺、停靠一键 Joystick（参考 Pardo E72 官方）', priceDelta: 0, sortOrder: 0 },
      { id: 'pow-man-twin', name: 'MAN V8/V12 高性能双机（选配）', description: '两台 MAN V12 系列柴油机（总功率 2×1550HP）+ V 型驱动，极速突破 33 节（参考 Princess F65）', priceDelta: 0, sortOrder: 1 },
      { id: 'pow-mtu', name: 'MTU 12V/16V 超级游艇版', description: 'MTU 16V 2000 M96L / Rolls-Royce 动力组合，总功率可达 4000 马力，适用于 28m 以上豪华飞桥（参考丽娃 96 Argo Super）', priceDelta: 0, sortOrder: 2 },
      { id: 'pow-hybrid', name: '柴油电动混动 · 零排放模式', description: '巡航用柴油机驱动并为电池充电；近岸/码头/锚地切换纯电电动机（0 排放 0 噪音），航程+30%（参考 Benetti B.Now 混动选项）', priceDelta: 0, sortOrder: 3 },
      { id: 'pow-pods', name: 'Zeus / 水面吊舱高速推进版', description: 'Cummins Zeus 或 Aquadrive 水面吊舱推进器，响应比传统轴系快 40%，高速转弯船体无明显倾斜', priceDelta: 0, sortOrder: 4 },
      { id: 'pow-custom', name: '定制动力 · 厂家技术部核定', description: '按实际用途（商业/远洋/近海/作业）一对一工程师量身匹配动力方案，含机舱布局计算与 CCS 认证', priceDelta: 0, sortOrder: 9 }
    );
  }
  tabs.push({
    id: 'power', label: '动力', kind: 'config', cameraMode: 'exterior', sortOrder: 3,
    description: '推进系统严谨方案（按船型自动匹配：纯电/公务/客运/通用游艇系列。参考 Princess / Pardo / MTU / Volvo 官方）',
    options: powerOptions
  });
  // 通用船型：在动力之后增加「智能」板块（所有非无人艇的船型默认都有，无人艇已有"智能系统"板块不重复）
  if (!isUnmanned) {
    tabs.push({
      id: 'smart', label: '智能', kind: 'accessory', cameraMode: 'exterior', sortOrder: 4,
      description: '三大类：导航安全 × 通讯娱乐 × 智能航行运维（Garmin/Raymarine/B&W/C-Zone 官方品牌）',
      options: [
        // ====== 导航 & 安全 ======
        { id: 'sm-nav-std', name: '导航安全 · 标配（Garmin 基础版）', description: 'Garmin GPSMAP 8410 10寸海图机 + AIS 收发器 + 磁罗经 + 电子罗盘 + 船位监控', priceDelta: 0, sortOrder: 0 },
        { id: 'sm-nav-raymarine', name: '导航安全 · Raymarine 专业版', description: 'Raymarine Axiom+ XL 22寸大屏 + Quantum 多普勒雷达 + FLIR M364C 热像仪夜视（参考 Pardo E72 22寸驾驶台大屏）', priceDelta: 0, sortOrder: 1 },
        { id: 'sm-nav-master', name: '导航安全 · 旗舰主控版', description: '双 24寸 Garmin 8624 海图 + Furuno 固态雷达 + 北斗 GPS 双定位冗余 + 自动舵 AP400 + NAVTEX 航行警告接收机', priceDelta: 0, sortOrder: 2 },
        { id: 'sm-safety-std', name: '安全设备 · 标配 SOLAS 标准', description: '救生筏/救生圈/灭火器/烟雾报警器 + 标准 EPIRB 应急示位标（符合 CCS 检验要求）', priceDelta: 0, sortOrder: 3 },
        { id: 'sm-safety-plus', name: '安全设备 · 远洋豪华增强', description: '加配：4 台外置环绕摄像头船坞视频、AIS-SART 搜救应答器、船载卫星电话 Iridium GO! exec、自动灭火器系统', priceDelta: 0, sortOrder: 4 },
        { id: 'sm-safety-maneuver', name: '安全设备 · 智能靠泊辅助', description: 'Dockmate 遥控靠泊系统 + 船首/船尾/侧推三向遥控 + 6 路 360° AI 距离雷达，距离预警 30cm 精度', priceDelta: 0, sortOrder: 5 },
        // ====== 通讯 & 娱乐 ======
        { id: 'sm-net-std', name: '通讯联网 · 船载 WiFi 标配', description: '双频段 4G LTE 船载路由器（海陆自动切换）+ 全舱 Wi-Fi 覆盖，支持船员手机 App', priceDelta: 0, sortOrder: 6 },
        { id: 'sm-net-vsat', name: '通讯联网 · VSAT 卫星宽带（远海）', description: 'KVH mini-VSAT 24cm 卫星宽带系统，全球海域高带宽联网，满足视频会议/直播/远程监控', priceDelta: 0, sortOrder: 7 },
        { id: 'sm-av-bw', name: '影音娱乐 · B&W Marine 定制音响', description: 'Bowers & Wilkins Marine 系列防水 16 音箱 + 4 炮 + 22" 折叠电视（参考 Brabus/Sunreef 联名款）', priceDelta: 0, sortOrder: 8 },
        { id: 'sm-av-synergy', name: '影音娱乐 · 全屋中控 C-Zone + 定制 KTV', description: 'C-Zone 数字船电中控统一控灯/窗帘/空调；独立 KTV 区含专业卡包箱、6T 点歌库、氛围灯联动', priceDelta: 0, sortOrder: 9 },
        // ====== 智能航行 & 运维 ======
        { id: 'sm-ai-std', name: '智能航行 · 标准智能包', description: 'C-Zone 船况监测网关（油/电/水/舱底水位传感器 20 点 + 手机告警）、电子海图 + 航线自动规划', priceDelta: 0, sortOrder: 10 },
        { id: 'sm-ai-plus', name: '智能航行 · 增强智能包', description: '加配：AI 视觉感知 + 雷达 3D 目标识别（自动避障 3nmile 距离）、夜航识别、远程监控 App（实时视频/定位/告警）', priceDelta: 0, sortOrder: 11 },
        { id: 'sm-ai-pro', name: '智能航行 · 旗舰运维包', description: '船联网远程运维平台 + AI 故障诊断（MTU/Volvo/潍柴原厂接入）、油耗曲线预测、AI 航线规划、自动靠泊辅助系统', priceDelta: 0, sortOrder: 12 },
        { id: 'sm-ai-autopilot', name: '智能航行 · 全自动近海无人值守版', description: '高级 AI 自动舵 + 近岸水域环境建模 + 锚泊自动警戒，近海航线可做到船长远程监督下的全自动航行', priceDelta: 0, sortOrder: 13 }
      ]
    });
  }
  return tabs;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function normalizeVector(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback.slice();
  return value.slice(0, 3).map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index]);
}

function normalizeViewSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const allowedDirections = new Set(['auto', '+x', '-x', '+z', '-z']);
  const normalizePose = pose => {
    if (!pose || typeof pose !== 'object') return null;
    return {
      position: normalizeVector(pose.position, [0, 0, 0]),
      target: normalizeVector(pose.target, [0, 0, -1]),
      near: Math.max(0.001, Math.min(1, Number(pose.near) || 0.01))
    };
  };
  return {
    bowDirection: allowedDirections.has(String(source.bowDirection || '').toLowerCase()) ? String(source.bowDirection).toLowerCase() : 'auto',
    exterior: normalizePose(source.exterior),
    interior: normalizePose(source.interior)
  };
}

function normalizeVariant(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...source,
    variantId: String(source.variantId || '').trim(),
    variantName: String(source.variantName || '平台上传模型').trim(),
    modelFiles: (Array.isArray(source.modelFiles) ? source.modelFiles : []).map(item => String(item || '').trim()).filter(Boolean),
    detailedInterior: Boolean(source.detailedInterior),
    viewSettings: normalizeViewSettings(source.viewSettings)
  };
}

function normalizeEntryView(value) {
  const source = value && typeof value === 'object' ? value : {};
  if (!Array.isArray(source.position) || !Array.isArray(source.target)) return null;
  const mode = source.mode === 'interior' ? 'interior' : 'exterior';
  const pose = normalizeViewSettings({ [mode]: source })[mode];
  return pose ? { mode, ...pose } : null;
}

function normalizeConfigTabs(value) {
  if (!Array.isArray(value)) return [];
  const allowedKinds = new Set(['overview', 'color', 'model', 'accessory', 'config']);
  return value.slice(0, 12).map((tab, tabIndex) => ({
    id: String(tab.id || `tab-${tabIndex + 1}`).trim(),
    label: String(tab.label || `配置${tabIndex + 1}`).trim(),
    kind: allowedKinds.has(tab.kind) ? tab.kind : 'config',
    cameraMode: tab.cameraMode === 'interior' ? 'interior' : 'exterior',
    description: String(tab.description || '').trim(),
    sortOrder: tabIndex,
    options: (Array.isArray(tab.options) ? tab.options : []).slice(0, 30).map((option, optionIndex) => {
      const priceDeltaYuan = optionPriceYuan(option);
      return {
        id: String(option.id || optionId(`option-${tabIndex}`, option.name, optionIndex)).trim(),
        name: String(option.name || `选项${optionIndex + 1}`).trim(),
        description: String(option.description || '').trim(),
        color: String(option.color || '').trim(),
        priceDeltaYuan,
        priceDelta: priceDeltaYuan / 10000,
        modelVariantId: String(option.modelVariantId || '').trim(),
        entryView: normalizeEntryView(option.entryView),
        imageUrl: String(option.imageUrl || '').trim(),
        accessories: (Array.isArray(option.accessories) ? option.accessories : []).slice(0, 12).map((asset, assetIndex) => ({
          id: String(asset.id || `asset-${assetIndex + 1}`),
          name: String(asset.name || `配件${assetIndex + 1}`),
          modelUrl: String(asset.modelUrl || '').trim(),
          position: Array.isArray(asset.position) ? asset.position.slice(0, 3).map(Number) : [0, 0, 0],
          rotation: Array.isArray(asset.rotation) ? asset.rotation.slice(0, 3).map(Number) : [0, 0, 0],
          scale: Array.isArray(asset.scale) ? asset.scale.slice(0, 3).map(Number) : [1, 1, 1]
        })),
        sortOrder: optionIndex
      };
    })
  }));
}

// 数字孪生每船配置：systems=孪生左侧要显示的物理系统；smart=每个智能大类选中的方案 id
const DEFAULT_TWIN_SYSTEMS = ['fire', 'elec', 'nav', 'cam'];
function normalizeTwinConfig(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const systems = Array.isArray(raw.systems)
    ? raw.systems.filter(Boolean).map(String)
    : DEFAULT_TWIN_SYSTEMS.slice();
  const smart = (raw.smart && typeof raw.smart === 'object') ? raw.smart : {};
  return { systems, smart };
}

class PlatformStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.usingMemory = !process.env.DATABASE_URL && !process.env.PGHOST;
    if (this.usingMemory) {
      const { newDb } = require('pg-mem');
      const db = newDb({ autoCreateForeignKeyIndices: true });
      const adapter = db.adapters.createPg();
      this.pool = new adapter.Pool();
    } else {
      this.pool = process.env.DATABASE_URL
        ? new Pool({ connectionString: process.env.DATABASE_URL })
        : new Pool();
    }
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS v12_membership_plans (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model_quota INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS v12_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_boat_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL DEFAULT 'default',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_boat_subcategories (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES v12_boat_categories(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id,name)
      );
      CREATE TABLE IF NOT EXISTS v12_shipyards (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        plan_code TEXT NOT NULL REFERENCES v12_membership_plans(code),
        status TEXT NOT NULL DEFAULT 'active',
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        business_scope TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        logo_url TEXT NOT NULL DEFAULT '',
        short_name TEXT NOT NULL DEFAULT '',
        official_website TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        source_checked_at DATE,
        data_source TEXT NOT NULL DEFAULT '',
        directory_only BOOLEAN NOT NULL DEFAULT FALSE,
        membership_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        membership_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_users (
        id BIGSERIAL PRIMARY KEY,
        legacy_id TEXT,
        username TEXT NOT NULL,
        username_key TEXT NOT NULL UNIQUE,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        security_question TEXT NOT NULL DEFAULT '',
        security_answer_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL,
        shipyard_id BIGINT REFERENCES v12_shipyards(id),
        status TEXT NOT NULL DEFAULT 'active',
        phone TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        avatar_url TEXT NOT NULL DEFAULT '',
        intention_boat TEXT NOT NULL DEFAULT '',
        intention_level TEXT NOT NULL DEFAULT '无意向',
        consultant TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '自主注册',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES v12_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_vr_models (
        variant_id TEXT PRIMARY KEY,
        ship_id TEXT NOT NULL,
        ship_name TEXT NOT NULL,
        variant_name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        length_m DOUBLE PRECISION NOT NULL DEFAULT 0,
        bundle_version TEXT NOT NULL DEFAULT '',
        bundle_file TEXT NOT NULL DEFAULT '',
        bundle_size BIGINT NOT NULL DEFAULT 0,
        bundle_sha256 TEXT NOT NULL DEFAULT '',
        thumbnail_url TEXT NOT NULL DEFAULT '',
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_shipyard_model_bindings (
        shipyard_id BIGINT NOT NULL REFERENCES v12_shipyards(id) ON DELETE CASCADE,
        variant_id TEXT NOT NULL REFERENCES v12_vr_models(variant_id) ON DELETE CASCADE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        bound_by BIGINT REFERENCES v12_users(id),
        bound_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (shipyard_id, variant_id)
      );
      CREATE TABLE IF NOT EXISTS v12_binding_requests (
        id BIGSERIAL PRIMARY KEY,
        shipyard_id BIGINT NOT NULL REFERENCES v12_shipyards(id) ON DELETE CASCADE,
        variant_id TEXT NOT NULL REFERENCES v12_vr_models(variant_id),
        requested_by BIGINT NOT NULL REFERENCES v12_users(id),
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by BIGINT REFERENCES v12_users(id),
        review_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS v12_vr_account_sync (
        user_id BIGINT PRIMARY KEY REFERENCES v12_users(id) ON DELETE CASCADE,
        variant_id TEXT NOT NULL REFERENCES v12_vr_models(variant_id) ON DELETE CASCADE,
        updated_by BIGINT REFERENCES v12_users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_submissions (
        id TEXT PRIMARY KEY,
        contact_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        remark TEXT NOT NULL DEFAULT '',
        files_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'submitted',
        assigned_shipyard_id BIGINT REFERENCES v12_shipyards(id),
        admin_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id BIGINT REFERENCES v12_users(id),
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        detail_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_boats (
        id BIGSERIAL PRIMARY KEY,
        ship_id TEXT NOT NULL UNIQUE,
        owner_shipyard_id BIGINT NOT NULL REFERENCES v12_shipyards(id),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        category_name TEXT NOT NULL,
        subtype TEXT NOT NULL,
        type_name TEXT NOT NULL,
        length_text TEXT NOT NULL DEFAULT '',
        capacity TEXT NOT NULL DEFAULT '',
        max_speed TEXT NOT NULL DEFAULT '',
        price TEXT NOT NULL DEFAULT '价格面议',
        base_price_yuan BIGINT NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        features_json TEXT NOT NULL DEFAULT '[]',
        image_url TEXT NOT NULL DEFAULT '',
        scene_image_url TEXT NOT NULL DEFAULT '',
        variants_json TEXT NOT NULL DEFAULT '[]',
        config_tabs_json TEXT NOT NULL DEFAULT '[]',
        customizable BOOLEAN NOT NULL DEFAULT TRUE,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_customizations (
        id TEXT PRIMARY KEY,
        boat_id BIGINT NOT NULL REFERENCES v12_boats(id),
        variant_id TEXT NOT NULL DEFAULT '',
        hull_color TEXT NOT NULL DEFAULT '',
        interior_style TEXT NOT NULL DEFAULT '',
        engine_package TEXT NOT NULL DEFAULT '',
        smart_system TEXT NOT NULL DEFAULT '',
        selections_json TEXT NOT NULL DEFAULT '{}',
        base_price_yuan BIGINT NOT NULL DEFAULT 0,
        option_price_yuan BIGINT NOT NULL DEFAULT 0,
        total_price_yuan BIGINT NOT NULL DEFAULT 0,
        pricing_snapshot_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'submitted',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS v12_membership_upgrade_requests (
        id BIGSERIAL PRIMARY KEY,
        shipyard_id BIGINT NOT NULL REFERENCES v12_shipyards(id) ON DELETE CASCADE,
        requested_by BIGINT NOT NULL REFERENCES v12_users(id),
        current_plan_code TEXT NOT NULL REFERENCES v12_membership_plans(code),
        target_plan_code TEXT NOT NULL REFERENCES v12_membership_plans(code),
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by BIGINT REFERENCES v12_users(id),
        review_note TEXT NOT NULL DEFAULT '',
        approved_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMPTZ
      );
    `);
    await this.ensureSchemaUpgrades();
    await this.seedPlans();
    await this.seedBoatCategories();
    const jingsui = await this.seedJingsuiShipyard();
    await this.seedDemoShipyardVendors();
    await this.seedModels();
    await this.seedBoats(jingsui.id);
    await this.seedJingsuiCatalogOnce(jingsui.id);
    await this.seedPricingOnce();
    await this.importLegacyUsers();
    console.log(`V1.2 平台数据层已就绪（${this.usingMemory ? '本地内存数据库' : 'PostgreSQL'}）`);
  }

  async ensureSchemaUpgrades() {
    const statements = [
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS business_scope TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS short_name TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS official_website TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS source_checked_at DATE',
      "ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS directory_only BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS membership_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE v12_shipyards ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ',
      'ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS owner_shipyard_id BIGINT REFERENCES v12_shipyards(id)',
      "ALTER TABLE v12_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_boats ADD COLUMN IF NOT EXISTS config_tabs_json TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE v12_boats ADD COLUMN IF NOT EXISTS twin_config TEXT NOT NULL DEFAULT '{}'",
      'ALTER TABLE v12_boats ADD COLUMN IF NOT EXISTS base_price_yuan BIGINT NOT NULL DEFAULT 0',
      'ALTER TABLE v12_boats ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ',
      "ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS selections_json TEXT NOT NULL DEFAULT '{}'",
      'ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS base_price_yuan BIGINT NOT NULL DEFAULT 0',
      'ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS option_price_yuan BIGINT NOT NULL DEFAULT 0',
      'ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS total_price_yuan BIGINT NOT NULL DEFAULT 0',
      "ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS pricing_snapshot_json TEXT NOT NULL DEFAULT '{}'",
      "ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_customizations ADD COLUMN IF NOT EXISTS customer_note TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_sessions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'web'",
      "ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS asset_format TEXT NOT NULL DEFAULT 'assetbundle'",
      "ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS detailed_interior BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS source_file TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'",
      "ALTER TABLE v12_vr_models ADD COLUMN IF NOT EXISTS processing_error TEXT NOT NULL DEFAULT ''"
    ];
    for (const sql of statements) await this.pool.query(sql);
  }

  async seedPlans() {
    for (const [code, name, quota, order] of PLANS) {
      await this.pool.query(
        `INSERT INTO v12_membership_plans(code,name,model_quota,sort_order) VALUES($1,$2,$3,$4)
         ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, model_quota=EXCLUDED.model_quota, sort_order=EXCLUDED.sort_order`,
        [code, name, quota, order]
      );
    }
  }

  async seedBoatCategories() {
    const count = Number((await this.pool.query('SELECT COUNT(*) AS count FROM v12_boat_categories')).rows[0].count);
    if (count) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (let categoryIndex = 0; categoryIndex < DEFAULT_BOAT_CATEGORIES.length; categoryIndex += 1) {
        const [id, name, icon, ...children] = DEFAULT_BOAT_CATEGORIES[categoryIndex];
        await client.query(
          'INSERT INTO v12_boat_categories(id,name,icon,sort_order) VALUES($1,$2,$3,$4)',
          [id, name, icon, categoryIndex]
        );
        for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
          await client.query(
            'INSERT INTO v12_boat_subcategories(id,category_id,name,sort_order) VALUES($1,$2,$3,$4)',
            [children[childIndex][0], id, children[childIndex][1], childIndex]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async seedJingsuiShipyard() {
    const result = await this.pool.query(
      `INSERT INTO v12_shipyards(name,plan_code,status,contact_name,contact_phone,address,business_scope,description,membership_expires_at)
       VALUES('京穗船舶','diamond','active','','','中国广东','新能源游览船、公务执法艇、应急救援艇、无人船及水上装备的研发制造','平台现有船型与服务器模型统一归属京穗船舶',$1)
       ON CONFLICT(name) DO UPDATE SET business_scope=EXCLUDED.business_scope,description=EXCLUDED.description
       RETURNING *`, [new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)]
    );
    return result.rows[0];
  }

  async seedDemoShipyardVendors() {
    const seedKey = 'real_shipyard_demo_vendors_20260901_v2';
    if ((await this.pool.query('SELECT 1 FROM v12_settings WHERE key=$1', [seedKey])).rowCount) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < REAL_SHIPYARD_DIRECTORY.length; index += 1) {
        const item = REAL_SHIPYARD_DIRECTORY[index];
        const shipyard = (await client.query(
          `INSERT INTO v12_shipyards(
            name,short_name,plan_code,status,contact_phone,address,business_scope,description,
            official_website,source_url,source_checked_at,data_source,directory_only
           ) VALUES($1,$2,'free','active',$3,$4,$5,$6,$7,$8,$9,'企业官网公开资料',FALSE)
           ON CONFLICT(name) DO UPDATE SET
             short_name=EXCLUDED.short_name,contact_phone=EXCLUDED.contact_phone,address=EXCLUDED.address,
             business_scope=EXCLUDED.business_scope,description=EXCLUDED.description,
             official_website=EXCLUDED.official_website,source_url=EXCLUDED.source_url,
             source_checked_at=EXCLUDED.source_checked_at,data_source=EXCLUDED.data_source,
             directory_only=FALSE,updated_at=CURRENT_TIMESTAMP
           RETURNING *`,
          [item.name, item.shortName, item.phone, item.address, item.businessScope,
            `${item.shortName}官网公开企业资料，仅用于平台内容演示；暂未绑定平台船型或模型。`,
            item.website, item.sourceUrl, '2026-09-01']
        )).rows[0];
        const owner = await client.query("SELECT 1 FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner'", [shipyard.id]);
        if (!owner.rowCount) {
          const username = `shipdemo${String(index + 1).padStart(3, '0')}`;
          const credentials = makePassword(crypto.randomBytes(24).toString('base64url'));
          await client.query(
            `INSERT INTO v12_users(
              username,username_key,salt,password_hash,role,shipyard_id,status,phone,display_name,source
             ) VALUES($1,$2,$3,$4,'shipyard_owner',$5,'active',$6,$7,'官网资料演示')`,
            [username, username.toLowerCase(), credentials.salt, credentials.passwordHash,
              shipyard.id, item.phone, `${item.shortName}主账号`]
          );
        }
      }
      await client.query('INSERT INTO v12_settings(key,value) VALUES($1,$2)', [seedKey, new Date().toISOString()]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async seedModels() {
    const metadata = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'config', 'ship-catalog.json'), 'utf8'));
    const rawPath = path.join(this.rootDir, 'vr-content', 'android', 'catalog.json');
    const rawEntries = fs.existsSync(rawPath)
      ? JSON.parse(fs.readFileSync(rawPath, 'utf8')).entries || []
      : [];
    const byId = new Map(rawEntries.map(item => [item.variantId, item]));
    const owner = (await this.pool.query("SELECT id FROM v12_shipyards WHERE name='京穗船舶'")).rows[0];
    for (const model of metadata) {
      const bundle = byId.get(model.variantId) || {};
      await this.pool.query(
        `INSERT INTO v12_vr_models(
          variant_id,ship_id,ship_name,variant_name,category,description,length_m,
          bundle_version,bundle_file,bundle_size,bundle_sha256,thumbnail_url,is_published,owner_shipyard_id
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13)
        ON CONFLICT(variant_id) DO UPDATE SET
          ship_id=EXCLUDED.ship_id, ship_name=EXCLUDED.ship_name, variant_name=EXCLUDED.variant_name,
          category=EXCLUDED.category, description=EXCLUDED.description, length_m=EXCLUDED.length_m,
          bundle_version=EXCLUDED.bundle_version, bundle_file=EXCLUDED.bundle_file,
          bundle_size=EXCLUDED.bundle_size, bundle_sha256=EXCLUDED.bundle_sha256,
          thumbnail_url=EXCLUDED.thumbnail_url, owner_shipyard_id=EXCLUDED.owner_shipyard_id,
          updated_at=CURRENT_TIMESTAMP`,
        [model.variantId, model.shipId, model.shipName, model.variantName, model.category,
          model.description, model.length, bundle.version || '', bundle.file || '', bundle.size || 0,
          bundle.sha256 || '', `/assets/vr-thumbnails/${model.variantId}.png`, owner ? owner.id : null]
      );
    }
  }

  async seedBoats(ownerShipyardId) {
    const catalog = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'config', 'ship-catalog.json'), 'utf8'));
    const profiles = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'config', 'boat-profiles.json'), 'utf8'));
    const assets = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'config', 'model-assets.json'), 'utf8'));
    const variantsByShip = new Map();
    for (const item of catalog) {
      const asset = assets[item.variantId] || {};
      const textureDir = path.join(this.rootDir, 'public', 'assets', 'model-textures', item.variantId);
      const materialNames = fs.existsSync(textureDir)
        ? fs.readdirSync(textureDir).filter(file => /_basecolor\.webp$/i.test(file)).map(file => file.replace(/_basecolor\.webp$/i, '')).sort()
        : [];
      const variant = {
        variantId: item.variantId,
        variantName: item.variantName,
        modelFiles: (asset.modelFiles || []).map(file => `/FBX/variants/${item.variantId}/${file}`),
        textureBaseUrl: `/assets/model-textures/${item.variantId}`,
        hullMaterial: asset.hullMaterial || 'mat_part01',
        materialNames,
        detailedInterior: /内饰|客舱|配置/.test(item.variantName) && !/基础外/.test(item.variantName),
        thumbnailUrl: `/assets/vr-thumbnails/${item.variantId}.png`
      };
      if (!variantsByShip.has(item.shipId)) variantsByShip.set(item.shipId, []);
      variantsByShip.get(item.shipId).push(variant);
    }
    for (const profile of profiles) {
      const catalogEntry = catalog.find(item => item.shipId === profile.shipId);
      const variants = variantsByShip.get(profile.shipId) || [];
      const primary = variants[0] || {};
      const configTabs = defaultConfigTabs(profile, variants);
      await this.pool.query(
        `INSERT INTO v12_boats(ship_id,owner_shipyard_id,name,category,category_name,subtype,type_name,length_text,capacity,max_speed,price,description,features_json,image_url,scene_image_url,variants_json,config_tabs_json)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT(ship_id) DO UPDATE SET
           config_tabs_json=CASE WHEN v12_boats.config_tabs_json='[]' THEN EXCLUDED.config_tabs_json ELSE v12_boats.config_tabs_json END`,
        [profile.shipId, ownerShipyardId, profile.name, profile.category, profile.categoryName, profile.subtype,
          profile.typeName, `${catalogEntry ? catalogEntry.length : 0}米`, profile.capacity, profile.maxSpeed,
          profile.price, catalogEntry ? catalogEntry.description : '', JSON.stringify(profile.features || []),
          profile.image || primary.thumbnailUrl || '', profile.sceneImage || '', JSON.stringify(variants), JSON.stringify(configTabs)]
      );
    }
  }

  async seedPricingOnce() {
    const seedKey = 'market_reference_pricing_20260901_v1';
    if ((await this.pool.query('SELECT 1 FROM v12_settings WHERE key=$1', [seedKey])).rowCount) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [shipId, suggestedBase] of Object.entries(BASE_PRICE_YUAN_BY_SHIP_ID)) {
        const row = (await client.query(
          'SELECT base_price_yuan,price,config_tabs_json FROM v12_boats WHERE ship_id=$1', [shipId]
        )).rows[0];
        if (!row) continue;
        const basePriceYuan = normalizeMoneyYuan(row.base_price_yuan) || suggestedBase;
        const configTabs = applySuggestedOptionPrices(shipId, basePriceYuan, parseJson(row.config_tabs_json, []));
        const shouldReplaceText = !normalizeMoneyYuan(row.base_price_yuan) || !row.price || /面议|待确认/.test(row.price);
        await client.query(
          `UPDATE v12_boats SET base_price_yuan=$2,price=$3,config_tabs_json=$4,updated_at=CURRENT_TIMESTAMP
           WHERE ship_id=$1`,
          [shipId, basePriceYuan, shouldReplaceText ? formatReferencePrice(basePriceYuan) : row.price, JSON.stringify(configTabs)]
        );
      }
      await client.query('INSERT INTO v12_settings(key,value) VALUES($1,$2)', [seedKey, new Date().toISOString()]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async seedJingsuiCatalogOnce(shipyardId) {
    const seedKey = 'jingsui_catalog_v1212';
    const done = (await this.pool.query('SELECT value FROM v12_settings WHERE key=$1', [seedKey])).rows[0];
    if (done) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE v12_shipyards SET plan_code='diamond',status='active',
         membership_expires_at=COALESCE(membership_expires_at,$2) WHERE id=$1`,
        [shipyardId, new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)]
      );
      await client.query('UPDATE v12_vr_models SET is_published=TRUE WHERE owner_shipyard_id=$1', [shipyardId]);
      const ownedModels = (await client.query(
        'SELECT variant_id FROM v12_vr_models WHERE owner_shipyard_id=$1', [shipyardId]
      )).rows;
      for (const model of ownedModels) {
        await client.query(
          `INSERT INTO v12_shipyard_model_bindings(shipyard_id,variant_id,active)
           VALUES($1,$2,TRUE) ON CONFLICT(shipyard_id,variant_id) DO NOTHING`,
          [shipyardId, model.variant_id]
        );
      }
      await client.query('INSERT INTO v12_settings(key,value) VALUES($1,$2)', [seedKey, new Date().toISOString()]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async importLegacyUsers() {
    const userFile = path.join(this.rootDir, 'users.json');
    let users = [];
    try { users = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch {}
    for (const user of users) {
      const usernameKey = String(user.username || '').trim().toLowerCase();
      if (!usernameKey) continue;
      // 按 username_key 去重：seedDemoShipyardVendors 等演示数据会先于本步骤写入 v12_users，
      // 不能再用“表非空就整体跳过”的守卫，否则 users.json 中的 admin 等历史账号永远无法导入。
      const exists = (await this.pool.query('SELECT 1 FROM v12_users WHERE username_key=$1', [usernameKey])).rowCount;
      if (exists) continue;
      const role = user.role === 'admin' ? 'platform_admin' : 'customer';
      await this.pool.query(
        `INSERT INTO v12_users(legacy_id,username,username_key,salt,password_hash,security_question,security_answer_hash,role,status,phone,display_name,intention_boat,intention_level,consultant,source)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [String(user.id || ''), user.username, usernameKey, user.salt, user.passwordHash,
          user.securityQuestion || '', user.securityAnswer ? hashAnswer(user.securityAnswer) : '', role,
          user.status === '禁用' ? 'disabled' : 'active', user.phone || '', user.username || '', user.intentionBoat || '',
          user.intentionLevel || '无意向', user.consultant || '', user.source || '自主注册']
      );
    }
  }

  userDto(row) {
    return {
      id: Number(row.id), username: row.username, role: row.role,
      displayName: row.display_name || (row.role === 'shipyard_owner' ? row.shipyard_name : row.username),
      phone: row.phone || '', avatarUrl: row.avatar_url || '', status: row.status,
      shipyardId: row.shipyard_id ? Number(row.shipyard_id) : null,
      shipyardName: row.shipyard_name || null,
      shipyardContactName: row.shipyard_contact_name || '',
      shipyardContactPhone: row.shipyard_contact_phone || '',
      shipyardAddress: row.shipyard_address || '',
      shipyardBusinessScope: row.shipyard_business_scope || '',
      shipyardDescription: row.shipyard_description || '',
      shipyardLogoUrl: row.shipyard_logo_url || '',
      membership: row.plan_name || null,
      membershipCode: row.plan_code || null,
      modelQuota: row.model_quota == null ? null : Number(row.model_quota),
      boundModelCount: row.bound_count == null ? null : Number(row.bound_count),
      membershipStartedAt: row.membership_started_at || null,
      membershipExpiresAt: row.membership_expires_at || null,
      membershipActive: (!row.shipyard_status || row.shipyard_status === 'active') &&
        (row.membership_expires_at == null || new Date(row.membership_expires_at).getTime() > Date.now())
    };
  }

  async findUserByName(username) {
    const result = await this.pool.query(
      `SELECT u.*, s.name AS shipyard_name, s.plan_code, s.status AS shipyard_status,
       s.contact_name AS shipyard_contact_name,s.contact_phone AS shipyard_contact_phone,
       s.address AS shipyard_address,s.business_scope AS shipyard_business_scope,
       s.description AS shipyard_description,s.logo_url AS shipyard_logo_url,
       s.membership_started_at,s.membership_expires_at,p.name AS plan_name, p.model_quota
       FROM v12_users u
       LEFT JOIN v12_shipyards s ON s.id=u.shipyard_id
       LEFT JOIN v12_membership_plans p ON p.code=s.plan_code
       WHERE u.username_key=$1`, [String(username).trim().toLowerCase()]
    );
    return this.enrichUser(result.rows[0] || null);
  }

  async enrichUser(user) {
    if (!user) return null;
    user.bound_count = 0;
    if (user.shipyard_id) {
      const count = await this.pool.query(
        `SELECT COUNT(DISTINCT m.ship_id) AS count
         FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id
         WHERE b.shipyard_id=$1 AND b.active=TRUE`,
        [user.shipyard_id]
      );
      user.bound_count = Number(count.rows[0].count);
    }
    return user;
  }

  async authenticate(username, password) {
    const user = await this.findUserByName(username);
    if (!user || user.status !== 'active' || !verifyPassword(password, user.salt, user.password_hash)) return null;
    return user;
  }

  async createSession(userId, kind = 'web') {
    const token = makeToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.pool.query('INSERT INTO v12_sessions(token_hash,user_id,expires_at,kind) VALUES($1,$2,$3,$4)',
      [hashToken(token), userId, expiresAt, kind]);
    return { token, expiresAt };
  }

  async deletePlatformSessions(userId) {
    if (!userId) return;
    await this.pool.query('DELETE FROM v12_sessions WHERE user_id=$1 AND kind=$2', [userId, 'web']);
  }

  async deleteSession(token) {
    if (token) await this.pool.query('DELETE FROM v12_sessions WHERE token_hash=$1', [hashToken(token)]);
  }

  async userFromToken(token) {
    if (!token) return null;
    const result = await this.pool.query(
      `SELECT u.*, x.expires_at AS session_expires_at, s.name AS shipyard_name, s.plan_code,
       s.contact_name AS shipyard_contact_name,s.contact_phone AS shipyard_contact_phone,
       s.address AS shipyard_address,s.business_scope AS shipyard_business_scope,
       s.description AS shipyard_description,s.logo_url AS shipyard_logo_url,
       s.status AS shipyard_status,s.membership_started_at,s.membership_expires_at,p.name AS plan_name, p.model_quota
       FROM v12_sessions x JOIN v12_users u ON u.id=x.user_id
       LEFT JOIN v12_shipyards s ON s.id=u.shipyard_id
       LEFT JOIN v12_membership_plans p ON p.code=s.plan_code
       WHERE x.token_hash=$1 AND u.status='active'`,
      [hashToken(token)]
    );
    const user = result.rows[0] || null;
    if (!user || new Date(user.session_expires_at).getTime() <= Date.now()) return null;
    return this.enrichUser(user);
  }

  async registerCustomer(data) {
    const username = String(data.username).trim();
    const credentials = makePassword(data.password);
    const result = await this.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,security_question,security_answer_hash,role)
       VALUES($1,$2,$3,$4,$5,$6,'customer') RETURNING id,username,role`,
      [username, username.toLowerCase(), credentials.salt, credentials.passwordHash,
        data.securityQuestion, hashAnswer(data.securityAnswer)]
    );
    return result.rows[0];
  }

  async securityQuestion(username) {
    const user = await this.findUserByName(username);
    return user ? user.security_question : null;
  }

  async resetPassword(username, answer, password) {
    const user = await this.findUserByName(username);
    if (!user) throw Object.assign(new Error('未找到该用户'), { status: 404 });
    if (!user.security_answer_hash || user.security_answer_hash !== hashAnswer(answer)) {
      throw Object.assign(new Error('密保答案不正确'), { status: 401 });
    }
    const credentials = makePassword(password);
    await this.pool.query('UPDATE v12_users SET salt=$2,password_hash=$3 WHERE id=$1',
      [user.id, credentials.salt, credentials.passwordHash]);
    await this.pool.query('DELETE FROM v12_sessions WHERE user_id=$1', [user.id]);
  }

  memberDto(row) {
    return {
      id: Number(row.id), username: row.username,
      role: row.role === 'platform_admin' ? 'admin' : 'user',
      phone: row.phone || '', intentionBoat: row.intention_boat || '',
      intentionLevel: row.intention_level || '无意向',
      status: row.status === 'active' ? '正常' : '禁用',
      consultant: row.consultant || '', source: row.source || '自主注册',
      createdAt: row.created_at
    };
  }

  async members(filters) {
    const params = [];
    const where = ["role IN ('platform_admin','customer')"];
    if (filters.keyword) {
      params.push(`%${String(filters.keyword).trim().toLowerCase()}%`);
      where.push(`(LOWER(username) LIKE $${params.length} OR CAST(id AS TEXT) LIKE $${params.length} OR phone LIKE $${params.length})`);
    }
    if (filters.role && filters.role !== 'all') {
      params.push(filters.role === 'admin' ? 'platform_admin' : 'customer');
      where.push(`role=$${params.length}`);
    }
    if (filters.intentionLevel && filters.intentionLevel !== 'all') {
      params.push(filters.intentionLevel); where.push(`intention_level=$${params.length}`);
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status === '正常' ? 'active' : 'disabled'); where.push(`status=$${params.length}`);
    }
    const total = Number((await this.pool.query(`SELECT COUNT(*) AS count FROM v12_users WHERE ${where.join(' AND ')}`, params)).rows[0].count);
    const page = Math.max(1, Number.parseInt(filters.page || 1));
    const pageSize = Math.max(1, Math.min(10000, Number.parseInt(filters.pageSize || 10)));
    params.push(pageSize, (page - 1) * pageSize);
    const rows = (await this.pool.query(
      `SELECT * FROM v12_users WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    )).rows;
    return { list: rows.map(row => this.memberDto(row)), total, page, pageSize };
  }

  async createMember(data) {
    const credentials = makePassword(data.password);
    const result = await this.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,role,status,phone,intention_boat,intention_level,consultant,source)
       VALUES($1,$2,$3,$4,'customer',$5,$6,$7,$8,$9,$10) RETURNING *`,
      [String(data.username).trim(), String(data.username).trim().toLowerCase(), credentials.salt, credentials.passwordHash,
        data.status === '禁用' ? 'disabled' : 'active', data.phone || '', data.intentionBoat || '',
        data.intentionLevel || '无意向', data.consultant || '', data.source || '管理员录入']
    );
    return this.memberDto(result.rows[0]);
  }

  async updateMember(id, data) {
    const current = (await this.pool.query('SELECT * FROM v12_users WHERE id=$1', [id])).rows[0];
    if (!current || !['platform_admin', 'customer'].includes(current.role)) throw Object.assign(new Error('未找到该会员'), { status: 404 });
    let salt = current.salt, passwordHash = current.password_hash;
    if (data.password) ({ salt, passwordHash } = makePassword(data.password));
    const result = await this.pool.query(
      `UPDATE v12_users SET phone=$2,intention_boat=$3,intention_level=$4,status=$5,consultant=$6,source=$7,salt=$8,password_hash=$9
       WHERE id=$1 RETURNING *`,
      [id, data.phone == null ? current.phone : data.phone, data.intentionBoat == null ? current.intention_boat : data.intentionBoat,
        data.intentionLevel || current.intention_level, data.status ? (data.status === '正常' ? 'active' : 'disabled') : current.status,
        data.consultant == null ? current.consultant : data.consultant, data.source == null ? current.source : data.source,
        salt, passwordHash]
    );
    return this.memberDto(result.rows[0]);
  }

  async deleteMember(id) {
    const user = (await this.pool.query('SELECT role FROM v12_users WHERE id=$1', [id])).rows[0];
    if (!user) throw Object.assign(new Error('未找到该会员'), { status: 404 });
    if (user.role === 'platform_admin') throw Object.assign(new Error('不可删除管理员账号'), { status: 400 });
    if (user.role !== 'customer') throw Object.assign(new Error('船厂账号请在船厂账号管理中处理'), { status: 400 });
    await this.pool.query('DELETE FROM v12_users WHERE id=$1', [id]);
  }

  async batchMembers(ids, action) {
    let affected = 0;
    for (const id of ids) {
      const user = (await this.pool.query('SELECT role FROM v12_users WHERE id=$1', [id])).rows[0];
      if (!user || user.role !== 'customer') continue;
      if (action === 'delete') await this.pool.query('DELETE FROM v12_users WHERE id=$1', [id]);
      else await this.pool.query('UPDATE v12_users SET status=$2 WHERE id=$1', [id, action === 'enable' ? 'active' : 'disabled']);
      affected++;
    }
    return affected;
  }

  async publicModels(user) {
    const shipyardId = user && user.shipyard_id;
    const result = await this.pool.query(
      `SELECT m.*,boat.id AS boat_id,
        CASE WHEN b.active=TRUE THEN TRUE ELSE FALSE END AS is_bound,
        CASE WHEN ship_bound.ship_count IS NOT NULL THEN TRUE ELSE FALSE END AS is_ship_bound
       FROM v12_vr_models m
       LEFT JOIN v12_boats boat ON boat.ship_id=m.ship_id AND boat.archived_at IS NULL
       LEFT JOIN v12_shipyard_model_bindings b ON b.variant_id=m.variant_id AND b.shipyard_id=$1
       LEFT JOIN (
         SELECT sm.ship_id, COUNT(*) AS ship_count
         FROM v12_shipyard_model_bindings sb
         JOIN v12_vr_models sm ON sm.variant_id=sb.variant_id
         WHERE sb.shipyard_id=$1 AND sb.active=TRUE
         GROUP BY sm.ship_id
       ) ship_bound ON ship_bound.ship_id=m.ship_id
       WHERE $2=TRUE OR (m.is_published=TRUE AND boat.id IS NOT NULL)
       ORDER BY m.ship_name,m.variant_name`,
      [shipyardId || null, Boolean(user && user.role === 'platform_admin')]
    );
    const latestRequest = new Map();
    if (shipyardId) {
      const requests = await this.pool.query(
        'SELECT variant_id,status FROM v12_binding_requests WHERE shipyard_id=$1 ORDER BY id DESC',
        [shipyardId]
      );
      for (const request of requests.rows) {
        if (!latestRequest.has(request.variant_id)) latestRequest.set(request.variant_id, request.status);
      }
    }
    return result.rows.map(row => this.modelDto({ ...row, request_status: latestRequest.get(row.variant_id) || null }));
  }

  modelDto(row) {
    return {
      variantId: row.variant_id, shipId: row.ship_id, shipName: row.ship_name,
      boatId: row.boat_id == null ? null : Number(row.boat_id),
      variantName: row.variant_name, category: row.category, description: row.description,
      length: Number(row.length_m), thumbnailUrl: row.thumbnail_url,
      published: row.is_published, bound: row.is_bound || false,
      shipBound: row.is_ship_bound || false,
      requestStatus: row.request_status || null,
      bundleReady: Boolean(row.bundle_file && row.bundle_sha256)
    };
  }

  async vrCatalog(user) {
    if (!user.shipyard_id) return { version: String(Date.now()), generatedAtUtc: new Date().toISOString(), entries: [] };
    if (user.shipyard_status && user.shipyard_status !== 'active') {
      return { version: String(Date.now()), generatedAtUtc: new Date().toISOString(), entries: [] };
    }
    if (user.membership_expires_at && new Date(user.membership_expires_at).getTime() <= Date.now()) {
      return { version: String(Date.now()), generatedAtUtc: new Date().toISOString(), entries: [] };
    }
    const result = await this.pool.query(
      `SELECT m.variant_id,m.ship_id,m.ship_name,m.variant_name,m.category,m.description,m.length_m,
              m.bundle_version,m.bundle_file,m.bundle_size,m.bundle_sha256,m.thumbnail_url,
              m.asset_format,m.detailed_interior
       FROM v12_vr_models m JOIN v12_shipyard_model_bindings b ON b.variant_id=m.variant_id
       WHERE b.shipyard_id=$1 AND b.active=TRUE AND m.is_published=TRUE
         AND m.bundle_file<>'' AND m.bundle_sha256<>'' ORDER BY m.variant_id`, [user.shipyard_id]
    );
    return {
      version: crypto.createHash('sha1').update(JSON.stringify(result.rows)).digest('hex').slice(0, 16),
      generatedAtUtc: new Date().toISOString(),
      entries: result.rows.map(row => ({
        variantId: row.variant_id, shipId: row.ship_id, shipName: row.ship_name,
        variantName: row.variant_name, category: row.category, description: row.description,
        length: Number(row.length_m), thumbnailUrl: row.thumbnail_url,
        detailedInterior: Boolean(row.detailed_interior), assetFormat: row.asset_format || 'assetbundle',
        version: row.bundle_version, file: row.bundle_file,
        size: Number(row.bundle_size), sha256: row.bundle_sha256
      }))
    };
  }

  async currentVrModel(user) {
    const result = await this.pool.query(
      `SELECT m.variant_id,m.ship_id,m.ship_name,m.variant_name,m.category,m.description,m.length_m,
              m.bundle_version,m.bundle_file,m.bundle_size,m.bundle_sha256,m.thumbnail_url,
              m.asset_format,m.detailed_interior,s.updated_at
       FROM v12_vr_account_sync s
       JOIN v12_vr_models m ON m.variant_id=s.variant_id
       LEFT JOIN v12_boats boat ON boat.ship_id=m.ship_id AND boat.archived_at IS NULL
       WHERE s.user_id=$1 AND m.is_published=TRUE AND boat.id IS NOT NULL
         AND m.bundle_file<>'' AND m.bundle_sha256<>''`, [user.id]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      variantId: row.variant_id, shipId: row.ship_id, shipName: row.ship_name,
      variantName: row.variant_name, category: row.category, description: row.description,
      length: Number(row.length_m), thumbnailUrl: row.thumbnail_url,
      detailedInterior: Boolean(row.detailed_interior), assetFormat: row.asset_format || 'assetbundle',
      version: row.bundle_version, file: row.bundle_file, size: Number(row.bundle_size),
      sha256: row.bundle_sha256, syncedAtUtc: row.updated_at.toISOString()
    };
  }

  async setCurrentVrModel(user, variantId) {
    const isAdmin = user.role === 'platform_admin';
    const params = [variantId];
    let accessJoin = '';
    if (!isAdmin) {
      params.push(user.shipyard_id);
      accessJoin = `INNER JOIN v12_shipyard_model_bindings b
                      ON b.variant_id=m.variant_id AND b.shipyard_id=$2 AND b.active=TRUE`;
    }
    const model = await this.pool.query(
      `SELECT m.variant_id FROM v12_vr_models m
       INNER JOIN v12_boats boat ON boat.ship_id=m.ship_id AND boat.archived_at IS NULL
       ${accessJoin}
       WHERE m.variant_id=$1 AND m.is_published=TRUE
         AND m.bundle_file<>'' AND m.bundle_sha256<>''`, params
    );
    if (!model.rowCount) throw Object.assign(new Error('该模型尚未就绪、未上架或当前账号无权使用'), { status: 403 });
    await this.pool.query(
      `INSERT INTO v12_vr_account_sync(user_id,variant_id,updated_by,updated_at)
       VALUES($1,$2,$1,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE
       SET variant_id=EXCLUDED.variant_id,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP`,
      [user.id, variantId]
    );
    await this.audit(user.id, 'vr.sync', 'vr_model', variantId, {});
    return this.currentVrModel(user);
  }

  async requestBinding(user, variantId, note) {
    if (user.shipyard_status && user.shipyard_status !== 'active') {
      throw Object.assign(new Error('厂商账号已停用，请联系平台管理员'), { status: 403 });
    }
    if (user.membership_expires_at && new Date(user.membership_expires_at).getTime() <= Date.now()) {
      throw Object.assign(new Error('会员已到期，请联系平台续费后再申请模型'), { status: 403 });
    }
    const model = await this.pool.query('SELECT ship_id FROM v12_vr_models WHERE variant_id=$1 AND is_published=TRUE', [variantId]);
    if (!model.rowCount) throw Object.assign(new Error('该模型未上架，暂不能申请'), { status: 404 });
    const bound = await this.pool.query(
      'SELECT 1 FROM v12_shipyard_model_bindings WHERE shipyard_id=$1 AND variant_id=$2 AND active=TRUE',
      [user.shipyard_id, variantId]
    );
    if (bound.rowCount) throw Object.assign(new Error('该模型已绑定'), { status: 409 });
    const pending = await this.pool.query(
      `SELECT 1 FROM v12_binding_requests WHERE shipyard_id=$1 AND variant_id=$2 AND status='pending'`,
      [user.shipyard_id, variantId]
    );
    if (pending.rowCount) throw Object.assign(new Error('该模型已有待审核申请'), { status: 409 });
    const result = await this.pool.query(
      `INSERT INTO v12_binding_requests(shipyard_id,variant_id,requested_by,note)
       VALUES($1,$2,$3,$4) RETURNING id,status,created_at`,
      [user.shipyard_id, variantId, user.id, String(note || '').trim()]
    );
    return result.rows[0];
  }

  async plans() {
    return (await this.pool.query('SELECT code,name,model_quota,sort_order FROM v12_membership_plans ORDER BY sort_order')).rows;
  }

  async shipyards(options = {}) {
    const includeDirectory = Boolean(options.includeDirectory);
    const result = await this.pool.query(
      `SELECT s.*,p.name AS plan_name,p.model_quota,u.id AS owner_user_id,u.username AS owner_username,
       u.display_name AS owner_display_name,u.status AS owner_status,u.phone AS owner_phone
       FROM v12_shipyards s
       JOIN v12_membership_plans p ON p.code=s.plan_code
       LEFT JOIN v12_users u ON u.shipyard_id=s.id AND u.role='shipyard_owner'
       ${includeDirectory ? '' : 'WHERE s.directory_only=FALSE'}
       ORDER BY s.id DESC,u.id ASC`
    );
    const accounts = await this.pool.query('SELECT shipyard_id,COUNT(*) AS count FROM v12_users WHERE shipyard_id IS NOT NULL GROUP BY shipyard_id');
    const bindings = await this.pool.query(
      `SELECT b.shipyard_id,COUNT(DISTINCT m.ship_id) AS count
       FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id
       WHERE b.active=TRUE GROUP BY b.shipyard_id`
    );
    const accountMap = new Map(accounts.rows.map(row => [String(row.shipyard_id), Number(row.count)]));
    const bindingMap = new Map(bindings.rows.map(row => [String(row.shipyard_id), Number(row.count)]));
    const unique = new Map();
    for (const row of result.rows) if (!unique.has(String(row.id))) unique.set(String(row.id), row);
    return Array.from(unique.values()).map(row => ({
      ...row,
      account_count: accountMap.get(String(row.id)) || 0,
      bound_count: bindingMap.get(String(row.id)) || 0
    }));
  }

  async createShipyard(data, actorId) {
    const result = await this.pool.query(
      `INSERT INTO v12_shipyards(name,plan_code,contact_name,contact_phone,directory_only) VALUES($1,$2,$3,$4,FALSE) RETURNING *`,
      [String(data.name).trim(), data.planCode || 'free', String(data.contactName || '').trim(), String(data.contactPhone || '').trim()]
    );
    await this.audit(actorId, 'shipyard.create', 'shipyard', result.rows[0].id, data);
    return result.rows[0];
  }

  async createVendor(data, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let shipyard = (await client.query('SELECT * FROM v12_shipyards WHERE name=$1', [String(data.name).trim()])).rows[0];
      if (shipyard) {
        const owner = await client.query("SELECT 1 FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner'", [shipyard.id]);
        if (owner.rowCount) throw Object.assign(new Error('该厂商已存在主账号'), { status: 409 });
        shipyard = (await client.query(
          `UPDATE v12_shipyards SET plan_code=$2,status='active',contact_name=$3,contact_phone=$4,
           membership_started_at=CURRENT_TIMESTAMP,membership_expires_at=$5,directory_only=FALSE WHERE id=$1 RETURNING *`,
          [shipyard.id, data.planCode || shipyard.plan_code || 'free', String(data.contactName || '').trim(),
            String(data.contactPhone || '').trim(), data.membershipExpiresAt || null]
        )).rows[0];
      } else {
        shipyard = (await client.query(
          `INSERT INTO v12_shipyards(name,plan_code,contact_name,contact_phone,address,business_scope,membership_expires_at)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [String(data.name).trim(), data.planCode || 'free', String(data.contactName || '').trim(),
            String(data.contactPhone || '').trim(), String(data.address || '').trim(),
            String(data.businessScope || '').trim(), data.membershipExpiresAt || null]
        )).rows[0];
      }
      const credentials = makePassword(data.ownerPassword);
      const account = (await client.query(
        `INSERT INTO v12_users(username,username_key,salt,password_hash,role,shipyard_id,phone,display_name,source)
         VALUES($1,$2,$3,$4,'shipyard_owner',$5,$6,$7,'平台开通') RETURNING id,username,display_name,role,shipyard_id,status,created_at`,
        [String(data.ownerUsername).trim(), String(data.ownerUsername).trim().toLowerCase(), credentials.salt,
          credentials.passwordHash, shipyard.id, String(data.contactPhone || '').trim(), String(data.ownerDisplayName || '').trim()]
      )).rows[0];
      await client.query('COMMIT');
      await this.audit(actorId, 'vendor.create', 'shipyard', shipyard.id, { name: shipyard.name, ownerUsername: account.username, planCode: shipyard.plan_code });
      return { shipyard, account };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async updateShipyard(id, data, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = (await client.query('SELECT * FROM v12_shipyards WHERE id=$1', [id])).rows[0];
      if (!current) throw Object.assign(new Error('船厂不存在'), { status: 404 });
      const expiry = Object.prototype.hasOwnProperty.call(data, 'membershipExpiresAt') ? (data.membershipExpiresAt || null) : current.membership_expires_at;
      const result = await client.query(
        `UPDATE v12_shipyards SET name=$2,plan_code=$3,status=$4,contact_name=$5,contact_phone=$6,
         address=$7,business_scope=$8,description=$9,logo_url=$10,membership_expires_at=$11,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [id, String(data.name == null ? current.name : data.name).trim(), data.planCode || current.plan_code,
          data.status || current.status, data.contactName == null ? current.contact_name : String(data.contactName).trim(),
          data.contactPhone == null ? current.contact_phone : String(data.contactPhone).trim(),
          data.address == null ? current.address : String(data.address).trim(),
          data.businessScope == null ? current.business_scope : String(data.businessScope).trim(),
          data.description == null ? current.description : String(data.description).trim(),
          data.logoUrl == null ? current.logo_url : String(data.logoUrl).trim(), expiry]
      );
      let owner = (await client.query("SELECT * FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner' ORDER BY id LIMIT 1", [id])).rows[0];
      const ownerUsername = String(data.ownerUsername || '').trim();
      if (ownerUsername) {
        let credentials = owner ? { salt: owner.salt, passwordHash: owner.password_hash } : null;
        if (data.ownerPassword) credentials = makePassword(data.ownerPassword);
        if (!owner && !credentials) throw Object.assign(new Error('开通主账号时必须设置初始密码'), { status: 400 });
        if (owner) {
          owner = (await client.query(
            `UPDATE v12_users SET username=$2,username_key=$3,status=$4,phone=$5,display_name=$6,
             salt=$7,password_hash=$8 WHERE id=$1 RETURNING id,username,display_name,status,phone,shipyard_id,created_at`,
            [owner.id, ownerUsername, ownerUsername.toLowerCase(), data.ownerStatus || owner.status,
              data.ownerPhone == null ? owner.phone : String(data.ownerPhone).trim(),
              data.ownerDisplayName == null ? owner.display_name : String(data.ownerDisplayName).trim(),
              credentials.salt, credentials.passwordHash]
          )).rows[0];
          if (data.ownerPassword) await client.query('DELETE FROM v12_sessions WHERE user_id=$1', [owner.id]);
        } else {
          owner = (await client.query(
            `INSERT INTO v12_users(username,username_key,salt,password_hash,role,shipyard_id,status,phone,display_name,source)
             VALUES($1,$2,$3,$4,'shipyard_owner',$5,$6,$7,$8,'平台开通')
             RETURNING id,username,display_name,status,phone,shipyard_id,created_at`,
            [ownerUsername, ownerUsername.toLowerCase(), credentials.salt, credentials.passwordHash, id,
              data.ownerStatus || 'active', String(data.ownerPhone || data.contactPhone || '').trim(),
              String(data.ownerDisplayName || '').trim()]
          )).rows[0];
        }
      }
      await client.query('COMMIT');
      await this.audit(actorId, 'shipyard.update', 'shipyard', id, { ...data, ownerPassword: data.ownerPassword ? '[reset]' : undefined });
      return { ...result.rows[0], owner };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async updateShipyardLogo(shipyardId, logoUrl, actorId) {
    const result = await this.pool.query(
      'UPDATE v12_shipyards SET logo_url=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,logo_url',
      [shipyardId, String(logoUrl || '').trim()]
    );
    if (!result.rowCount) throw Object.assign(new Error('船厂不存在'), { status: 404 });
    await this.audit(actorId, 'shipyard.logo', 'shipyard', shipyardId, { logoUrl });
    return { id: Number(result.rows[0].id), logoUrl: result.rows[0].logo_url };
  }

  async accounts(shipyardId) {
    const params = [];
    let where = "WHERE u.role IN ('shipyard_owner','sales')";
    if (shipyardId) { params.push(shipyardId); where += ` AND u.shipyard_id=$${params.length}`; }
    return (await this.pool.query(
      `SELECT u.id,u.username,u.display_name,u.phone,u.avatar_url,u.role,u.status,u.shipyard_id,s.name AS shipyard_name,u.created_at
       FROM v12_users u JOIN v12_shipyards s ON s.id=u.shipyard_id ${where} ORDER BY u.id DESC`, params
    )).rows;
  }

  async createAccount(data, actorId) {
    if (data.role !== 'shipyard_owner') throw Object.assign(new Error('平台管理员只能创建厂商主账号'), { status: 403 });
    const existing = await this.pool.query("SELECT 1 FROM v12_users WHERE shipyard_id=$1 AND role='shipyard_owner'", [data.shipyardId]);
    if (existing.rowCount) throw Object.assign(new Error('该厂家已经存在主账号'), { status: 409 });
    const credentials = makePassword(data.password);
    const result = await this.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,role,shipyard_id,display_name,phone)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,username,display_name,role,shipyard_id,status,phone,created_at`,
      [String(data.username).trim(), String(data.username).trim().toLowerCase(), credentials.salt,
        credentials.passwordHash, data.role, data.shipyardId, String(data.displayName || '').trim(), String(data.phone || '').trim()]
    );
    await this.audit(actorId, 'account.create', 'user', result.rows[0].id, { role: data.role, shipyardId: data.shipyardId });
    return result.rows[0];
  }

  async updateAccount(id, data, actorId) {
    const current = (await this.pool.query("SELECT * FROM v12_users WHERE id=$1 AND role IN ('shipyard_owner','sales')", [id])).rows[0];
    if (!current) throw Object.assign(new Error('船厂账号不存在'), { status: 404 });
    let credentials = { salt: current.salt, passwordHash: current.password_hash };
    if (data.password) credentials = makePassword(data.password);
    const username = String(data.username == null ? current.username : data.username).trim();
    const result = await this.pool.query(
      `UPDATE v12_users SET username=$2,username_key=$3,display_name=$4,phone=$5,status=$6,salt=$7,password_hash=$8
       WHERE id=$1 RETURNING id,username,display_name,phone,role,status,shipyard_id,created_at`,
      [id, username, username.toLowerCase(), data.displayName == null ? current.display_name : String(data.displayName).trim(),
        data.phone == null ? current.phone : String(data.phone).trim(), data.status || current.status,
        credentials.salt, credentials.passwordHash]
    );
    if (data.password || username.toLowerCase() !== current.username_key) await this.pool.query('DELETE FROM v12_sessions WHERE user_id=$1', [id]);
    await this.audit(actorId, 'account.update', 'user', id, { username, status: data.status, passwordReset: Boolean(data.password) });
    return result.rows[0];
  }

  async salesAccounts(owner) {
    return (await this.pool.query(
      `SELECT id,username,display_name,avatar_url,status,phone,created_at FROM v12_users
       WHERE shipyard_id=$1 AND role='sales' ORDER BY id DESC`, [owner.shipyard_id]
    )).rows;
  }

  async createSales(owner, data) {
    const credentials = makePassword(data.password);
    const result = await this.pool.query(
      `INSERT INTO v12_users(username,username_key,salt,password_hash,role,shipyard_id,phone,display_name,source)
       VALUES($1,$2,$3,$4,'sales',$5,$6,$7,'厂商创建') RETURNING id,username,display_name,status,phone,created_at`,
      [String(data.username).trim(), String(data.username).trim().toLowerCase(), credentials.salt,
        credentials.passwordHash, owner.shipyard_id, String(data.phone || '').trim(), String(data.displayName || '').trim()]
    );
    await this.audit(owner.id, 'sales.create', 'user', result.rows[0].id, { shipyardId: owner.shipyard_id });
    return result.rows[0];
  }

  async updateSales(owner, id, data) {
    const current = (await this.pool.query(
      "SELECT * FROM v12_users WHERE id=$1 AND shipyard_id=$2 AND role='sales'", [id, owner.shipyard_id]
    )).rows[0];
    if (!current) throw Object.assign(new Error('未找到该销售员工'), { status: 404 });
    let salt = current.salt, passwordHash = current.password_hash;
    if (data.password) ({ salt, passwordHash } = makePassword(data.password));
    const result = await this.pool.query(
      `UPDATE v12_users SET status=COALESCE($3,status),phone=COALESCE($4,phone),display_name=COALESCE($5,display_name),salt=$6,password_hash=$7
       WHERE id=$1 AND shipyard_id=$2 RETURNING id,username,display_name,status,phone,created_at`,
      [id, owner.shipyard_id, data.status || null, data.phone == null ? null : data.phone,
        data.displayName == null ? null : data.displayName, salt, passwordHash]
    );
    await this.audit(owner.id, 'sales.update', 'user', id, { status: data.status, passwordReset: Boolean(data.password) });
    return result.rows[0];
  }

  async deleteSales(owner, id) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const target = (await client.query(
        "SELECT id FROM v12_users WHERE id=$1 AND shipyard_id=$2 AND role='sales'", [id, owner.shipyard_id]
      )).rows[0];
      if (!target) throw Object.assign(new Error('未找到该销售员工'), { status: 404 });
      // 保留该销售曾经产生的审计记录，但解除外键引用，随后安全删除账号与会话。
      await client.query('UPDATE v12_audit_logs SET actor_user_id=NULL WHERE actor_user_id=$1', [id]);
      await client.query("DELETE FROM v12_users WHERE id=$1 AND shipyard_id=$2 AND role='sales'", [id, owner.shipyard_id]);
      await client.query('COMMIT');
      await this.audit(owner.id, 'sales.delete', 'user', id, {});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async boatCategories() {
    const [categories, subcategories] = await Promise.all([
      this.pool.query('SELECT id,name,icon,sort_order FROM v12_boat_categories ORDER BY sort_order,id'),
      this.pool.query('SELECT id,category_id,name,sort_order FROM v12_boat_subcategories ORDER BY sort_order,id')
    ]);
    return categories.rows.map(row => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      sortOrder: Number(row.sort_order),
      children: subcategories.rows.filter(item => item.category_id === row.id).map(item => ({
        id: item.id,
        name: item.name,
        sortOrder: Number(item.sort_order)
      }))
    }));
  }

  async createBoatCategory(data, actorId) {
    const name = String(data.name || '').trim();
    if (!name) throw Object.assign(new Error('大类名称不能为空'), { status: 400 });
    const baseId = databaseKey(data.id || name, 'category');
    let id = baseId;
    let suffix = 1;
    while ((await this.pool.query('SELECT 1 FROM v12_boat_categories WHERE id=$1', [id])).rowCount) id = `${baseId}-${suffix++}`;
    const sortOrder = Number((await this.pool.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM v12_boat_categories')).rows[0].next);
    const row = (await this.pool.query(
      'INSERT INTO v12_boat_categories(id,name,icon,sort_order) VALUES($1,$2,$3,$4) RETURNING *',
      [id, name, String(data.icon || 'default'), sortOrder]
    )).rows[0];
    await this.audit(actorId, 'boat_category.create', 'boat_category', id, { name });
    return { id: row.id, name: row.name, icon: row.icon, sortOrder: Number(row.sort_order), children: [] };
  }

  async updateBoatCategory(id, data, actorId) {
    const name = String(data.name || '').trim();
    if (!name) throw Object.assign(new Error('大类名称不能为空'), { status: 400 });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query(
        'UPDATE v12_boat_categories SET name=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *', [id, name]
      )).rows[0];
      if (!row) throw Object.assign(new Error('大类不存在'), { status: 404 });
      await client.query('UPDATE v12_boats SET category_name=$2,updated_at=CURRENT_TIMESTAMP WHERE category=$1', [id, name]);
      await client.query('COMMIT');
      await this.audit(actorId, 'boat_category.update', 'boat_category', id, { name });
      return { id: row.id, name: row.name, icon: row.icon, sortOrder: Number(row.sort_order) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async deleteBoatCategory(id, actorId) {
    const usage = Number((await this.pool.query('SELECT COUNT(*) AS count FROM v12_boats WHERE category=$1', [id])).rows[0].count);
    if (usage) throw Object.assign(new Error(`该大类仍有${usage}艘船型，请先迁移后再删除`), { status: 409 });
    const children = Number((await this.pool.query('SELECT COUNT(*) AS count FROM v12_boat_subcategories WHERE category_id=$1', [id])).rows[0].count);
    if (children) throw Object.assign(new Error('该大类仍有小类，请先删除或迁移小类'), { status: 409 });
    const result = await this.pool.query('DELETE FROM v12_boat_categories WHERE id=$1', [id]);
    if (!result.rowCount) throw Object.assign(new Error('大类不存在'), { status: 404 });
    await this.audit(actorId, 'boat_category.delete', 'boat_category', id, {});
  }

  async createBoatSubcategory(categoryId, data, actorId) {
    if (!(await this.pool.query('SELECT 1 FROM v12_boat_categories WHERE id=$1', [categoryId])).rowCount) {
      throw Object.assign(new Error('大类不存在'), { status: 404 });
    }
    const name = String(data.name || '').trim();
    if (!name) throw Object.assign(new Error('小类名称不能为空'), { status: 400 });
    const baseId = databaseKey(data.id || name, 'type');
    let id = baseId;
    let suffix = 1;
    while ((await this.pool.query('SELECT 1 FROM v12_boat_subcategories WHERE id=$1', [id])).rowCount) id = `${baseId}-${suffix++}`;
    const sortOrder = Number((await this.pool.query(
      'SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM v12_boat_subcategories WHERE category_id=$1', [categoryId]
    )).rows[0].next);
    const row = (await this.pool.query(
      'INSERT INTO v12_boat_subcategories(id,category_id,name,sort_order) VALUES($1,$2,$3,$4) RETURNING *',
      [id, categoryId, name, sortOrder]
    )).rows[0];
    await this.audit(actorId, 'boat_subcategory.create', 'boat_subcategory', id, { categoryId, name });
    return { id: row.id, name: row.name, sortOrder: Number(row.sort_order) };
  }

  async updateBoatSubcategory(categoryId, id, data, actorId) {
    const name = String(data.name || '').trim();
    if (!name) throw Object.assign(new Error('小类名称不能为空'), { status: 400 });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query(
        'UPDATE v12_boat_subcategories SET name=$3,updated_at=CURRENT_TIMESTAMP WHERE category_id=$1 AND id=$2 RETURNING *',
        [categoryId, id, name]
      )).rows[0];
      if (!row) throw Object.assign(new Error('小类不存在'), { status: 404 });
      await client.query('UPDATE v12_boats SET type_name=$2,updated_at=CURRENT_TIMESTAMP WHERE subtype=$1', [id, name]);
      await client.query('COMMIT');
      await this.audit(actorId, 'boat_subcategory.update', 'boat_subcategory', id, { categoryId, name });
      return { id: row.id, name: row.name, sortOrder: Number(row.sort_order) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async deleteBoatSubcategory(categoryId, id, actorId) {
    const usage = Number((await this.pool.query('SELECT COUNT(*) AS count FROM v12_boats WHERE subtype=$1', [id])).rows[0].count);
    if (usage) throw Object.assign(new Error(`该小类仍有${usage}艘船型，请先迁移后再删除`), { status: 409 });
    const result = await this.pool.query('DELETE FROM v12_boat_subcategories WHERE category_id=$1 AND id=$2', [categoryId, id]);
    if (!result.rowCount) throw Object.assign(new Error('小类不存在'), { status: 404 });
    await this.audit(actorId, 'boat_subcategory.delete', 'boat_subcategory', id, { categoryId });
  }

  async reorderBoatCategories(data, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [index, id] of (Array.isArray(data.categoryIds) ? data.categoryIds : []).entries()) {
        await client.query('UPDATE v12_boat_categories SET sort_order=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id, index]);
      }
      if (data.categoryId && Array.isArray(data.subcategoryIds)) {
        for (const [index, id] of data.subcategoryIds.entries()) {
          await client.query(
            'UPDATE v12_boat_subcategories SET sort_order=$3,updated_at=CURRENT_TIMESTAMP WHERE category_id=$1 AND id=$2',
            [data.categoryId, id, index]
          );
        }
      }
      await client.query('COMMIT');
      await this.audit(actorId, 'boat_category.reorder', 'boat_category', String(data.categoryId || 'all'), {});
      return this.boatCategories();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  boatDto(row) {
    const variants = parseJson(row.variants_json, []).map(normalizeVariant);
    const basePriceYuan = normalizeMoneyYuan(row.base_price_yuan);
    const twinConfig = parseJson(row.twin_config, {});
    return {
      id: Number(row.id), shipId: row.ship_id, name: row.name, category: row.category,
      categoryName: row.category_name, subtype: row.subtype, type: row.subtype, typeName: row.type_name,
      length: row.length_text, capacity: row.capacity, maxSpeed: row.max_speed,
      price: basePriceYuan ? formatReferencePrice(basePriceYuan) : row.price,
      basePriceYuan, pricingNote: '模拟参考价，仅供演示，最终以厂家正式报价为准',
      description: row.description, features: parseJson(row.features_json, []), image: row.image_url,
      sceneImage: row.scene_image_url, manufacturer: row.manufacturer || '京穗船舶',
      ownerShipyardId: row.owner_shipyard_id ? Number(row.owner_shipyard_id) : null,
      customizable: row.customizable, published: row.is_published, archived: Boolean(row.archived_at),
      archivedAt: row.archived_at || null, configTabs: normalizeConfigTabs(parseJson(row.config_tabs_json, [])),
      twinConfig: normalizeTwinConfig(twinConfig),
      variants, primaryVariantId: variants[0] ? variants[0].variantId : null,
      modelFile: variants[0] && variants[0].modelFiles[0] ? variants[0].modelFiles[0] : null
    };
  }

  async boats(filters = {}) {
    const params = [];
    const where = ['b.is_published=TRUE', 'b.archived_at IS NULL'];
    if (filters.category && filters.category !== 'all') { params.push(filters.category); where.push(`b.category=$${params.length}`); }
    if (filters.subtype) { params.push(filters.subtype); where.push(`b.subtype=$${params.length}`); }
    const result = await this.pool.query(
      `SELECT b.*,s.name AS manufacturer FROM v12_boats b JOIN v12_shipyards s ON s.id=b.owner_shipyard_id
       WHERE ${where.join(' AND ')} ORDER BY b.id`, params
    );
    return result.rows.map(row => this.boatDto(row));
  }

  async adminBoats(filters = {}) {
    const params = [];
    const where = [];
    if (filters.shipyardId) { params.push(filters.shipyardId); where.push(`b.owner_shipyard_id=$${params.length}`); }
    if (!filters.includeArchived) where.push('b.archived_at IS NULL');
    const result = await this.pool.query(
      `SELECT b.*,s.name AS manufacturer FROM v12_boats b JOIN v12_shipyards s ON s.id=b.owner_shipyard_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.name,b.id`, params
    );
    const bindingRows = await this.pool.query(
      `SELECT DISTINCT m.ship_id,b.shipyard_id
       FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id
       WHERE b.active=TRUE`
    );
    const boundShipyards = new Map();
    for (const row of bindingRows.rows) {
      const key = String(row.ship_id);
      if (!boundShipyards.has(key)) boundShipyards.set(key, []);
      boundShipyards.get(key).push(Number(row.shipyard_id));
    }
    return result.rows.map(row => ({
      ...this.boatDto(row),
      boundShipyardIds: boundShipyards.get(String(row.ship_id)) || []
    }));
  }

  async boat(id, includeArchived = true) {
    const result = await this.pool.query(
      `SELECT b.*,s.name AS manufacturer FROM v12_boats b JOIN v12_shipyards s ON s.id=b.owner_shipyard_id
       WHERE b.id=$1 ${includeArchived ? '' : 'AND b.archived_at IS NULL AND b.is_published=TRUE'}`, [id]
    );
    return result.rows[0] ? this.boatDto(result.rows[0]) : null;
  }

  async updateBoat(id, data, actorId) {
    const current = await this.boat(id);
    if (!current) throw Object.assign(new Error('船型不存在'), { status: 404 });
    const configTabs = data.configTabs == null ? current.configTabs : normalizeConfigTabs(data.configTabs);
    const basePriceYuan = data.basePriceYuan == null ? current.basePriceYuan : normalizeMoneyYuan(data.basePriceYuan);
    const priceText = data.basePriceYuan == null && data.price != null ? String(data.price).trim() : formatReferencePrice(basePriceYuan);
    const result = await this.pool.query(
      `UPDATE v12_boats SET owner_shipyard_id=$2,name=$3,category=$4,category_name=$5,subtype=$6,type_name=$7,
       description=$8,length_text=$9,capacity=$10,max_speed=$11,price=$12,base_price_yuan=$13,features_json=$14,image_url=$15,
       scene_image_url=$16,customizable=$17,is_published=$18,config_tabs_json=$19,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 RETURNING *`,
      [id, data.ownerShipyardId || current.ownerShipyardId, data.name == null ? current.name : String(data.name).trim(),
        data.category == null ? current.category : data.category, data.categoryName == null ? current.categoryName : data.categoryName,
        data.subtype == null ? current.subtype : data.subtype, data.typeName == null ? current.typeName : data.typeName,
        data.description == null ? current.description : data.description, data.length == null ? current.length : data.length,
        data.capacity == null ? current.capacity : data.capacity, data.maxSpeed == null ? current.maxSpeed : data.maxSpeed,
        priceText, basePriceYuan,
        JSON.stringify(data.features == null ? current.features : (Array.isArray(data.features) ? data.features : String(data.features).split('、').map(x => x.trim()).filter(Boolean))),
        data.image == null ? current.image : data.image, data.sceneImage == null ? current.sceneImage : data.sceneImage,
        data.customizable == null ? current.customizable : Boolean(data.customizable),
        data.published == null ? current.published : Boolean(data.published), JSON.stringify(configTabs)]
    );
    await this.audit(actorId, 'boat.update', 'boat', id, data);
    const row = result.rows[0];
    if (Number(row.owner_shipyard_id) !== Number(current.ownerShipyardId)) {
      await this.pool.query(
        'UPDATE v12_vr_models SET owner_shipyard_id=$1,updated_at=CURRENT_TIMESTAMP WHERE ship_id=$2',
        [row.owner_shipyard_id, row.ship_id]
      );
    }
    row.manufacturer = (await this.pool.query('SELECT name FROM v12_shipyards WHERE id=$1', [row.owner_shipyard_id])).rows[0].name;
    return this.boatDto(row);
  }

  async createBoat(data, actorId) {
    const ownerShipyardId = Number(data.ownerShipyardId);
    const owner = (await this.pool.query('SELECT id FROM v12_shipyards WHERE id=$1', [ownerShipyardId])).rows[0];
    if (!owner) throw Object.assign(new Error('所属厂家不存在'), { status: 400 });
    const shipId = String(data.shipId || `ship-${Date.now()}`).trim();
    const profile = { name: data.name || '未命名船型', typeName: data.typeName || '', subtype: data.subtype || '' };
    const tabs = data.configTabs ? normalizeConfigTabs(data.configTabs) : defaultConfigTabs(profile, []);
    const basePriceYuan = normalizeMoneyYuan(data.basePriceYuan);
    const result = await this.pool.query(
      `INSERT INTO v12_boats(ship_id,owner_shipyard_id,name,category,category_name,subtype,type_name,length_text,
       capacity,max_speed,price,base_price_yuan,description,features_json,image_url,scene_image_url,variants_json,config_tabs_json,customizable,is_published)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'[]',$17,$18,$19) RETURNING *`,
      [shipId, ownerShipyardId, String(data.name || '未命名船型').trim(), data.category || 'commercial',
        data.categoryName || '商用船', data.subtype || 'workboat', data.typeName || '工作船', data.length || '',
        data.capacity || '', data.maxSpeed || '资料待确认', formatReferencePrice(basePriceYuan), basePriceYuan, data.description || '',
        JSON.stringify(Array.isArray(data.features) ? data.features : []), data.image || '', data.sceneImage || '',
        JSON.stringify(tabs), data.customizable !== false, data.published !== false]
    );
    await this.audit(actorId, 'boat.create', 'boat', result.rows[0].id, { shipId, ownerShipyardId });
    return this.boat(result.rows[0].id);
  }

  async archiveBoat(id, archived, actorId) {
    const result = await this.pool.query(
      `UPDATE v12_boats SET archived_at=${archived ? 'CURRENT_TIMESTAMP' : 'NULL'},updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) throw Object.assign(new Error('船型不存在'), { status: 404 });
    await this.audit(actorId, archived ? 'boat.archive' : 'boat.restore', 'boat', id, {});
    return this.boat(id);
  }

  async updateBoatImage(id, image, actorId) {
    const result = await this.pool.query('UPDATE v12_boats SET image_url=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id', [id, image]);
    if (!result.rowCount) throw Object.assign(new Error('船型不存在'), { status: 404 });
    await this.audit(actorId, 'boat.image', 'boat', id, { image });
  }

  async addBoatVariant(id, variant, actorId) {
    const current = await this.boat(id);
    if (!current) throw Object.assign(new Error('船型不存在'), { status: 404 });
    const variants = Array.isArray(current.variants) ? current.variants.slice() : [];
    const normalizedVariant = normalizeVariant(variant);
    if (!normalizedVariant.variantId || !normalizedVariant.modelFiles.length) {
      throw Object.assign(new Error('模型版本缺少有效文件'), { status: 400 });
    }
    variants.push(normalizedVariant);
    await this.pool.query(
      'UPDATE v12_boats SET variants_json=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      [id, JSON.stringify(variants)]
    );
    await this.pool.query(
      `INSERT INTO v12_vr_models(
        variant_id,ship_id,ship_name,variant_name,category,description,length_m,
        thumbnail_url,is_published,owner_shipyard_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9)
       ON CONFLICT(variant_id) DO UPDATE SET
        ship_id=EXCLUDED.ship_id,ship_name=EXCLUDED.ship_name,variant_name=EXCLUDED.variant_name,
        category=EXCLUDED.category,description=EXCLUDED.description,length_m=EXCLUDED.length_m,
        thumbnail_url=EXCLUDED.thumbnail_url,owner_shipyard_id=EXCLUDED.owner_shipyard_id,
        updated_at=CURRENT_TIMESTAMP`,
      [normalizedVariant.variantId, current.shipId, current.name, normalizedVariant.variantName || '平台上传模型',
        current.categoryName || current.category, current.description || '', Number.parseFloat(current.length) || 0,
        normalizedVariant.thumbnailUrl || current.image || '', current.ownerShipyardId]
    );
    await this.audit(actorId, 'boat.model_upload', 'boat', id, { variantId: normalizedVariant.variantId, modelFiles: normalizedVariant.modelFiles });
    return { ...current, variants, primaryVariantId: normalizedVariant.variantId, modelFile: normalizedVariant.modelFiles[0] };
  }

  async updateBoatVariant(id, variantId, data, actorId) {
    const current = await this.boat(id);
    if (!current) throw Object.assign(new Error('船型不存在'), { status: 404 });
    const variants = Array.isArray(current.variants) ? current.variants.slice() : [];
    const index = variants.findIndex(item => item.variantId === variantId);
    if (index < 0) throw Object.assign(new Error('模型版本不存在'), { status: 404 });
    variants[index] = normalizeVariant({
      ...variants[index],
      variantName: data.variantName == null ? variants[index].variantName : data.variantName,
      detailedInterior: data.detailedInterior == null ? variants[index].detailedInterior : data.detailedInterior,
      viewSettings: data.viewSettings == null ? variants[index].viewSettings : data.viewSettings
    });
    await this.pool.query('UPDATE v12_boats SET variants_json=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id, JSON.stringify(variants)]);
    await this.pool.query(
      'UPDATE v12_vr_models SET variant_name=$2,updated_at=CURRENT_TIMESTAMP WHERE variant_id=$1',
      [variantId, variants[index].variantName]
    );
    await this.audit(actorId, 'boat.model_view_update', 'boat', id, { variantId, viewSettings: variants[index].viewSettings });
    return this.boat(id);
  }

  async saveCustomization(data) {
    const boat = await this.boat(data.boatId, false);
    if (!boat) throw Object.assign(new Error('未找到该船型'), { status: 404 });
    const requestedSelections = data.selections && typeof data.selections === 'object' ? data.selections : {};
    const selectionSnapshot = {};
    const selectedRows = [];
    for (const tab of boat.configTabs || []) {
      if (!Array.isArray(tab.options) || !tab.options.length) continue;
      const input = requestedSelections[tab.id];
      const requestedOptionId = typeof input === 'string' ? input : input && input.optionId;
      const option = requestedOptionId
        ? tab.options.find(item => item.id === requestedOptionId)
        : tab.options[0];
      if (!option) throw Object.assign(new Error(`“${tab.label}”包含无效选项，请刷新页面后重试`), { status: 400 });
      const priceDeltaYuan = optionPriceYuan(option);
      const snapshot = {
        tabId: tab.id, tabLabel: tab.label, kind: tab.kind,
        optionId: option.id, optionName: option.name, color: option.color || '', priceDeltaYuan
      };
      selectionSnapshot[tab.id] = snapshot;
      selectedRows.push({ tab, option, snapshot });
    }
    const selectedModelId = selectedRows.find(item => item.tab.kind === 'model' && item.option.modelVariantId)?.option.modelVariantId;
    const allowedVariants = boat.variants || [];
    const variant = allowedVariants.find(item => item.variantId === selectedModelId) ||
      allowedVariants.find(item => item.variantId === data.variantId) || allowedVariants[0] || null;
    const byKind = kind => selectedRows.find(item => item.tab.kind === kind)?.option.name || '';
    const byLabel = label => selectedRows.find(item => String(item.tab.label || '').includes(label))?.option.name || '';
    const interiorStyle = selectedRows.find(item => item.tab.cameraMode === 'interior')?.option.name || '';
    const basePriceYuan = normalizeMoneyYuan(boat.basePriceYuan);
    const optionPriceYuanTotal = selectedRows.reduce((sum, item) => sum + item.snapshot.priceDeltaYuan, 0);
    const totalPriceYuan = basePriceYuan + optionPriceYuanTotal;
    const pricingSnapshot = {
      currency: 'CNY', basePriceYuan, optionPriceYuan: optionPriceYuanTotal, totalPriceYuan,
      options: selectedRows.map(item => item.snapshot),
      note: boat.pricingNote, calculatedAt: new Date().toISOString()
    };
    const orderId = `CFG-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await this.pool.query(
      `INSERT INTO v12_customizations(
        id,boat_id,variant_id,hull_color,interior_style,engine_package,smart_system,selections_json,
        base_price_yuan,option_price_yuan,total_price_yuan,pricing_snapshot_json,
        customer_name,customer_phone,customer_note
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [orderId, boat.id, variant ? variant.variantId : '', byKind('color'), interiorStyle,
        byLabel('动力'), byKind('accessory'), JSON.stringify(selectionSnapshot),
        basePriceYuan, optionPriceYuanTotal, totalPriceYuan, JSON.stringify(pricingSnapshot),
        String(data.customerName || '').trim(), String(data.customerPhone || '').trim(), String(data.customerNote || '').trim()]
    );
    return {
      orderId, boatId: boat.id, boatName: boat.name, variantId: variant ? variant.variantId : null,
      variantName: variant ? variant.variantName : null, hullColor: byKind('color'),
      interiorStyle, enginePackage: byLabel('动力'), smartSystem: byKind('accessory'),
      basePriceYuan, optionPriceYuan: optionPriceYuanTotal, totalPriceYuan,
      basePrice: formatReferencePrice(basePriceYuan), optionPrice: formatReferencePrice(optionPriceYuanTotal),
      totalPrice: formatReferencePrice(totalPriceYuan), pricingNote: boat.pricingNote,
      selections: selectionSnapshot,
      customerName: String(data.customerName || '').trim(), customerPhone: String(data.customerPhone || '').trim(),
      customerNote: String(data.customerNote || '').trim(),
      createdAt: new Date().toISOString()
    };
  }

  async customizations() {
    const result = await this.pool.query(
      `SELECT c.*,b.name AS boat_name,b.ship_id,s.name AS manufacturer
       FROM v12_customizations c JOIN v12_boats b ON b.id=c.boat_id
       JOIN v12_shipyards s ON s.id=b.owner_shipyard_id ORDER BY c.created_at DESC`
    );
    return result.rows.map(row => ({
      orderId: row.id, boatId: Number(row.boat_id), boatName: row.boat_name,
      shipId: row.ship_id, manufacturer: row.manufacturer, variantId: row.variant_id,
      hullColor: row.hull_color, interiorStyle: row.interior_style,
      enginePackage: row.engine_package, smartSystem: row.smart_system,
      selections: parseJson(row.selections_json, {}), status: row.status,
      customerName: row.customer_name || '', customerPhone: row.customer_phone || '', customerNote: row.customer_note || '',
      basePriceYuan: normalizeMoneyYuan(row.base_price_yuan),
      optionPriceYuan: normalizeMoneyYuan(row.option_price_yuan),
      totalPriceYuan: normalizeMoneyYuan(row.total_price_yuan),
      basePrice: formatReferencePrice(row.base_price_yuan),
      optionPrice: formatReferencePrice(row.option_price_yuan),
      totalPrice: formatReferencePrice(row.total_price_yuan),
      pricingSnapshot: parseJson(row.pricing_snapshot_json, {}), createdAt: row.created_at
    }));
  }

  async customization(orderId) {
    const result = await this.pool.query(
      `SELECT c.*,b.name AS boat_name,b.ship_id,b.category_name,b.type_name,b.length_text,b.capacity,b.max_speed,
       b.description,b.price AS pricing_note,s.name AS manufacturer,m.variant_name
       FROM v12_customizations c JOIN v12_boats b ON b.id=c.boat_id
       JOIN v12_shipyards s ON s.id=b.owner_shipyard_id
       LEFT JOIN v12_vr_models m ON m.variant_id=c.variant_id
       WHERE c.id=$1`, [orderId]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      orderId: row.id, boatId: Number(row.boat_id), boatName: row.boat_name, shipId: row.ship_id,
      manufacturer: row.manufacturer, variantId: row.variant_id, variantName: row.variant_name || '',
      categoryName: row.category_name || '', typeName: row.type_name || '', length: row.length_text || '',
      capacity: row.capacity || '', maxSpeed: row.max_speed || '', description: row.description || '',
      hullColor: row.hull_color || '', interiorStyle: row.interior_style || '', enginePackage: row.engine_package || '',
      smartSystem: row.smart_system || '', selections: parseJson(row.selections_json, {}),
      customerName: row.customer_name || '', customerPhone: row.customer_phone || '', customerNote: row.customer_note || '',
      basePriceYuan: normalizeMoneyYuan(row.base_price_yuan), optionPriceYuan: normalizeMoneyYuan(row.option_price_yuan),
      totalPriceYuan: normalizeMoneyYuan(row.total_price_yuan), pricingSnapshot: parseJson(row.pricing_snapshot_json, {}),
      pricingNote: parseJson(row.pricing_snapshot_json, {}).note || row.pricing_note || '', createdAt: row.created_at
    };
  }

  async updateOwnProfile(user, data) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (user.role === 'shipyard_owner') {
        await client.query(
          `UPDATE v12_shipyards SET name=$2,contact_name=$3,contact_phone=$4,address=$5,business_scope=$6,
           description=$7,logo_url=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [user.shipyard_id, String(data.shipyardName || user.shipyard_name).trim(),
            String(data.contactName == null ? user.shipyard_contact_name || '' : data.contactName).trim(),
            String(data.contactPhone == null ? user.shipyard_contact_phone || '' : data.contactPhone).trim(),
            String(data.address == null ? user.shipyard_address || '' : data.address).trim(),
            String(data.businessScope == null ? user.shipyard_business_scope || '' : data.businessScope).trim(),
            String(data.description == null ? user.shipyard_description || '' : data.description).trim(),
            String(user.shipyard_logo_url || '').trim()]
        );
      }
      await client.query(
        `UPDATE v12_users SET display_name=$2,phone=$3,avatar_url=$4 WHERE id=$1`,
        [user.id, String(data.displayName == null ? user.display_name || '' : data.displayName).trim(),
          String(data.phone == null ? user.phone || '' : data.phone).trim(),
          String(data.avatarUrl == null ? user.avatar_url || '' : data.avatarUrl).trim()]
      );
      await client.query('COMMIT');
      await this.audit(user.id, 'profile.update', 'user', user.id, { shipyardUpdated: user.role === 'shipyard_owner' });
      return this.findUserByName(user.username);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async changeOwnPassword(user, currentPassword, newPassword) {
    const current = (await this.pool.query('SELECT * FROM v12_users WHERE id=$1', [user.id])).rows[0];
    if (!current || !verifyPassword(currentPassword, current.salt, current.password_hash)) {
      throw Object.assign(new Error('当前密码不正确'), { status: 400 });
    }
    const credentials = makePassword(newPassword);
    await this.pool.query('UPDATE v12_users SET salt=$2,password_hash=$3 WHERE id=$1', [user.id, credentials.salt, credentials.passwordHash]);
    await this.pool.query('DELETE FROM v12_sessions WHERE user_id=$1', [user.id]);
    await this.audit(user.id, 'password.change', 'user', user.id, {});
  }

  async requestMembershipUpgrade(user, data) {
    const plan = (await this.pool.query('SELECT * FROM v12_membership_plans WHERE code=$1', [data.targetPlanCode])).rows[0];
    if (!plan) throw Object.assign(new Error('请选择有效的目标会员等级'), { status: 400 });
    const currentPlan = (await this.pool.query('SELECT * FROM v12_membership_plans WHERE code=$1', [user.plan_code])).rows[0];
    if (!currentPlan || Number(plan.sort_order) <= Number(currentPlan.sort_order)) {
      throw Object.assign(new Error('请选择高于当前等级的会员方案'), { status: 400 });
    }
    const pending = await this.pool.query("SELECT 1 FROM v12_membership_upgrade_requests WHERE shipyard_id=$1 AND status='pending'", [user.shipyard_id]);
    if (pending.rowCount) throw Object.assign(new Error('已有一条待处理的会员申请'), { status: 409 });
    const result = await this.pool.query(
      `INSERT INTO v12_membership_upgrade_requests(shipyard_id,requested_by,current_plan_code,target_plan_code,contact_name,contact_phone,note)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user.shipyard_id, user.id, user.plan_code, plan.code, String(data.contactName || '').trim(),
        String(data.contactPhone || '').trim(), String(data.note || '').trim()]
    );
    await this.audit(user.id, 'membership.request', 'shipyard', user.shipyard_id, { targetPlanCode: plan.code });
    return result.rows[0];
  }

  async membershipUpgradeRequests(shipyardId) {
    const params = [];
    let where = '';
    if (shipyardId) { params.push(shipyardId); where = 'WHERE r.shipyard_id=$1'; }
    return (await this.pool.query(
      `SELECT r.*,s.name AS shipyard_name,cp.name AS current_plan_name,tp.name AS target_plan_name,
       u.display_name AS requester_name,u.username AS requester_username
       FROM v12_membership_upgrade_requests r JOIN v12_shipyards s ON s.id=r.shipyard_id
       JOIN v12_membership_plans cp ON cp.code=r.current_plan_code
       JOIN v12_membership_plans tp ON tp.code=r.target_plan_code
       JOIN v12_users u ON u.id=r.requested_by ${where} ORDER BY r.id DESC`, params
    )).rows;
  }

  async decideMembershipUpgrade(id, data, actorId) {
    const approve = data.decision === 'approve';
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const request = (await client.query('SELECT * FROM v12_membership_upgrade_requests WHERE id=$1', [id])).rows[0];
      if (!request) throw Object.assign(new Error('会员申请不存在'), { status: 404 });
      if (request.status !== 'pending') throw Object.assign(new Error('该申请已处理'), { status: 409 });
      const status = approve ? 'approved' : 'rejected';
      const expiresAt = approve ? (data.membershipExpiresAt || null) : null;
      await client.query(
        `UPDATE v12_membership_upgrade_requests SET status=$2,reviewed_by=$3,review_note=$4,
         approved_expires_at=$5,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [id, status, actorId, String(data.reviewNote || '').trim(), expiresAt]
      );
      if (approve) {
        await client.query(
          `UPDATE v12_shipyards SET plan_code=$2,membership_started_at=CURRENT_TIMESTAMP,
           membership_expires_at=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [request.shipyard_id, request.target_plan_code, expiresAt]
        );
      }
      await client.query('COMMIT');
      await this.audit(actorId, `membership.${status}`, 'membership_request', id, { expiresAt });
      return { id: Number(id), status };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async bindingRequests(status) {
    const params = [];
    let where = '';
    if (status) { params.push(status); where = 'WHERE r.status=$1'; }
    return (await this.pool.query(
      `SELECT r.*,s.name AS shipyard_name,m.ship_id,m.ship_name,m.variant_name,u.username AS requester,
       owner.name AS owner_shipyard_name,p.model_quota,
       COALESCE(bc.bound_ship_count,0) AS bound_ship_count
       FROM v12_binding_requests r JOIN v12_shipyards s ON s.id=r.shipyard_id
       JOIN v12_membership_plans p ON p.code=s.plan_code
       JOIN v12_vr_models m ON m.variant_id=r.variant_id
       LEFT JOIN v12_shipyards owner ON owner.id=m.owner_shipyard_id
       JOIN v12_users u ON u.id=r.requested_by
       LEFT JOIN (
         SELECT bb.shipyard_id, COUNT(DISTINCT bm.ship_id) AS bound_ship_count
         FROM v12_shipyard_model_bindings bb
         JOIN v12_vr_models bm ON bm.variant_id=bb.variant_id
         WHERE bb.active=TRUE
         GROUP BY bb.shipyard_id
       ) bc ON bc.shipyard_id=r.shipyard_id
       ${where} ORDER BY r.id DESC`, params
    )).rows;
  }

  async decideBinding(requestId, approve, reviewNote, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query(
        `SELECT r.*,p.model_quota,s.status AS shipyard_status,s.membership_expires_at,m.is_published,m.ship_id
         FROM v12_binding_requests r JOIN v12_shipyards s ON s.id=r.shipyard_id
         JOIN v12_membership_plans p ON p.code=s.plan_code
         JOIN v12_vr_models m ON m.variant_id=r.variant_id WHERE r.id=$1`, [requestId]
      );
      const request = requestResult.rows[0];
      if (!request) throw Object.assign(new Error('申请不存在'), { status: 404 });
      if (request.status !== 'pending') throw Object.assign(new Error('该申请已处理'), { status: 409 });
      if (approve && request.shipyard_status !== 'active') {
        throw Object.assign(new Error('该厂商已停用，不能新增绑定'), { status: 409 });
      }
      if (approve && request.membership_expires_at && new Date(request.membership_expires_at).getTime() <= Date.now()) {
        throw Object.assign(new Error('该厂商会员已到期，不能新增绑定'), { status: 409 });
      }
      if (approve && !request.is_published) {
        throw Object.assign(new Error('该模型尚未上架，不能绑定'), { status: 409 });
      }
      const boundCountResult = await client.query(
        `SELECT COUNT(DISTINCT m.ship_id) AS count
         FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id
         WHERE b.shipyard_id=$1 AND b.active=TRUE`,
        [request.shipyard_id]
      );
      const alreadyHasShip = await client.query(
        `SELECT 1 FROM v12_shipyard_model_bindings b JOIN v12_vr_models m ON m.variant_id=b.variant_id
         WHERE b.shipyard_id=$1 AND b.active=TRUE AND m.ship_id=$2 LIMIT 1`,
        [request.shipyard_id, request.ship_id]
      );
      if (approve && !alreadyHasShip.rowCount && Number(boundCountResult.rows[0].count) >= Number(request.model_quota)) {
        throw Object.assign(new Error(`该船厂已达到会员船型上限（${request.model_quota}艘）`), { status: 409 });
      }
      const status = approve ? 'approved' : 'rejected';
      await client.query(
        `UPDATE v12_binding_requests SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [requestId, status, actorId, String(reviewNote || '').trim()]
      );
      if (approve) {
        await client.query(
          `INSERT INTO v12_shipyard_model_bindings(shipyard_id,variant_id,bound_by,active)
           VALUES($1,$2,$3,TRUE) ON CONFLICT(shipyard_id,variant_id)
           DO UPDATE SET active=TRUE,bound_by=EXCLUDED.bound_by,bound_at=CURRENT_TIMESTAMP`,
          [request.shipyard_id, request.variant_id, actorId]
        );
      }
      await client.query('COMMIT');
      await this.audit(actorId, approve ? 'binding.approve' : 'binding.reject', 'binding_request', requestId, { reviewNote });
      return { id: Number(requestId), status };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async setModelPublished(variantId, published, actorId) {
    const result = await this.pool.query(
      `UPDATE v12_vr_models SET is_published=$2,updated_at=CURRENT_TIMESTAMP WHERE variant_id=$1 RETURNING *`,
      [variantId, Boolean(published)]
    );
    if (!result.rowCount) throw Object.assign(new Error('模型不存在'), { status: 404 });
    await this.audit(actorId, 'model.publish', 'vr_model', variantId, { published: Boolean(published) });
    return this.modelDto(result.rows[0]);
  }

  async saveSubmission(submission) {
    await this.pool.query(
      `INSERT INTO v12_submissions(id,contact_name,contact_phone,remark,files_json)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
      [submission.orderId, submission.contactName, submission.contactPhone, submission.remark || '', JSON.stringify(submission.files || [])]
    );
  }

  async submissions() {
    const result = await this.pool.query(
      `SELECT x.*,s.name AS shipyard_name FROM v12_submissions x
       LEFT JOIN v12_shipyards s ON s.id=x.assigned_shipyard_id ORDER BY x.created_at DESC`
    );
    return result.rows.map(row => ({ ...row, files: JSON.parse(row.files_json || '[]'), files_json: undefined }));
  }

  async updateSubmission(id, data, actorId) {
    const result = await this.pool.query(
      `UPDATE v12_submissions SET status=COALESCE($2,status), assigned_shipyard_id=$3,
       admin_note=COALESCE($4,admin_note), updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
      [id, data.status || null, data.assignedShipyardId || null, data.adminNote == null ? null : data.adminNote]
    );
    if (!result.rowCount) throw Object.assign(new Error('提交记录不存在'), { status: 404 });
    await this.audit(actorId, 'submission.update', 'submission', id, data);
    return result.rows[0];
  }

  async audit(actorId, action, targetType, targetId, detail) {
    await this.pool.query(
      `INSERT INTO v12_audit_logs(actor_user_id,action,target_type,target_id,detail_json) VALUES($1,$2,$3,$4,$5)`,
      [actorId || null, action, targetType, String(targetId), JSON.stringify(detail || {})]
    );
  }

  async close() { await this.pool.end(); }
}

module.exports = { PlatformStore, PLANS };
