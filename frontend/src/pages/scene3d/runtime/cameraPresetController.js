import * as THREE from 'three'

import {
  degreesVectorToEuler,
  focusVectorToArray,
  getFirstPersonLookAnglesFromPreset,
  getOrbitViewDirectionFromRotation,
  getPresetRotationValue,
  getYawPitchFromCamera
} from '../../../utils/utils_3js.js'

import {
  normalizeCameraMode
} from '../../../utils/utils_ship_scene.js'

import {
  CAMERA_MODE_FIRST_PERSON,
  CAMERA_MODE_ORBIT,
  FOCUS_COORDINATE_SPACE_MODEL_LOCAL,
  FOCUS_COORDINATE_SPACE_SCENE
} from '../../../constants/constants_ship_scene.js'

export function createCameraPresetController({
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
  setActiveCamera,
  syncTransformControls
}) {
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

  const applyFirstPersonRotation = (rotationValue) => {
    interiorCamera.rotation.copy(degreesVectorToEuler(rotationValue))
    const lookAngles = getYawPitchFromCamera(interiorCamera)
    const interiorPose = interiorPoseRef.current
    interiorPose.yaw = lookAngles.yaw
    interiorPose.pitch = lookAngles.pitch
    updateInteriorOrientation()
  }

  const applyFirstPersonCameraPreset = (preset, deckPreset) => {
    const deckPosition = [deckPreset.position.x, deckPreset.position.y, deckPreset.position.z]
    const cameraPosition = toSceneFocusCoordinate(
      preset?.target ?? preset?.position ?? deckPosition,
      preset?.coordinateSpace
    )
    const rotationPreset = getPresetRotationValue(preset)
    const interiorPose = interiorPoseRef.current
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

  const updatePresentationOffset = (mode) => {
    presentationRoot.position.y = mode === 'exterior' ? exteriorCameraPreset.stageOffsetY : 0
    modelRoot.position.y = (mode === 'exterior' && shouldShowWaterSurface)
      ? waterTuning.exteriorModelLiftY
      : 0
  }

  const applyExteriorCameraPreset = (preset) => {
    const safePreset = preset ?? {}
    const nextTarget = safePreset.target ?? [0, exteriorCameraPreset.targetY, 0]
    const focusTargetVector = toSceneFocusCoordinate(nextTarget, safePreset.coordinateSpace)

    const baseTargetVector = new THREE.Vector3(0, exteriorCameraPreset.targetY, 0)
    const baseCameraVector = new THREE.Vector3(...exteriorCameraPreset.position)
    const rotationPreset = getPresetRotationValue(safePreset)
    const viewDirection = rotationPreset
      ? getOrbitViewDirectionFromRotation(rotationPreset)
      : baseCameraVector.sub(baseTargetVector).normalize()

    const fallbackDistance = Math.max(
      new THREE.Vector3(...exteriorCameraPreset.position).distanceTo(baseTargetVector),
      0.01
    )
    const nextDistance = Number.isFinite(Number(safePreset.zoom)) && Number(safePreset.zoom) > 0
      ? Number(safePreset.zoom)
      : fallbackDistance
    const nextPosition = focusTargetVector.clone().add(viewDirection.multiplyScalar(nextDistance))

    exteriorCamera.position.copy(nextPosition)
    exteriorCamera.zoom = exteriorCameraPreset.zoom
    controls.target.copy(focusTargetVector)
    exteriorCamera.updateProjectionMatrix()
    controls.update()
  }

  /**
   * 设置相机视图预设，是切换内外景、应用相机位置的核心函数。
   * 它会根据参数决定最终的相机模式（第一人称/轨道）和视图模式（内景/外景），
   * 然后配置并激活相应的相机和控制器。
   *
   * @param {('interior'|'exterior')} mode - 期望的视图模式。'interior' 表示内景，'exterior' 表示外景。
   * @param {string} [deck=interiorDeckRef.current] - 对于内景模式，指定所在的甲板层级（如 '1' 或 '2'）。
   * @param {object|null} [preset=null] - 一个相机预设对象，可以包含 position, target, rotation, zoom, cameraMode 等字段，用于精确控制相机状态。
   *                                      如果为 null，则会使用基于 mode 和 deck 的默认状态。
   */
  const setViewPreset = (mode, deck = interiorDeckRef.current, preset = null) => {
    // 1. 确定最终的相机控制模式 (第一人称 或 轨道环绕)
    //    - 如果 preset 中明确指定了 cameraMode，则使用它。
    //    - 否则，根据期望的视图模式 mode 来决定：内景默认为第一人称，外景默认为轨道环绕。
    const cameraMode = normalizeCameraMode(
      preset?.cameraMode,
      mode === 'interior' ? CAMERA_MODE_FIRST_PERSON : CAMERA_MODE_ORBIT
    )
    // 2. 确定最终的有效视图模式 (内景 或 外景)
    //    - 如果相机模式是第一人称，则强制为内景模式。
    //    - 否则，为外景模式。
    const effectiveMode = cameraMode === CAMERA_MODE_FIRST_PERSON ? 'interior' : 'exterior'
    modeRef.current = effectiveMode
    const effectiveDeck = isTwoLayerBoat ? deck : '1'

    // 3. 根据视图模式调整场景元素的可见性和位置
    //    - 外景时，抬升整个舞台 (presentationRoot) 以适应相机高度，并根据需要调整模型 (modelRoot) 的高度。
    updatePresentationOffset(effectiveMode)

    //    - 外景时显示水面，内景时隐藏。
    if (waterSurface) {
      waterSurface.mesh.visible = effectiveMode === 'exterior'
    }
    //    - 内景时显示内部环境贴图（天空球），外景时隐藏。
    if (interiorSkySphere) {
      interiorSkySphere.mesh.visible = effectiveMode === 'interior'
    }

    // 4. 根据最终的视图模式，配置并激活相应的相机和控制器
    if (effectiveMode === 'interior') {
      // --- 内景模式 ---
      setActiveCamera(interiorCamera) // 激活内景相机
      cameraRef.current = interiorCamera
      controls.enabled = false // 禁用轨道控制器
      interiorPoseRef.current.cameraMode = CAMERA_MODE_FIRST_PERSON // 标记当前为第一人称模式

      const deckPreset = interiorDeckPresets[effectiveDeck] ?? interiorDeckPresets['1']
      // 如果传入了详细的 preset，则应用它来设置相机位置和姿态
      if (
        preset?.target ||
        preset?.position ||
        Number.isFinite(Number(preset?.zoom)) ||
        getPresetRotationValue(preset)
      ) {
        applyFirstPersonCameraPreset(preset, deckPreset)
      } else {
        // 否则，使用甲板的默认预设位置，并允许 preset 微调初始视角
        const lookAngles = getFirstPersonLookAnglesFromPreset(preset, deckPreset.yaw, deckPreset.pitch)
        interiorPoseRef.current.position.copy(deckPreset.position)
        interiorPoseRef.current.yaw = preset?.yaw ?? lookAngles.yaw
        interiorPoseRef.current.pitch = preset?.pitch ?? lookAngles.pitch
        updateInteriorOrientation()
      }
    } else {
      // --- 外景模式 ---
      setActiveCamera(exteriorCamera) // 激活外景相机
      cameraRef.current = exteriorCamera
      controls.enabled = true // 启用轨道控制器
      interiorPoseRef.current.cameraMode = CAMERA_MODE_ORBIT // 标记当前为轨道模式
      interiorPoseRef.current.keys.clear() // 清除可能残留的键盘移动状态
      applyExteriorCameraPreset(preset) // 应用外景相机预设
    }
    syncTransformControls()
  }

  /**
   * 设置相机聚焦目标，是一个更高级的视图切换函数。
   * 它接收一个语义化的目标名称（如 'console', 'engine'），
   * 然后从预设配置中查找对应的相机参数，并调用 setViewPreset 来执行切换。
   *
   * @param {string} target - 目标名称。例如 'exterior', 'console', 'engine', 'smart-system'。
   */
  const setFocusTarget = (target) => {
    // 1. 从已解析的预设列表中获取最新的预设配置
    const latestFocusPresets = resolvedOrderFocusPresetsRef.current

    // 2. 根据目标名称查找具体的预设对象
    //    - 'smart-system' 是一个特殊目标，使用稳定化的预设
    //    - 'exterior' 直接使用外景预设
    //    - 其他目标按名称查找，并提供 'exterior' 和 'overview' 作为备用
    const preset = target === 'smart-system' && stabilizedSmartSystemPreset
      ? stabilizedSmartSystemPreset
      : target === 'exterior'
      ? latestFocusPresets.exterior
      : (latestFocusPresets[target] ?? latestFocusPresets.exterior ?? latestFocusPresets.overview)

    // 3. 处理 'exterior' 目标的特殊情况
    if (target === 'exterior') {
      setViewPreset('exterior', interiorDeckRef.current, preset)
      return
    }

    // 4. 根据预设的类型（内景/外景）或相机模式（第一人称/轨道）调用 setViewPreset
    //    - 如果预设是第一人称或内景类型，则切换到内景视图
    if (preset.cameraMode === CAMERA_MODE_FIRST_PERSON || preset.type === 'interior') {
      setViewPreset('interior', preset.deck ?? '1', preset)
      return
    }

    // 5. 默认情况下，切换到外景视图
    setViewPreset('exterior', interiorDeckRef.current, preset)
  }

  return {
    setFocusTarget,
    setViewPreset
  }
}