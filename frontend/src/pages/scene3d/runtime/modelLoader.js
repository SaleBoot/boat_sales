import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

import { ENGINE_MODEL_LIBRARY } from '../../../constants/constants_ship_scene.js'

export function createModelLoader({
  modelId,
  modelConfig,
  effectiveModelFormat,
  effectiveModelPath,
  hasCompositeParts,
  compositeParts,
  isTwoLayerBoat,
  uvSets,
  resolveManifestPath,
  loadingTracker,
  materialPipeline
}) {
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()

  const applyMeshShadowFlags = (rootObject) => {
    rootObject.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      child.castShadow = true
      child.receiveShadow = true
    })
  }

  const loadModelAsync = ({ format, path }) => new Promise((resolve, reject) => {
    const assetState = loadingTracker.beginTrackedAsset(path, '正在下载模型文件…')
    const handleProgress = (event) => {
      if (!event) {
        return
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
          format: engineLibraryEntry.format,
          path: resolveManifestPath(engineLibraryEntry.path)
        })

        applyMeshShadowFlags(engineObject)

        try {
          await materialPipeline.loadAndApplyUvMaps(
            engineObject,
            engineLibraryEntry.uvSets,
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
              await materialPipeline.loadAndApplyTwoLayerMaps(object3d)
            } catch (error) {
              console.error('Failed to load fixed texture maps for TwoLayerBoat:', error)
            }
            materialPipeline.applyTwoLayerOverrides(object3d)
            return
          }

          if (uvSets.length > 0) {
            try {
              await materialPipeline.loadAndApplyUvMaps(object3d, uvSets, effectiveModelFormat, modelId)
            } catch (error) {
              console.error(`Failed to load UV set textures for ${modelId}:`, error)
            }
          }

          if (modelId === 'TestHigh') {
            materialPipeline.applyTestHighStudioOverrides(object3d, modelId, 0)
          }

          materialPipeline.applyColorConfigToObject(object3d, 'full')
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
              materialPipeline.applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
            }
            continue
          }

          try {
            await materialPipeline.loadAndApplyUvMaps(part.object3d, part.uvSets, part.format, `${modelId}/${part.id}`)
          } catch (error) {
            console.error(`Failed to load UV set textures for ${modelId}/${part.id}:`, error)
          }

          if (modelId === 'TestHigh') {
            materialPipeline.applyTestHighStudioOverrides(part.object3d, part.id, partIndex)
          }

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
