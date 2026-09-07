import * as THREE from 'three'
import Scene from '/js/Scene.js'
import { SYSTEMS, DEVICES, CAMERAS } from './twin-data.js'

const systemColor = id => {
  const sys = SYSTEMS.find(s => s.id === id)
  return sys ? sys.color : '#94a3b8'
}

/**
 * 数孪 3D 视图：复用现有 Scene（加载真实船模），叠加设备点位标记。
 * 设备点位按模型实际包围盒按比例换算，贴合任意尺寸船模。
 */
export class TwinScene {
  constructor(container, { onSelect, onHover } = {}) {
    this.container = container
    this.onSelect = onSelect
    this.onHover = onHover
    this.inner = new Scene(container)
    this._setupSea()
    this._disableFreeOrbit()
    this.markers = new Map()
    this.markerMeshes = []
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = 0.4
    this._downPos = null
    this._hovered = null
    this._bound = null
    this._systemOn = {}
    this._layersOn = new Set()
    this._selectedId = null
    this._devicesRef = []
    this._camerasRef = []
    this._markerScale = 1

    this._onPointerDown = e => { this._downPos = { x: e.clientX, y: e.clientY } }
    this._onPointerUp = e => this._handlePointerUp(e)
    this._onPointerMove = e => this._handlePointerMove(e)
    container.addEventListener('pointerdown', this._onPointerDown)
    container.addEventListener('pointerup', this._onPointerUp)
    container.addEventListener('pointermove', this._onPointerMove)
    this._pulseStart = performance.now()
    this._stop = false
  }

  // 只允许左侧按钮控制视角：关闭画布自由旋转/缩放/平移
  _disableFreeOrbit() {
    const c = this.inner.controls
    c.enableRotate = false
    c.enableZoom = false
    c.enablePan = false
    c.enableDamping = false
    c.enableZoom = false
  }

  _poseFromPoints(points, { distFactor = 2.5, pad = 0.25, dir = [0.7, 0.5, 1] } = {}) {
    const center = new THREE.Vector3()
    points.forEach(p => center.add(p))
    if (points.length) center.multiplyScalar(1 / points.length)
    let maxR = 0
    points.forEach(p => { maxR = Math.max(maxR, center.distanceTo(p)) })
    const radius = Math.max(maxR + pad, 0.25)
    const d = new THREE.Vector3(...dir).normalize()
    const pos = this._clampOutsideBox(center.clone().add(d.multiplyScalar(radius * distFactor)))
    pos.y += radius * 0.25
    return { position: pos.toArray(), target: center.toArray() }
  }

  // 确保相机始终落在船体包围盒外侧，避免穿入舱壁
  _clampOutsideBox(pos, margin = 0.12) {
    const b = this._bound
    if (!b) return pos
    const c = b.getCenter(new THREE.Vector3())
    const s = b.getSize(new THREE.Vector3())
    const half = new THREE.Vector3(s.x / 2 + margin, s.y / 2 + margin, s.z / 2 + margin)
    const rel = pos.clone().sub(c)
    const outside = t => {
      const p = c.clone().add(rel.clone().multiplyScalar(t))
      return Math.abs(p.x - c.x) > half.x || Math.abs(p.y - c.y) > half.y || Math.abs(p.z - c.z) > half.z
    }
    let t = 1
    let guard = 0
    while (!outside(t) && guard < 80) { t *= 1.12; guard++ }
    return c.clone().add(rel.multiplyScalar(t))
  }

  _allPoints() {
    return [...DEVICES, ...CAMERAS].map(d => this._anchorToWorld(d.anchor))
  }

  _systemPoints(systemId) {
    const list = [...DEVICES, ...CAMERAS].filter(d => d.system === systemId)
    return list.map(d => this._anchorToWorld(d.anchor))
  }

  _layerPoints(layerId) {
    const list = [...DEVICES, ...CAMERAS].filter(d => d.layer === layerId)
    return list.map(d => this._anchorToWorld(d.anchor))
  }

  exteriorPose() {
    const b = this._bound
    const c = b.getCenter(new THREE.Vector3())
    const s = b.getSize(new THREE.Vector3())
    const maxDim = Math.max(s.x, s.y, s.z)
    const d = new THREE.Vector3(0.7, 0.5, 1).normalize()
    const pos = c.clone().add(d.multiplyScalar(maxDim * 1.55))
    return { position: pos.toArray(), target: c.toArray() }
  }

  interiorPose() {
    // 绑定到「驾驶台/集控」视角：朝向中央控制台与仪表区（船内）
    const pts = this._layerPoints('pilot')
    const center = new THREE.Vector3()
    pts.forEach(p => center.add(p)); if (pts.length) center.multiplyScalar(1 / pts.length)
    const pos = center.clone().add(new THREE.Vector3(-0.42, 0.14, 0.22))
    return { position: pos.toArray(), target: center.toArray() }
  }

  mainPose(mode) {
    return mode === 'interior' ? this.interiorPose() : this.exteriorPose()
  }

