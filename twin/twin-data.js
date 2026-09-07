/* =========================================================================
 * JS-1300X 消防艇 数字孪生 —— 模拟数据（第一版）
 * 结构说明：所有「设备点位」用比例锚点 anchor:[长度, 高度, 宽度]，范围约 [-1,1]
 *   长度 +1 = 船艏，-1 = 船艉；高度 +1=桅杆，-1=舱底；宽度 +1=右舷，-1=左舷。
 * 渲染时按模型实际包围盒按比例换算，从而贴合任意尺寸的船模。
 * 正式接入真实数据时，把本模块替换成 /api/twin/context 的接口返回即可。
 * ========================================================================= */

const STATUS_TEXT = { online: '在线', offline: '离线', alarm: '报警' };

const SYSTEMS = [
  { id: 'cnc',    name: '船舶数控系统', color: '#38bdf8', icon: 'monitor' },
  { id: 'hvac',   name: '空调系统',     color: '#22c55e', icon: 'wind' },
  { id: 'elec',   name: '电气系统',     color: '#f59e0b', icon: 'bolt' },
  { id: 'engine', name: '发动机与动力', color: '#ef4444', icon: 'engine' },
  { id: 'fire',   name: '消防系统',     color: '#f43f5e', icon: 'flame' },
  { id: 'nav',    name: '航行与通信',   color: '#8b5cf6', icon: 'nav' },
  { id: 'cam',    name: '视频监控',     color: '#06b6d4', icon: 'cam' }
];

const LAYERS = [
  { id: 'pilot',       name: '驾驶舱' },
  { id: 'main_deck',   name: '主甲板' },
  { id: 'lower_deck',  name: '下层甲板' },
  { id: 'engine_room', name: '机舱' }
];

