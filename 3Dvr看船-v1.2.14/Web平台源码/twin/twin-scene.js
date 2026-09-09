import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
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
    this._bound = null
    this._setupSea()
    this._disableFreeOrbit()
    this.markers = new Map()
    this.markerMeshes = []
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = Infinity
    this._downPos = null
    this._hovered = null
    this._systemOn = {}
    this._layersOn = new Set()
    this._selectedId = null
    this._devicesRef = []
    this._camerasRef = []
    this._markerScale = 1
    this._fxGroup = null
    this._scanLight = null
    this._routeFlow = []
    this._fxStart = performance.now()

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
    c.enableRotate = true
    c.enableZoom = true
    c.enablePan = true
    c.enableDamping = false
    c.maxPolarAngle = Math.PI * .48
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
    this.geography?.setMode('ship')
    this.animateTo(this.focusPose(kind, id), opts.dur || 0.75, opts.done)
  }

  _setupSea() {
    this.inner.scene.background = null
    this.inner.scene.fog = null
    this._fog = null
    if (this.inner.groundMesh) this.inner.groundMesh.visible = false
  }

  _applyWater() {
    if (this._waterMesh) {
      this.inner.scene.remove(this._waterMesh)
      this._dispose(this._waterMesh)
    }
    const box = this._bound
    const normals = new THREE.TextureLoader().load('/twin/waternormals.jpg')
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    const water = new Water(new THREE.PlaneGeometry(180,180), {
      textureWidth:512, textureHeight:512, waterNormals:normals,
      sunDirection:new THREE.Vector3(-.4,.7,.5).normalize(),
      sunColor:0xc4ddf2, waterColor:0x063055, distortionScale:1.8, alpha:1
    })
    water.material.uniforms.size.value = 18
    water.material.transparent = true
    water.material.fragmentShader = water.material.fragmentShader.replace(
      'gl_FragColor = vec4( outgoingLight, alpha );',
      'gl_FragColor = vec4(outgoingLight, alpha * (1.0-smoothstep(35.0,85.0,length(worldPosition.xz))));'
    )
    water.rotation.x = -Math.PI/2
    water.position.y = box.min.y + (box.max.y-box.min.y)*.10
    this.inner.scene.add(water)
    this._waterMesh = water
    if (this.inner.groundMesh) this.inner.groundMesh.visible = false
  }

  async loadBoat(variant, onProgress) {
    await this.inner.loadVariant(variant, onProgress)
    this._bound = new THREE.Box3().setFromObject(this.inner.currentModel)
    this.inner.renderer.shadowMap.autoUpdate = false
    this.inner.renderer.shadowMap.needsUpdate = true
    this._applyWater()
    this._buildShipFx()
    this.refreshMarkers()
    return this.inner.currentModel
  }

  _buildShipFx() {
    if (this._fxGroup) {
      this.inner.scene.remove(this._fxGroup)
      this._dispose(this._fxGroup)
    }
    const box = this._bound
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const group = new THREE.Group()
    group.name = 'Ship Hologram FX'

    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x * 1.05, size.y * 1.12, size.z * 1.08)),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending })
    )
    shell.position.copy(center)
    group.add(shell)

    const ringMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
    for (const y of [box.min.y + size.y * 0.18, box.min.y + size.y * 0.5, box.max.y + size.y * 0.08]) {
      const curve = new THREE.EllipseCurve(0, 0, size.x * 0.62, size.z * 0.62, 0, Math.PI * 2)
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(96)), ringMat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(center.x, y, center.z)
      group.add(ring)
    }

    const gridMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })
    const grid = new THREE.GridHelper(maxDim * 1.65, 18, 0x38bdf8, 0x38bdf8)
    grid.material = gridMat
    grid.position.set(center.x, box.min.y + size.y * 0.08, center.z)
    group.add(grid)

    this._scanLight = new THREE.Mesh(
      new THREE.PlaneGeometry(size.x * 1.18, size.z * 1.18),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    this._scanLight.rotation.x = -Math.PI / 2
    this._scanLight.position.set(center.x, box.min.y, center.z)
    group.add(this._scanLight)

    this._routeFlow = []
    const routeMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
    for (let i = 0; i < 4; i++) {
      const z = center.z + (i - 1.5) * size.z * 0.22
      const y = box.min.y + size.y * (0.08 + i * 0.035)
      const pts = []
      for (let n = 0; n < 64; n++) {
        const k = n / 63
        pts.push(new THREE.Vector3(center.x - size.x * (0.78 - k * 1.56), y + Math.sin(k * Math.PI * 2) * size.y * 0.015, z + Math.sin(k * Math.PI * 3 + i) * size.z * 0.06))
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), routeMat.clone())
      line.userData.phase = i * 0.7
      this._routeFlow.push(line)
      group.add(line)
    }

    const particleCount = 48
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = center.x + (Math.random() - 0.5) * size.x * 1.35
      pos[i * 3 + 1] = box.min.y + size.y * (0.18 + Math.random() * 0.9)
      pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * size.z * 1.35
    }
    const particles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: 0xbae6fd, size: maxDim * 0.008, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    particles.name = 'Ship FX Particles'
    group.add(particles)

    this._fxGroup = group
    this.inner.scene.add(group)
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
      this.markers.set(device.id, { group, dot, baseDot: 1, baseRing: 1 })
      this.markerMeshes.push(dot)
    }
    this._applyFilters()
  }

  _dispose(obj) {
    obj.traverse(child => {
      if (child.isMesh || child.isLine || child.isPoints) {
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
      if (this._waterMesh) this._waterMesh.material.uniforms.time.value = performance.now() * .001
      this._animateShipFx()
      this._pulse()
      requestAnimationFrame(raf)
    }
    raf()
  }

  _animateShipFx() {
    if (!this._fxGroup || !this._bound) return
    const t = (performance.now() - this._fxStart) / 1000
    const size = this._bound.getSize(new THREE.Vector3())
    if (this._scanLight) {
      this._scanLight.position.y = this._bound.min.y + ((t * 0.28) % 1) * size.y * 1.15
      this._scanLight.material.opacity = 0.08 + Math.sin(t * 4) * 0.04
    }
    for (const line of this._routeFlow) {
      line.material.opacity = 0.3 + ((Math.sin(t * 2.4 + line.userData.phase) + 1) / 2) * 0.48
      line.position.x = Math.sin(t * 0.9 + line.userData.phase) * size.x * 0.025
    }
    const particles = this._fxGroup.getObjectByName('Ship FX Particles')
    if (particles) {
      particles.rotation.y = t * 0.08
      particles.material.opacity = 0.32 + Math.sin(t * 1.8) * 0.1
    }
  }

  setInterior(enabled) { this.inner.setInteriorMaterialMode(enabled) }
  setCameraMode(mode) {
    // 船内不施加海面远景雾，避免舱内发白
    this.inner.scene.fog = mode === 'interior' ? null : this._fog
    if (this._fxGroup) this._fxGroup.visible = mode !== 'interior'
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
