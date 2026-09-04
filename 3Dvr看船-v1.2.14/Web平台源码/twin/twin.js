import * as THREE from 'three'
import { TwinScene } from './twin-scene.js'
import { STATUS_TEXT, SYSTEMS, LAYERS, DEVICES, CAMERAS, ALARMS, makeSeries, jitterScale } from './twin-data.js'

const $ = id => document.getElementById(id)
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const state = {
  boat: null, scene: null, variants: {}, view: 'exterior',
  selected: null, systemFocus: 'all', layers: new Set(), rightTab: 'device', logs: []
}
const allDevices = [...DEVICES, ...CAMERAS]
const SYSTEM_META = Object.fromEntries(SYSTEMS.map(s => [s.id, s]))

// 每船数字孪生左侧 = twinConfig.systems 勾选的物理系统(排除发动机) + 智能大类
function twinLeftGroups() {
  const cfg = state.boat.twinConfig || {}
  const enabled = Array.isArray(cfg.systems) ? cfg.systems : ['fire', 'elec', 'nav', 'cam']
  const physical = enabled.filter(id => id !== 'engine' && SYSTEM_META[id]).map(id => ({
    kind: 'system', id, name: SYSTEM_META[id].name, color: SYSTEM_META[id].color
  }))
  const smart = smartCategories().map(cat => ({
    kind: 'smart', id: cat.id, name: cat.category, color: cat.color, option: cat.selected || cat.options[0]
  }))
  return [...physical, ...smart]
}

// 从「智能」配置板块解析大类：选项名以“大类 · 版本”组织，按“·”左边的词分组
function smartCategories() {
  const tabs = Array.isArray(state.boat.configTabs) ? state.boat.configTabs : []
  const smartTab = tabs.find(t => t.kind === 'accessory' || /智能/.test(t.label || ''))
  const opts = (smartTab && Array.isArray(smartTab.options)) ? smartTab.options : []
  const groups = {}
  const order = []
  const palette = ['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#f43f5e', '#06b6d4', '#8b5cf6', '#ef4444']
  opts.forEach(o => {
    const cat = String(o.name || '').split('·')[0].trim() || String(o.name || '智能')
    if (!groups[cat]) { groups[cat] = { id: 'smart-' + cat, category: cat, options: [], color: palette[order.length % palette.length] }; order.push(cat) }
    groups[cat].options.push(o)
  })
  const selected = (state.boat.twinConfig && state.boat.twinConfig.smart) || {}
  // 只显示用户已勾选（出现在 twin_config.smart 里）的大类；每个大类只是一个去重条目
  return order.filter(cat => selected[cat] || selected[cat] === '').map(cat => {
    const g = groups[cat]
    const pick = (selected && selected[cat]) || (g.options[0] && g.options[0].id)
    return { ...g, selected: g.options.find(o => o.id === pick) || g.options[0] }
  })
}

// 只把「勾选的物理系统」的设备/摄像头传给 3D（点位自动定位）
function twinDevicesData() {
  const cfg = state.boat.twinConfig || {}
  const enabled = Array.isArray(cfg.systems) ? cfg.systems : ['fire', 'elec', 'nav', 'cam']
  return DEVICES.filter(d => enabled.includes(d.system))
}
function twinCamerasData() {
  const cfg = state.boat.twinConfig || {}
  const enabled = Array.isArray(cfg.systems) ? cfg.systems : ['fire', 'elec', 'nav', 'cam']
  return enabled.includes('cam') ? CAMERAS : []
}

async function ensureAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (res.ok) { const json = await res.json(); if (json.success && json.data) return json.data }
  } catch {}
  location.href = 'login.html'
  throw new Error('未登录')
}

async function fetchBoat() {
  const params = new URLSearchParams(location.search)
  const shipId = params.get('boat') || 'js1300x'
  const res = await fetch('/api/boats', { credentials: 'same-origin' })
  const json = await res.json()
  const boat = (json.data || []).find(b => b.shipId === shipId) || (json.data || [])[0]
  if (!boat) throw new Error('未找到数孪船型')
  return boat
}

function twinVariant() {
  // 数字孪生始终使用「详细内饰」完整模型（含内饰/电气设备）
  return state.boat.variants.find(v => v.variantId === 'js1300x_interior') || state.boat.variants[0]
}