// 设备列表：anchor = [长度, 高度, 宽度]
const DEVICES = [
  // ---- 船舶数控系统 ----
  { id: 'cnc-1', name: '中央控制台',        system: 'cnc', layer: 'pilot',       anchor: [0.25, 0.55, 0.12], status: 'online',  value: '主控', unit: '—',  controllable: true, commands: ['解锁操作', '锁定操作'], params: [['通讯链路', '正常'], ['CPU占用', '22%'], ['系统状态', '运行']] },
  { id: 'cnc-2', name: '集中报警单元',      system: 'cnc', layer: 'engine_room', anchor: [-0.2, -0.35, 0.1], status: 'online',  value: '待命', unit: '—',  controllable: true, commands: ['确认告警', '静音'],  params: [['告警总数', '3'], ['已处理', '1'], ['组网', '正常']] },
  { id: 'cnc-3', name: '主机遥控装置',      system: 'cnc', layer: 'engine_room', anchor: [-0.25, -0.32, 0.02], status: 'online',  value: '遥控', unit: '—', controllable: true, commands: ['本地', '遥控'],  params: [['控制权', '驾驶台'], ['整定', 'OK'], ['通讯', '正常']] },
  { id: 'cnc-4', name: '数据采集终端',      system: 'cnc', layer: 'main_deck',  anchor: [0.0, 0.12, -0.15], status: 'alarm',   value: '异常', unit: '—',  controllable: false, commands: [], params: [['采样', '中断'], ['最近上报', '2分钟前'], ['待处理', '厂家']] },

  // ---- 空调系统 ----
  { id: 'hvac-1', name: '驾驶室空调机组',   system: 'hvac', layer: 'pilot',       anchor: [0.25, 0.45, 0.1], status: 'online',  value: 24.5, unit: '℃', controllable: true, commands: ['温度+', '温度-', '风速+'], params: [['设定', '24℃'], ['回风', '23.8℃'], ['运行模式', '制冷']] },
  { id: 'hvac-2', name: '机舱通风机组',     system: 'hvac', layer: 'engine_room', anchor: [-0.15, -0.32, 0.05], status: 'online', value: 1450, unit: 'rpm', controllable: true, commands: ['开启', '关闭'], params: [['风量', '中'], ['滤网压差', '正常'], ['状态', '运行']] },
  { id: 'hvac-3', name: '生活区空调机组',   system: 'hvac', layer: 'main_deck',  anchor: [-0.3, 0.2, 0.1], status: 'offline', value: 0, unit: '℃', controllable: true, commands: ['开启', '关闭'], params: [['状态', '离线'], ['原因', '通讯中断'], ['历史', '正常']] },
  { id: 'hvac-4', name: '排风机',           system: 'hvac', layer: 'main_deck',  anchor: [0.0, -0.1, -0.2], status: 'online', value: 800, unit: 'rpm', controllable: true, commands: ['开启', '关闭'], params: [['状态', '运行'], ['联动', '消防水炮']] },

  // ---- 电气系统（详细内饰版自带）----
  { id: 'elec-1', name: '主配电板',         system: 'elec', layer: 'engine_room', anchor: [-0.05, -0.25, 0.15], status: 'online',  value: 380, unit: 'V', controllable: true, commands: ['合闸', '分闸'], params: [['频率', '50.0Hz'], ['负载', '62%'], ['绝缘', '正常']] },
  { id: 'elec-2', name: '应急配电板',       system: 'elec', layer: 'pilot',       anchor: [0.1, 0.2, 0.12],  status: 'online',  value: 220, unit: 'V', controllable: true, commands: ['合闸', '分闸'], params: [['状态', '待机'], ['切换', '自动']] },
  { id: 'elec-3', name: '发电机组1',        system: 'elec', layer: 'engine_room', anchor: [-0.1, -0.3, 0.05], status: 'online',  value: 50, unit: 'Hz', controllable: true, commands: ['启动', '停车'], params: [['三相电压', '400V'], ['输出', '75kW'], ['油压', '0.4MPa']] },
  { id: 'elec-4', name: '蓄电池组',         system: 'elec', layer: 'lower_deck', anchor: [-0.35, -0.05, -0.1], status: 'alarm', value: 24.0, unit: 'V', controllable: false, commands: [], params: [['电压', '24.0V'], ['温度', '42℃'], ['状态', '欠压']] },
  { id: 'elec-5', name: '岸电箱',           system: 'elec', layer: 'main_deck', anchor: [-0.7, 0.15, -0.05], status: 'offline', value: 0, unit: 'V', controllable: true, commands: ['接入', '断开'], params: [['状态', '未接岸电'], ['相序', '—'], ['容量', '63A']] },

  // ---- 发动机与动力 ----
  { id: 'eng-1', name: '左主机',            system: 'engine', layer: 'engine_room', anchor: [-0.15, -0.3, 0.2], status: 'online', value: 1450, unit: 'rpm', controllable: true, commands: ['怠速', '+转速', '-转速', '停车'], params: [['滑油压力', '0.42MPa'], ['冷却水温', '82℃'], ['累计小时', '312h']] },
  { id: 'eng-2', name: '右主机',            system: 'engine', layer: 'engine_room', anchor: [-0.15, -0.3, -0.2], status: 'online', value: 1450, unit: 'rpm', controllable: true, commands: ['怠速', '+转速', '-转速', '停车'], params: [['滑油压力', '0.41MPa'], ['冷却水温', '83℃'], ['累计小时', '312h']] },
  { id: 'eng-3', name: '齿轮箱',            system: 'engine', layer: 'engine_room', anchor: [0.0, -0.28, 0.0], status: 'online', value: '合排', unit: '—', controllable: true, commands: ['合排', '脱排'], params: [['油温', '78℃'], ['油压', '0.8MPa'], ['航向', '前进']] },
  { id: 'eng-4', name: '舵机',              system: 'engine', layer: 'engine_room', anchor: [0.5, -0.25, 0.0], status: 'online', value: 0, unit: '°', controllable: true, commands: ['左满舵', '右满舵', '回中'], params: [['舵角', '0°'], ['反馈', '0°'], ['泵站', '正常']] },
  { id: 'eng-5', name: '日用燃油柜',        system: 'engine', layer: 'lower_deck', anchor: [-0.4, -0.1, 0.05], status: 'online', value: 68, unit: '%', controllable: false, commands: [], params: [['容量', '1200L'], ['液位', '68%'], ['温度', '30℃']] },
  { id: 'eng-6', name: '滑油柜',            system: 'engine', layer: 'lower_deck', anchor: [0.45, -0.15, 0.0], status: 'online', value: 72, unit: '%', controllable: false, commands: [], params: [['容量', '300L'], ['液位', '72%'], ['油质', '正常']] },
  { id: 'eng-7', name: '燃油供给泵',        system: 'engine', layer: 'engine_room', anchor: [-0.3, -0.25, 0.12], status: 'online', value: 0.6, unit: 'MPa', controllable: true, commands: ['启动', '停止'], params: [['状态', '运行'], ['出口压力', '0.6MPa'], ['备用', '自动']] },

  // ---- 消防系统 ----
  { id: 'fire-1', name: '消防水炮（艏）',   system: 'fire', layer: 'main_deck', anchor: [0.72, 0.35, 0.0], status: 'online', value: 0, unit: '°', controllable: true, commands: ['水平+', '水平-', '俯仰+', '俯仰-', '开炮', '停炮'], params: [['流量', '1200L/min'], ['射程', '65m'], ['介质', '水/泡沫']] },
  { id: 'fire-2', name: '消防水炮（艉）',   system: 'fire', layer: 'main_deck', anchor: [-0.62, 0.35, 0.0], status: 'online', value: 0, unit: '°', controllable: true, commands: ['水平+', '水平-', '俯仰+', '俯仰-', '开炮', '停炮'], params: [['流量', '1200L/min'], ['射程', '60m'], ['介质', '水/泡沫']] },
  { id: 'fire-3', name: '消防泵1',          system: 'fire', layer: 'engine_room', anchor: [0.0, -0.25, 0.12], status: 'online', value: 1.1, unit: 'MPa', controllable: true, commands: ['启动', '停止'], params: [['状态', '运行'], ['出口', '1.1MPa'], ['流量', '120m³/h']] },
  { id: 'fire-4', name: '消防泵2',          system: 'fire', layer: 'engine_room', anchor: [0.0, -0.25, -0.12], status: 'alarm', value: 0, unit: 'MPa', controllable: false, commands: [], params: [['状态', '故障'], ['原因', '启动失败'], ['联锁', '已切除']] },
  { id: 'fire-5', name: '泡沫泵',           system: 'fire', layer: 'engine_room', anchor: [-0.1, -0.25, 0.2], status: 'online', value: '待命', unit: '—', controllable: true, commands: ['启动', '停止'], params: [['状态', '待命'], ['泡沫箱', '600L'], ['配比', '3%']] },
  { id: 'fire-6', name: '机舱CO2灭火',      system: 'fire', layer: 'engine_room', anchor: [0.2, -0.3, 0.0], status: 'online', value: '就绪', unit: '—', controllable: false, commands: [], params: [['瓶组', '12瓶'], ['压力', '5.7MPa'], ['状态', '就绪']] },
  { id: 'fire-7', name: '消火栓箱',         system: 'fire', layer: 'main_deck', anchor: [0.3, 0.1, 0.32], status: 'online', value: '就绪', unit: '—', controllable: false, commands: [], params: [['水带', '65mm×2'], ['水枪', '1支'], ['状态', '完好']] },

  // ---- 航行与通信 ----
  { id: 'nav-1', name: '船用雷达',          system: 'nav', layer: 'pilot', anchor: [0.35, 0.6, 0.0], status: 'online', value: 24, unit: 'nm', controllable: true, commands: ['量程+', '量程-'], params: [['量程', '24nm'], ['天线', '旋转'], ['目标', '18']] },
  { id: 'nav-2', name: 'GPS/AIS',           system: 'nav', layer: 'pilot', anchor: [0.35, 0.55, 0.2], status: 'online', value: '锁定', unit: '—', controllable: false, commands: [], params: [['船位', '31.23°N 121.50°E'], ['航速', '8.2kn'], ['卫星', '12']] },
  { id: 'nav-3', name: '电子海图',          system: 'nav', layer: 'pilot', anchor: [0.25, 0.5, 0.2], status: 'online', value: '自动', unit: '—', controllable: false, commands: [], params: [['航线', '外滩—横沙水道'], ['偏航', '0.02nm'], ['报警', '无']] },
  { id: 'nav-4', name: 'VHF设备',           system: 'nav', layer: 'pilot', anchor: [0.25, 0.5, 0.0], status: 'online', value: 16, unit: 'CH', controllable: true, commands: ['CH8', 'CH16'], params: [['工作', 'CH16'], ['功率', '25W'], ['值守', '正常']] }
];