  focusPose(kind, id) {
    if (id === 'all') return this.exteriorPose()
    const pts = kind === 'layer' ? this._layerPoints(id) : this._systemPoints(id)
    if (!pts.length) return this.exteriorPose()
    const b = this._bound
    const c = b.getCenter(new THREE.Vector3())
    const s = b.getSize(new THREE.Vector3())
    const maxDim = Math.max(s.x, s.y, s.z)
    const center = new THREE.Vector3()
    pts.forEach(p => center.add(p)); center.multiplyScalar(1 / pts.length)
    // 从船心指向该区域的水平方向（若重合则默认 +x）
    let dir = new THREE.Vector3(center.x - c.x, 0, center.z - c.z)
    if (dir.lengthSq() < 1e-4) dir = new THREE.Vector3(1, 0, 0)
    dir.normalize()
    const camPos = c.clone().add(dir.multiplyScalar(maxDim * 1.12))
    camPos.y = Math.min(b.max.y + 0.4, Math.max(center.y + maxDim * 0.18, c.y - maxDim * 0.1))
    return { position: camPos.toArray(), target: center.toArray() }
  }

  capturePose() {
    const cam = this.inner.camera; const ctl = this.inner.controls
    return { position: cam.position.toArray(), target: ctl.target.toArray() }
  }

  applyPose(pose) {
    if (!pose) return
    const cam = this.inner.camera; const ctl = this.inner.controls
    cam.position.set(...pose.position)
    ctl.target.set(...pose.target)
    cam.lookAt(ctl.target)
    ctl.update()
  }

  animateTo(pose, dur = 0.75, onDone) {
    if (!pose) { onDone && onDone(); return }
    const cam = this.inner.camera; const ctl = this.inner.controls
    if (this._tween) { cancelAnimationFrame(this._tween); this._tween = null }
    const p0 = cam.position.clone(); const t0 = ctl.target.clone()
    const p1 = new THREE.Vector3(...pose.position); const t1 = new THREE.Vector3(...pose.target)
    const start = performance.now()
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const step = () => {
      const k = (performance.now() - start) / (dur * 1000)
      const e = ease(Math.min(1, k))
      cam.position.lerpVectors(p0, p1, e)
      ctl.target.lerpVectors(t0, t1, e)
      cam.lookAt(ctl.target)
      ctl.update()
      if (k < 1) this._tween = requestAnimationFrame(step)
      else { this._tween = null; onDone && onDone() }
    }
    this._tween = requestAnimationFrame(step)
  }

  focusView(kind, id, opts = {}) {
    this.animateTo(this.focusPose(kind, id), opts.dur || 0.75, opts.done)
  }