async function init() {
  try {
    await ensureAuth()
    state.boat = await fetchBoat()
    renderHeader(); renderKpis(); renderLegend(); renderSystemTree(); renderLayerFilters()
    bindViewSwitch(); bindRightTabs(); bindLogout(); bindConfirmDialog(); bindCameraOverlay()

    state.scene = new TwinScene($('twinViewport'), { onSelect: onMarkerSelect, onHover: onMarkerHover })
    state.scene.setDevices(twinDevicesData(), twinCamerasData())
    await loadModel()
    state.scene.start()
    setFilteredMarkers()
    renderRight()
    startLiveTicker()
    setInterval(() => renderSystemTree(), 8000)
    window.__twinReady = true
  } catch (error) { showError(error.message || error) }
}

async function loadModel() {
  const variant = twinVariant()
  const loading = $('modelLoading')
  if (loading) {
    loading.style.display = 'flex'; loading.style.opacity = '1'
    const s = loading.querySelector('span'); if (s) s.textContent = '正在加载船模与设备点位…'
  }
  try {
    await state.scene.loadBoat(variant, p => {
      const el = $('modelLoading'); const s = el && el.querySelector('span')
      if (s) s.textContent = '正在加载船模与设备点位… ' + Math.round(p * 100) + '%'
    })
    state.scene.setCameraMode('exterior')
    state.scene.applyPose(state.scene.mainPose('exterior'))
    state.scene.setMarkerScale(1.9)
    state.scene.setSystemFocus(state.systemFocus === 'all' ? null : state.systemFocus)
    if (loading) loading.style.display = 'none'
  } catch (error) {
    const s = loading && loading.querySelector('span')
    if (s) s.textContent = '模型加载失败：' + (error.message || error)
  }
}

// 船外/船内：同一完整模型，仅切换相机与材质（不重载模型）
function switchView(view) {
  if (view === state.view) return
  state.view = view
  state.scene.setCameraMode(view === 'interior' ? 'interior' : 'exterior')
  state.scene.applyPose(state.scene.mainPose(view))
  state.scene.setMarkerScale(view === 'interior' ? 0.35 : 1.9)
  state.scene.setSystemFocus(state.systemFocus === 'all' ? null : state.systemFocus)
}

function renderHeader() {
  const b = state.boat
  $('boatTitle').textContent = b.name || 'JS-1300X 铝合金智能消防艇'
  $('boatMeta').textContent = `${b.categoryName || '智能消防艇'} · 全长 ${b.length || 13} 米 · ${b.manufacturer || '京穗船舶'}`
}

function kpiData() {
  const total = allDevices.length
  const online = allDevices.filter(d => d.status === 'online').length
  const alarm = allDevices.filter(d => d.status === 'alarm').length
  const eng5 = DEVICES.find(d => d.id === 'eng-5')
  const eng6 = DEVICES.find(d => d.id === 'eng-6')
  return { total, online, alarm, fuel: eng5 ? eng5.value : 68, oil: eng6 ? eng6.value : 72, fuelRate: 42, range: 320, route: '外滩—横沙水道 巡航' }
}

function renderKpis() {
  const k = kpiData()
  $('kpiBar').innerHTML = `
    <div class="kpi"><span class="kpi-label">设备总数</span><span class="kpi-value">${k.total}</span></div>
    <div class="kpi"><span class="kpi-label">在线</span><span class="kpi-value kpi-ok">${k.online}</span></div>
    <div class="kpi"><span class="kpi-label">报警</span><span class="kpi-value kpi-warn">${k.alarm}</span></div>
    <div class="kpi"><span class="kpi-label">主机燃油</span><span class="kpi-value">${k.fuel}<small>%</small></span></div>
    <div class="kpi"><span class="kpi-label">机油量</span><span class="kpi-value">${k.oil}<small>%</small></span></div>
    <div class="kpi"><span class="kpi-label">油耗</span><span class="kpi-value">${k.fuelRate}<small>L/h</small></span></div>
    <div class="kpi"><span class="kpi-label">续航航程</span><span class="kpi-value">${k.range}<small>nm</small></span></div>
    <div class="kpi kpi-route"><span class="kpi-label">当前航线</span><span class="kpi-value">${esc(k.route)}</span></div>`
}