// 视频监控（船内摄像头 + 控制室）
const CAMERAS = [
  { id: 'cam-1', name: '驾驶室内监控', system: 'cam', layer: 'pilot',       anchor: [0.25, 0.5, 0.0],  location: '驾驶台 / 操舵位',   tone: 'steel' },
  { id: 'cam-2', name: '机舱监控',     system: 'cam', layer: 'engine_room', anchor: [-0.15, -0.3, 0.0], location: '主机 / 配电板区',    tone: 'amber' },
  { id: 'cam-3', name: '船艏甲板摄像', system: 'cam', layer: 'main_deck',  anchor: [0.72, 0.2, 0.0],   location: '消防水炮 / 甲板',   tone: 'sea' },
  { id: 'cam-4', name: '船艉甲板摄像', system: 'cam', layer: 'main_deck',  anchor: [-0.72, 0.2, 0.0],  location: '艉部作业区',        tone: 'sea' },
  { id: 'cam-5', name: '中央控制室监控', system: 'cam', layer: 'pilot',    anchor: [0.05, 0.4, 0.12],  location: '集控台 / 多屏',     tone: 'violet' }
];

const ALARMS = [
  { id: 'ALM-20260904-001', time: '2026-09-04 09:12', level: '高', device: '左主机',       source: '发动机与动力', message: '主机滑油压力低（0.28MPa）', status: '处理中', color: '#ef4444' },
  { id: 'ALM-20260904-002', time: '2026-09-04 08:40', level: '中', device: '消防泵2',      source: '消防系统',     message: '消防泵启动失败，联锁已切除', status: '未处理', color: '#f59e0b' },
  { id: 'ALM-20260904-003', time: '2026-09-04 07:55', level: '低', device: '蓄电池组',     source: '电气系统',     message: '蓄电池组电压偏低（24.0V）', status: '未处理', color: '#22c55e' }
];

