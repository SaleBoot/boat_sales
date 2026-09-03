import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export default class Scene {
  constructor(container) {
    this.container = container

    // 创建 canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.display = 'block'
    container.appendChild(this.canvas)

    const width = container.clientWidth
    const height = container.clientHeight || Math.round(width * 10 / 16)

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // 色彩空间 + 色调映射:让颜色饱满通透,高光不过曝
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    // 纹理各向异性上限,用于模型纹理
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()

    // 场景
    this.scene = new THREE.Scene()
    // 环境反射:让船体金属/漆面有真实反射,告别塑料扁平感
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.loadBackground()

    // 相机
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    this.camera.position.set(5, 5, 10)
    this.cameraMode = 'exterior'

    // 控制器
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.target.set(0, 1, 0)
    this.controls.minDistance = 2
    this.controls.maxDistance = 20

    this.firstPersonEnabled = false
    this.firstPersonKeys = new Set()
    this.firstPersonYaw = 0
    this.firstPersonPitch = 0
    this.firstPersonMoveSpeed = 1
    this.firstPersonDragging = false
    this.firstPersonPointer = { x: 0, y: 0 }
    this._lastFrameTime = performance.now()
    this._onFirstPersonKeyDown = event => {
      if (!this.firstPersonEnabled || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return
      event.preventDefault()
      this.firstPersonKeys.add(event.code)
      this.updateFirstPersonMovement(.08)
    }
    this._onFirstPersonKeyUp = event => this.firstPersonKeys.delete(event.code)
    this._onFirstPersonPointerDown = event => {
      if (!this.firstPersonEnabled || event.button !== 0) return
      this.firstPersonDragging = true
      this.firstPersonPointer = { x: event.clientX, y: event.clientY }
      this.canvas.focus()
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(event.pointerId)
    }
    this._onFirstPersonPointerMove = event => {
      if (!this.firstPersonEnabled || !this.firstPersonDragging) return
      const dx = event.clientX - this.firstPersonPointer.x
      const dy = event.clientY - this.firstPersonPointer.y
      this.firstPersonPointer = { x: event.clientX, y: event.clientY }
      this.firstPersonYaw -= dx * .004
      this.firstPersonPitch = THREE.MathUtils.clamp(this.firstPersonPitch - dy * .004, -Math.PI * .48, Math.PI * .48)
      this.updateFirstPersonLook()
    }
    this._onFirstPersonPointerUp = () => { this.firstPersonDragging = false }
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('pointerdown', this._onFirstPersonPointerDown)
    window.addEventListener('pointermove', this._onFirstPersonPointerMove)
    window.addEventListener('pointerup', this._onFirstPersonPointerUp)
    window.addEventListener('keydown', this._onFirstPersonKeyDown)
    window.addEventListener('keyup', this._onFirstPersonKeyUp)

    this.setupLights()
    this.setupGround()
    this.setupFog()

    this._onResize = () => this.onResize()
    window.addEventListener('resize', this._onResize)
    this.animate()

    // 调试与远程验证用:暴露到 window,便于诊断模型是否居中,生产部署可删除
    window.__scene3dDebug = this
    window.__THREEDbg = THREE
  }

  destroy() {
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onFirstPersonPointerMove)
    window.removeEventListener('pointerup', this._onFirstPersonPointerUp)
    window.removeEventListener('keydown', this._onFirstPersonKeyDown)
    window.removeEventListener('keyup', this._onFirstPersonKeyUp)
    this.canvas.removeEventListener('pointerdown', this._onFirstPersonPointerDown)
    if (this._rafId) cancelAnimationFrame(this._rafId)
    if (this.groundMesh) {
      this.groundMesh.geometry && this.groundMesh.geometry.dispose && this.groundMesh.geometry.dispose()
      this.groundMesh.material && this.groundMesh.material.dispose && this.groundMesh.material.dispose()
    }
    this.renderer.dispose()
    this.controls.dispose()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
  }

  setupLights() {
    // 有了 scene.environment,环境光调低避免整体发灰过亮
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(5, 10, 7)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    // 阴影更聚焦,边缘更干净
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 50
    dirLight.shadow.camera.left = -10
    dirLight.shadow.camera.right = 10
    dirLight.shadow.camera.top = 10
    dirLight.shadow.camera.bottom = -10
    dirLight.shadow.bias = -0.0005
    this.scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5)
    fillLight.position.set(-5, 0, 5)
    this.scene.add(fillLight)
    const backLight = new THREE.DirectionalLight(0xffaa88, 0.3)
    backLight.position.set(0, 5, -10)
    this.scene.add(backLight)
  }

  setupGround() {
    // 只在船身下方的承接阴影:中心淡灰、快速淡出、边缘完全透明,不产生"整幅灰滤镜"影响左右栏色差
    // 半径设为 4.5(仅略大于船体最长方向),让地面阴影范围只在船底附近,画布其他区域是干净的纯白背景
    const radius = 4.5
    const segments = 96
    const geometry = new THREE.CircleGeometry(radius, segments)
    geometry.rotateX(-Math.PI / 2)

    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const ctx = c.getContext('2d')
    const grad = ctx.createRadialGradient(512, 512, 20, 512, 512, 512)
    // 5 段:中心更淡、衰减更快 → 外围 55% 就几乎透明,70% 完全透明
    grad.addColorStop(0.00, 'rgba(40, 44, 52, 0.13)')
    grad.addColorStop(0.18, 'rgba(40, 44, 52, 0.08)')
    grad.addColorStop(0.40, 'rgba(40, 44, 52, 0.035)')
    grad.addColorStop(0.60, 'rgba(40, 44, 52, 0.01)')
    grad.addColorStop(1.00, 'rgba(40, 44, 52, 0.00)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1024, 1024)

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.maxAnisotropy || 4

    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    })

    this.groundMesh = new THREE.Mesh(geometry, material)
    this.groundMesh.receiveShadow = true
    this.groundMesh.position.y = -0.05
    this.scene.add(this.groundMesh)
  }

  setupFog() {
    // 雾色=纯白,密度近乎 0:保证极远处淡出与页面白底完全一致,肉眼无任何色差
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.0015)
    this.renderer.setClearColor(0xffffff, 0)
  }

  loadBackground() {
    // 背景透明,透出外层 CSS 白底(与整站页面一致)
    this.scene.background = null
  }

  loadFBXFromFile(file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      const loader = new FBXLoader()
      const group = loader.parse(event.target.result, '')
      this.addModel(group)
    }
    reader.readAsArrayBuffer(file)
  }

  loadFBXFromUrl(url, onProgress) {
    return new Promise((resolve, reject) => {
      const manager = new THREE.LoadingManager()
      manager.setURLModifier((textureUrl) => {
        if (!textureUrl.toLowerCase().endsWith('.fbx')) {
          const filename = textureUrl.split(/[\\/]/).pop()
          return `/FBX/${filename}`
        }
        return textureUrl
      })
      // 纹理加载失败不阻塞模型显示,只警告
      manager.onError = (fileUrl) => console.warn('纹理资源未加载:', fileUrl)

      const loader = new FBXLoader(manager)
      let settled = false
      // 超时保护,避免无限转圈
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('模型加载超时(30s),请检查网络或文件大小'))
        }
      }, 30000)

      loader.load(
        url,
        (group) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          try {
            this.addModel(group)
            resolve(group)
          } catch (e) {
            reject(e)
          }
        },
        (xhr) => {
          if (xhr.lengthComputable && typeof onProgress === 'function') {
            onProgress(xhr.loaded / xhr.total)
          }
        },
        (err) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          reject(err)
        }
      )
    })
  }

  async loadVariant(variant, onProgress) {
    if (!variant || !Array.isArray(variant.modelFiles) || !variant.modelFiles.length) {
      throw new Error('该船型没有可用的网页模型文件')
    }
    let loadedBytes = 0
    const groups = []
    for (const modelUrl of variant.modelFiles) {
      const group = await this.loadModelObject(modelUrl, xhr => {
          if (xhr.lengthComputable && typeof onProgress === 'function') {
            onProgress(Math.min(.78, (loadedBytes + xhr.loaded) / Math.max(xhr.total * variant.modelFiles.length, 1) * .78))
          }
      })
      loadedBytes += 1
      groups.push(group)
    }
    const combined = new THREE.Group()
    groups.forEach(group => combined.add(group))
    await this.applyVariantMaterials(combined, variant, progress => {
      if (typeof onProgress === 'function') onProgress(.78 + progress * .22)
    })
    this.currentVariant = variant
    this.addModel(combined)
    return combined
  }

  loadModelObject(url, onProgress) {
    const lower = String(url || '').split('?')[0].toLowerCase()
    const manager = new THREE.LoadingManager()
    manager.onError = fileUrl => console.warn('模型资源未加载:', fileUrl)
    let loader
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) loader = new GLTFLoader(manager)
    else if (lower.endsWith('.obj')) loader = new OBJLoader(manager)
    else loader = new FBXLoader(manager)
    return new Promise((resolve, reject) => loader.load(url, result => resolve(result && result.scene ? result.scene : result), onProgress, reject))
  }

  async setAccessories(accessories = []) {
    this.clearAccessories()
    if (!this.currentModel || !Array.isArray(accessories)) return
    this.accessoryRoot = new THREE.Group()
    this.accessoryRoot.name = 'ConfiguredAccessories'
    this.currentModel.add(this.accessoryRoot)
    for (const asset of accessories) {
      if (!asset || !asset.modelUrl) continue
      try {
        const object = await this.loadModelObject(asset.modelUrl)
        const position = Array.isArray(asset.position) ? asset.position : [0, 0, 0]
        const rotation = Array.isArray(asset.rotation) ? asset.rotation : [0, 0, 0]
        const scale = Array.isArray(asset.scale) ? asset.scale : [1, 1, 1]
        object.position.set(Number(position[0]) || 0, Number(position[1]) || 0, Number(position[2]) || 0)
        object.rotation.set(THREE.MathUtils.degToRad(Number(rotation[0]) || 0), THREE.MathUtils.degToRad(Number(rotation[1]) || 0), THREE.MathUtils.degToRad(Number(rotation[2]) || 0))
        object.scale.set(Number(scale[0]) || 1, Number(scale[1]) || 1, Number(scale[2]) || 1)
        object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true } })
        this.accessoryRoot.add(object)
      } catch (error) { console.warn('配件模型加载失败:', asset.modelUrl, error) }
    }
  }

  clearAccessories() {
    if (!this.accessoryRoot) return
    this.accessoryRoot.traverse(child => {
      if (!child.isMesh) return
      if (child.geometry && child.geometry.dispose) child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.filter(Boolean).forEach(material => material.dispose && material.dispose())
    })
    if (this.accessoryRoot.parent) this.accessoryRoot.parent.remove(this.accessoryRoot)
    this.accessoryRoot = null
  }

  async applyVariantMaterials(group, variant, onProgress) {
    const materialNames = Array.isArray(variant.materialNames) ? variant.materialNames : []
    const materials = new Map()
    let finished = 0
    for (const name of materialNames) {
      materials.set(name.toLowerCase(), await this.createTexturedMaterial(variant.textureBaseUrl, name))
      finished += 1
      if (typeof onProgress === 'function') onProgress(finished / Math.max(materialNames.length, 1))
    }
    group.traverse(child => {
      if (!child.isMesh || !child.material) return
      const replace = source => {
        const key = String(source && source.name || '').toLowerCase().replace(/\s*\(instance\)$/,'')
        const exact = materials.get(key)
        if (exact) return exact.clone()
        const part = key.match(/mat_part\d+/)
        return part && materials.get(part[0]) ? materials.get(part[0]).clone() : source
      }
      child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material)
      if (child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv1) {
        child.geometry.setAttribute('uv1', child.geometry.attributes.uv)
      }
    })
    this.variantMaterials = materials
  }

  async createTexturedMaterial(baseUrl, name) {
    const textureLoader = new THREE.TextureLoader()
    const loadOptional = async suffix => {
      try {
        const texture = await textureLoader.loadAsync(`${baseUrl}/${name}_${suffix}.webp`)
        texture.flipY = true
        texture.anisotropy = this.maxAnisotropy || 4
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        return texture
      } catch { return null }
    }
    const [map, normalMap, aoMap, metallicMap] = await Promise.all([
      loadOptional('basecolor'), loadOptional('normal'), loadOptional('ao'), loadOptional('metallicsmoothness')
    ])
    if (map) map.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.MeshStandardMaterial({
      name,
      map,
      normalMap,
      aoMap,
      metalnessMap: metallicMap,
      metalness: metallicMap ? .42 : .12,
      roughness: .48,
      color: 0xffffff
    })
    material.userData.baseColor = '#ffffff'
    return material
  }

  setHullColor(hex, hullMaterialName = 'mat_part01') {
    if (!this.currentModel) return
    const target = String(hullMaterialName || 'mat_part01').toLowerCase()
    this.currentModel.traverse(child => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(material => {
        const name = String(material.name || '').toLowerCase()
        if (name.includes(target) && material.color) {
          material.color.set(hex || '#ffffff')
          material.needsUpdate = true
        }
      })
    })
  }

  addModel(group) {
    if (this.currentModel) {
      this.scene.remove(this.currentModel)
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          child.geometry && child.geometry.dispose && child.geometry.dispose()
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach(m => m.dispose && m.dispose())
          }
        }
      })
      this.currentModel = null
    }

    this.currentModel = group

    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 3 / maxDim
    group.scale.set(scale, scale, scale)
    group.position.set(-center.x * scale, -center.y * scale, -center.z * scale)

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // 处理 FBX 自带材质和纹理,提升渲染质量
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((mat) => {
          if (!mat) return
          // PBR 材质开启更真实的高光/反射
          if (mat.isMeshPhongMaterial || mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.envMapIntensity = 1.0
            if ('roughness' in mat) mat.roughness = Math.min(mat.roughness ?? 0.6, 0.8)
            if ('metalness' in mat) mat.metalness = mat.metalness ?? 0.1
          }
          // 遍历材质里的所有贴图,统一设置色彩空间 + 各向异性过滤
          const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap']
          maps.forEach((key) => {
            const tex = mat[key]
            if (tex && tex.isTexture) {
              if (tex.colorSpace === undefined || key === 'map' || key === 'emissiveMap') {
                tex.colorSpace = THREE.SRGBColorSpace
              } else {
                tex.colorSpace = THREE.LinearSRGBColorSpace
              }
              tex.anisotropy = this.maxAnisotropy
              tex.minFilter = THREE.LinearMipmapLinearFilter
              tex.magFilter = THREE.LinearFilter
              tex.needsUpdate = true
            }
          })
          mat.needsUpdate = true
        })
      }
    })

    this.scene.add(group)

    this.modelBounds = new THREE.Box3().setFromObject(group)
    this.modelSize = this.modelBounds.getSize(new THREE.Vector3())

    // 根据加载后的模型实际尺寸,同步调整展示底座的大小与位置,刚好承接船体阴影
    if (this.groundMesh && group) {
      const finalBox = new THREE.Box3().setFromObject(group)
      const finalSize = finalBox.getSize(new THREE.Vector3())
      const footprint = Math.max(finalSize.x, finalSize.z)
      const groundScale = Math.max(1.6, footprint * 1.1)
      this.groundMesh.scale.set(groundScale, 1, groundScale)
      this.groundMesh.position.y = Math.min(finalBox.min.y - 0.01, -0.01)
      this.groundMesh.visible = true
    }

    // 让模型严格位于画面正中心:按实际包围盒设置相机位置 + controls.target
    this.fitToView(group)
  }

  /**
   * 将相机视角自适应到正好能完整看到模型,模型位于画布正中央。
   * 模型加载后与窗口 resize 时都调用此函数,保证两套逻辑一致不漂移。
   * 链路:模型几何中心归一化 -> 控制器target=模型中心 -> 相机按fov/aspect自动后退距离
   */
  fitToView(object) {
    if (!object) return
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // 用包围球半径计算更稳妥:不会因为模型特别瘦长或扁平而出现裁剪
    const sphereRadius = Math.max(size.x, size.y, size.z) * 0.55
    const fov = this.camera.fov * (Math.PI / 180)
    const aspect = this.camera.aspect || (this.container.clientWidth / (this.container.clientHeight || this.container.clientWidth * 10 / 16))

    // 垂直方向需要的距离 = r / tan(fov/2);水平方向需考虑aspect,取较大值
    const distanceY = sphereRadius / Math.tan(fov / 2)
    const distanceX = sphereRadius * aspect / Math.tan(fov / 2)
    // 安全边距 1.10:默认打开更满更贴近参考车图比例
    const distance = Math.max(distanceX, distanceY) * 1.10

    // 固定的观察方向(略微右上方俯视):保证每个模型默认视角一致,中心对画布正中央
    const dir = new THREE.Vector3(1.15, 0.85, 1.5).normalize()
    this.camera.position.copy(center.clone().add(dir.multiplyScalar(distance)))
    this.camera.near = Math.max(0.01, distance / 100)
    this.camera.far = Math.max(200, distance * 20)
    this.camera.lookAt(center)
    this.camera.updateProjectionMatrix()

    // OrbitControls.target 严格对齐模型几何中心:任何旋转都围绕船转,船永远在画布中央
    this.controls.target.copy(center)

    // 缩放边界:允许更近放大到 0.30x,最远 2.8x
    this.controls.minDistance = distance * 0.30
    this.controls.maxDistance = distance * 2.8
    this.controls.update()
  }

  setCameraMode(mode = 'exterior') {
    this.cameraMode = mode === 'interior' ? 'interior' : 'exterior'
    this.container.dataset.cameraMode = this.cameraMode
    if (!this.currentModel) return
    this.setInteriorMaterialMode(this.cameraMode === 'interior')
    const savedPose = this.currentVariant && this.currentVariant.viewSettings && this.currentVariant.viewSettings[this.cameraMode]
    if (savedPose && Array.isArray(savedPose.position) && Array.isArray(savedPose.target)) {
      this.applyCameraPose(savedPose)
      return
    }
    if (this.cameraMode !== 'interior') {
      this.fitToView(this.currentModel)
      this._safeCameraPosition = this.camera.position.clone()
      this.container.dataset.cameraPosition = this.camera.position.toArray().map(value => value.toFixed(4)).join(',')
      return
    }
    const box = new THREE.Box3().setFromObject(this.currentModel)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const forward = Math.max(size.z, size.x) * .42
    const cameraHeight = center.y + Math.max(size.y * .08, .08)
    let directionName = String(this.currentVariant && this.currentVariant.viewSettings && this.currentVariant.viewSettings.bowDirection || 'auto').toLowerCase()
    if (directionName === 'auto') directionName = size.x >= size.z ? '+x' : '+z'
    const directions = { '+x': new THREE.Vector3(1, 0, 0), '-x': new THREE.Vector3(-1, 0, 0), '+z': new THREE.Vector3(0, 0, 1), '-z': new THREE.Vector3(0, 0, -1) }
    const bow = directions[directionName] || directions['-z']
    this.camera.position.copy(new THREE.Vector3(center.x, cameraHeight, center.z).add(bow.clone().multiplyScalar(-Math.max(Math.min(size.x, size.z) * .08, .05))))
    const target = new THREE.Vector3(center.x, cameraHeight, center.z).add(bow.clone().multiplyScalar(forward))
    this.camera.near = Math.max(.002, Math.min(.01, Math.max(size.x, size.y, size.z) / 1500))
    this.camera.far = Math.max(200, forward * 30)
    this.camera.lookAt(target)
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(target)
    this.controls.minDistance = .02
    this.controls.maxDistance = Math.max(size.x, size.y, size.z) * 1.2
    this.controls.update()
    this._safeCameraPosition = this.camera.position.clone()
    this.container.dataset.cameraPosition = this.camera.position.toArray().map(value => value.toFixed(4)).join(',')
  }

  setInteriorMaterialMode(enabled) {
    if (!this.currentModel) return
    this.currentModel.traverse(child => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(material => {
        if (!material) return
        if (material.userData.originalSide == null) material.userData.originalSide = material.side
        material.side = enabled ? THREE.DoubleSide : material.userData.originalSide
        material.needsUpdate = true
      })
    })
  }

  applyCameraPose(pose) {
    const position = new THREE.Vector3(...pose.position.map(Number))
    const target = new THREE.Vector3(...pose.target.map(Number))
    if (![position.x, position.y, position.z, target.x, target.y, target.z].every(Number.isFinite)) return
    this.camera.position.copy(position)
    this.camera.near = Math.max(.001, Math.min(1, Number(pose.near) || (this.cameraMode === 'interior' ? .005 : .01)))
    this.camera.far = 500
    this.camera.lookAt(target)
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(target)
    const distance = Math.max(position.distanceTo(target), .05)
    this.controls.minDistance = this.cameraMode === 'interior' ? Math.max(.015, distance * .08) : Math.max(.08, distance * .28)
    this.controls.maxDistance = this.cameraMode === 'interior' ? Math.max(distance * 2.5, .8) : Math.max(distance * 4, 8)
    this.controls.update()
    this._safeCameraPosition = this.camera.position.clone()
    this.container.dataset.cameraPosition = this.camera.position.toArray().map(value => value.toFixed(4)).join(',')
  }

  captureCameraPose() {
    return {
      position: this.camera.position.toArray().map(value => Number(value.toFixed(6))),
      target: this.controls.target.toArray().map(value => Number(value.toFixed(6))),
      near: Number(this.camera.near.toFixed(5))
    }
  }

  setFirstPersonNavigation(enabled) {
    this.firstPersonEnabled = Boolean(enabled)
    this.container.dataset.firstPersonNavigation = this.firstPersonEnabled ? 'enabled' : 'disabled'
    this.controls.enabled = !this.firstPersonEnabled
    this.firstPersonKeys.clear()
    this.firstPersonDragging = false
    this.canvas.style.cursor = this.firstPersonEnabled ? 'crosshair' : 'grab'
    if (!this.firstPersonEnabled) return
    const direction = this.controls.target.clone().sub(this.camera.position).normalize()
    this.firstPersonYaw = Math.atan2(direction.x, -direction.z)
    this.firstPersonPitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))
    if (this.currentModel) {
      const size = new THREE.Box3().setFromObject(this.currentModel).getSize(new THREE.Vector3())
      this.firstPersonMoveSpeed = Math.max(.2, Math.max(size.x, size.y, size.z) * .35)
    }
    this.updateFirstPersonLook()
    this.canvas.focus()
  }

  updateFirstPersonLook() {
    if (!this.firstPersonEnabled) return
    const cosPitch = Math.cos(this.firstPersonPitch)
    const forward = new THREE.Vector3(
      Math.sin(this.firstPersonYaw) * cosPitch,
      Math.sin(this.firstPersonPitch),
      -Math.cos(this.firstPersonYaw) * cosPitch
    ).normalize()
    const lookDistance = Math.max(this.camera.position.distanceTo(this.controls.target), 1)
    this.controls.target.copy(this.camera.position).add(forward.multiplyScalar(lookDistance))
    this.camera.lookAt(this.controls.target)
    this.camera.updateProjectionMatrix()
  }

  updateFirstPersonMovement(deltaSeconds) {
    if (!this.firstPersonEnabled || !this.firstPersonKeys.size) return
    const forward = new THREE.Vector3(Math.sin(this.firstPersonYaw), 0, -Math.cos(this.firstPersonYaw)).normalize()
    const right = new THREE.Vector3(Math.cos(this.firstPersonYaw), 0, Math.sin(this.firstPersonYaw)).normalize()
    const movement = new THREE.Vector3()
    if (this.firstPersonKeys.has('KeyW')) movement.add(forward)
    if (this.firstPersonKeys.has('KeyS')) movement.sub(forward)
    if (this.firstPersonKeys.has('KeyD')) movement.add(right)
    if (this.firstPersonKeys.has('KeyA')) movement.sub(right)
    if (this.firstPersonKeys.has('KeyE')) movement.y += 1
    if (this.firstPersonKeys.has('KeyQ')) movement.y -= 1
    if (!movement.lengthSq()) return
    movement.normalize().multiplyScalar(this.firstPersonMoveSpeed * Math.min(deltaSeconds, .05))
    this.camera.position.add(movement)
    this.controls.target.add(movement)
    this.camera.lookAt(this.controls.target)
    this.camera.updateProjectionMatrix()
    this.container.dataset.cameraPosition = this.camera.position.toArray().map(value => value.toFixed(4)).join(',')
  }

  enforceCameraCollision() {
    if (!this.currentModel || !this._safeCameraPosition) return
    const movement = this.camera.position.clone().sub(this._safeCameraPosition)
    const distance = movement.length()
    if (distance < .0005) return
    const ray = new THREE.Raycaster(this._safeCameraPosition, movement.clone().normalize(), .002, distance)
    const hit = ray.intersectObject(this.currentModel, true).find(item => item.distance < distance - .003)
    if (hit) {
      this.camera.position.copy(this._safeCameraPosition)
      this.controls.update()
    } else {
      this._safeCameraPosition.copy(this.camera.position)
    }
  }

  onResize() {
    const container = this.container
    if (!container) return
    const width = container.clientWidth
    const height = container.clientHeight || Math.round(width * 10 / 16)
    if (width < 1 || height < 1) return
    this.camera.aspect = width / height
    this.renderer.setSize(width, height, false)
    this.camera.updateProjectionMatrix()
  }

  animate() {
    this._rafId = requestAnimationFrame(() => this.animate())
    try {
      const now = performance.now()
      const deltaSeconds = Math.max(0, (now - this._lastFrameTime) / 1000)
      this._lastFrameTime = now
      this.updateFirstPersonMovement(deltaSeconds)
      this.controls.update()
      this.enforceCameraCollision()
      this.renderer.render(this.scene, this.camera)
    } catch (e) {
      console.error('渲染主循环异常:', e)
    }
  }

}