function renderLegend() {
  $('legend').innerHTML = SYSTEMS.map(s => `<span class="legend-item"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')
}

function renderSystemTree() {
  const tree = $('systemTree')
  const groups = twinLeftGroups()
  const devTotal = twinDevicesData().length
  const allActive = state.systemFocus === 'all' && !state.selected
  tree.innerHTML = `<button class="sys-row sys-all ${allActive ? 'active' : ''}" data-key="all"><i class="sys-dot" style="background:#94a3b8"></i><span>全部专业</span><span class="sys-count">${devTotal}</span></button>` +
    groups.map(g => {
      const open = state.systemFocus === g.id
      if (g.kind === 'system') {
        const devs = DEVICES.filter(d => d.system === g.id)
        const alarm = devs.filter(d => d.status === 'alarm').length
        return `<div class="sys-group"><button class="sys-row ${open ? 'active' : ''}" data-key="sys:${g.id}"><i class="sys-dot" style="background:${g.color}"></i><span>${esc(g.name)}</span><span class="sys-count">${devs.length}</span>${alarm ? `<span class="sys-alarm">${alarm}</span>` : ''}</button>${open ? `<div class="sys-devices">${devs.map(deviceRow).join('')}</div>` : ''}</div>`
      }
      const opt = g.option
      const selName = opt ? String(opt.name || '').split('·')[1] || opt.name || g.name : ''
      return `<div class="sys-group"><button class="sys-row ${open ? 'active' : ''}" data-key="smart:${g.id}"><i class="sys-dot" style="background:${g.color}"></i><span>${esc(g.name)}</span><span class="sys-count">1</span></button>${open ? `<div class="sys-devices"><button class="dev-row smart-sel" data-key="${g.id}"><span class="status-dot" style="background:${g.color}"></span><span>${esc(opt ? opt.name : '未配置')}</span><span class="dev-status">已选</span></button></div>` : ''}</div>`
    }).join('')
  tree.querySelectorAll('.sys-row').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.key
    if (key === 'all') {
      state.systemFocus = 'all'; state.selected = null
      state.scene.resetSystemFocus(); state.scene.setSystemFocus(null); state.scene.highlight(null)
      fadeView(() => state.scene.focusView('system', 'all', { dur: 0.7 }))
    } else if (key.indexOf('sys:') === 0) {
      const system = key.slice(4)
      state.systemFocus = system; state.selected = null; state.scene.setSystemFocus(system)
      fadeView(() => state.scene.focusView('system', system, { dur: 0.7 }))
    } else if (key.indexOf('smart:') === 0) {
      const gid = key.slice(6)
      state.systemFocus = gid; state.selected = { id: gid, name: gid.replace('smart-', ''), system: 'smart', kind: 'smart' }
      state.scene.resetSystemFocus(); state.scene.highlight(null)
    }
    renderSystemTree(); renderRight()
  }))
  tree.querySelectorAll('.dev-row[data-device]').forEach(row => row.addEventListener('click', () => onMarkerSelect(row.dataset.device)))
  tree.querySelectorAll('.smart-sel[data-key]').forEach(row => row.addEventListener('click', () => onSmartSelect(row.dataset.key)))
}

function deviceRow(d) {
  const color = d.status === 'alarm' ? '#ef4444' : d.status === 'offline' ? '#94a3b8' : '#22c55e'
  return `<button class="dev-row" data-device="${esc(d.id)}"><span class="status-dot" style="background:${color}"></span><span>${esc(d.name)}</span><span class="dev-status">${STATUS_TEXT[d.status] || ''}</span></button>`
}

function setFilteredMarkers() {
  state.scene.setFilters({ systems: [], layers: [...state.layers] })
  state.scene.setSystemFocus(state.systemFocus === 'all' ? null : state.systemFocus)
}

function renderLayerFilters() {
  const wrap = $('layerFilters')
  wrap.innerHTML = LAYERS.map(l => {
    const on = state.layers.size === 0 || state.layers.has(l.id)
    return `<label class="layer-item ${on ? 'on' : ''}"><input type="checkbox" value="${esc(l.id)}" ${on ? 'checked' : ''}><span>${esc(l.name)}</span></label>`
  }).join('')
  wrap.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    input.closest('.layer-item').classList.toggle('on', input.checked)
    if (input.checked) state.layers.add(input.value); else state.layers.delete(input.value)
    setFilteredMarkers()
    if (input.checked) fadeView(() => state.scene.focusView('layer', input.value, { dur: 0.7 }))
  }))
}

function onMarkerSelect(deviceId) {
  const device = allDevices.find(d => d.id === deviceId)
  if (!device) return
  state.selected = device; state.systemFocus = device.system
  state.scene.setSystemFocus(device.system); state.scene.highlight(deviceId)
  state.rightTab = 'device'
  document.querySelectorAll('.right-tabs button').forEach(b => b.classList.toggle('active', b.dataset.panel === 'device'))
  renderSystemTree(); renderRight()
}

function onMarkerHover(deviceId, e) {
  const tip = $('markerTooltip')
  if (!deviceId) { tip.hidden = true; return }
  const device = allDevices.find(d => d.id === deviceId)
  if (!device) { tip.hidden = true; return }
  const sys = SYSTEMS.find(s => s.id === device.system)
  tip.innerHTML = `<b>${esc(device.name)}</b><span>${esc(sys ? sys.name : '')} · ${STATUS_TEXT[device.status] || ''}</span>`
  tip.hidden = false
  const rect = $('twinViewport').getBoundingClientRect()
  tip.style.left = (e.clientX - rect.left + 14) + 'px'
  tip.style.top = (e.clientY - rect.top + 14) + 'px'
}

function bindRightTabs() {
  document.querySelectorAll('.right-tabs button').forEach(btn => btn.addEventListener('click', () => {
    state.rightTab = btn.dataset.panel
    document.querySelectorAll('.right-tabs button').forEach(b => b.classList.toggle('active', b === btn))
    renderRight()
  }))
}

function renderRight() {
  const c = $('rightContent')
  switch (state.rightTab) {
    case 'device': c.innerHTML = renderDevicePanel(); c.querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => onCommand(b.dataset.command))); break
    case 'curve': c.innerHTML = renderCurvePanel(); drawCurve($('rightContent')); break
    case 'alarm': c.innerHTML = renderAlarmPanel(); c.querySelectorAll('[data-alarm]').forEach(b => b.addEventListener('click', () => onAlarmClick(b.dataset.alarm))); break
    case 'camera': c.innerHTML = renderCameraPanel(); c.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => openCamera(b.dataset.cam))); break
    case 'energy': c.innerHTML = renderEnergyPanel(); drawCurve($('energyCurve')); break
    case 'report': c.innerHTML = renderReportPanel(); c.querySelectorAll('[data-report]').forEach(b => b.addEventListener('click', () => exportReport(b.dataset.report))); break
  }
  c.classList.remove('anim'); void c.offsetWidth; c.classList.add('anim')
}

function renderDevicePanel() {
  const d = state.selected
  if (!d) return `<div class="empty-panel"><b>发动机与动力</b><p>左主机 · 右主机 · 齿轮箱 · 舵机 · 燃油/机油/油耗/航程/航线</p></div>` + renderEngineCard()
  if (d.kind === 'smart') {
    const opt = d.option || {}
    return `<div class="dev-detail"><div class="dd-head"><span class="dd-sys" style="background:#38bdf8">智能系统</span><h3>${esc(d.name)}</h3><span class="dd-status">已选</span></div>
      <div class="dd-live"><span>当前方案</span><b>${esc(opt.name || '—')}</b></div>
      <div class="dd-params"><div class="dd-param"><span>说明</span><b>${esc(opt.description || '—')}</b></div></div>
      <div class="ctl-hint single">该大类为单选配置项，可在定制页修改。</div></div>`
  }
  const sys = SYSTEMS.find(s => s.id === d.system)
  const stColor = d.status === 'alarm' ? '#ef4444' : d.status === 'offline' ? '#94a3b8' : '#22c55e'
  return `<div class="dev-detail">
    <div class="dd-head"><span class="dd-sys" style="background:${sys ? sys.color : '#94a3b8'}">${esc(sys ? sys.name : '')}</span><h3>${esc(d.name)}</h3><span class="dd-status" style="color:${stColor}">● ${STATUS_TEXT[d.status] || ''}</span></div>
    <div class="dd-live"><span>实时值</span><b>${esc(d.value)}</b><small>${esc(d.unit || '')}</small></div>
    <div class="dd-params">${(d.params || []).map(p => `<div class="dd-param"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('')}</div>
    <div class="dd-actions">${d.controllable
      ? `<div class="dd-controls">${(d.commands || []).map(c => `<button class="ctl-btn" data-command="${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="ctl-hint">* 当前为模拟下发，正式上线将实际控制船载设备。</p>`
      : '<p class="ctl-hint single">该设备为只读监测项。</p>'}</div>
    <div class="dd-log">${renderLog()}</div>
  </div>`
}

function renderEngineCard() {
  const k = kpiData()
  return `<div class="engine-gauges">
    <div class="route-line"><span>发动机型号</span><b>${esc(engineModelName())}</b></div>
    <div class="gauge"><span>燃油</span><div class="bar"><i style="width:${k.fuel}%"></i></div><b>${k.fuel}%</b></div>
    <div class="gauge"><span>机油量</span><div class="bar"><i style="width:${k.oil}%"></i></div><b>${k.oil}%</b></div>
    <div class="gauge"><span>油耗</span><div class="bar"><i style="width:${Math.min(100, k.fuelRate)}%"></i></div><b>${k.fuelRate} L/h</b></div>
    <div class="gauge"><span>续航航程</span><div class="bar"><i style="width:${Math.min(100, (k.range / 500) * 100)}%"></i></div><b>${k.range} nm</b></div>
    <div class="route-line"><span>当前航线</span><b>${esc(k.route)}</b></div>
  </div>`
}

// 该船在「动力」板块选择的发动机型号（默认取第一个已选/第一个选项）
function engineModelName() {
  const tabs = Array.isArray(state.boat.configTabs) ? state.boat.configTabs : []
  const power = tabs.find(t => t.id === 'power' || /动力/.test(t.label || ''))
  const opts = (power && Array.isArray(power.options)) ? power.options : []
  if (opts.length) {
    const sel = opts.find(o => o.selected) || opts[0]
    return sel.name || ''
  }
  return '标准动力'
}

function onSmartSelect(gid) {
  const cat = smartCategories().find(c => c.id === gid)
  if (!cat) return
  state.selected = { id: gid, kind: 'smart', name: cat.category, option: cat.selected || cat.options[0] }
  renderRight()
}

function renderEngineGauges() {
  const k = kpiData()
  return `<div class="engine-gauges">
    <div class="gauge"><span>燃油</span><div class="bar"><i style="width:${k.fuel}%"></i></div><b>${k.fuel}%</b></div>
    <div class="gauge"><span>机油量</span><div class="bar"><i style="width:${k.oil}%"></i></div><b>${k.oil}%</b></div>
    <div class="gauge"><span>油耗</span><div class="bar"><i style="width:${Math.min(100, k.fuelRate)}%"></i></div><b>${k.fuelRate} L/h</b></div>
    <div class="gauge"><span>续航航程</span><div class="bar"><i style="width:${Math.min(100, (k.range / 500) * 100)}%"></i></div><b>${k.range} nm</b></div>
    <div class="route-line"><span>当前航线</span><b>${esc(k.route)}</b></div></div>`
}

function renderCurvePanel() {
  return `<div class="curve-panel"><div class="cp-toolbar"><span>左主机 24h 工况</span><span class="live-dot">LIVE</span></div><canvas id="curveCanvas" width="720" height="300"></canvas><div class="cp-legend"><span class="c-rpm">转速 rpm</span><span class="c-fuel">油耗 L/h</span><span class="c-temp">水温 ℃</span></div></div>`
}

function drawCurve(target) {
  const cv = target && target.querySelector ? target.querySelector('canvas') : target
  if (!cv || !cv.getContext) return
  const ctx = cv.getContext('2d'); const W = cv.width; const H = cv.height
  const data = makeSeries(24)
  ctx.clearRect(0, 0, W, H); ctx.font = '11px sans-serif'
  const pad = { l: 42, r: 14, t: 16, b: 26 }
  ctx.strokeStyle = 'rgba(148,163,184,0.18)'
  for (let i = 0; i <= 4; i++) { const y = pad.t + (H - pad.t - pad.b) * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke() }
  const xStep = (W - pad.l - pad.r) / (data.length - 1)
  const plot = (key, color, max) => { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((d, i) => { const x = pad.l + i * xStep; const y = pad.t + (H - pad.t - pad.b) * (1 - d[key] / max); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) }); ctx.stroke() }
  plot('rpm', '#38bdf8', 1800); plot('fuel', '#f59e0b', 70); plot('temp', '#ef4444', 100)
  ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'
  for (let i = 0; i < data.length; i += 6) ctx.fillText(data[i].time, pad.l + i * xStep, H - 8)
}

function renderAlarmPanel() {
  const total = ALARMS.length; const solved = ALARMS.filter(a => a.status === '处理中').length
  return `<div class="alarm-panel"><div class="ap-summary"><span>近期事件 <b>${total}</b></span><span>处理中 <b>${solved}</b></span><span>未处理 <b>${total - solved}</b></span></div>
    <div class="alarm-list">${ALARMS.map(a => `<button class="alarm-row" data-alarm="${esc(a.id)}" style="--c:${a.color}"><span class="alarm-time">${esc(a.time)}</span><span class="alarm-level" style="background:${a.color}">${esc(a.level)}</span><span class="alarm-msg"><b>${esc(a.device)}</b> · ${esc(a.message)}</span><span class="alarm-status">${esc(a.status)}</span></button>`).join('')}</div></div>`
}

function onAlarmClick(alarmId) {
  const a = ALARMS.find(x => x.id === alarmId); if (!a) return
  const device = DEVICES.find(d => d.name === a.device)
  if (device) onMarkerSelect(device.id)
}

function renderCameraPanel() {
  const main = CAMERAS.find(c => c.id === 'cam-5')
  return `<div class="camera-panel"><div class="cp2-title">控制室监控</div>${cameraTile(main)}
    <div class="cp2-title">船内摄像头</div><div class="cam-grid">${CAMERAS.filter(c => c.id !== 'cam-5').map(cameraTile).join('')}</div></div>`
}

function cameraTile(cam) {
  if (!cam) return ''
  return `<button class="cam-tile" data-cam="${esc(cam.id)}" style="--tone:var(--${cam.tone})"><div class="cam-feed"><span class="cam-live">LIVE</span><div class="cam-noise"></div></div><div class="cam-meta"><b>${esc(cam.name)}</b><span>${esc(cam.location)}</span></div></button>`
}

function renderEnergyPanel() {
  const k = kpiData()
  return `<div class="energy-panel"><div class="ep-title">能效与续航</div>
    <div class="ep-grid">
      <div class="ep-card"><span>燃油量</span><b>${k.fuel}%</b><div class="bar"><i style="width:${k.fuel}%"></i></div></div>
      <div class="ep-card"><span>机油量</span><b>${k.oil}%</b><div class="bar"><i style="width:${k.oil}%"></i></div></div>
      <div class="ep-card"><span>瞬时油耗</span><b>${k.fuelRate} L/h</b><div class="bar"><i style="width:${Math.min(100, k.fuelRate)}%"></i></div></div>
      <div class="ep-card"><span>续航航程</span><b>${k.range} nm</b><div class="bar"><i style="width:${Math.min(100, (k.range / 500) * 100)}%"></i></div></div>
    </div>
    <div class="ep-route"><span>当前航线</span><b>${esc(k.route)}</b></div>
    <div class="ep-title">燃油消耗曲线</div><canvas id="energyCurve" width="720" height="260"></canvas></div>`
}

function renderReportPanel() {
  return `<div class="report-panel"><div class="rp-title">报表导出</div><p class="rp-note">选择报表类型即可生成并下载（模拟数据）。</p>
    <div class="rp-list">
      <button class="rp-btn" data-report="alarm">报警事件报表<small>.csv</small></button>
      <button class="rp-btn" data-report="device">设备台账表<small>.csv</small></button>
      <button class="rp-btn" data-report="energy">能耗报表<small>.csv</small></button>
      <button class="rp-btn" data-report="camera">监控点位表<small>.csv</small></button>
    </div></div>`
}

function exportReport(kind) {
  let rows = [], name = ''
  if (kind === 'alarm') { name = '报警事件报表'; rows = [['事件编号', '时间', '级别', '设备', '来源', '描述', '状态']].concat(ALARMS.map(a => [a.id, a.time, a.level, a.device, a.source, a.message, a.status])) }
  else if (kind === 'device') { name = '设备台账'; rows = [['设备编号', '名称', '专业', '层级', '状态', '实时值', '单位']].concat(allDevices.map(d => { const sys = SYSTEMS.find(s => s.id === d.system); return [d.id, d.name, sys ? sys.name : '', d.layer, STATUS_TEXT[d.status], d.value, d.unit] })) }
  else if (kind === 'energy') { name = '能耗报表'; const k = kpiData(); rows = [['项目', '数值'], ['燃油量%', k.fuel], ['机油量%', k.oil], ['瞬时油耗L/h', k.fuelRate], ['续航航程nm', k.range], ['航线', k.route]] }
  else { name = '监控点位'; rows = [['点位编号', '名称', '位置', '层级']].concat(CAMERAS.map(c => [c.id, c.name, c.location, c.layer])) }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href)
  toast(`已生成《${name}》报表`)
}

function renderLog() {
  if (!state.logs.length) return '<div class="log-empty">暂无操作日志</div>'
  return state.logs.slice(-6).reverse().map(l => `<div class="op-log"><span>${esc(l.time)}</span>${esc(l.text)}</div>`).join('')
}

function onCommand(command) {
  const d = state.selected
  if (!d) return
  openConfirm(`确认向「${d.name}」下发指令「${command}」？`, () => {
    state.logs.push({ time: nowTime(), text: `下发「${command}」至「${d.name}」 —— 模拟执行成功` })
    toast(`已下发「${command}」，模拟执行中`, 'ok')
    $('rightContent').innerHTML = renderDevicePanel()
    $('rightContent').querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => onCommand(b.dataset.command)))
  })
}

function openConfirm(text, onOk) {
  const ov = $('confirmOverlay')
  ov.querySelector('.confirm-msg').textContent = text
  ov.onConfirm = onOk
  ov.classList.add('show')
}
function bindConfirmDialog() {
  const ov = $('confirmOverlay')
  ov.querySelector('[data-confirm-ok]').addEventListener('click', () => { if (ov.onConfirm) ov.onConfirm(); closeConfirm() })
  ov.querySelector('[data-confirm-no]').addEventListener('click', closeConfirm)
  ov.addEventListener('click', e => { if (e.target === ov) closeConfirm() })
}
function closeConfirm() { $('confirmOverlay').classList.remove('show') }

function openCamera(camId) {
  const cam = CAMERAS.find(c => c.id === camId); if (!cam) return
  const ov = $('cameraOverlay')
  ov.querySelector('.cam-title').textContent = cam.name + ' · ' + cam.location
  $('bigScreen').style.setProperty('--tone', `var(--${cam.tone})`)
  ov.classList.add('show')
}
function bindCameraOverlay() {
  $('closeCamera').addEventListener('click', () => $('cameraOverlay').classList.remove('show'))
  $('cameraOverlay').addEventListener('click', e => { if (e.target === $('cameraOverlay')) $('cameraOverlay').classList.remove('show') })
}

function bindViewSwitch() {
  document.querySelectorAll('.view-switch button').forEach(btn => btn.addEventListener('click', async () => {
    if (btn.dataset.view === state.view) return
    document.querySelectorAll('.view-switch button').forEach(b => b.classList.toggle('active', b === btn))
    fadeView(() => switchView(btn.dataset.view))
  }))
}

function bindLogout() {
  $('logoutBtn').addEventListener('click', async () => { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }) } catch {}; location.href = 'login.html' })
}

function startLiveTicker() {
  setInterval(() => {
    DEVICES.forEach(d => { if (typeof d.value === 'number' && d.status === 'online') d.value = Math.round(d.value * jitterScale() * 10) / 10 })
    renderKpis()
    if (state.rightTab === 'device' && state.selected) { const c = $('rightContent'); c.innerHTML = renderDevicePanel(); c.querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => onCommand(b.dataset.command))) }
  }, 3000)
}

function nowTime() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function toast(msg, kind = '') {
  const box = $('toastBox'); const el = document.createElement('div')
  el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el)
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000)
}
function showError(msg) {
  const loading = $('modelLoading'); const span = loading && loading.querySelector('span')
  if (span) span.textContent = '加载失败：' + msg
}
function fadeView(cb) {
  const f = $('viewFade'); if (!f) { cb(); return }
  f.classList.add('show')
  setTimeout(() => { try { cb() } finally { setTimeout(() => f.classList.remove('show'), 60) } }, 220)
}

document.addEventListener('DOMContentLoaded', init)
