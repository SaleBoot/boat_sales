﻿import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader }     from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import { 
  updateOrthographicFrustum,
  createWaterSurface,
  focusVectorToArray, 
  normalizeDebugTransform,  
  getExteriorCameraDistance,
  scaleFocusDistance,
  getInteriorDeckPresets,
  getWaterTuning,
  mergeVectorPreset,
  mergeInteriorDeckPresets, 
  createReflectionEnvironmentScene,
  createInteriorSkySphere,
  getOrderFocusPresets,
  objectTransformToDebugPayload,
  applyDebugTransformToObject,
  degreesVectorToEuler, 
  getYawPitchFromCamera, 
  getPresetRotationValue,
  getOrbitViewDirectionFromRotation,
  getFirstPersonLookAnglesFromPreset,
  normalizeOrderFocusPreset,
  normalizeOrderFocusPresets,
  applyShaderTintMaterial,
  clearShaderTintMaterial,
  clearShaderTintTree ,
  applyPackedRmaoMaterial,
  applyDitherFadeMaterial,
} from '../../utils/utils_3js.js';

import { 
  normalizeMaterialName, 
  formatTransferSize,
  formatTransferSpeed,   
  getAssetDisplayLabel,
  getStaticAssetBaseUrl, 
  createInitialLoadingState,
  isStudioLookModel,
  getExteriorCameraPreset,
  normalizeCameraMode, 
  resolveRequestedFocusTarget,
  resolveAppliedFocusTarget,
  getColorShaderPreset,
  getColorConfigMaterialSlots,
  materialMatchesColorSlots,
  normalizeOptionalMaterialOverrides,
  materialMatchesOverrideSlots,
  shouldApplyColorway
} from '../../utils/utils_ship_scene.js';

import {
  WATER_SURFACE_ENABLED,
  EXTERIOR_STAGE_Y_OFFSET,
  EXTERIOR_TARGET_Y,
  EMPTY_ARRAY,
  DEFAULT_WATER_TUNING,
  UV_SET_ALPHA_MODE_OPAQUE,
  UV_SET_ALPHA_MODE_CUTOUT,
  UV_SET_ALPHA_MODE_BLEND,
  UV_SET_SIDE_FRONT,
  UV_SET_SIDE_DOUBLE,
  UV_SET_DEPTH_WRITE_ON,
  UV_SET_DEPTH_WRITE_OFF,
  UV_SET_DEPTH_TEST_ON,
  UV_SET_DEPTH_TEST_OFF,
  UV_SET_DITHER_MODE_ON,
  UV_SET_DITHER_MODE_OFF,
  CAMERA_MODE_ORBIT,
  CAMERA_MODE_FIRST_PERSON,
  FOCUS_COORDINATE_SPACE_SCENE,
  FOCUS_COORDINATE_SPACE_MODEL_LOCAL,
  DEFAULT_CAMERA_ROTATION_DEGREES,
  TWO_LAYER_TRACKED_TEXTURE_PATHS,
  MODEL_WATER_TUNING,
  DEFAULT_EXTERIOR_CAMERA_PRESET,
  STUDIO_EXTERIOR_CAMERA_PRESET,
  DEFAULT_INTERIOR_DECK_PRESETS,
  ENGINE_MODEL_LIBRARY,
  TEST_HIGH_INTERIOR_DECK_PRESETS
} from '../../constants/constants_ship_scene.js';



