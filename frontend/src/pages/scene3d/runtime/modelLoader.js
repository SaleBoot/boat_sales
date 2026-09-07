import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

import { ENGINE_MODEL_LIBRARY } from '../../../constants/constants_ship_scene.js'

export function createModelLoader({
  modelId,
  modelConfig,  
  compositeParts,
  isTwoLayerBoat,
  matSlots,
  resolveUrlPath,
  loadingTracker,
  materialPipeline
}) {
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()
  
  const  hasCompositeParts = Array.isArray(compositeParts)? compositeParts.length > 0 : false
  const  effectiveModelPath = compositeParts?.[0] || ''
  const  effectiveModelFormat = effectiveModelPath.split('.').pop()?.toLowerCase() || 'glb'
  console.log("createModelLoader...::compositeParts",compositeParts,"matSlots=",matSlots )

  const applyMeshShadowFlags = (rootObject) => {
    rootObject.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      child.castShadow = true
      child.receiveShadow = true
    })
  }

  const loadModelAsync = ({ path }) => new Promise((resolve, reject) => {
    const assetState = loadingTracker.beginTrackedAsset(path, '正在下载模型文件…')
    const handleProgress = (event) => {
      if (!event) {
        return
      }

      if (event.total > 0) {
        const percent = Math.floor((event.loaded / event.total) * 100)
        // console.log(`[modelLoader] Loading progress for ${path}: ${percent}%`)
      }

      if (event.total) {
        loadingTracker.setAssetExpectedBytes(path, event.total)
      }

      const nextLoadedBytes = Number.isFinite(event.loaded) ? event.loaded : 0
      const deltaBytes = nextLoadedBytes - assetState.loadedBytes
      assetState.loadedBytes = nextLoadedBytes
      loadingTracker.noteDownloadedBytes(deltaBytes)
    }
    const handleComplete = (object3d) => {
      if (assetState.totalBytes > assetState.loadedBytes) {
        const deltaBytes = assetState.totalBytes - assetState.loadedBytes
        assetState.loadedBytes = assetState.totalBytes
        loadingTracker.noteDownloadedBytes(deltaBytes)
      }
      loadingTracker.markAssetCompleted(path, '正在下载模型文件…')
      resolve(object3d)
    }
    const handleError = (error) => {
      console.error(`[modelLoader] CRITICAL: An error occurred during model loading for ${path}.`, error)
      reject(error)
    }

    if (!path) {
      return handleError(new Error('Load path is empty or invalid.'));
    }

    const fileExt = path.split('.').pop()?.toLowerCase().trim();
    
    if (fileExt === 'fbx') {
      // console.log(`%c[modelLoader] Using FBXLoader for: ${path}`, 'color: blue; font-weight: bold;');
      fbxLoader.load(path, handleComplete, handleProgress, handleError);
      return;
    }

    // Default to GLTFLoader for 'gltf', 'glb', or any other extension
    // console.log(`%c[modelLoader] Using GLTFLoader for: ${path}`, 'color: green; font-weight: bold;');
    gltfLoader.load(
      path,
      (gltf) => {
        const object3d = gltf.scene ?? gltf.scenes?.[0];
        if (!object3d) {
          return handleError(new Error(`${modelId} does not contain a scene root.`));
        }
        handleComplete(object3d);
      },
      handleProgress,
      handleError
    );
  });
  // 这个函数负责根据模型配置动态加载并添加 发动机引擎模型 到船只上
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

    for (const [engineIndex, engineConfig] of configuredEngines.entries()) 
    {
      const engineType = `${engineConfig?.type ?? 'outboard-a'}`.trim() || 'outboard-a'
      const engineLibraryEntry = ENGINE_MODEL_LIBRARY[engineType] ?? ENGINE_MODEL_LIBRARY['outboard-a']
      try {
 
        const engineObject = await loadModelAsync({
          path: resolveUrlPath(engineLibraryEntry.path)
        })

        applyMeshShadowFlags(engineObject)

        try {
          await materialPipeline.loadAndApplyUvMaps(
            engineObject,
            engineLibraryEntry.matSlots,
            engineLibraryEntry.format,
            `${modelId}/engine-${engineIndex + 1}`
          )
        } catch (error) {
          console.error(`Failed to load configured engine textures for ${modelId}:`, error)
        }

        materialPipeline.applyCabnetTwinEngineFinish(engineObject)

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

  /**
   * 异步加载主船体模型，核心函数之一。
   * 它负责处理两种主要的模型加载场景：
   * 1. 单一模型（Simple Model）：整个船体是一个单独的3D文件。
   * 2. 复合模型（Composite Model）：船体由多个可分离的3D文件（部件）组合而成。
   * 
   * @returns {Promise<{root: THREE.Object3D, applyMaterials: Function}>} 
   *          返回一个对象，包含加载完成的根3D对象(root)和用于后续应用材质的函数(applyMaterials)。
   */
  const loadCompositeModelAsync = async () => {
    // --- 场景一：加载单一模型 ---
    // 如果模型配置中没有定义复合部件(hasCompositeParts为false)，则执行此逻辑。
    
    if (!hasCompositeParts) {      
      console.log("loadCompositeModelAsync;;;effectiveModelPath=", effectiveModelPath);
      // 调用 loadModelAsync 加载单个模型文件。
      const object3d = await loadModelAsync({
         path: effectiveModelPath
      })
      // 为模型的所有网格启用阴影投射和接收。
      applyMeshShadowFlags(object3d)

      // 返回加载的模型对象，以及一个专门用于处理其材质的函数。
      return {
        root: object3d,
        /**
         * 应用材质的异步函数。
         * 此函数将在模型加载后被调用，负责贴图和颜色配置。
         */
        applyMaterials: async () => {
          // 特殊处理：针对“双层船体”有特定的贴图逻辑。
          // console.log("modelLoader::applyMaterials::1");
          if (isTwoLayerBoat) {
            try {
              await materialPipeline.loadAndApplyTwoLayerMaps(object3d)
            } catch (error) {
              console.error('Failed to load fixed texture maps for TwoLayerBoat:', error)
            }
            materialPipeline.applyTwoLayerOverrides(object3d)
            return
          }
          console.log("modelLoader::applyMaterials::2,matSlots.length",matSlots.length);
          // 标准处理：根据配置的UV集加载并应用纹理。
          if (matSlots.length > 0) {
            try {
              await materialPipeline.loadAndApplyUvMaps(object3d, matSlots, effectiveModelFormat, modelId)
            } catch (error) {
              console.error(`Failed to load UV set textures for ${modelId}:`, error)
            }
          }

          // 特殊覆盖：针对 'TestHigh' 模型的特殊材质。
          if (modelId === 'TestHigh') {
            materialPipeline.applyTestHighStudioOverrides(object3d, modelId, 0)
          }

          // 应用最终的颜色配置到整个模型。
          materialPipeline.applyColorConfigToObject(object3d, 'full')
        }
      }
    }

    // --- 场景二：加载复合模型 ---
    // 如果模型由多个部件组成，则执行此逻辑。

    // 创建一个 THREE.Group 作为所有部件的父容器，它将代表整个复合模型。
    const compositeRoot = new THREE.Group()
    // 使用 Promise.all 并行加载所有已定义的模型部件，以提高效率。
    const loadedParts = await Promise.all(compositeParts.map(async (part) => {
      // 解析当前部件的模型格式和路径。
      const partFormat =  part.split('.').pop()?.toLowerCase() || 'glb'
      const partPath = resolveUrlPath(part)
      console.log(`Loading composite part model from: ${partPath} (format: ${partFormat})`)
      
      // 加载单个部件的3D模型。
      const object3d = await loadModelAsync({ 
        path: partPath
      })
      // 为部件启用阴影。
      applyMeshShadowFlags(object3d)

      // 将加载完成的部件添加到父容器中。
      compositeRoot.add(object3d)

      // 返回该部件的详细信息，供后续材质应用步骤使用。
      return {
        id: part,
        format: partFormat,
        object3d,
        matSlots: matSlots ?? []
      }
    }))

    // 返回组装完成的复合模型，以及一个用于处理其各部件材质的函数。
    return {
      root: compositeRoot,
      /**
       * 为复合模型的每个部件独立应用材质的异步函数。
       */
      applyMaterials: async () => {
        for (const [partIndex, part] of loadedParts.entries()) {
          // 如果部件没有定义UV集，可能它有特殊的材质逻辑或不需要贴图。
          if (part.matSlots.length === 0) {
            if (modelId === 'TestHigh') {
              materialPipeline.applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
            }
            continue // 继续处理下一个部件。
          }

          // 根据部件自身的UV集，为其加载并应用纹理。
          try {
            await materialPipeline.loadAndApplyUvMaps(part.object3d, part.matSlots, part.format, `${modelId}/${part.id}`)
          } catch (error) {
            console.error(`Failed to load UV set textures for ${modelId}/${part.id}:`, error)
          }

          // 针对 'TestHigh' 模型的特殊材质覆盖。
          if (modelId === 'TestHigh') {
            materialPipeline.applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
          }

          // 根据部件的角色（role）应用颜色配置。
          materialPipeline.applyColorConfigToObject(part.object3d, materialPipeline.getTestHighPartRole(part.id, partIndex))
        }
      }
    }
  }

  return {
    addConfiguredEnginesAsync,
    loadCompositeModelAsync,
    loadModelAsync
  }
}