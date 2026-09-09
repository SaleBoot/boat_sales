import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const ports = [
  { name: '大连港', lat: 38.92, lng: 121.65 }, { name: '天津港', lat: 38.99, lng: 117.78 },
  { name: '青岛港', lat: 36.07, lng: 120.38 }, { name: '上海港', lat: 31.23, lng: 121.5 },
  { name: '宁波舟山港', lat: 29.87, lng: 122.12 }, { name: '厦门港', lat: 24.48, lng: 118.08 },
  { name: '深圳港', lat: 22.55, lng: 114.05 }, { name: '广州港', lat: 23.1, lng: 113.45 }
]

const state = { boats: [], selected: null, mode: 'global', markers: new Map(), shipMeshes: [] }
const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x031426, 60, 240)
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(0, 42, 92)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
$('geoViewport').appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 26
controls.maxDistance = 160
controls.maxPolarAngle = Math.PI * 0.48
controls.target.set(0, 0, 0)

scene.add(new THREE.AmbientLight(0x8bd8ff, 1.2))
const sun = new THREE.DirectionalLight(0xffffff, 2.3)
sun.position.set(42, 76, 30)
scene.add(sun)

const root = new THREE.Group()
scene.add(root)

function stableHash(value) {
  let h = 2166136261
  for (const ch of String(value || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
function seeded(id) {
  let x = stableHash(id) || 1
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    return ((x >>> 0) % 10000) / 10000
  }
}
function geoToWorld(lat, lng, scale = 1) {
  return new THREE.Vector3((lng - 118) * 3.15 * scale, 0, -(lat - 29) * 3.55 * scale)
}
function boatPosition(boat) {
  const rand = seeded(boat.shipId || boat.id)
  const port = ports[Math.floor(rand() * ports.length)]
  return {
    port: port.name,
    lat: port.lat + (rand() - .5) * 1.35,
    lng: port.lng + (rand() - .5) * 1.65
  }
}
function makeTextTexture(text, width = 360, height = 96) {
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(3, 12, 24, .66)'
  roundRect(ctx, 10, 12, width - 20, height - 24, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(125, 211, 252, .5)'
  ctx.stroke()
  ctx.fillStyle = '#dff7ff'
  ctx.font = '600 28px sans-serif'
  ctx.fillText(text.slice(0, 14), 28, 58)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function makeOfflineChartTexture() {
  const c = document.createElement('canvas')
  c.width = 2048; c.height = 1024
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, c.height)
  g.addColorStop(0, '#04294b'); g.addColorStop(.48, '#075f86'); g.addColorStop(1, '#02182f')
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = 'rgba(151, 221, 240, .11)'; ctx.lineWidth = 1
  for (let x = 0; x < c.width; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke() }
  for (let y = 0; y < c.height; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke() }
  ctx.fillStyle = 'rgba(33, 105, 84, .88)'
  ctx.strokeStyle = 'rgba(177, 245, 222, .55)'
  ctx.lineWidth = 3
  const coast = [[920,20],[1020,70],[1120,90],[1215,155],[1328,190],[1420,270],[1510,370],[1568,492],[1510,610],[1412,650],[1320,714],[1246,840],[1160,944],[1055,990],[968,940],[996,820],[1080,740],[1120,610],[1088,500],[1002,410],[948,300],[884,220]]
  ctx.beginPath(); coast.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.lineTo(2048,1024); ctx.lineTo(2048,0); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = 'rgba(56, 189, 248, .62)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(820,230); ctx.bezierCurveTo(940,300,990,430,1110,500); ctx.bezierCurveTo(1240,570,1320,660,1450,820); ctx.stroke()
  ctx.strokeStyle = 'rgba(234, 179, 8, .55)'; ctx.lineWidth = 2
  for (const p of ports) {
    const v = geoToWorld(p.lat, p.lng, 12)
    const x = 1024 + v.x * 4.2, y = 512 + v.z * 2.2
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(234, 179, 8, .9)'; ctx.fill()
    ctx.fillStyle = 'rgba(219, 244, 255, .8)'; ctx.font = '24px sans-serif'; ctx.fillText(p.name, x + 14, y + 8)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return tex
}
function addBaseScene() {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 120, 80, 48),
    new THREE.MeshStandardMaterial({ map: makeOfflineChartTexture(), roughness: .7, metalness: .02 })
  )
  water.rotation.x = -Math.PI / 2
  root.add(water)

  const grid = new THREE.GridHelper(180, 24, 0x38bdf8, 0x166a8f)
  grid.material.transparent = true
  grid.material.opacity = .24
  grid.position.y = .03
  root.add(grid)

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(22, 96, 48),
    new THREE.MeshBasicMaterial({ color: 0x0a5d85, transparent: true, opacity: .22, side: THREE.BackSide })
  )
  glow.position.set(-56, 13, -28)
  root.add(glow)
}
function markerForBoat(boat) {
  const pos = boatPosition(boat)
  boat.__geo = pos
  const p = geoToWorld(pos.lat, pos.lng)
  const group = new THREE.Group()
  group.position.copy(p)
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(.55, 1.45, 3),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x075985, emissiveIntensity: .7, roughness: .45 })
  )
  body.rotation.x = Math.PI / 2
  group.add(body)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.18, 36),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .42, side: THREE.DoubleSide })
  )
  ring.rotation.x = -Math.PI / 2
  group.add(ring)
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeTextTexture(boat.name || boat.shipId), transparent: true }))
  label.position.set(0, 2.2, 0)
  label.scale.set(7.6, 2, 1)
  group.add(label)
  group.userData.boatId = boat.id
  root.add(group)
  state.markers.set(boat.id, group)
  state.shipMeshes.push(body)
}
function renderList() {
  const q = $('shipSearch').value.trim().toLowerCase()
  const rows = state.boats.filter(b => `${b.name} ${b.shipId} ${b.manufacturer} ${b.categoryName} ${b.typeName}`.toLowerCase().includes(q))
  $('fleetCount').textContent = `${rows.length} 艘`
  $('shipList').innerHTML = rows.map(b => `<button class="ship-row ${state.selected && state.selected.id === b.id ? 'active' : ''}" data-id="${b.id}">
    <b>${esc(b.name)}</b><span>${esc(b.shipId)} · ${esc(b.manufacturer || '')} · ${esc((b.categoryName || '') + ' / ' + (b.typeName || ''))}</span>
  </button>`).join('')
  document.querySelectorAll('.ship-row').forEach(btn => btn.onclick = () => selectBoat(Number(btn.dataset.id)))
}
function renderCard(boat) {
  const img = boat.sceneImage || boat.image || ''
  $('shipCard').hidden = false
  $('shipCard').innerHTML = `${img ? `<img src="${esc(img)}" alt="">` : ''}
    <div class="card-body">
      <h2>${esc(boat.name)}</h2>
      <div class="card-meta">
        <span>${esc(boat.shipId)}</span><span>${esc(boat.manufacturer || '')}</span>
        <span>${esc(boat.categoryName || '')}</span><span>${esc(boat.typeName || '')}</span><span>${esc(boat.__geo?.port || '近海')}</span>
      </div>
      <div class="card-actions">
        <a class="primary" href="/twin/?boat=${encodeURIComponent(boat.shipId)}">数字孪生看船</a>
        <a href="/detail.html?id=${encodeURIComponent(boat.id)}">查看船型</a>
      </div>
    </div>`
}
function selectBoat(id) {
  const boat = state.boats.find(b => Number(b.id) === Number(id))
  if (!boat) return
  state.selected = boat
  for (const [bid, marker] of state.markers) marker.scale.setScalar(Number(bid) === Number(id) ? 1.55 : 1)
  const marker = state.markers.get(boat.id)
  if (marker) {
    controls.target.copy(marker.position)
    camera.position.copy(marker.position).add(new THREE.Vector3(14, 14, 20))
  }
  renderCard(boat)
  renderList()
}
function setMode(mode) {
  state.mode = mode
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode))
  if (mode === 'global') { controls.target.set(0, 0, 0); camera.position.set(0, 48, 98) }
  if (mode === 'coast') { controls.target.set(14, 0, -4); camera.position.set(30, 40, 58) }
  if (mode === 'port') {
    const boat = state.selected || state.boats[0]
    if (boat) selectBoat(boat.id)
  }
}
async function loadBoats() {
  const res = await fetch('/api/boats')
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.message || '船舶数据加载失败')
  state.boats = (json.data || []).filter(b => b && b.shipId)
  state.boats.forEach(markerForBoat)
  renderList()
  const wanted = new URLSearchParams(location.search).get('boat')
  const current = state.boats.find(b => b.shipId === wanted) || state.boats[0]
  if (current) selectBoat(current.id)
}
function tick() {
  requestAnimationFrame(tick)
  const t = performance.now() * .001
  root.children.forEach(child => {
    if (child.type === 'GridHelper') child.position.y = .03 + Math.sin(t) * .015
  })
  for (const marker of state.markers.values()) marker.children[1].scale.setScalar(1 + Math.sin(t * 2.2 + marker.position.x) * .08)
  controls.update()
  renderer.render(scene, camera)
}
addBaseScene()
tick()
loadBoats().catch(err => {
  $('fleetCount').textContent = '加载失败'
  $('shipList').innerHTML = `<div class="ship-row"><b>${esc(err.message)}</b><span>请检查后端接口</span></div>`
})
document.querySelectorAll('.mode-btn').forEach(btn => btn.onclick = () => setMode(btn.dataset.mode))
$('shipSearch').addEventListener('input', renderList)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