export default function ShipScene({
  modelConfig,
  focusTarget = 'exterior',
  focusTargetPresets = null,
  colorConfig = null,
  optionalMaterialOverrides = [],
  overviewZoomScale = 1,
  viewTogglePortalTarget = null,
  focusTargetStrategy = 'default',
  onFocusTargetChange = null,
  debugMode = false,
  debugTransformMode = 'translate',
  debugTransform = null,
  onDebugTransformChange = null
}) {
  const assetBaseUrl = getStaticAssetBaseUrl(
    import.meta.env.VITE_STATIC_ASSET_ORIGIN,
    import.meta.env.BASE_URL
  )
  const resolveAssetPath = (relativePath) => `${assetBaseUrl}${relativePath}`
  // 在 React 或前端项目中，它的核心任务是：确保无论传入什么样的资源路径（assetPath），
  // 最终都能拼凑出一个可以正常访问的完整 URL。
  const resolveManifestPath = (assetPath) => {
    if (!assetPath) {
      return ''
    }
    // 绝对地址检查（网络路径）
    // 正则表达式：^https?:\/\/ 匹配以 http:// 或 https:// 开头的字符串（不区分大小写）。
    // 逻辑：如果这个资源已经是完整的网络地址了（比如已经在 CDN 上或引用的是外部图片），那就原样返回，不要再折腾它。
    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath
    }

    // 
    if (assetPath.startsWith('/')) {
      // 为了拼接到 assetBaseUrl（通常以 / 结尾）后面，代码使用 slice(1) 删掉了 assetPath 开头的斜杠。
      return `${assetBaseUrl}${assetPath.slice(1)}`
    }

    return `${assetBaseUrl}${assetPath}`
  }

  // (1)modelConfig?.id ,,,先检查 modelConfig 是否存在（即不是 null 或 undefined）
  //       如果存在：继续读取 .id 的值。
  //       如果不存在：直接返回 undefined，而不会报错。
  // (2)?? —— 空值合并运算符 (Nullish Coalescing),作用：它会检查左侧的值。如果左侧是 null
  //      或 undefined，就返回右侧的值（这里是 ''）。
  const modelId = modelConfig?.id ?? ''
  // 
  const resolvedRequestedFocusTarget = resolveRequestedFocusTarget(modelId, focusTarget)
  const renderConfig = modelConfig?.renderConfig ?? {}
  const waterConfig = renderConfig?.water ?? {}
  const waterTuning = {
    ...getWaterTuning(modelId), // 默认配置,
    ...(waterConfig && typeof waterConfig === 'object' ? waterConfig : {}) // 用户配置
  }

  // 复合部件
  const compositeParts = modelConfig?.parts ?? EMPTY_ARRAY
  const hasCompositeParts = compositeParts.length > 0
  const shouldUseSinglePartCompositeFallback = !modelConfig?.model?.path && compositeParts.length === 1
  const effectiveModelConfig = shouldUseSinglePartCompositeFallback
    ? compositeParts[0]?.model ?? null
    : modelConfig?.model ?? null
  const effectiveUvSets = shouldUseSinglePartCompositeFallback
    ? compositeParts[0]?.uvSets ?? EMPTY_ARRAY
    : modelConfig?.uvSets ?? EMPTY_ARRAY
  const hasRenderableModel = Boolean(effectiveModelConfig?.path || hasCompositeParts)
  // 模型格式
  const modelFormat = (effectiveModelConfig?.format ?? 'glb').toLowerCase()
  const modelPath = effectiveModelConfig?.path
    ? resolveManifestPath(effectiveModelConfig.path)
    : ''
  // 是否是双层船
  const isTwoLayerBoat = modelId === 'TwoLayerBoat'
  // 是否是工作室模式;;默认的室外真实感渲染和工作室风格的预览渲染。
  // `studioLook` 是一个布尔配置，用于在两种渲染模式之间切换：**默认的室外真实感渲染**和**工作室风格的预览渲染**。
  // `studioLook` 是一个用于启用“工作室模式”的开关。这个模式旨在提供一个干净、中性的背景和
  //          优化的灯光，以便更好地展示和预览3D模型，而不是模拟其在真实世界水域中的样子。这
  //          对于模型审查、材质调整或在产品目录中生成标准化预览图等场景非常有用。
  // 当 `isStudioLook` 为 `true` 时，会发生以下变化：
  // *   **隐藏水面**: `shouldShowWaterSurface` 会变为 `false`，水面将不可见。
  // *   **调整相机**: 内部相机的近裁剪面 (`near`) 会被调整，可能是为了适应不同的模型尺寸或避免在近距离观察时出现裁剪问题。
  // *   **改变灯光和颜色**:
  //     *   环境光 (`ambientLight`) 和半球光 (`hemisphereLight`) 的颜色会改变，
  //                      工作室风格的光照颜色更偏向中性或冷色调（例如，`#dde8f6`）。
  //     *   主光源 (`keyLight`) 的颜色、强度和位置都会改变，以模拟工作室的布光效果。
  //     *   补光 (`fillLight`) 的颜色和强度也会调整。
  // *   **调整色调映射**: `renderer.toneMappingExposure` 的值会改变，这会影响最终画面的亮度和对比度。
  // *   **UI/DOM 样式变化**:
  //     *   `canvas-view-toggle` 和 `scene-shell` 的 CSS 类名会添加 `-studio` 后缀，这表明 UI 可能会有不同的外观或布局。
  //     *   在 `viewToggleClassName` 和 `scene-shell` 的类名中，`isStudioLook` 用于
  //         动态添加 CSS 类，这表明工作室模式下可能会有不同的 UI 样式。
  const isStudioLook = typeof renderConfig.studioLook === 'boolean'
    ? renderConfig.studioLook
    : isStudioLookModel(modelId)
  // 外部相机预设
  const baseExteriorCameraPreset = mergeVectorPreset(getExteriorCameraPreset(modelId), renderConfig.exteriorCamera)
  const exteriorCameraPreset = {
    ...baseExteriorCameraPreset,
    zoom: baseExteriorCameraPreset.zoom * overviewZoomScale
  }
  const interiorDeckPresetConfig = mergeInteriorDeckPresets(getInteriorDeckPresets(modelId), 
                                                            renderConfig.interiorDecks)
  const directConsolePreset = useMemo(() => {
    const rawPreset = focusTargetPresets?.console
    if (!rawPreset || typeof rawPreset !== 'object') {
      return null
    }

    return normalizeOrderFocusPreset(rawPreset, {
      type: 'interior',
      cameraMode: CAMERA_MODE_FIRST_PERSON,
      deck: '1'
    })
  }, [focusTargetPresets])

  const directSmartSystemPreset = useMemo(() => {
    const rawPreset = focusTargetPresets?.['smart-system']
    if (!rawPreset || typeof rawPreset !== 'object') {
      return null
    }

    return normalizeOrderFocusPreset(rawPreset, {
      type: 'interior',
      cameraMode: CAMERA_MODE_FIRST_PERSON,
      deck: '1'
    })
  }, [focusTargetPresets])

  const stabilizedSmartSystemPreset = useMemo(() => {
    if (!directSmartSystemPreset) {
      return null
    }

    if (
      modelId !== 'TestHigh' ||
      directSmartSystemPreset.cameraMode !== CAMERA_MODE_FIRST_PERSON ||
      !directConsolePreset
    ) {
      return directSmartSystemPreset
    }

    const nextTarget = [...directSmartSystemPreset.target]
    if (nextTarget[0] > 0) {
      nextTarget[0] = directConsolePreset.target[0]
    }

    return {
      ...directSmartSystemPreset,
      target: nextTarget
    }
  }, [directConsolePreset, directSmartSystemPreset, modelId])

  const resolvedOrderFocusPresets = useMemo(() => {
    const baseOrderFocusPresets = normalizeOrderFocusPresets(getOrderFocusPresets(modelId), renderConfig.focusTargets)
    const exteriorFallbackDistance = getExteriorCameraDistance(exteriorCameraPreset)
    const orderFocusPresets = {
      ...baseOrderFocusPresets,
      exterior: {
        ...baseOrderFocusPresets.exterior,
        zoom: scaleFocusDistance(baseOrderFocusPresets.exterior?.zoom ?? exteriorFallbackDistance, overviewZoomScale)
      },
      overview: {
        ...(baseOrderFocusPresets.overview ?? baseOrderFocusPresets.exterior),
        zoom: scaleFocusDistance(baseOrderFocusPresets.overview?.zoom ?? exteriorFallbackDistance, overviewZoomScale)
      }
    }

    return normalizeOrderFocusPresets(orderFocusPresets, focusTargetPresets)
  }, [modelId, overviewZoomScale, exteriorCameraPreset, focusTargetPresets, renderConfig.focusTargets])
  
  const shouldShowWaterSurface = (waterConfig.enabled ?? WATER_SURFACE_ENABLED) && !isStudioLook
  // ===== TwoLayerBoat Locked Block START =====
  // TwoLayerBoat 维持固定 GLB 入口，避免被自动配置改动影响贴图稳定性。
  const effectiveModelPath = isTwoLayerBoat
    ? resolveAssetPath('gltf/TwoLayerBoat/TwoLayerBoat.glb')
    : modelPath
  const effectiveModelFormat = isTwoLayerBoat ? 'glb' : modelFormat
  // ===== TwoLayerBoat Locked Block END =====
  const uvSets = effectiveUvSets

  const canvasRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const modeRef = useRef('exterior')
  const interiorDeckRef = useRef('1')
  const setViewPresetRef = useRef(() => {})
  const setFocusTargetRef = useRef(() => {})
  const setColorConfigRef = useRef(() => {})
  const setOptionalMaterialOverridesRef = useRef(() => {})
  const resolvedOrderFocusPresetsRef = useRef(resolvedOrderFocusPresets)
  const optionalMaterialOverridesRef = useRef(optionalMaterialOverrides)
  const loadedRootRef = useRef(null)
  const focusCoordinateRootRef = useRef(null)
  const activeFocusTargetRef = useRef(resolvedRequestedFocusTarget)
  const transformControlsRef = useRef(null)
  const debugModeRef = useRef(debugMode)
  const debugTransformModeRef = useRef(debugTransformMode)
  const onDebugTransformChangeRef = useRef(onDebugTransformChange)
  const loadingOverlayTimerRef = useRef(null)
  // ---- 场景状态管理 ----
  const [activeView, setActiveView] = useState('exterior')
  const [activeFocusTarget, setActiveFocusTarget] = useState(resolvedRequestedFocusTarget)
  const [activeDeck, setActiveDeck] = useState('1')
  const [isSceneLoading, setIsSceneLoading] = useState(true)
  const [loadingState, setLoadingState] = useState(() => createInitialLoadingState(hasRenderableModel))
  const [isLoadingHudVisible, setIsLoadingHudVisible] = useState(true)
  const [sceneError, setSceneError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    if (!hasRenderableModel) {
      setIsSceneLoading(true)
      setSceneError('')
      setLoadingState(createInitialLoadingState(false))
      setIsLoadingHudVisible(true)
      return undefined
    }

    let isDisposed = false
    if (loadingOverlayTimerRef.current) {
      window.clearTimeout(loadingOverlayTimerRef.current)
      loadingOverlayTimerRef.current = null
    }
    setIsSceneLoading(true)
    setSceneError('')
    setIsLoadingHudVisible(true)
    const abortController = new AbortController()

    const scene = new THREE.Scene()
    const presentationRoot = new THREE.Group()
    const modelRoot = new THREE.Group()
    const waterRoot = new THREE.Group()
    const stageRoot = new THREE.Group()
    const waterSurface = shouldShowWaterSurface ? createWaterSurface() : null
    const interiorSkySphere = createInteriorSkySphere()
    scene.add(presentationRoot)
    presentationRoot.add(stageRoot, waterRoot, modelRoot)
    if (interiorSkySphere) {
      scene.add(interiorSkySphere.mesh)
    }
    
    // 外部相机（正交）：用于外部环绕观察，提供无透视失真的产品展示视图，类似于工程蓝图。
    const exteriorCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.005, 5000)
    // 内部相机（透视）：用于内部第一人称漫游，提供具有深度感的真实沉浸式体验。
    const interiorCamera = new THREE.PerspectiveCamera(56, 1, isStudioLook ? 0.02 : 0.005, 5000)
    exteriorCamera.position.set(...exteriorCameraPreset.position)
    exteriorCamera.zoom = exteriorCameraPreset.zoom
    interiorCamera.position.set(...(interiorDeckPresetConfig['1']?.position ?? [0, 0.68, -0.82]))
    scene.add(exteriorCamera, interiorCamera)

    let activeCamera = exteriorCamera
    cameraRef.current = activeCamera

    const ambientLight = new THREE.HemisphereLight(
      new THREE.Color(isStudioLook ? '#dde8f6' : '#bfd9f2'),
      new THREE.Color(isStudioLook ? '#32251c' : '#52606c'),
      isStudioLook ? 0.62 : 1.02
    )
    const keyLight = new THREE.DirectionalLight(
      new THREE.Color(isStudioLook ? '#fff1de' : '#ffd7ab'),
      isStudioLook ? 2.05 : 1.18
    )
    keyLight.position.set(...(isStudioLook ? [5.4, 3.5, 4.8] : [6.8, 4.6, 2.2]))
    keyLight.target = modelRoot
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.bias = -0.0002
    keyLight.shadow.normalBias = 0.03
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 24
    keyLight.shadow.camera.left = -8
    keyLight.shadow.camera.right = 8
    keyLight.shadow.camera.top = 8
    keyLight.shadow.camera.bottom = -8
    const underGlowLight = new THREE.PointLight(
      new THREE.Color(isStudioLook ? '#72f6ff' : '#ffffff'),
      isStudioLook ? 0 : 0,
      10,
      2
    )
    underGlowLight.position.set(0.2, -0.55, 1.1)
    scene.add(ambientLight, keyLight, underGlowLight)

    if (waterSurface) {
      waterRoot.add(waterSurface.mesh)
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor('#010203', 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = isStudioLook ? 0.92 : 0.94
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const reflectionEnvironment = createReflectionEnvironmentScene()
    const environmentTexture = pmremGenerator.fromScene(reflectionEnvironment.scene, 0.02).texture
    scene.environment = environmentTexture

    const controls = new OrbitControls(exteriorCamera, canvas)
    controls.enableDamping = true
    controls.enablePan = false
    controls.enableZoom = false
    controls.target.set(0, exteriorCameraPreset.targetY, 0)
    controls.update()
    controlsRef.current = controls

    let transformControls = null
    const syncTransformControls = () => {
      if (!transformControls) {
        return
      }

      const shouldAttach = debugModeRef.current && modeRef.current === 'exterior' && Boolean(loadedRootRef.current)
      transformControls.setMode(debugTransformModeRef.current === 'rotate' ? 'rotate' : 'translate')
      transformControls.enabled = shouldAttach
      transformControls.visible = shouldAttach
      if (shouldAttach) {
        if (transformControls.object !== loadedRootRef.current) {
          transformControls.attach(loadedRootRef.current)
        }
      } else {
        transformControls.detach()
      }
    }

    if (typeof onDebugTransformChangeRef.current === 'function') {
      transformControls = new TransformControls(exteriorCamera, canvas)
      transformControls.enabled = false
      transformControls.visible = false
      transformControls.setMode(debugTransformModeRef.current === 'rotate' ? 'rotate' : 'translate')
      transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value && modeRef.current === 'exterior'
      })
      transformControls.addEventListener('objectChange', () => {
        if (typeof onDebugTransformChangeRef.current === 'function') {
          onDebugTransformChangeRef.current(objectTransformToDebugPayload(loadedRootRef.current))
        }
      })
      scene.add(transformControls)
      transformControlsRef.current = transformControls
    }

    const interiorPose = {
      position: new THREE.Vector3(...(interiorDeckPresetConfig['1']?.position ?? [0, 0.68, -0.82])),
      yaw: 0,
      pitch: 0,
      dragging: false,
      lastX: 0,
      lastY: 0,
      keys: new Set(),
      cameraMode: CAMERA_MODE_FIRST_PERSON
    }

    const interiorLookDirection = new THREE.Vector3()
    const interiorLookTarget = new THREE.Vector3()

    const updateInteriorOrientation = () => {
      interiorLookDirection.set(
        Math.sin(interiorPose.yaw) * Math.cos(interiorPose.pitch),
        Math.sin(interiorPose.pitch),
        Math.cos(interiorPose.yaw) * Math.cos(interiorPose.pitch)
      )
      interiorLookTarget.copy(interiorPose.position).add(interiorLookDirection)
      interiorCamera.position.copy(interiorPose.position)
      interiorCamera.lookAt(interiorLookTarget)
      interiorCamera.updateProjectionMatrix()
    }

    const applyFirstPersonRotation = (rotationValue) => {
      interiorCamera.rotation.copy(degreesVectorToEuler(rotationValue))
      const lookAngles = getYawPitchFromCamera(interiorCamera)
      interiorPose.yaw = lookAngles.yaw
      interiorPose.pitch = lookAngles.pitch
      interiorCamera.updateProjectionMatrix()
    }

    const toSceneFocusCoordinate = (value, coordinateSpace = FOCUS_COORDINATE_SPACE_SCENE) => {
      const vector = value?.isVector3 ? value.clone() : new THREE.Vector3(...focusVectorToArray(value))
      if (coordinateSpace !== FOCUS_COORDINATE_SPACE_MODEL_LOCAL) {
        return vector
      }

      const coordinateRoot = focusCoordinateRootRef.current
      if (!coordinateRoot) {
        return vector
      }

      return coordinateRoot.localToWorld(vector)
    }

    const applyFirstPersonCameraPreset = (preset, deckPreset) => {
      const deckPosition = [deckPreset.position.x, deckPreset.position.y, deckPreset.position.z]
      const cameraPosition = toSceneFocusCoordinate(
        preset?.target ?? preset?.position ?? deckPosition,
        preset?.coordinateSpace
      )
      const rotationPreset = getPresetRotationValue(preset)
      interiorPose.position.copy(cameraPosition)
      interiorCamera.position.copy(cameraPosition)
      if (rotationPreset) {
        applyFirstPersonRotation(rotationPreset)
      } else {
        const lookAngles = getFirstPersonLookAnglesFromPreset(preset, deckPreset.yaw, deckPreset.pitch)
        interiorPose.yaw = Number.isFinite(Number(preset?.yaw)) ? Number(preset.yaw) : lookAngles.yaw
        interiorPose.pitch = Number.isFinite(Number(preset?.pitch)) ? Number(preset.pitch) : lookAngles.pitch
        updateInteriorOrientation()
      }
    }

    const updateFirstPersonMovement = (deltaSeconds) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON || interiorPose.keys.size === 0) {
        return
      }

      const forward = new THREE.Vector3(Math.sin(interiorPose.yaw), 0, Math.cos(interiorPose.yaw)).normalize()
      const movement = new THREE.Vector3()
      if (interiorPose.keys.has('KeyW') || interiorPose.keys.has('ArrowUp')) {
        movement.add(forward)
      }
      if (interiorPose.keys.has('KeyS') || interiorPose.keys.has('ArrowDown')) {
        movement.sub(forward)
      }
      if (movement.lengthSq() <= 0) {
        return
      }

      movement.normalize().multiplyScalar(deltaSeconds * 1.8)
      interiorPose.position.add(movement)
      updateInteriorOrientation()
    }

    const onPointerDown = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON) {
        return
      }

      interiorPose.dragging = true
      interiorPose.lastX = event.clientX
      interiorPose.lastY = event.clientY
    }

    const onPointerMove = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON || !interiorPose.dragging) {
        return
      }

      const deltaX = event.clientX - interiorPose.lastX
      const deltaY = event.clientY - interiorPose.lastY
      interiorPose.lastX = event.clientX
      interiorPose.lastY = event.clientY

      interiorPose.yaw -= deltaX * 0.004
      interiorPose.pitch -= deltaY * 0.003
      interiorPose.pitch = THREE.MathUtils.clamp(interiorPose.pitch, -1.25, 1.25)
      updateInteriorOrientation()
    }

    const onPointerUp = () => {
      interiorPose.dragging = false
    }

    const onKeyDown = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON) {
        return
      }
      if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        interiorPose.keys.add(event.code)
        event.preventDefault()
      }
    }

    const onKeyUp = (event) => {
      interiorPose.keys.delete(event.code)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    const interiorDeckPresets = Object.fromEntries(
      Object.entries(interiorDeckPresetConfig).map(([deck, preset]) => [
        deck,
        {
          position: new THREE.Vector3(...preset.position),
          yaw: preset.yaw,
          pitch: preset.pitch
        }
      ])
    )

    /**
     * 根据当前的相机模式（外部/内部）更新整个场景（presentationRoot）和模型（modelRoot）的垂直偏移。
     * @param {string} mode - 当前的相机模式，通常是 'exterior' 或 'interior'。
     */
    const updatePresentationOffset = (mode) => {
      // 在外部模式下，将整个场景的根节点向上抬升 stageOffsetY 的距离，以获得更好的构图。
      presentationRoot.position.y = mode === 'exterior' ? exteriorCameraPreset.stageOffsetY : 0
      // 在外部模式且显示水面的情况下，根据水面调整参数额外抬升模型，以模拟浮在水上的效果。
      modelRoot.position.y = (mode === 'exterior' && shouldShowWaterSurface) 
                            ? waterTuning.exteriorModelLiftY 
                            : 0
    }

    /**
     * 应用一个外部相机预设，设置正交相机（OrthographicCamera）的位置和轨道控制器（OrbitControls）的目标。
     * @param {object} preset - 一个相机预设对象，可能包含 target, zoom, rotation, coordinateSpace 等属性。
     */
    const applyExteriorCameraPreset = (preset) => {
      const safePreset = preset ?? {}
      // 确定相机的目标点。如果预设中没有提供，则使用默认的 targetY 高度。
      const nextTarget = safePreset.target ?? [0, exteriorCameraPreset.targetY, 0]
      // 将目标点从可能的模型局部坐标系转换到场景世界坐标系。
      const focusTargetVector = toSceneFocusCoordinate(nextTarget, safePreset.coordinateSpace)

      // 计算相机的观察方向。
      // 优先使用预设中定义的旋转值（rotation）。
      const baseTargetVector = new THREE.Vector3(0, exteriorCameraPreset.targetY, 0)
      const baseCameraVector = new THREE.Vector3(...exteriorCameraPreset.position)
      const rotationPreset = getPresetRotationValue(safePreset)
      // 如果没有旋转值，则通过默认的相机位置和目标点来计算方向。
      const viewDirection = rotationPreset
        ? getOrbitViewDirectionFromRotation(rotationPreset)
        : baseCameraVector.sub(baseTargetVector).normalize()

      // 计算相机与目标点之间的距离（nextDistance），优先使用预设的 zoom 值。
      // 注意：这里的 zoom 属性被用作距离值，而不是正交相机的缩放因子。
      const fallbackDistance = Math.max(
        new THREE.Vector3(...exteriorCameraPreset.position).distanceTo(baseTargetVector),
        0.01
      )
      const nextDistance = Number.isFinite(Number(safePreset.zoom)) && Number(safePreset.zoom) > 0
        ? Number(safePreset.zoom)
        : fallbackDistance

      // 根据目标点、观察方向和距离，计算出最终的相机位置。
      const nextPosition = focusTargetVector.clone().add(viewDirection.multiplyScalar(nextDistance))

      // 将计算出的目标点和相机位置应用到相机和轨道控制器上。
      exteriorCamera.position.copy(nextPosition)
      // 设置正交相机的缩放级别。这与上面用作距离的 zoom 是不同的概念。
      exteriorCamera.zoom = exteriorCameraPreset.zoom
      controls.target.copy(focusTargetVector)
      // 更新相机投影矩阵以应用更改。
      exteriorCamera.updateProjectionMatrix()
      controls.update()
    }

    setViewPresetRef.current = (mode, deck = interiorDeckRef.current, preset = null) => {
      const cameraMode = normalizeCameraMode(
        preset?.cameraMode,
        mode === 'interior' ? CAMERA_MODE_FIRST_PERSON : CAMERA_MODE_ORBIT
      )
      const effectiveMode = cameraMode === CAMERA_MODE_FIRST_PERSON ? 'interior' : 'exterior'
      modeRef.current = effectiveMode
      const effectiveDeck = isTwoLayerBoat ? deck : '1'

      updatePresentationOffset(effectiveMode)

      if (waterSurface) {
        waterSurface.mesh.visible = effectiveMode === 'exterior'
      }
      if (interiorSkySphere) {
        interiorSkySphere.mesh.visible = effectiveMode === 'interior'
      }

      if (effectiveMode === 'interior') {
        activeCamera = interiorCamera
        cameraRef.current = interiorCamera
        controls.enabled = false
        interiorPose.cameraMode = CAMERA_MODE_FIRST_PERSON

        const deckPreset = interiorDeckPresets[effectiveDeck] ?? interiorDeckPresets['1']
        if (preset?.target || preset?.position || Number.isFinite(Number(preset?.zoom)) || getPresetRotationValue(preset)) {
          applyFirstPersonCameraPreset(preset, deckPreset)
        } else {
          const lookAngles = getFirstPersonLookAnglesFromPreset(preset, deckPreset.yaw, deckPreset.pitch)
          interiorPose.position.copy(deckPreset.position)
          interiorPose.yaw = preset?.yaw ?? lookAngles.yaw
          interiorPose.pitch = preset?.pitch ?? lookAngles.pitch
          updateInteriorOrientation()
        }
      } else {
        activeCamera = exteriorCamera
        cameraRef.current = exteriorCamera
        controls.enabled = true
        interiorPose.cameraMode = CAMERA_MODE_ORBIT
        interiorPose.keys.clear()
        applyExteriorCameraPreset(preset)
      }
      syncTransformControls()
    }

    setFocusTargetRef.current = (target) => {
      const latestFocusPresets = resolvedOrderFocusPresetsRef.current
      const preset = target === 'smart-system' && stabilizedSmartSystemPreset
        ? stabilizedSmartSystemPreset
        : (latestFocusPresets[target] ?? latestFocusPresets.exterior ?? latestFocusPresets.overview)
      if (preset.cameraMode === CAMERA_MODE_FIRST_PERSON || preset.type === 'interior') {
        setViewPresetRef.current('interior', preset.deck ?? '1', preset)
        return
      }

      setViewPresetRef.current('exterior', interiorDeckRef.current, preset)
    }

    setViewPresetRef.current('exterior')
    setFocusTargetRef.current(
      resolveAppliedFocusTarget(
        modelId,
        resolvedRequestedFocusTarget,
        resolvedOrderFocusPresetsRef.current,
        focusTargetStrategy
      )
    )

    let loadedRoot = null
    const gltfLoader = new GLTFLoader()
    const fbxLoader = new FBXLoader()
    const textureLoader = new THREE.TextureLoader()
    const externalTextures = []
    const texturePromiseCache = new Map()
    const trackedAssetUrls = (() => {
      const assetUrls = []
      const pushAssetUrl = (assetPath, resolver = resolveManifestPath) => {
        if (!assetPath) {
          return
        }

        assetUrls.push(resolver(assetPath))
      }
      const pushUvTextureUrls = (targetUvSets) => {
        targetUvSets.forEach((uvSet) => {
          Object.values(uvSet?.textures ?? {}).forEach((assetPath) => {
            pushAssetUrl(assetPath)
          })
        })
      }

      if (hasCompositeParts) {
        compositeParts.forEach((part) => {
          pushAssetUrl(part?.model?.path)
          pushUvTextureUrls(part?.uvSets ?? EMPTY_ARRAY)
        })
      } else {
        pushAssetUrl(effectiveModelPath, (value) => value)
        if (isTwoLayerBoat) {
          TWO_LAYER_TRACKED_TEXTURE_PATHS.forEach((assetPath) => {
            pushAssetUrl(assetPath, resolveAssetPath)
          })
        } else {
          pushUvTextureUrls(uvSets)
        }
      }

      return [...new Set(assetUrls.filter(Boolean))]
    })()
    const assetProgressMap = new Map(
      trackedAssetUrls.map((assetUrl) => [
        assetUrl,
        {
          loadedBytes: 0,
          totalBytes: 0,
          completed: false
        }
      ])
    )
    const speedSamples = []
    let totalLoadedBytes = 0
    let totalExpectedBytes = 0
    let completedAssetCount = 0
    let progressFrameId = 0
    let progressFloor = 0
    let currentLoadingPhase = trackedAssetUrls.length > 0
      ? '正在下载模型与贴图资源…'
      : '正在准备模型与贴图资源…'
    let currentAssetLabel = trackedAssetUrls[0] ? getAssetDisplayLabel(trackedAssetUrls[0]) : ''

    setLoadingState({
      ...createInitialLoadingState(true),
      phase: currentLoadingPhase,
      totalItems: trackedAssetUrls.length,
      activeLabel: currentAssetLabel
    })

    const computeDownloadSpeed = () => {
      const sampleCount = speedSamples.length
      if (sampleCount < 2) {
        return 0
      }

      const firstSample = speedSamples[0]
      const lastSample = speedSamples[sampleCount - 1]
      const elapsedSeconds = (lastSample.time - firstSample.time) / 1000

      if (elapsedSeconds <= 0) {
        return 0
      }

      return (lastSample.bytes - firstSample.bytes) / elapsedSeconds
    }

    const pushLoadingState = (force = false) => {
      if (isDisposed) {
        return
      }

      const runUpdate = () => {
        progressFrameId = 0
        const byteProgress = totalExpectedBytes > 0 ? totalLoadedBytes / totalExpectedBytes : 0
        const itemProgress = trackedAssetUrls.length > 0 ? completedAssetCount / trackedAssetUrls.length : 0
        const nextProgress = totalExpectedBytes > 0 ? byteProgress : itemProgress
        if (completedAssetCount >= trackedAssetUrls.length && trackedAssetUrls.length > 0) {
          progressFloor = 1
        } else {
          progressFloor = Math.max(progressFloor, nextProgress)
        }

        setLoadingState({
          phase: currentLoadingPhase,
          progress: trackedAssetUrls.length > 0 ? Math.min(progressFloor, 1) : 0,
          downloadedBytes: totalLoadedBytes,
          totalBytes: totalExpectedBytes,
          loadedItems: completedAssetCount,
          totalItems: trackedAssetUrls.length,
          speedBytesPerSecond: computeDownloadSpeed(),
          activeLabel: currentAssetLabel,
          hasKnownTotal: totalExpectedBytes > 0
        })
      }

      if (force) {
        if (progressFrameId) {
          window.cancelAnimationFrame(progressFrameId)
          progressFrameId = 0
        }
        runUpdate()
        return
      }

      if (progressFrameId) {
        return
      }

      progressFrameId = window.requestAnimationFrame(runUpdate)
    }

    const noteDownloadedBytes = (deltaBytes) => {
      if (!Number.isFinite(deltaBytes) || deltaBytes <= 0) {
        return
      }

      totalLoadedBytes += deltaBytes
      const now = performance.now()
      speedSamples.push({
        time: now,
        bytes: totalLoadedBytes
      })

      while (speedSamples.length > 0 && now - speedSamples[0].time > 1800) {
        speedSamples.shift()
      }

      pushLoadingState()
    }

    const setAssetExpectedBytes = (assetUrl, totalBytes) => {
      const assetState = assetProgressMap.get(assetUrl)
      if (!assetState) {
        return
      }

      if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
        return
      }

      totalExpectedBytes += totalBytes - assetState.totalBytes
      assetState.totalBytes = totalBytes
      if (assetState.completed && assetState.loadedBytes < totalBytes) {
        const deltaBytes = totalBytes - assetState.loadedBytes
        assetState.loadedBytes = totalBytes
        noteDownloadedBytes(deltaBytes)
        return
      }
      pushLoadingState()
    }

    const markAssetCompleted = (assetUrl, phase) => {
      const assetState = assetProgressMap.get(assetUrl)
      if (!assetState || assetState.completed) {
        return
      }

      assetState.completed = true
      completedAssetCount += 1
      currentLoadingPhase = completedAssetCount >= trackedAssetUrls.length && trackedAssetUrls.length > 0
        ? '正在整理场景与材质…'
        : phase
      currentAssetLabel = getAssetDisplayLabel(assetUrl)
      pushLoadingState(true)
    }

    const beginTrackedAsset = (assetUrl, phase) => {
      if (!assetProgressMap.has(assetUrl)) {
        assetProgressMap.set(assetUrl, {
          loadedBytes: 0,
          totalBytes: 0,
          completed: false
        })
      }

      currentLoadingPhase = phase
      currentAssetLabel = getAssetDisplayLabel(assetUrl)
      pushLoadingState()
      return assetProgressMap.get(assetUrl)
    }

    const estimateAssetSizes = () => {
      trackedAssetUrls.forEach((assetUrl) => {
        fetch(assetUrl, {
          method: 'HEAD',
          signal: abortController.signal
        })
          .then((response) => {
            if (!response.ok) {
              return
            }

            const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
            if (Number.isFinite(contentLength) && contentLength > 0) {
              setAssetExpectedBytes(assetUrl, contentLength)
            }
          })
          .catch(() => {})
      })
    }

    estimateAssetSizes()

    const loadTextureAsync = (path) => {
      if (texturePromiseCache.has(path)) {
        return texturePromiseCache.get(path)
      }

      const texturePromise = new Promise((resolve, reject) => {
        const assetState = beginTrackedAsset(path, '正在下载贴图资源…')

        textureLoader.load(
          path,
          (texture) => {
            if (assetState.totalBytes > assetState.loadedBytes) {
              const deltaBytes = assetState.totalBytes - assetState.loadedBytes
              assetState.loadedBytes = assetState.totalBytes
              noteDownloadedBytes(deltaBytes)
            }
            markAssetCompleted(path, '正在下载贴图资源…')
            texturePromise.__resolvedTexture = texture
            resolve(texture)
          },
          undefined,
          reject
        )
      })

      texturePromiseCache.set(path, texturePromise)
      return texturePromise
    }

    const loadModelAsync = ({ format, path }) => new Promise((resolve, reject) => {
      const assetState = beginTrackedAsset(path, '正在下载模型文件…')
      const handleProgress = (event) => {
        if (!event) {
          return
        }

        if (event.total) {
          setAssetExpectedBytes(path, event.total)
        }

        const nextLoadedBytes = Number.isFinite(event.loaded) ? event.loaded : 0
        const deltaBytes = nextLoadedBytes - assetState.loadedBytes
        assetState.loadedBytes = nextLoadedBytes
        noteDownloadedBytes(deltaBytes)
      }
      const handleComplete = (object3d) => {
        if (assetState.totalBytes > assetState.loadedBytes) {
          const deltaBytes = assetState.totalBytes - assetState.loadedBytes
          assetState.loadedBytes = assetState.totalBytes
          noteDownloadedBytes(deltaBytes)
        }
        markAssetCompleted(path, '正在下载模型文件…')
        resolve(object3d)
      }

      if (format === 'fbx') {
        fbxLoader.load(
          path,
          (object3d) => handleComplete(object3d),
          handleProgress,
          reject
        )
        return
      }

      gltfLoader.load(
        path,
        (gltf) => {
          const object3d = gltf.scene ?? gltf.scenes?.[0]
          if (!object3d) {
            reject(new Error(`${modelId} does not contain a scene root.`))
            return
          }
          handleComplete(object3d)
        },
        handleProgress,
        reject
      )
    })

    const ensureAoUv = (mesh) => {
      const geometry = mesh.geometry
      if (!geometry?.attributes?.uv) {
        return false
      }

      if (!geometry.attributes.uv2) {
        geometry.setAttribute('uv2', geometry.attributes.uv.clone())
      }

      return true
    }

    const applyMeshShadowFlags = (rootObject) => {
      rootObject.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        child.castShadow = true
        child.receiveShadow = true
      })
    }

    const normalizeUvSetRenderProfile = (profile = {}) => ({
      alphaMode: `${profile?.alphaMode ?? ''}`.trim().toLowerCase(),
      side: `${profile?.side ?? ''}`.trim().toLowerCase(),
      depthWrite: `${profile?.depthWrite ?? ''}`.trim().toLowerCase(),
      depthTest: `${profile?.depthTest ?? ''}`.trim().toLowerCase(),
      alphaCutoff:
        Number.isFinite(Number(profile?.alphaCutoff)) && Number(profile?.alphaCutoff) > 0
          ? Number(profile.alphaCutoff)
          : 0,
      renderOrder:
        Number.isFinite(Number(profile?.renderOrder))
          ? Math.trunc(Number(profile.renderOrder))
          : null,
      metalness:
        profile?.metalness !== '' &&
        profile?.metalness !== null &&
        profile?.metalness !== undefined &&
        Number.isFinite(Number(profile.metalness))
          ? Math.max(0, Math.min(1, Number(profile.metalness)))
          : null,
      roughness:
        profile?.roughness !== '' &&
        profile?.roughness !== null &&
        profile?.roughness !== undefined &&
        Number.isFinite(Number(profile.roughness))
          ? Math.max(0, Math.min(1, Number(profile.roughness)))
          : null,
      envMapIntensity:
        profile?.envMapIntensity !== '' &&
        profile?.envMapIntensity !== null &&
        profile?.envMapIntensity !== undefined &&
        Number.isFinite(Number(profile.envMapIntensity))
          ? Math.max(0, Math.min(8, Number(profile.envMapIntensity)))
          : null,
      clearcoat:
        profile?.clearcoat !== '' &&
        profile?.clearcoat !== null &&
        profile?.clearcoat !== undefined &&
        Number.isFinite(Number(profile.clearcoat))
          ? Math.max(0, Math.min(1, Number(profile.clearcoat)))
          : null,
      clearcoatRoughness:
        profile?.clearcoatRoughness !== '' &&
        profile?.clearcoatRoughness !== null &&
        profile?.clearcoatRoughness !== undefined &&
        Number.isFinite(Number(profile.clearcoatRoughness))
          ? Math.max(0, Math.min(1, Number(profile.clearcoatRoughness)))
          : null,
      ditherMode: `${profile?.ditherMode ?? ''}`.trim().toLowerCase(),
      ditherOpacity:
        profile?.ditherOpacity !== '' &&
        profile?.ditherOpacity !== null &&
        profile?.ditherOpacity !== undefined &&
        Number.isFinite(Number(profile.ditherOpacity))
          ? Math.max(0, Math.min(1, Number(profile.ditherOpacity)))
          : null
    })

    const applyUvSetRenderProfileToMaterial = (material, renderProfile = {}, context = {}) => {
      const normalizedProfile = normalizeUvSetRenderProfile(renderProfile)
      const hasOpacityTexture = Boolean(context.maps?.opacity)
      const useBaseColorAlpha = context.textureOptions?.baseColor?.useAlphaAsOpacity === true
      let targetMaterial = material

      if (
        (normalizedProfile.clearcoat !== null || normalizedProfile.clearcoatRoughness !== null) &&
        !targetMaterial?.isMeshPhysicalMaterial
      ) {
        targetMaterial = createPhysicalMaterial(targetMaterial)
      }

      if (normalizedProfile.alphaMode === UV_SET_ALPHA_MODE_OPAQUE) {
        targetMaterial.transparent = false
        targetMaterial.alphaTest = 0
        targetMaterial.opacity = 1
        targetMaterial.alphaMap = null
      } else if (normalizedProfile.alphaMode === UV_SET_ALPHA_MODE_CUTOUT) {
        targetMaterial.transparent = false
        targetMaterial.opacity = 1
        targetMaterial.alphaTest = normalizedProfile.alphaCutoff || Math.max(targetMaterial.alphaTest ?? 0, 0.02)
      } else if (normalizedProfile.alphaMode === UV_SET_ALPHA_MODE_BLEND) {
        targetMaterial.transparent = hasOpacityTexture || useBaseColorAlpha || targetMaterial.transparent
        targetMaterial.opacity = 1
        targetMaterial.alphaTest = normalizedProfile.alphaCutoff || Math.max(targetMaterial.alphaTest ?? 0, 0.02)
      } else if (normalizedProfile.alphaCutoff > 0 && (hasOpacityTexture || useBaseColorAlpha || targetMaterial.transparent)) {
        targetMaterial.alphaTest = normalizedProfile.alphaCutoff
      }

      if (normalizedProfile.side === UV_SET_SIDE_FRONT) {
        targetMaterial.side = THREE.FrontSide
      } else if (normalizedProfile.side === UV_SET_SIDE_DOUBLE) {
        targetMaterial.side = THREE.DoubleSide
      }

      if (normalizedProfile.depthWrite === UV_SET_DEPTH_WRITE_ON) {
        targetMaterial.depthWrite = true
      } else if (normalizedProfile.depthWrite === UV_SET_DEPTH_WRITE_OFF) {
        targetMaterial.depthWrite = false
      }

      if (normalizedProfile.depthTest === UV_SET_DEPTH_TEST_ON) {
        targetMaterial.depthTest = true
      } else if (normalizedProfile.depthTest === UV_SET_DEPTH_TEST_OFF) {
        targetMaterial.depthTest = false
      }

      if (normalizedProfile.renderOrder !== null && context.child) {
        context.child.renderOrder = normalizedProfile.renderOrder
      }

      if (normalizedProfile.metalness !== null && 'metalness' in targetMaterial) {
        targetMaterial.metalness = normalizedProfile.metalness
      }
      if (normalizedProfile.roughness !== null && 'roughness' in targetMaterial) {
        targetMaterial.roughness = normalizedProfile.roughness
      }
      if (normalizedProfile.envMapIntensity !== null && 'envMapIntensity' in targetMaterial) {
        targetMaterial.envMapIntensity = normalizedProfile.envMapIntensity
      }
      if (normalizedProfile.clearcoat !== null && 'clearcoat' in targetMaterial) {
        targetMaterial.clearcoat = normalizedProfile.clearcoat
      }
      if (normalizedProfile.clearcoatRoughness !== null && 'clearcoatRoughness' in targetMaterial) {
        targetMaterial.clearcoatRoughness = normalizedProfile.clearcoatRoughness
      }

      if (normalizedProfile.ditherMode === UV_SET_DITHER_MODE_ON) {
        targetMaterial = applyDitherFadeMaterial(targetMaterial, normalizedProfile.ditherOpacity ?? 0.45)
      } else if (normalizedProfile.ditherMode === UV_SET_DITHER_MODE_OFF) {
        targetMaterial.userData.ditherFadeUniforms = null
      }

      targetMaterial.needsUpdate = true
      return targetMaterial
    }

    const createPbrMaterial = (material) => {
      const upgradedMaterial = new THREE.MeshStandardMaterial({
        name: material?.name || '',
        color: material?.color?.clone?.() ?? new THREE.Color('#ffffff'),
        emissive: material?.emissive?.clone?.() ?? new THREE.Color('#000000'),
        emissiveIntensity: material?.emissiveIntensity ?? 1,
        opacity: material?.opacity ?? 1,
        transparent: material?.transparent ?? false,
        side: material?.side ?? THREE.DoubleSide,
        alphaTest: material?.alphaTest ?? 0,
        depthWrite: material?.depthWrite ?? true,
        depthTest: material?.depthTest ?? true,
        wireframe: material?.wireframe ?? false,
        flatShading: material?.flatShading ?? false,
        fog: material?.fog ?? true,
        metalness: 'metalness' in (material ?? {}) ? material.metalness : 0.22,
        roughness: 'roughness' in (material ?? {}) ? material.roughness : 0.42,
        envMapIntensity: 1.28
      })

      if (material?.map) {
        upgradedMaterial.map = material.map
      }
      if (material?.normalMap) {
        upgradedMaterial.normalMap = material.normalMap
      }
      if (material?.alphaMap) {
        upgradedMaterial.alphaMap = material.alphaMap
      }
      if (material?.aoMap) {
        upgradedMaterial.aoMap = material.aoMap
      }
      if (material?.metalnessMap) {
        upgradedMaterial.metalnessMap = material.metalnessMap
      }
      if (material?.roughnessMap) {
        upgradedMaterial.roughnessMap = material.roughnessMap
      }
      if (material?.emissiveMap) {
        upgradedMaterial.emissiveMap = material.emissiveMap
      }
      if (material?.normalScale) {
        upgradedMaterial.normalScale = material.normalScale.clone()
      }
      if (material?.userData?.packedRmaoMap) {
        upgradedMaterial.userData.packedRmaoMap = material.userData.packedRmaoMap
        applyPackedRmaoMaterial(upgradedMaterial, material.userData.packedRmaoMap)
      }

      return upgradedMaterial
    }

    const createPhysicalMaterial = (material) => {
      const upgradedMaterial = new THREE.MeshPhysicalMaterial({
        name: material?.name || '',
        color: material?.color?.clone?.() ?? new THREE.Color('#ffffff'),
        emissive: material?.emissive?.clone?.() ?? new THREE.Color('#000000'),
        emissiveIntensity: material?.emissiveIntensity ?? 1,
        opacity: material?.opacity ?? 1,
        transparent: material?.transparent ?? false,
        side: material?.side ?? THREE.DoubleSide,
        alphaTest: material?.alphaTest ?? 0,
        depthWrite: material?.depthWrite ?? true,
        depthTest: material?.depthTest ?? true,
        wireframe: material?.wireframe ?? false,
        flatShading: material?.flatShading ?? false,
        fog: material?.fog ?? true,
        metalness: 'metalness' in (material ?? {}) ? material.metalness : 0.24,
        roughness: 'roughness' in (material ?? {}) ? material.roughness : 0.34,
        envMapIntensity: material?.envMapIntensity ?? 1.52,
        clearcoat: material?.clearcoat ?? 0,
        clearcoatRoughness: material?.clearcoatRoughness ?? 0.08
      })

      if (material?.map) {
        upgradedMaterial.map = material.map
      }
      if (material?.normalMap) {
        upgradedMaterial.normalMap = material.normalMap
      }
      if (material?.alphaMap) {
        upgradedMaterial.alphaMap = material.alphaMap
      }
      if (material?.aoMap) {
        upgradedMaterial.aoMap = material.aoMap
      }
      if (material?.metalnessMap) {
        upgradedMaterial.metalnessMap = material.metalnessMap
      }
      if (material?.roughnessMap) {
        upgradedMaterial.roughnessMap = material.roughnessMap
      }
      if (material?.emissiveMap) {
        upgradedMaterial.emissiveMap = material.emissiveMap
      }
      if (material?.normalScale) {
        upgradedMaterial.normalScale = material.normalScale.clone()
      }
      if (material?.aoMapIntensity !== undefined) {
        upgradedMaterial.aoMapIntensity = material.aoMapIntensity
      }
      if (material?.userData?.packedRmaoMap) {
        upgradedMaterial.userData.packedRmaoMap = material.userData.packedRmaoMap
        applyPackedRmaoMaterial(upgradedMaterial, material.userData.packedRmaoMap)
      }

      return upgradedMaterial
    }

    const getMaterialForUvMaps = (material, options = {}) => {
      const { preferPbrFinish = false } = options

      if (preferPbrFinish && !material?.isMeshStandardMaterial) {
        return createPbrMaterial(material)
      }

      if (preferPbrFinish && material?.isMeshStandardMaterial) {
        material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 1.28)
      }

      return material
    }

    const applyMapsToMaterial = (material, maps, options = {}) => {
      const {
        canUseUvMaps = true,
        textureOptions = {}
      } = options
      const shouldUseBaseColorAlpha = textureOptions.baseColor?.useAlphaAsOpacity === true

      if (maps.baseColor && canUseUvMaps) {
        if (material.color) {
          material.color.set('#ffffff')
        }
        material.map = maps.baseColor
      }
      if (maps.emissive && canUseUvMaps) {
        material.emissive = new THREE.Color('#ffffff')
        material.emissiveMap = maps.emissive
      }
      if (maps.normal && canUseUvMaps) {
        material.normalMap = maps.normal
        material.normalScale = new THREE.Vector2(1, -1)
      }
      if (maps.orm && canUseUvMaps) {
        material.aoMap = maps.orm
        material.aoMapIntensity = 0.72
        material.roughnessMap = maps.orm
        material.roughness = 1
        material.metalnessMap = maps.orm
        material.metalness = 1
      }
      if (maps.rmao && canUseUvMaps) {
        material.aoMap = maps.rmao
        material.aoMapIntensity = 0.72
        material.roughnessMap = maps.rmao
        material.roughness = 1
        material.metalnessMap = maps.rmao
        material.metalness = 1
        applyPackedRmaoMaterial(material, maps.rmao)
      }
      if (maps.ao && canUseUvMaps) {
        material.aoMap = maps.ao
        material.aoMapIntensity = 0.72
      }
      if (maps.metalness && canUseUvMaps) {
        material.metalnessMap = maps.metalness
        material.metalness = 1
      }
      if (maps.roughness && canUseUvMaps) {
        material.roughnessMap = maps.roughness
        material.roughness = 1
      }
      if (maps.opacity && canUseUvMaps) {
        material.alphaMap = maps.opacity
      }
      if ((maps.opacity || shouldUseBaseColorAlpha) && canUseUvMaps) {
        material.transparent = true
        material.opacity = 1
        material.alphaTest = Math.max(material.alphaTest ?? 0, 0.02)
        material.depthWrite = true
        material.depthTest = true
        material.side = THREE.DoubleSide
      }
      if ('envMapIntensity' in material) {
        material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 1.28)
      }
      material.needsUpdate = true
    }

    const applyFireFightingCcClearcoat = (material) => {
      const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

      targetMaterial.metalness = targetMaterial.metalnessMap ? 0.26 : 0.1
      targetMaterial.roughness = targetMaterial.roughnessMap ? 1 : 0.56
      targetMaterial.clearcoat = 0.22
      targetMaterial.clearcoatRoughness = 0.34
      targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 0.92)
      if ('specularIntensity' in targetMaterial) {
        targetMaterial.specularIntensity = 0.42
      }
      if ('specularColor' in targetMaterial && targetMaterial.specularColor?.set) {
        targetMaterial.specularColor.set('#d86f72')
      }
      targetMaterial.needsUpdate = true

      return targetMaterial
    }

    const applyFireFightingRailingTransparency = (material) => {
      const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

      targetMaterial.transparent = true
      targetMaterial.alphaTest = 0.18
      targetMaterial.depthWrite = false
      targetMaterial.side = THREE.DoubleSide
      targetMaterial.metalness = 1
      targetMaterial.roughness = targetMaterial.roughnessMap ? 0.42 : 0.18
      targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 1.92)
      targetMaterial.clearcoat = 0.24
      targetMaterial.clearcoatRoughness = 0.14
      if (targetMaterial.emissiveMap) {
        targetMaterial.emissive = new THREE.Color('#dfe5ee')
        targetMaterial.emissiveIntensity = 0.42
      }
      if ('specularIntensity' in targetMaterial) {
        targetMaterial.specularIntensity = 1
      }
      targetMaterial.needsUpdate = true

      return targetMaterial
    }

    const applyLiuYunGlassFinish = (material) => {
      const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

      targetMaterial.transparent = true
      targetMaterial.opacity = 1
      targetMaterial.alphaTest = 0.02
      targetMaterial.depthWrite = true
      targetMaterial.side = THREE.DoubleSide
      targetMaterial.metalness = 0
      targetMaterial.roughness = 0.22
      targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 1.18)
      if ('transmission' in targetMaterial) {
        targetMaterial.transmission = 0
      }
      if ('ior' in targetMaterial) {
        targetMaterial.ior = 1.5
      }
      if ('thickness' in targetMaterial) {
        targetMaterial.thickness = 0
      }
      if ('attenuationDistance' in targetMaterial) {
        targetMaterial.attenuationDistance = Infinity
      }
      targetMaterial.needsUpdate = true

      return targetMaterial
    }

    const applyLiuYunOpaqueFinish = (material, context = {}) => {
      if (context.child?.name === 'Box025') {
        return applyLiuYunGlassFinish(material)
      }

      const shouldKeepTransparency =
        context.maps?.opacity ||
        context.textureOptions?.baseColor?.useAlphaAsOpacity === true

      const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

      // LiuYun 的 mt BaseColor 虽然带 alpha，但当前更像是导出残留；
      // 若整组开启透明会导致排序和穿帮，因此先按不透明材质处理。
      targetMaterial.transparent = shouldKeepTransparency
      targetMaterial.alphaTest = shouldKeepTransparency
        ? Math.max(targetMaterial.alphaTest ?? 0, 0.02)
        : 0
      targetMaterial.depthWrite = true
      targetMaterial.depthTest = true
      targetMaterial.side = THREE.DoubleSide
      targetMaterial.metalness = targetMaterial.metalnessMap ? 0.22 : 0.08
      targetMaterial.roughness = targetMaterial.roughnessMap ? 0.88 : 0.52
      targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 1.18)
      targetMaterial.needsUpdate = true

      return targetMaterial
    }

    const collectRuntimeMaterialSlots = (rootObject) => {
      const materialSlots = new Map()

      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => {
          const name = `${material?.name ?? ''}`.trim()
          const normalizedName = normalizeMaterialName(name)
          if (!normalizedName || materialSlots.has(normalizedName)) {
            return
          }

          materialSlots.set(normalizedName, name)
        })
      })

      return Array.from(materialSlots, ([normalizedName, name]) => ({ normalizedName, name }))
    }

    const applyUvSetMaps = (rootObject, uvSet, maps, options = {}) => {
      const hint = uvSet.materialNameHint
      const normalizedHint = normalizeMaterialName(hint)
      const {
        materialTransform = null,
        textureOptions = {},
        renderProfile = {},
        allowSingleMaterialFallback = false
      } = options
      let appliedCount = 0
      let skippedMeshCount = 0
      const runtimeMaterialSlots = hint ? collectRuntimeMaterialSlots(rootObject) : []
      const hintMatchesRuntimeSlot = !hint || runtimeMaterialSlots.some((slot) => slot.normalizedName === normalizedHint)
      const singleMaterialFallbackSlot = allowSingleMaterialFallback && hint && !hintMatchesRuntimeSlot && runtimeMaterialSlots.length === 1
        ? runtimeMaterialSlots[0]
        : null

      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        const hasUv = ensureAoUv(child)
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        const updatedMaterials = materials.map((material) => {
          const normalizedMaterialName = normalizeMaterialName(material?.name)
          const matchesMaterialHint = !hint || normalizedMaterialName === normalizedHint
          const matchesSingleMaterialFallback =
            singleMaterialFallbackSlot && normalizedMaterialName === singleMaterialFallbackSlot.normalizedName
          if (!matchesMaterialHint && !matchesSingleMaterialFallback) {
            return material
          }

          let targetMaterial = getMaterialForUvMaps(material, options)

          if (!hasUv) {
            skippedMeshCount += 1
            applyMapsToMaterial(targetMaterial, maps, { canUseUvMaps: false, textureOptions })
            if (materialTransform) {
              targetMaterial = materialTransform(targetMaterial, {
                child,
                uvSet,
                normalizedMaterialName,
                maps,
                textureOptions
              })
            }
            targetMaterial = applyUvSetRenderProfileToMaterial(targetMaterial, renderProfile, {
              child,
              uvSet,
              maps,
              textureOptions
            })
            return targetMaterial
          }

          applyMapsToMaterial(targetMaterial, maps, { canUseUvMaps: true, textureOptions })
          if (materialTransform) {
            targetMaterial = materialTransform(targetMaterial, {
              child,
              uvSet,
              normalizedMaterialName,
                maps,
                textureOptions
              })
            }
          targetMaterial = applyUvSetRenderProfileToMaterial(targetMaterial, renderProfile, {
            child,
            uvSet,
            maps,
            textureOptions
          })
          appliedCount += 1
          return targetMaterial
        })

        if (Array.isArray(child.material)) {
          materials.forEach((material, index) => {
            if (updatedMaterials[index] !== material) {
              material?.dispose?.()
            }
          })
          child.material = updatedMaterials
        } else if (updatedMaterials[0] !== child.material) {
          child.material?.dispose?.()
          child.material = updatedMaterials[0]
        }
      })

      return { appliedCount, skippedMeshCount }
    }

    const applyTwoLayerMaterialMaps = (rootObject, materialName, maps, withEmissive) => {
      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => {
          if (material?.name !== materialName) {
            return
          }

          ensureAoUv(child)
          if (withEmissive && maps.emissive) {
            material.emissive = new THREE.Color('#ffffff')
            material.emissiveMap = maps.emissive
          }
          material.normalMap = maps.normal
          material.aoMap = maps.ao
          material.metalnessMap = maps.metalness
          material.roughnessMap = maps.roughness
          material.metalness = 1
          material.roughness = 1
          material.normalScale = new THREE.Vector2(1, -1)
          material.needsUpdate = true
        })
      })
    }

    // ===== TwoLayerBoat Locked Block START =====
    // TwoLayerBoat 贴图保持回滚后的定向挂载策略（M_01/M_02），请勿替换为通用自动映射。
    const loadAndApplyTwoLayerMaps = async (rootObject) => {
      const [emissive, normal, ao, metalness, roughness, normal2, ao2, metalness2, roughness2] = await Promise.all([
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/1/1_01 - Default_Emissive.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/1/1_01 - Default_Normal.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/1/AO.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/1/meti.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/1/rou.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/2/1_02 - Default_Normal.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/2/AO_3.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/2/meti_1.png')),
        loadTextureAsync(resolveAssetPath('gltf/TwoLayerBoat/2/rou_2.png'))
      ])

      emissive.flipY = false
      emissive.colorSpace = THREE.SRGBColorSpace

      normal.flipY = false
      ao.flipY = false
      metalness.flipY = false
      roughness.flipY = false

      normal2.flipY = false
      ao2.flipY = false
      metalness2.flipY = false
      roughness2.flipY = false

      externalTextures.push(emissive, normal, ao, metalness, roughness, normal2, ao2, metalness2, roughness2)

      applyTwoLayerMaterialMaps(
        rootObject,
        'M_01___Default',
        { emissive, normal, ao, metalness, roughness },
        true
      )
      applyTwoLayerMaterialMaps(
        rootObject,
        'M_02___Default',
        { normal: normal2, ao: ao2, metalness: metalness2, roughness: roughness2 },
        false
      )
    }
    // ===== TwoLayerBoat Locked Block END =====

    const loadAndApplyUvMaps = async (rootObject, targetUvSets, targetModelFormat, targetLabel) => {
      const shouldFlipY = targetModelFormat !== 'fbx'
      const texturedUvSetCount = targetUvSets
        .filter((uvSet) => Object.keys(uvSet.textures ?? {}).some((textureType) => Boolean(uvSet.textures?.[textureType])))
        .length

      for (const uvSet of targetUvSets) {
        const textureEntries = Object.entries(uvSet.textures ?? {}).filter(([, path]) => Boolean(path))
        if (textureEntries.length === 0) {
          continue
        }

        const textureOptions = uvSet.textureOptions ?? {}
        const renderProfile = uvSet.renderProfile ?? {}

        const loadedTextures = await Promise.all(
          textureEntries.map(async ([type, path]) => {
            const texture = await loadTextureAsync(resolveManifestPath(path))
            texture.flipY = shouldFlipY ? false : true
            if (type === 'baseColor' || type === 'emissive') {
              texture.colorSpace = THREE.SRGBColorSpace
            }
            texture.needsUpdate = true
            externalTextures.push(texture)
            return [type, texture]
          })
        )

        const textureMap = Object.fromEntries(loadedTextures)
        const hasExplicitRenderProfile = Object.values(uvSet.renderProfile ?? {}).some((value) => value !== '' && value !== 0 && value !== null)
        const materialTransform = hasExplicitRenderProfile
          ? null
          : modelId === 'FireFighting'
            ? (
                uvSet.id === 'tt/cc'
                  ? applyFireFightingCcClearcoat
                  : uvSet.id === 'tt/langan'
                    ? applyFireFightingRailingTransparency
                    : null
              )
            : modelId === 'LiuYun' && uvSet.id === 'mt'
              ? applyLiuYunOpaqueFinish
              : null
        const initialResult = applyUvSetMaps(rootObject, uvSet, textureMap, {
          preferPbrFinish: targetModelFormat === 'fbx',
          materialTransform,
          textureOptions,
          renderProfile,
          allowSingleMaterialFallback: texturedUvSetCount === 1
        })
        if (initialResult.appliedCount === 0) {
          // 多材质模型如果提示未命中，宁可保留原材质，也不要把整套贴图错误铺满整船。
          if (initialResult.skippedMeshCount > 0) {
            console.warn(`Skipped UV texture application for ${targetLabel}/${uvSet.id}: model meshes do not contain UV coordinates.`)
          } else {
            console.warn(`Skipped UV texture application for ${targetLabel}/${uvSet.id}: material name hint did not match any runtime material slot.`)
          }
        } else if (initialResult.skippedMeshCount > 0) {
          console.warn(`Partially skipped UV texture application for ${targetLabel}/${uvSet.id}: some meshes do not contain UV coordinates.`)
        }
      }
    }

    const applyTwoLayerOverrides = (rootObject) => {
      rootObject.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        if (child.name?.toLowerCase() === 'box018' && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => {
            material.metalness = 0
            material.roughness = 0.95
            if ('envMapIntensity' in material) {
              material.envMapIntensity = 0.18
            }
            if ('clearcoat' in material) {
              material.clearcoat = 0
            }
            material.needsUpdate = true
          })
        }

        if (child.name === 'Cylinder019') {
          const silverMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#c7ccd3'),
            metalness: 1,
            roughness: 0,
            clearcoat: 0.5,
            clearcoatRoughness: 0.02,
            envMapIntensity: 2.2
          })

          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material?.dispose())
            child.material = child.material.map(() => silverMaterial.clone())
            silverMaterial.dispose()
          } else {
            child.material?.dispose()
            child.material = silverMaterial
          }
        }

        if (child.name === '对象004') {
          const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#d9ecff'),
            metalness: 0,
            roughness: 0.02,
            transmission: 0.96,
            thickness: 1.2,
            ior: 1.5,
            transparent: true,
            opacity: 0.28,
            clearcoat: 1,
            clearcoatRoughness: 0.01,
            envMapIntensity: 2.4,
            side: THREE.DoubleSide
          })

          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material?.dispose())
            child.material = child.material.map(() => glassMaterial.clone())
            glassMaterial.dispose()
          } else {
            child.material?.dispose()
            child.material = glassMaterial
          }
        }
      })
    }

    const updateMeshMaterials = (mesh, transformMaterial) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const updatedMaterials = materials.map((material) => transformMaterial(material))

      if (Array.isArray(mesh.material)) {
        materials.forEach((material, index) => {
          if (updatedMaterials[index] !== material) {
            material?.dispose?.()
          }
        })
        mesh.material = updatedMaterials
        return
      }

      if (updatedMaterials[0] !== mesh.material) {
        mesh.material?.dispose?.()
        mesh.material = updatedMaterials[0]
      }
    }

    const rememberOptionalMaterialBase = (material) => {
      if (!material || material.userData.optionalMaterialOverrideBase) {
        return
      }

      material.userData.optionalMaterialOverrideBase = {
        color: material.color?.clone?.() ?? null,
        map: material.map ?? null,
        metalness: 'metalness' in material ? material.metalness : null,
        roughness: 'roughness' in material ? material.roughness : null,
        envMapIntensity: 'envMapIntensity' in material ? material.envMapIntensity : null,
        clearcoat: 'clearcoat' in material ? material.clearcoat : null,
        clearcoatRoughness: 'clearcoatRoughness' in material ? material.clearcoatRoughness : null
      }
    }

    const restoreOptionalMaterialBase = (material) => {
      const base = material?.userData?.optionalMaterialOverrideBase
      if (!material || !base) {
        return material
      }

      if (material.color && base.color) {
        material.color.copy(base.color)
      }
      material.map = base.map ?? null
      ;['metalness', 'roughness', 'envMapIntensity', 'clearcoat', 'clearcoatRoughness'].forEach((key) => {
        if (key in material && base[key] !== null && base[key] !== undefined) {
          material[key] = base[key]
        }
      })
      material.needsUpdate = true
      return material
    }

    const applyOptionalMaterialOverrideToMaterial = (material, override) => {
      if (!materialMatchesOverrideSlots(material, override)) {
        return material
      }

      let targetMaterial = material
      if (!targetMaterial?.isMeshStandardMaterial) {
        targetMaterial = createPbrMaterial(targetMaterial)
      }

      rememberOptionalMaterialBase(targetMaterial)

      if (override.baseColorPath) {
        const texture = texturePromiseCache.get(resolveManifestPath(override.baseColorPath))?.__resolvedTexture
        if (texture) {
          targetMaterial.map = texture
          if (targetMaterial.color) {
            targetMaterial.color.set('#ffffff')
          }
        }
      }
      targetMaterial.needsUpdate = true
      return targetMaterial
    }

    const preloadOptionalMaterialOverrideTextures = async (nextOverrides) => {
      const normalizedOverrides = normalizeOptionalMaterialOverrides(nextOverrides)
      await Promise.all(normalizedOverrides
        .filter((override) => override.baseColorPath)
        .map(async (override) => {
          const resolvedPath = resolveManifestPath(override.baseColorPath)
          const texture = await loadTextureAsync(resolvedPath)
          texture.flipY = effectiveModelFormat !== 'fbx' ? false : true
          texture.colorSpace = THREE.SRGBColorSpace
          texture.needsUpdate = true
          const cachedPromise = texturePromiseCache.get(resolvedPath)
          if (cachedPromise) {
            cachedPromise.__resolvedTexture = texture
          }
          return texture
        }))
    }

    const applyOptionalMaterialOverridesToObject = (rootObject, nextOverrides) => {
      const normalizedOverrides = normalizeOptionalMaterialOverrides(nextOverrides)

      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        updateMeshMaterials(child, (material) => {
          let targetMaterial = restoreOptionalMaterialBase(material)
          normalizedOverrides.forEach((override) => {
            targetMaterial = applyOptionalMaterialOverrideToMaterial(targetMaterial, override)
          })
          return targetMaterial
        })
      })
    }

    const applyColorConfigToObject = (rootObject, partRole) => {
      const colorMaterialSlots = getColorConfigMaterialSlots(colorConfig)
      const hasExplicitColorSlots = colorMaterialSlots.size > 0
      if (!hasExplicitColorSlots && !shouldApplyColorway(modelId, partRole)) {
        return
      }

      const colorPreset = getColorShaderPreset(colorConfig, { explicitMaterialSlots: hasExplicitColorSlots })
      const colorOptions = partRole === 'hull'
        ? { targetWhiteSurfaces: true, allowHighMetalness: true }
        : {}
      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        updateMeshMaterials(child, (material) => {
          if (hasExplicitColorSlots && !materialMatchesColorSlots(material, colorMaterialSlots)) {
            return clearShaderTintMaterial(material)
          }

          return applyShaderTintMaterial(material, colorPreset, {
            ...colorOptions,
            forceTint: hasExplicitColorSlots
          })
        })
      })
    }

    const getTestHighPartRole = (partId, partIndex) => {
      const partLabel = `${partId ?? ''}`

      if (partLabel.includes('灯带') || partLabel.includes('控制台') || partIndex === 0) {
        return 'accent'
      }

      if (partLabel.includes('船体') || partLabel.includes('顶棚') || partIndex === 1) {
        return 'hull'
      }

      if (partLabel.includes('船舱') || partLabel.includes('栏杆') || partLabel.includes('沙发') || partIndex === 2) {
        return 'interior'
      }

      if (partLabel.includes('马达') || partIndex === 3) {
        return 'engine'
      }

      return 'default'
    }

    const applyStudioMaterialPreset = (material, preset = {}) => {
      const targetMaterial = material?.isMeshStandardMaterial ? material : createPbrMaterial(material)

      if (targetMaterial.color && preset.color) {
        targetMaterial.color.set(preset.color)
      }

      if (targetMaterial.color && preset.colorMultiply) {
        targetMaterial.color.multiplyScalar(preset.colorMultiply)
      }

      if (preset.metalness !== undefined) {
        targetMaterial.metalness = targetMaterial.metalnessMap && preset.preserveMetalnessMapRange
          ? Math.max(1, preset.metalness)
          : preset.metalness
      }

      if (preset.roughness !== undefined) {
        targetMaterial.roughness = targetMaterial.roughnessMap && preset.preserveRoughnessMapRange
          ? Math.max(1, preset.roughness)
          : preset.roughness
      }

      if (targetMaterial.aoMap && preset.aoMapIntensity !== undefined) {
        targetMaterial.aoMapIntensity = preset.aoMapIntensity
      }

      if (preset.envMapIntensity !== undefined) {
        targetMaterial.envMapIntensity = preset.envMapIntensity
      }

      if (preset.disableMetalnessMap) {
        targetMaterial.metalnessMap = null
      }

      if (preset.disableRoughnessMap) {
        targetMaterial.roughnessMap = null
      }

      if (targetMaterial.normalMap && preset.normalScale !== undefined) {
        targetMaterial.normalScale = new THREE.Vector2(preset.normalScale, -preset.normalScale)
      }

      if (targetMaterial.emissiveMap && preset.emissiveColor) {
        targetMaterial.emissive = new THREE.Color(preset.emissiveColor)
      }

      if (targetMaterial.emissiveMap && preset.emissiveIntensity !== undefined) {
        targetMaterial.emissiveIntensity = preset.emissiveIntensity
      }

      targetMaterial.side = THREE.DoubleSide
      targetMaterial.needsUpdate = true

      return targetMaterial
    }

    const applyTestHighStudioOverrides = (rootObject, partId, partIndex) => {
      const partRole = getTestHighPartRole(partId, partIndex)
      const partPresetMap = {
        default: {
          colorMultiply: 0.94,
          metalness: 0.1,
          roughness: 0.34,
          aoMapIntensity: 0.68,
          envMapIntensity: 1
        },
        accent: {
          colorMultiply: 0.68,
          metalness: 0.14,
          roughness: 0.46,
          aoMapIntensity: 0.72,
          envMapIntensity: 0.45,
          emissiveIntensity: 0.2
        },
        hull: {
          
        },
        interior: {
          colorMultiply: 0.88,
          metalness: 0.2,
          roughness: 0.72,
          aoMapIntensity: 0.7,
          envMapIntensity: 0.65,
          preserveMetalnessMapRange: true,
          preserveRoughnessMapRange: true,
          normalScale: 0.82
        },
        engine: {
          color: '#8e9db3',
          metalness: 0.92,
          roughness: 0.28,
          aoMapIntensity: 0.24,
          envMapIntensity: 2.05
        }
      }
      const partPreset = partPresetMap[partRole] ?? partPresetMap.default

      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        ensureAoUv(child)
        updateMeshMaterials(child, (material) => applyStudioMaterialPreset(material, partPreset))
      })
    }

    const applyCabnetTwinEngineFinish = (rootObject) => {
      const enginePreset = {
        color: '#8e9db3',
        metalness: 0.92,
        roughness: 0.28,
        aoMapIntensity: 0.24,
        envMapIntensity: 2.05
      }

      rootObject.traverse((child) => {
        if (!child.isMesh || !child.material) {
          return
        }

        ensureAoUv(child)
        updateMeshMaterials(child, (material) => applyStudioMaterialPreset(material, enginePreset))
      })
    }

    const addConfiguredEnginesAsync = async (rootObject) => {
      const configuredEngines = Array.isArray(modelConfig?.engines)
        ? modelConfig.engines.filter((engine) => engine?.enabled).slice(0, 4)
        : []

      if (configuredEngines.length === 0) {
        return
      }

      rootObject.updateMatrixWorld(true)
      const boatBounds = new THREE.Box3().setFromObject(rootObject)
      const boatSize = boatBounds.getSize(new THREE.Vector3())
      const rootWorldScale = rootObject.getWorldScale(new THREE.Vector3())
      const engineGroup = new THREE.Group()
      engineGroup.name = `${modelId}ConfiguredEngines`

      for (const [engineIndex, engineConfig] of configuredEngines.entries()) {
        const engineType = `${engineConfig?.type ?? 'outboard-a'}`.trim() || 'outboard-a'
        const engineLibraryEntry = ENGINE_MODEL_LIBRARY[engineType] ?? ENGINE_MODEL_LIBRARY['outboard-a']
        try {
          const engineObject = await loadModelAsync({
            format: engineLibraryEntry.format,
            path: resolveManifestPath(engineLibraryEntry.path)
          })

          applyMeshShadowFlags(engineObject)

          try {
            await loadAndApplyUvMaps(
              engineObject,
              engineLibraryEntry.uvSets,
              engineLibraryEntry.format,
              `${modelId}/engine-${engineIndex + 1}`
            )
          } catch (error) {
            console.error(`Failed to load configured engine textures for ${modelId}:`, error)
          }

          applyCabnetTwinEngineFinish(engineObject)

          const engineBounds = new THREE.Box3().setFromObject(engineObject)
          const engineCenter = engineBounds.getCenter(new THREE.Vector3())
          const engineSize = engineBounds.getSize(new THREE.Vector3())
          const enginePivot = new THREE.Group()
          enginePivot.name = `${engineType}:mount-${engineIndex + 1}`

          engineObject.position.copy(engineCenter).multiplyScalar(-1)
          const targetEngineHeight = Math.max(boatSize.y * (engineLibraryEntry.targetHeightScale ?? 0.34), 0.01)
          const inheritedScaleY = Math.max(Math.abs(rootWorldScale.y) || 1, 0.000001)
          const scaleFactor = engineSize.y > 0 ? targetEngineHeight / (engineSize.y * inheritedScaleY) : 1
          enginePivot.scale.setScalar(scaleFactor)
          enginePivot.rotation.set(
            Number(engineConfig?.rotation?.x ?? 0) || 0,
            Number(engineConfig?.rotation?.y ?? 0) || 0,
            Number(engineConfig?.rotation?.z ?? 0) || 0
          )
          const mountPosition = new THREE.Vector3(
            Number(engineConfig?.position?.x ?? 0) || 0,
            Number(engineConfig?.position?.y ?? 0) || 0,
            Number(engineConfig?.position?.z ?? 0) || 0
          )
          enginePivot.position.copy(rootObject.worldToLocal(mountPosition))

          enginePivot.add(engineObject)
          engineGroup.add(enginePivot)
        } catch (error) {
          console.error(`Failed to load configured engine model for ${modelId}:`, error)
        }
      }

      if (engineGroup.children.length > 0) {
        rootObject.add(engineGroup)
      }
    }

    const loadCompositeModelAsync = async () => {
      if (!hasCompositeParts) {
        const object3d = await loadModelAsync({
          format: effectiveModelFormat,
          path: effectiveModelPath
        })
        applyMeshShadowFlags(object3d)

        return {
          root: object3d,
          applyMaterials: async () => {
            if (isTwoLayerBoat) {
              try {
                await loadAndApplyTwoLayerMaps(object3d)
              } catch (error) {
                console.error('Failed to load fixed texture maps for TwoLayerBoat:', error)
              }
              applyTwoLayerOverrides(object3d)
              return
            }

            if (uvSets.length > 0) {
              try {
                await loadAndApplyUvMaps(object3d, uvSets, effectiveModelFormat, modelId)
              } catch (error) {
                console.error(`Failed to load UV set textures for ${modelId}:`, error)
              }
            }

            if (modelId === 'TestHigh') {
              applyTestHighStudioOverrides(object3d, modelId, 0)
            }

            applyColorConfigToObject(object3d, 'full')
          }
        }
      }

      const compositeRoot = new THREE.Group()
      const loadedParts = await Promise.all(compositeParts.map(async (part) => {
        const partFormat = (part?.model?.format ?? 'glb').toLowerCase()
        const partPath = resolveManifestPath(part?.model?.path ?? '')
        const object3d = await loadModelAsync({
          format: partFormat,
          path: partPath
        })
        applyMeshShadowFlags(object3d)

        compositeRoot.add(object3d)

        return {
          id: part.id,
          format: partFormat,
          object3d,
          uvSets: part.uvSets ?? []
        }
      }))

      return {
        root: compositeRoot,
        applyMaterials: async () => {
          for (const [partIndex, part] of loadedParts.entries()) {
            if (part.uvSets.length === 0) {
              if (modelId === 'TestHigh') {
                applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
              }
              continue
            }

            try {
              await loadAndApplyUvMaps(part.object3d, part.uvSets, part.format, `${modelId}/${part.id}`)
            } catch (error) {
              console.error(`Failed to load UV set textures for ${modelId}/${part.id}:`, error)
            }

            if (modelId === 'TestHigh') {
              applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
            }

            applyColorConfigToObject(part.object3d, getTestHighPartRole(part.id, partIndex))
          }
        }
      }
    }

    setColorConfigRef.current = (nextColorConfig) => {
      const colorMaterialSlots = getColorConfigMaterialSlots(nextColorConfig)
      const hasExplicitColorSlots = colorMaterialSlots.size > 0
      const colorPreset = getColorShaderPreset(nextColorConfig, { explicitMaterialSlots: hasExplicitColorSlots })

      const applyLiveColorConfig = (rootObject, partRole) => {
        if (!hasExplicitColorSlots && !shouldApplyColorway(modelId, partRole)) {
          return
        }

        const colorOptions = partRole === 'hull'
          ? { targetWhiteSurfaces: true, allowHighMetalness: true }
          : {}

        rootObject.traverse((child) => {
          if (!child.isMesh || !child.material) {
            return
          }

          updateMeshMaterials(child, (material) => {
            if (hasExplicitColorSlots && !materialMatchesColorSlots(material, colorMaterialSlots)) {
              return clearShaderTintMaterial(material)
            }

            return applyShaderTintMaterial(material, colorPreset, {
              ...colorOptions,
              forceTint: hasExplicitColorSlots
            })
          })
        })
      }

      if (!loadedRoot) {
        return
      }

      if (!hasCompositeParts) {
        applyLiveColorConfig(loadedRoot, 'full')
        applyOptionalMaterialOverridesToObject(loadedRoot, optionalMaterialOverridesRef.current)
        return
      }

      compositeParts.forEach((part, partIndex) => {
        const partObject = loadedRoot.children[partIndex]
        if (!partObject) {
          return
        }

        applyLiveColorConfig(partObject, getTestHighPartRole(part.id, partIndex))
        applyOptionalMaterialOverridesToObject(partObject, optionalMaterialOverridesRef.current)
      })
    }

    setOptionalMaterialOverridesRef.current = async (nextOverrides) => {
      if (!loadedRoot) {
        return
      }

      try {
        await preloadOptionalMaterialOverrideTextures(nextOverrides)
      } catch (error) {
        console.error(`Failed to load optional BaseColor texture for ${modelId}:`, error)
      }

      if (!hasCompositeParts) {
        clearShaderTintTree(loadedRoot)
        applyColorConfigToObject(loadedRoot, 'full')
        applyOptionalMaterialOverridesToObject(loadedRoot, nextOverrides)
        return
      }

      compositeParts.forEach((part, partIndex) => {
        const partObject = loadedRoot.children[partIndex]
        if (!partObject) {
          return
        }

        clearShaderTintTree(partObject)
        applyColorConfigToObject(partObject, getTestHighPartRole(part.id, partIndex))
        applyOptionalMaterialOverridesToObject(partObject, nextOverrides)
      })
    }

    loadCompositeModelAsync()
      .then(async ({ root, applyMaterials }) => {
        if (isDisposed) {
          return
        }

        loadedRoot = root
        await applyMaterials()
        if (isDisposed) {
          return
        }

        const object3d = root

        const bounds = new THREE.Box3().setFromObject(object3d)
        const size = bounds.getSize(new THREE.Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        if (maxSize > 0) {
          object3d.scale.multiplyScalar(6 / maxSize)
        }

        bounds.setFromObject(object3d)
        const center = bounds.getCenter(new THREE.Vector3())
        object3d.position.sub(center)
        await addConfiguredEnginesAsync(object3d)
        applyDebugTransformToObject(object3d, debugTransform ?? renderConfig.debugTransform)

        bounds.setFromObject(object3d)
        const centeredBounds = bounds.clone()
        const normalizedSize = centeredBounds.getSize(new THREE.Vector3())
        if (waterSurface) {
          const waterRadius = Math.max(Math.max(normalizedSize.x, normalizedSize.z) * waterTuning.radiusScale, 3.4)
          const waterLevel = centeredBounds.min.y + normalizedSize.y * waterTuning.levelFactor
          waterSurface.mesh.scale.setScalar(waterRadius)
          waterSurface.mesh.position.set(0, waterLevel, waterTuning.zOffset)
        }

        if (isStudioLook) {
          stageRoot.clear()

          const shadowStageSize = Math.max(normalizedSize.x, normalizedSize.z) * 1.45
          const shadowStage = new THREE.Mesh(
            new THREE.PlaneGeometry(shadowStageSize, shadowStageSize),
            new THREE.ShadowMaterial({
              opacity: 0.84
            })
          )
          shadowStage.rotation.x = -Math.PI / 2
          shadowStage.position.set(0, centeredBounds.min.y + 0.008, 0)
          shadowStage.receiveShadow = true
          stageRoot.add(shadowStage)
        }

        modelRoot.add(object3d)
        loadedRootRef.current = object3d
        focusCoordinateRootRef.current = object3d
        setFocusTargetRef.current(activeFocusTargetRef.current)
        if (typeof onDebugTransformChangeRef.current === 'function') {
          onDebugTransformChangeRef.current(objectTransformToDebugPayload(object3d))
        }
        syncTransformControls()
        setColorConfigRef.current(colorConfig)
        setOptionalMaterialOverridesRef.current(optionalMaterialOverridesRef.current)
        setLoadingState((previous) => ({
          ...previous,
          phase: '场景已就绪',
          progress: 1,
          downloadedBytes: Math.max(previous.downloadedBytes, previous.totalBytes),
          loadedItems: previous.totalItems || previous.loadedItems,
          speedBytesPerSecond: 0,
          activeLabel: ''
        }))
        setIsSceneLoading(false)
        loadingOverlayTimerRef.current = window.setTimeout(() => {
          setIsLoadingHudVisible(false)
          loadingOverlayTimerRef.current = null
        }, 900)
      })
      .catch((error) => {
        if (isDisposed) {
          return
        }

        if (error?.name === 'AbortError') {
          return
        }

        console.error(`Failed to load ${modelId}:`, error)
        setSceneError('当前 3D 模型加载失败，请刷新后重试。')
        setIsLoadingHudVisible(true)
        setIsSceneLoading(false)
      })

    const resize = () => {
      const width = canvas.clientWidth || 1
      const height = canvas.clientHeight || 1

      updateOrthographicFrustum(exteriorCamera, width / height, 7.6)
      exteriorCamera.updateProjectionMatrix()
      interiorCamera.aspect = width / height
      interiorCamera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    let frameId = 0
    let lastFrameTime = performance.now()
    const renderLoop = () => {
      const now = performance.now()
      const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05)
      lastFrameTime = now
      if (waterSurface) {
        waterSurface.material.uniforms.uTime.value = now * 0.001
      }
      if (interiorSkySphere?.mesh.visible) {
        interiorSkySphere.mesh.position.copy(interiorCamera.position)
      }
      if (modeRef.current === 'exterior') {
        controls.update()
      } else {
        updateFirstPersonMovement(deltaSeconds)
      }
      renderer.render(scene, activeCamera)
      frameId = window.requestAnimationFrame(renderLoop)
    }
    renderLoop()

    return () => {
      isDisposed = true
      if (loadingOverlayTimerRef.current) {
        window.clearTimeout(loadingOverlayTimerRef.current)
        loadingOverlayTimerRef.current = null
      }
      abortController.abort()
      if (progressFrameId) {
        window.cancelAnimationFrame(progressFrameId)
      }
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      controls.dispose()
      if (transformControls) {
        transformControls.dispose()
        scene.remove(transformControls)
        transformControlsRef.current = null
      }
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      if (loadedRoot) {
        if (transformControls?.object === loadedRoot) {
          transformControls.detach()
        }
        modelRoot.remove(loadedRoot)
        loadedRoot.traverse((child) => {
          if (!child.isMesh) {
            return
          }

          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material?.dispose())
          } else {
            child.material?.dispose()
          }
        })
      }

      scene.environment = null
      reflectionEnvironment.dispose()
      environmentTexture.dispose()
      pmremGenerator.dispose()
      externalTextures.forEach((texture) => texture?.dispose())
      controlsRef.current = null
      cameraRef.current = null
      loadedRootRef.current = null
      focusCoordinateRootRef.current = null

      if (waterSurface) {
        waterRoot.remove(waterSurface.mesh)
        waterSurface.geometry.dispose()
        waterSurface.material.dispose()
      }
      if (interiorSkySphere) {
        scene.remove(interiorSkySphere.mesh)
        interiorSkySphere.geometry.dispose()
        interiorSkySphere.material.dispose()
        interiorSkySphere.texture.dispose()
      }

      stageRoot.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        child.geometry?.dispose()
        child.material?.dispose?.()
      })

      renderer.dispose()
    }
  }, [
    compositeParts,
    effectiveModelFormat,
    effectiveModelPath,
    hasRenderableModel,
    hasCompositeParts,
    isStudioLook,
    isTwoLayerBoat,
    modelId,
    overviewZoomScale,
    renderConfig.debugTransform,
    shouldShowWaterSurface,
    uvSets,
    stabilizedSmartSystemPreset,
    focusTargetStrategy
  ])

  useEffect(() => {
    setActiveFocusTarget(resolvedRequestedFocusTarget)
    activeFocusTargetRef.current = resolvedRequestedFocusTarget
  }, [resolvedRequestedFocusTarget, modelId])

  useEffect(() => {
    activeFocusTargetRef.current = activeFocusTarget
    resolvedOrderFocusPresetsRef.current = resolvedOrderFocusPresets
    const appliedFocusTarget = resolveAppliedFocusTarget(
      modelId,
      activeFocusTarget,
      resolvedOrderFocusPresets,
      focusTargetStrategy
    )
    setFocusTargetRef.current(appliedFocusTarget)
    const nextFocusPreset = resolvedOrderFocusPresets[appliedFocusTarget] ?? resolvedOrderFocusPresets.exterior ?? resolvedOrderFocusPresets.overview
    if (nextFocusPreset.cameraMode === CAMERA_MODE_FIRST_PERSON || nextFocusPreset.type === 'interior') {
      setActiveView('interior')
      return
    }

    setActiveView('exterior')
  }, [activeFocusTarget, focusTargetStrategy, modelId, resolvedOrderFocusPresets])

  useEffect(() => {
    setColorConfigRef.current(colorConfig)
  }, [colorConfig])

  useEffect(() => {
    optionalMaterialOverridesRef.current = optionalMaterialOverrides
    setOptionalMaterialOverridesRef.current(optionalMaterialOverrides)
  }, [optionalMaterialOverrides])

  useEffect(() => {
    debugModeRef.current = debugMode
    const transformControls = transformControlsRef.current
    if (!transformControls) {
      return
    }

    const shouldAttach = debugMode && activeView === 'exterior' && Boolean(loadedRootRef.current)
    transformControls.enabled = shouldAttach
    transformControls.visible = shouldAttach
    if (shouldAttach) {
      transformControls.attach(loadedRootRef.current)
    } else {
      transformControls.detach()
      controlsRef.current && (controlsRef.current.enabled = activeView === 'exterior')
    }
  }, [debugMode, activeView])

  useEffect(() => {
    debugTransformModeRef.current = debugTransformMode
    transformControlsRef.current?.setMode(debugTransformMode === 'rotate' ? 'rotate' : 'translate')
  }, [debugTransformMode])

  useEffect(() => {
    onDebugTransformChangeRef.current = onDebugTransformChange
  }, [onDebugTransformChange])

  const handleFocusTargetChange = (target, event = null) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const resolvedTarget = resolveRequestedFocusTarget(modelId, target)
    const appliedTarget = resolveAppliedFocusTarget(
      modelId,
      resolvedTarget,
      resolvedOrderFocusPresetsRef.current,
      focusTargetStrategy
    )
    setActiveFocusTarget(resolvedTarget)
    activeFocusTargetRef.current = resolvedTarget
    setFocusTargetRef.current(appliedTarget)
    if (typeof onFocusTargetChange === 'function') {
      onFocusTargetChange(resolvedTarget)
    }
  }

  const stopViewTogglePointerPropagation = (event) => {
    event.stopPropagation()
  }

  const handleInteriorDeckSwitch = (deck) => {
    interiorDeckRef.current = deck
    setActiveDeck(deck)
    if (activeView !== 'interior') {
      setActiveView('interior')
    }
    setViewPresetRef.current('interior', deck, 
      resolvedOrderFocusPresets.interior ?? { cameraMode: CAMERA_MODE_FIRST_PERSON }
    )
  }

  const viewToggleClassName = `canvas-view-toggle ${isStudioLook ? 'canvas-view-toggle-studio' : ''}`.trim()
  const viewToggle = hasRenderableModel ? (
    <div className={viewToggleClassName} aria-label="场景视角切换">
      <div className="interior-toggle-group">
        <button
          type="button"
          className={`switch-btn ${activeFocusTarget === 'interior' ? 'active' : ''}`}
          onPointerDown={stopViewTogglePointerPropagation}
          onPointerUp={(event) => handleFocusTargetChange('interior', event)}
          onClick={(event) => handleFocusTargetChange('interior', event)}
        >
          内部
        </button>
        {isTwoLayerBoat && activeView === 'interior' && (
          <div className="interior-level-toggle" aria-label="内部楼层切换">
            <button
              type="button"
              className={`switch-btn switch-btn-sm ${activeDeck === '1' ? 'active' : ''}`}
              onPointerDown={stopViewTogglePointerPropagation}
              onClick={() => handleInteriorDeckSwitch('1')}
            >
              一层
            </button>
            <button
              type="button"
              className={`switch-btn switch-btn-sm ${activeDeck === '2' ? 'active' : ''}`}
              onPointerDown={stopViewTogglePointerPropagation}
              onClick={() => handleInteriorDeckSwitch('2')}
            >
              二层
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className={`switch-btn ${activeFocusTarget === 'exterior' ? 'active' : ''}`}
        onPointerDown={stopViewTogglePointerPropagation}
        onPointerUp={(event) => handleFocusTargetChange('exterior', event)}
        onClick={(event) => handleFocusTargetChange('exterior', event)}
      >
        外部
      </button>
      <button
        type="button"
        className={`switch-btn ${activeFocusTarget === 'engine' ? 'active' : ''}`}
        onPointerDown={stopViewTogglePointerPropagation}
        onPointerUp={(event) => handleFocusTargetChange('engine', event)}
        onClick={(event) => handleFocusTargetChange('engine', event)}
      >
        发动机
      </button>
      <button
        type="button"
        className={`switch-btn ${activeFocusTarget === 'console' ? 'active' : ''}`}
        onPointerDown={stopViewTogglePointerPropagation}
        onPointerUp={(event) => handleFocusTargetChange('console', event)}
        onClick={(event) => handleFocusTargetChange('console', event)}
      >
        中控台
      </button>
      <button
        type="button"
        className={`switch-btn ${activeFocusTarget === 'smart-system' ? 'active' : ''}`}
        onPointerDown={stopViewTogglePointerPropagation}
        onPointerUp={(event) => handleFocusTargetChange('smart-system', event)}
        onClick={(event) => handleFocusTargetChange('smart-system', event)}
      >
        智能系统
      </button>
    </div>
  ) : null

  return (
    <div className={`scene-shell ${isStudioLook ? 'scene-shell-studio' : ''}`.trim()} aria-label="3D 船舶预览">
      <canvas className="webgl" ref={canvasRef} />
      {(isLoadingHudVisible || isSceneLoading || sceneError) && (
        <div className="scene-status-overlay" aria-live="polite">
          {sceneError ? (
            <div className="scene-status-card scene-status-card-error">
              <strong>场景未能正常加载</strong>
              <span>{sceneError}</span>
            </div>
          ) : (
            <div className="scene-status-card scene-status-card-loading">
              <strong>3D 场景加载中</strong>
              <span>{loadingState.phase}</span>
              {hasRenderableModel && (
                <div className="scene-progress-stack">
                  <div className="scene-progress-meta">
                    <span>
                      {loadingState.hasKnownTotal
                        ? `${formatTransferSize(loadingState.downloadedBytes)} / ${formatTransferSize(loadingState.totalBytes)}`
                        : `${loadingState.loadedItems} / ${loadingState.totalItems || 1} 项资源`}
                    </span>
                    <strong>{Math.round((loadingState.progress || 0) * 100)}%</strong>
                  </div>
                  <div className="scene-progress-track" aria-hidden="true">
                    <span style={{ width: `${Math.round((loadingState.progress || 0) * 100)}%` }} />
                  </div>
                  <div className="scene-progress-foot">
                    <span>{`资源 ${loadingState.loadedItems} / ${loadingState.totalItems || 0}`}</span>
                    <span>
                      {loadingState.speedBytesPerSecond > 0
                        ? formatTransferSpeed(loadingState.speedBytesPerSecond)
                        : '测速中…'}
                    </span>
                  </div>
                  {loadingState.activeLabel && (
                    <p className="scene-progress-current">{`当前资源：${loadingState.activeLabel}`}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!viewTogglePortalTarget && viewToggle}
      {viewTogglePortalTarget && viewToggle ? createPortal(viewToggle, viewTogglePortalTarget) : null}
    </div>
  )
}