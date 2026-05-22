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

  const setViewPreset = (mode, deck = interiorDeckRef.current, preset = null) => {
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
      setActiveCamera(interiorCamera)
      cameraRef.current = interiorCamera
      controls.enabled = false
      interiorPoseRef.current.cameraMode = CAMERA_MODE_FIRST_PERSON

      const deckPreset = interiorDeckPresets[effectiveDeck] ?? interiorDeckPresets['1']
      if (
        preset?.target ||
        preset?.position ||
        Number.isFinite(Number(preset?.zoom)) ||
        getPresetRotationValue(preset)
      ) {
        applyFirstPersonCameraPreset(preset, deckPreset)
      } else {
        const lookAngles = getFirstPersonLookAnglesFromPreset(preset, deckPreset.yaw, deckPreset.pitch)
        interiorPoseRef.current.position.copy(deckPreset.position)
        interiorPoseRef.current.yaw = preset?.yaw ?? lookAngles.yaw
        interiorPoseRef.current.pitch = preset?.pitch ?? lookAngles.pitch
        updateInteriorOrientation()
      }
    } else {
      setActiveCamera(exteriorCamera)
      cameraRef.current = exteriorCamera
      controls.enabled = true
      interiorPoseRef.current.cameraMode = CAMERA_MODE_ORBIT
      interiorPoseRef.current.keys.clear()
      applyExteriorCameraPreset(preset)
    }
    syncTransformControls()
  }

  const setFocusTarget = (target) => {
    const latestFocusPresets = resolvedOrderFocusPresetsRef.current
    const preset = target === 'smart-system' && stabilizedSmartSystemPreset
      ? stabilizedSmartSystemPreset
      : (latestFocusPresets[target] ?? latestFocusPresets.exterior ?? latestFocusPresets.overview)
    if (preset.cameraMode === CAMERA_MODE_FIRST_PERSON || preset.type === 'interior') {
      setViewPreset('interior', preset.deck ?? '1', preset)
      return
    }

    setViewPreset('exterior', interiorDeckRef.current, preset)
  }

  return {
    setFocusTarget,
    setViewPreset
  }
}
