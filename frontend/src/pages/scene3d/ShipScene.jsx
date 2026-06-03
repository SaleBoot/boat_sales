﻿import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

import {  
  normalizeDebugTransform,  
  getExteriorCameraDistance,
  scaleFocusDistance,
  getInteriorDeckPresets,
  getWaterTuning,
  mergeVectorPreset,
  mergeInteriorDeckPresets,   
  getOrderFocusPresets,
  objectTransformToDebugPayload,
  applyDebugTransformToObject,
  normalizeOrderFocusPreset,
  normalizeOrderFocusPresets,
} from '../../utils/utils_3js.js';

import { 
  formatTransferSize,
  formatTransferSpeed,   
  getStaticAssetBaseUrl, 
  createInitialLoadingState,
  isStudioLookModel,
  getExteriorCameraPreset,
  resolveRequestedFocusTarget,
  resolveAppliedFocusTarget,
} from '../../utils/utils_ship_scene.js';

import {
  WATER_SURFACE_ENABLED, 
  EMPTY_ARRAY, 
  CAMERA_MODE_FIRST_PERSON,
  TWO_LAYER_TRACKED_TEXTURE_PATHS
} from '../../constants/constants_ship_scene.js';
import { useThree } from './hooks/useThree.js';
import { useFirstPersonControls } from './hooks/useFirstPersonControls.js';
import { createLoadingTracker } from './runtime/loadingTracker.js';
import { createCameraPresetController } from './runtime/cameraPresetController.js';
import { createMaterialPipeline } from './runtime/materialPipeline.js';
import { createModelLoader } from './runtime/modelLoader.js';
import { disposeLoadedRoot } from './runtime/disposeLoadedRoot.js';


function setupTransformControls(scene, 
    camera, 
    canvas, 
    onDebugTransformChangeRef, 
    debugTransformModeRef, 
    controls, 
    loadedRootRef) 
{
  if (typeof onDebugTransformChangeRef.current !== 'function') {
    return null
  }

  const transformControls = new TransformControls(camera, canvas)
  transformControls.enabled = false
  transformControls.visible = false
  transformControls.setMode(debugTransformModeRef.current === 'rotate' ? 'rotate' : 'translate')
  
  transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value
  })
  
  transformControls.addEventListener('objectChange', () => {
    if (typeof onDebugTransformChangeRef.current === 'function' && loadedRootRef.current) {
      onDebugTransformChangeRef.current(objectTransformToDebugPayload(loadedRootRef.current))
    }
  })
  
  scene.add(transformControls)
  return transformControls
}