// 能耗 / 工况（模拟设备历史运行数据）——供曲线使用
function makeSeries(points) {
  const out = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    const ts = new Date(now - i * 3600e3);
    const rpm = 1380 + Math.round(Math.sin((points - i) / 3) * 90 + (Math.random() - 0.5) * 40);
    const fuel = 40 + Math.round(Math.sin((points - i) / 4) * 6 + (Math.random() - 0.5) * 3);
    const temp = 80 + Math.round(Math.sin((points - i) / 5) * 3 + (Math.random() - 0.5) * 2);
    out.push({ time: ts.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), rpm, fuel, temp });
  }
  return out;
}

function jitterScale() { return 1 + (Math.random() - 0.5) * 0.06; }

/* ===== 通用点位模板：非 js1300x 船型也用这套，按模型包围盒自动定位 ===== */
const GENERIC_DEVICES = [
  { id: 'g-fire-1', name: '消防泵',         system: 'fire', layer: 'engine_room', anchor: [0.0, -0.25, 0.1],  status: 'online', value: 1.1, unit: 'MPa', controllable: true, commands: ['启动', '停止'], params: [['状态', '运行'], ['出口', '1.1MPa']] },
  { id: 'g-fire-2', name: '消防水炮',       system: 'fire', layer: 'main_deck', anchor: [0.72, 0.35, 0.0],  status: 'online', value: 0, unit: '°', controllable: true, commands: ['水平+/俯仰+', '开炮'], params: [['流量', '1200L/min'], ['射程', '65m']] },
  { id: 'g-fire-3', name: '灭火器箱',       system: 'fire', layer: 'main_deck', anchor: [0.3, 0.1, 0.3],    status: 'online', value: '就绪', unit: '—', controllable: false, commands: [], params: [['配备', '2具'], ['状态', '完好']] },
  { id: 'g-elec-1', name: '主配电板',       system: 'elec', layer: 'engine_room', anchor: [-0.05, -0.25, 0.15], status: 'online', value: 380, unit: 'V', controllable: true, commands: ['合闸', '分闸'], params: [['频率', '50.0Hz'], ['负载', '62%']] },
  { id: 'g-elec-2', name: '发电机组',       system: 'elec', layer: 'engine_room', anchor: [-0.1, -0.3, 0.05], status: 'online', value: 50, unit: 'Hz', controllable: true, commands: ['启动', '停车'], params: [['输出', '75kW'], ['油压', '0.4MPa']] },
  { id: 'g-elec-3', name: '蓄电池组',       system: 'elec', layer: 'lower_deck', anchor: [-0.35, -0.05, -0.1], status: 'alarm', value: 24, unit: 'V', controllable: false, commands: [], params: [['电压', '24.0V'], ['状态', '欠压']] },
  { id: 'g-elec-4', name: '应急配电板',     system: 'elec', layer: 'pilot', anchor: [0.1, 0.2, 0.12], status: 'online', value: 220, unit: 'V', controllable: true, commands: ['合闸', '分闸'], params: [['状态', '待机']] },
  { id: 'g-nav-1', name: '船用雷达',        system: 'nav', layer: 'pilot', anchor: [0.35, 0.6, 0.0], status: 'online', value: 24, unit: 'nm', controllable: true, commands: ['量程+', '量程-'], params: [['量程', '24nm']] },
  { id: 'g-nav-2', name: 'GPS/AIS',         system: 'nav', layer: 'pilot', anchor: [0.35, 0.55, 0.2], status: 'online', value: '锁定', unit: '—', controllable: false, commands: [], params: [['船位', '31.23°N 121.50°E']] },
  { id: 'g-nav-3', name: 'VHF设备',         system: 'nav', layer: 'pilot', anchor: [0.25, 0.5, 0.0], status: 'online', value: 16, unit: 'CH', controllable: true, commands: ['CH8', 'CH16'], params: [['功率', '25W']] },
  { id: 'g-cnc-1', name: '中央控制台',      system: 'cnc', layer: 'pilot', anchor: [0.25, 0.55, 0.12], status: 'online', value: '主控', unit: '—', controllable: true, commands: ['解锁', '锁定'], params: [['通讯', '正常']] },
  { id: 'g-cnc-2', name: '机舱监测单元',    system: 'cnc', layer: 'engine_room', anchor: [-0.2, -0.35, 0.1], status: 'online', value: '待命', unit: '—', controllable: true, commands: ['确认告警'], params: [['组网', '正常']] },
  { id: 'g-hvac-1', name: '驾驶室空调机组', system: 'hvac', layer: 'pilot', anchor: [0.25, 0.45, 0.1], status: 'online', value: 24.5, unit: '℃', controllable: true, commands: ['温度+', '温度-'], params: [['设定', '24℃']] },
  { id: 'g-hvac-2', name: '机舱通风机组',   system: 'hvac', layer: 'engine_room', anchor: [-0.15, -0.32, 0.05], status: 'online', value: 1450, unit: 'rpm', controllable: true, commands: ['开启', '关闭'], params: [['风量', '中']] }
];
const GENERIC_CAMERAS = [
  { id: 'g-cam-1', name: '驾驶室监控',   system: 'cam', layer: 'pilot',       anchor: [0.25, 0.5, 0.0],  location: '驾驶台 / 操舵位', tone: 'steel' },
  { id: 'g-cam-2', name: '机舱监控',     system: 'cam', layer: 'engine_room', anchor: [-0.15, -0.3, 0.0], location: '主机 / 配电板区', tone: 'amber' },
  { id: 'g-cam-3', name: '船艏甲板摄像', system: 'cam', layer: 'main_deck',  anchor: [0.72, 0.2, 0.0],   location: '演示点位', tone: 'sea' },
  { id: 'g-cam-4', name: '船艉甲板摄像', system: 'cam', layer: 'main_deck',  anchor: [-0.72, 0.2, 0.0],  location: '演示点位', tone: 'sea' },
  { id: 'g-cam-5', name: '中央控制室监控', system: 'cam', layer: 'pilot',    anchor: [0.05, 0.4, 0.12],  location: '集控台 / 多屏', tone: 'violet' }
];

// js1300x 用现有的详细网点；其它船型用通用模板（同样按包围盒自动定位）
function devicesForBoat(boat) {
  if (boat && boat.shipId === 'js1300x') return { devices: DEVICES, cameras: CAMERAS };
  return { devices: GENERIC_DEVICES, cameras: GENERIC_CAMERAS };
}

export {
  STATUS_TEXT, SYSTEMS, LAYERS, DEVICES, CAMERAS, ALARMS, makeSeries, jitterScale,
  GENERIC_DEVICES, GENERIC_CAMERAS, devicesForBoat
};