  _setupSea() {
    const inner = this.inner
    // 天空 -> 海面 渐变背景
    const c = document.createElement('canvas')
    c.width = 8; c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#bfe6ff')
    g.addColorStop(0.42, '#e9f7ff')
    g.addColorStop(0.56, '#a7ddf0')
    g.addColorStop(1, '#2f86a8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 8, 256)
    const skyTex = new THREE.CanvasTexture(c)
    skyTex.colorSpace = THREE.SRGBColorSpace
    inner.scene.background = skyTex
    // 平静海面用淡雾，让远海自然淡出
    this._fog = new THREE.Fog(0xd3ecf7, 28, 120)
    inner.scene.fog = this._fog
    // 关掉默认的不透明底座，改用海面
    if (inner.groundMesh) inner.groundMesh.visible = false
  }

  _applyWater() {
    const inner = this.inner
    if (this._waterMesh) {
      inner.scene.remove(this._waterMesh)
      this._waterMesh.geometry.dispose()
      this._waterMesh.material.dispose()
      this._waterMesh = null
    }
    if (!inner.currentModel) return
    const box = new THREE.Box3().setFromObject(inner.currentModel)
    const geo = new THREE.PlaneGeometry(120, 120)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2490b0, roughness: 0.28, metalness: 0.02,
      transparent: true, opacity: 0.95
    })
    const water = new THREE.Mesh(geo, mat)
    water.rotation.x = -Math.PI / 2
    water.position.y = box.min.y + (box.max.y - box.min.y) * 0.03
    water.receiveShadow = true
    water.name = 'TwinWater'
    inner.scene.add(water)
    this._waterMesh = water
  }

  async loadBoat(variant, onProgress) {
    await this.inner.loadVariant(variant, onProgress)
    this._bound = new THREE.Box3().setFromObject(this.inner.currentModel)
    this._applyWater()
    this.refreshMarkers()
    return this.inner.currentModel
  }

  setDevices(devices, cameras) {
    this._devicesRef = devices || []
    this._camerasRef = cameras || []
  }

  _anchorToWorld(anchor) {
    const box = this._bound || new THREE.Box3()
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const lenAxis = size.x >= size.z ? 'x' : 'z'
    const beamAxis = lenAxis === 'x' ? 'z' : 'x'
    const pos = { x: center.x, y: center.y, z: center.z }
    pos[lenAxis] = center[lenAxis] + anchor[0] * (size[lenAxis] / 2)
    pos[beamAxis] = center[beamAxis] + anchor[2] * (size[beamAxis] / 2)
    pos.y = center.y + anchor[1] * (size.y / 2)
    return new THREE.Vector3(pos.x, pos.y, pos.z)
  }

  _makeMarker(device) {
    const group = new THREE.Group()
    const color = new THREE.Color(systemColor(device.system))
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 14, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    )
    dot.name = `dev-${device.id}`
    dot.userData.deviceId = device.id
    // 选中态外圈（相对缩放，跟随 group 整体缩放）
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.062, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    )
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    group.add(dot)
    group.add(ring)
    return { group, dot, baseDot: 1, baseRing: 1 }
  }

  refreshMarkers() {
    for (const { group } of this.markers.values()) {
      this.inner.scene.remove(group)
      this._dispose(group)
    }
    this.markers.clear()
    this.markerMeshes = []
    const list = [...this._devicesRef, ...this._camerasRef]
    for (const device of list) {
      const { group, dot } = this._makeMarker(device)
      group.position.copy(this._anchorToWorld(device.anchor))
      this.inner.scene.add(group)
      this.markers.set(device.id, { group, dot })
      this.markerMeshes.push(dot)
    }
    this._applyFilters()
  }

  _dispose(obj) {
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry && child.geometry.dispose && child.geometry.dispose()
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(m => m.dispose && m.dispose())
        }
      }
    })
  }

  setFilters({ systems, layers }) {
    this._systemOn = {}
    for (const id of (systems || [])) this._systemOn[id] = true
    this._layersOn = new Set(layers || [])
    this._applyFilters()
  }

  _applyFilters() {
    const list = [...this._devicesRef, ...this._camerasRef]
    for (const [id, { group }] of this.markers) {
      const dev = list.find(d => d.id === id)
      if (!dev) continue
      const sysOk = Object.keys(this._systemOn).length === 0 || !!(this._systemOn[dev.system])
      const layerOk = this._layersOn.size === 0 || this._layersOn.has(dev.layer)
      group.visible = sysOk && layerOk
    }
  }

  _applyMarkerScale() {
    const s = this._markerScale || 1
    for (const [, { group }] of this.markers) group.scale.setScalar(s)
  }

  setMarkerScale(scale) {
    this._markerScale = Number(scale) || 1
    this._applyMarkerScale()
  }

  highlight(deviceId) {
    this._selectedId = deviceId
    for (const [id, { dot, group, baseDot, baseRing }] of this.markers) {
      const sel = id === deviceId
      dot.scale.setScalar(sel ? baseDot * 1.6 : baseDot)
      dot.material.opacity = sel ? 1 : 0.9
      group.children[1].scale.setScalar(sel ? baseRing * 1.2 : baseRing)
      group.children[1].material.opacity = sel ? 0.9 : 0
      group.children[1].visible = sel
    }
  }

  setSystemFocus(systemId) {
    const list = [...this._devicesRef, ...this._camerasRef]
    for (const [id, { dot }] of this.markers) {
      const dev = list.find(d => d.id === id)
      const match = !systemId || (dev && dev.system === systemId)
      dot.material.opacity = match ? 1 : 0.18
    }
  }

  resetSystemFocus() {
    for (const [, { dot }] of this.markers) dot.material.opacity = 0.95
  }

  _pointerToRay(e) {
    const rect = this.container.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.inner.camera)
    return this.raycaster.intersectObjects(this.markerMeshes, false)
  }

  _handlePointerMove(e) {
    const hits = this._pointerToRay(e)
    const hit = hits.length ? hits[0].object.userData.deviceId : null
    if (hit !== this._hovered) {
      this._hovered = hit
      if (this.onHover) this.onHover(hit, e)
    }
  }

  _handlePointerUp(e) {
    if (!this._downPos) return
    const moved = Math.hypot(e.clientX - this._downPos.x, e.clientY - this._downPos.y)
    this._downPos = null
    if (moved > 5) return
    const hits = this._pointerToRay(e)
    if (hits.length && this.onSelect) this.onSelect(hits[0].object.userData.deviceId)
  }

  _pulse() {
    const t = (performance.now() - this._pulseStart) / 1000
    for (const [id, { group }] of this.markers) {
      if (!group.visible || id !== this._selectedId) continue
      const r = group.children[1]
      const s = 1.2 + Math.sin(t * 4) * 0.12
      r.scale.setScalar((this._markerScale || 1) * s)
      r.material.opacity = 0.5 + Math.sin(t * 4) * 0.18
    }
  }

  start() {
    const raf = () => {
      if (this._stop) return
      this._pulse()
      requestAnimationFrame(raf)
    }
    raf()
  }

  setInterior(enabled) { this.inner.setInteriorMaterialMode(enabled) }
  setCameraMode(mode) {
    // 船内不施加海面远景雾，避免舱内发白
    this.inner.scene.fog = mode === 'interior' ? null : this._fog
    this.inner.setCameraMode(mode)
  }

  destroy() {
    this._stop = true
    this.container.removeEventListener('pointerdown', this._onPointerDown)
    this.container.removeEventListener('pointerup', this._onPointerUp)
    this.container.removeEventListener('pointermove', this._onPointerMove)
    try { this.inner.destroy() } catch {}
  }
}