// --------------------------------------------------------------
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
  // console.log('ShipScene start, modelConfig:', modelConfig);
  const assetBaseUrl = getStaticAssetBaseUrl(
    import.meta.env.VITE_REMOTE_FBX_ORIGIN,
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
  
  // console.log("modelConfig=",modelConfig)

  // 复合部件
  const compositeParts = modelConfig?.parts ?? EMPTY_ARRAY
  const hasCompositeParts = compositeParts.length > 0
  const shouldUseSinglePartCompositeFallback = !modelConfig?.model?.path && compositeParts.length === 1
  const effectiveModelConfig = shouldUseSinglePartCompositeFallback
    ? compositeParts[0]?.model ?? null
    : modelConfig?.model ?? null
  
  // const effectiveMatSlots = shouldUseSinglePartCompositeFallback
  //   ? compositeParts[0]?.matSlots ?? EMPTY_ARRAY
  //   : modelConfig?.model?.primaryModelInfo?.matSlots ?? EMPTY_ARRAY
  const effectiveMatSlots =  modelConfig?.primaryModelInfo?.matSlots ?? EMPTY_ARRAY
  // console.log("000..effectiveMatSlots=",effectiveMatSlots)
  const hasRenderableModel = Boolean(effectiveModelConfig?.path || hasCompositeParts)
  // 模型格式 
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
  const exteriorCameraPreset = useMemo(() => {
    const base = mergeVectorPreset(getExteriorCameraPreset(modelId), renderConfig.exteriorCamera);
    return {
        ...base,
        zoom: base.zoom * overviewZoomScale
    };
  }, [modelId, renderConfig.exteriorCamera, overviewZoomScale]);

  const interiorDeckPresetConfig = useMemo(() => 
    mergeInteriorDeckPresets(getInteriorDeckPresets(modelId), renderConfig.interiorDecks),
    [modelId, renderConfig.interiorDecks]
  );
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
  const effectiveModelPath = modelPath
  // ===== TwoLayerBoat Locked Block END =====
  const matSlots = effectiveMatSlots
  // console.log("matSlots=",matSlots)

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
    if (loadingOverlayTimerRef.current) {
      window.clearTimeout(loadingOverlayTimerRef.current)
      loadingOverlayTimerRef.current = null
    }

    modeRef.current = 'exterior'
    cameraRef.current = null
    loadedRootRef.current = null
    focusCoordinateRootRef.current = null
    transformControlsRef.current?.detach?.()
    setActiveView('exterior')
    setIsSceneLoading(true)
    setIsLoadingHudVisible(true)
    setSceneError('')
    setLoadingState(createInitialLoadingState(hasRenderableModel))
  }, [modelId, effectiveModelPath, hasRenderableModel])

  // 初始化threejs 场景
  const threeContext = useThree(canvasRef, {
    isStudioLook,
    shouldShowWaterSurface,
    exteriorCameraPreset,
    interiorDeckPresetConfig,
  });
  // 初始化第一人称控制
  const {
    updateFirstPersonMovement,
    interiorPoseRef,
    updateInteriorOrientation,
  } = useFirstPersonControls(threeContext, canvasRef, modeRef);

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !threeContext) {
      return undefined
    }
    
    const {
      renderer,
      scene,
      presentationRoot,
      modelRoot,
      waterRoot,
      stageRoot,
      waterSurface,
      interiorSkySphere,
      exteriorCamera,
      interiorCamera,
      controls,
      pmremGenerator,
      reflectionEnvironment,
      environmentTexture
    } = threeContext;

    // Restore the initial position from the original logic
    interiorPoseRef.current.position.set(...(interiorDeckPresetConfig['1']?.position ?? [0, 0.68, -0.82]));

    if (!hasRenderableModel) {
      setIsSceneLoading(true)
      setSceneError('')
      setLoadingState(createInitialLoadingState(false))
      setIsLoadingHudVisible(true)
      return undefined
    }

    let isDisposed = false
    const getIsDisposed = () => isDisposed
    if (loadingOverlayTimerRef.current) {
      window.clearTimeout(loadingOverlayTimerRef.current)
      loadingOverlayTimerRef.current = null
    }
    setIsSceneLoading(true)
    setSceneError('')
    setIsLoadingHudVisible(true)
    const abortController = new AbortController()

    let activeCamera = exteriorCamera
    cameraRef.current = activeCamera

    controlsRef.current = controls

    let transformControls = null
    const syncTransformControls = () => {
      if (!transformControls) {
        return
      }

      const shouldAttach = debugModeRef.current && 
                          modeRef.current === 'exterior' && 
                          Boolean(loadedRootRef.current)
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

    transformControls = setupTransformControls(scene, exteriorCamera, canvas, 
        onDebugTransformChangeRef, debugTransformModeRef, controls, loadedRootRef)
    if (transformControls) {
      transformControlsRef.current = transformControls
    }

    const cameraPresetController = createCameraPresetController({
      presentationRoot,
      modelRoot,
      waterSurface,
      interiorSkySphere,
      exteriorCamera,
      interiorCamera,
      controls,
      exteriorCameraPreset,
      interiorDeckPresetConfig,
      shouldShowWaterSurface,
      waterTuning,
      isTwoLayerBoat,
      modeRef,
      interiorDeckRef,
      interiorPoseRef,
      cameraRef,
      focusCoordinateRootRef,
      resolvedOrderFocusPresetsRef,
      stabilizedSmartSystemPreset,
      updateInteriorOrientation,
      setActiveCamera: (nextCamera) => {
        activeCamera = nextCamera
      },
      syncTransformControls
    })

    setViewPresetRef.current = cameraPresetController.setViewPreset
    setFocusTargetRef.current = cameraPresetController.setFocusTarget

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
      const pushUvTextureUrls = (targetMatSlots) => {
        targetMatSlots.forEach((matSlot) => {
          Object.values(matSlot?.textures ?? {}).forEach((assetPath) => {
            pushAssetUrl(assetPath)
          })
        })
      }

      if (hasCompositeParts) {
        compositeParts.forEach((part) => {
          pushAssetUrl(part?.model?.path)
          pushUvTextureUrls(part?.matSlots ?? EMPTY_ARRAY)
        })
      } else {
        pushAssetUrl(effectiveModelPath, (value) => value)
        if (isTwoLayerBoat) {
          TWO_LAYER_TRACKED_TEXTURE_PATHS.forEach((assetPath) => {
            pushAssetUrl(assetPath, resolveAssetPath)
          })
        } else {
          pushUvTextureUrls(matSlots)
        }
      }

      return [...new Set(assetUrls.filter(Boolean))]
    })()
    const loadingTracker = createLoadingTracker({
      trackedAssetUrls,
      setLoadingState,
      isDisposed: getIsDisposed
    })

    loadingTracker.estimateAssetSizes(abortController.signal)

    const loadTextureAsync = (path) => {
      // console.log("loadTextureAsync,path=" ,path)

      if (texturePromiseCache.has(path)) {
        return texturePromiseCache.get(path)
      }

      const texturePromise = new Promise((resolve, reject) => {
        const assetState = loadingTracker.beginTrackedAsset(path, '正在下载贴图资源…')

        textureLoader.load(
          path,
          (texture) => {
            if (assetState.totalBytes > assetState.loadedBytes) {
              const deltaBytes = assetState.totalBytes - assetState.loadedBytes
              assetState.loadedBytes = assetState.totalBytes
              loadingTracker.noteDownloadedBytes(deltaBytes)
            }
            loadingTracker.markAssetCompleted(path, '正在下载贴图资源…')

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

    const materialPipeline = createMaterialPipeline({
      modelId,
      colorConfig,
      effectiveModelFormat: effectiveModelPath.split('.').pop()?.toLowerCase() || 'glb',
      resolveAssetPath,
      resolveManifestPath,
      loadTextureAsync,
      externalTextures,
      texturePromiseCache
    })

    const modelLoader = createModelLoader({
      modelId,
      modelConfig, 
      effectiveModelPath,
      hasCompositeParts,
      compositeParts,
      isTwoLayerBoat,
      matSlots,
      resolveManifestPath,
      loadingTracker,
      materialPipeline
    })

    setColorConfigRef.current = (nextColorConfig) => {
      if (!loadedRoot) {
        return
      }

      if (!hasCompositeParts) {
        materialPipeline.applyColorConfigToObject(loadedRoot, 'full', nextColorConfig)
        materialPipeline.applyOptionalMaterialOverridesToObject(loadedRoot, optionalMaterialOverridesRef.current)
        return
      }

      compositeParts.forEach((part, partIndex) => {
        const partObject = loadedRoot.children[partIndex]
        if (!partObject) {
          return
        }

        materialPipeline.applyColorConfigToObject(
          partObject,
          materialPipeline.getTestHighPartRole(part.id, partIndex),
          nextColorConfig
        )
        materialPipeline.applyOptionalMaterialOverridesToObject(partObject, optionalMaterialOverridesRef.current)
      })
    }

    setOptionalMaterialOverridesRef.current = async (nextOverrides) => {
      if (!loadedRoot) {
        return
      }

      try {
        await materialPipeline.preloadOptionalMaterialOverrideTextures(nextOverrides)
      } catch (error) {
        console.error(`Failed to load optional BaseColor texture for ${modelId}:`, error)
      }

      if (!hasCompositeParts) {
        materialPipeline.clearShaderTintTree(loadedRoot)
        materialPipeline.applyColorConfigToObject(loadedRoot, 'full')
        materialPipeline.applyOptionalMaterialOverridesToObject(loadedRoot, nextOverrides)
        return
      }

      compositeParts.forEach((part, partIndex) => {
        const partObject = loadedRoot.children[partIndex]
        if (!partObject) {
          return
        }

        materialPipeline.clearShaderTintTree(partObject)
        materialPipeline.applyColorConfigToObject(partObject, materialPipeline.getTestHighPartRole(part.id, partIndex))
        materialPipeline.applyOptionalMaterialOverridesToObject(partObject, nextOverrides)
      })
    }

    modelLoader.loadCompositeModelAsync()
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
        await modelLoader.addConfiguredEnginesAsync(object3d)
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
      loadingTracker.dispose()
      window.cancelAnimationFrame(frameId)
       
      if (transformControls) {
        transformControls.dispose()
        scene.remove(transformControls)
        transformControlsRef.current = null
      }

      disposeLoadedRoot({
        loadedRoot,
        modelRoot,
        transformControls
      })

      externalTextures.forEach((texture) => texture?.dispose())
      controlsRef.current = null
      cameraRef.current = null
      loadedRootRef.current = null
      focusCoordinateRootRef.current = null

      stageRoot.traverse((child) => {
        if (!child.isMesh) {
          return
        }

        child.geometry?.dispose()
        child.material?.dispose?.()
      })
      stageRoot.clear()
    }
  }, [
    compositeParts, 
    effectiveModelPath,
    hasRenderableModel,
    hasCompositeParts,
    isStudioLook,
    isTwoLayerBoat,
    modelId,
    overviewZoomScale,
    renderConfig.debugTransform,
    shouldShowWaterSurface,
    matSlots,
    stabilizedSmartSystemPreset,
    focusTargetStrategy,
    threeContext
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
    if (appliedFocusTarget === 'exterior') {
      setActiveView('exterior')
      return
    }

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