import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader }     from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { 
  DEFAULT_EXTERIOR_CAMERA_PRESET, 
  STUDIO_EXTERIOR_CAMERA_PRESET,
  EXTERIOR_TARGET_Y,
  TEST_HIGH_INTERIOR_DECK_PRESETS,
  DEFAULT_INTERIOR_DECK_PRESETS,
  DEFAULT_WATER_TUNING,
  MODEL_WATER_TUNING,
  CAMERA_MODE_ORBIT,
  CAMERA_MODE_FIRST_PERSON,
  DEFAULT_CAMERA_ROTATION_DEGREES
} from '../constants/constants_ship_scene.js';

import {  
  getExteriorCameraPreset,
  normalizeCameraMode,
  normalizeFocusCoordinateSpace ,
  isColorTintCandidate
} from './utils_ship_scene.js';

export function updateOrthographicFrustum(camera, aspect, frustumHeight) {
  const safeAspect = Math.max(aspect, 0.01)
  const halfHeight = frustumHeight / 2
  const halfWidth = halfHeight * safeAspect

  camera.left = -halfWidth
  camera.right = halfWidth
  camera.top = halfHeight
  camera.bottom = -halfHeight
}

 
export function focusVectorToArray(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value) && value.length >= 3) {
    return [
      Number(value[0]) || 0,
      Number(value[1]) || 0,
      Number(value[2]) || 0
    ]
  }

  if (value && typeof value === 'object') {
    return [
      Number(value.x) || 0,
      Number(value.y) || 0,
      Number(value.z) || 0
    ]
  }

  return [...fallback]
}

function transformVectorToArray(value, fallback = [0, 0, 0]) {
  return focusVectorToArray(value, fallback)
}

export function normalizeDebugTransform(value = {}) {
  return {
    position: transformVectorToArray(value.position, [0, 0, 0]),
    rotation: transformVectorToArray(value.rotation, [0, 0, 0]),
    scale: transformVectorToArray(value.scale, [1, 1, 1])
  }
}


export function getExteriorCameraDistance(preset = DEFAULT_EXTERIOR_CAMERA_PRESET) {
  const position = focusVectorToArray(preset.position, DEFAULT_EXTERIOR_CAMERA_PRESET.position);
  const target = focusVectorToArray(preset.target, [0, preset.targetY ?? EXTERIOR_TARGET_Y, 0]);

  return Math.max(
    new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...target)),
    0.01
  );
}

/**
 * 根据给定的距离和视觉缩放比例计算并返回一个经过调整的焦距值。
 * 这个函数确保了输入值的安全性，并对缩放比例进行了限制，以防止出现极端的焦距。
 *
 * @param {number} distance - 要缩放的基础距离。如果提供的值无效或非正数，
 *                 则会使用 getExteriorCameraDistance() 的结果作为备用。
 * @param {number} [visualScale=1] - 应用的视觉缩放因子。如果提供的值无效或非正数，则默认为 1。
 * @returns {number} - 计算出的缩放后的焦距。
 */
export function scaleFocusDistance(distance, visualScale = 1) {
  const safeDistance = Number.isFinite(Number(distance)) && Number(distance) > 0
    ? Number(distance)
    : getExteriorCameraDistance();
  const safeScale = Number.isFinite(Number(visualScale)) && Number(visualScale) > 0
    ? Number(visualScale)
    : 1;

  return safeDistance / THREE.MathUtils.clamp(safeScale, 0.2, 4);
}

export function getInteriorDeckPresets(modelId) {
  return modelId === 'TestHigh'
    ? TEST_HIGH_INTERIOR_DECK_PRESETS
    : DEFAULT_INTERIOR_DECK_PRESETS;
}


export function getWaterTuning(modelId) {
  return {
    ...DEFAULT_WATER_TUNING,
    ...(MODEL_WATER_TUNING[modelId] ?? {})
  }
}

export function mergeVectorPreset(basePreset = {}, overridePreset = {}) {
  const nextPreset = { ...basePreset }
  if (!overridePreset || typeof overridePreset !== 'object') {
    return nextPreset
  }

  if (Array.isArray(overridePreset.position)) {
    nextPreset.position = focusVectorToArray(overridePreset.position, nextPreset.position)
  }
  if (Array.isArray(overridePreset.target)) {
    nextPreset.target = focusVectorToArray(overridePreset.target, nextPreset.target)
  }
  if (Array.isArray(overridePreset.rotation)) {
    nextPreset.rotation = focusVectorToArray(overridePreset.rotation, nextPreset.rotation)
  }

  ;['zoom', 'targetY', 'stageOffsetY', 'yaw', 'pitch'].forEach((key) => {
    if (Number.isFinite(Number(overridePreset[key]))) {
      nextPreset[key] = Number(overridePreset[key])
    }
  })

  ;['type', 'deck', 'cameraMode'].forEach((key) => {
    if (`${overridePreset[key] ?? ''}`.trim()) {
      nextPreset[key] = `${overridePreset[key]}`.trim()
    }
  })

  return nextPreset
}


export function mergeInteriorDeckPresets(basePresets = {}, overridePresets = {}) {
  if (!overridePresets || typeof overridePresets !== 'object') {
    return basePresets
  }

  const nextPresets = { ...basePresets }
  Object.entries(overridePresets).forEach(([key, preset]) => {
    const deckKey = `${key ?? ''}`.trim()
    if (!deckKey) {
      return
    }

    nextPresets[deckKey] = mergeVectorPreset(nextPresets[deckKey] ?? {}, preset)
  })

  return nextPresets
}

 
export function getOrderFocusPresets(modelId) {
  const exteriorPreset = getExteriorCameraPreset(modelId)
  const exteriorTargetY = exteriorPreset.targetY ?? DEFAULT_EXTERIOR_CAMERA_PRESET.targetY
  const defaultExteriorPreset = {
    type: 'exterior',
    cameraMode: CAMERA_MODE_ORBIT,
    position: exteriorPreset.position,
    zoom: getExteriorCameraDistance(exteriorPreset),
    target: [0, exteriorTargetY, 0]
  }
  const defaultInteriorPreset = {
    type: 'interior',
    cameraMode: CAMERA_MODE_FIRST_PERSON,
    deck: '1'
  }
  const pointPresetKeys = ['POINT1', 'POINT2', 'POINT3', 'POINT4', 'POINT5']
  const createPointPresets = (fallbackPreset) => Object.fromEntries(
    pointPresetKeys.map((key) => [key, { ...fallbackPreset }])
  )

  if (modelId === 'TestHigh') {
    const exteriorPreset = {
      type: 'exterior',
      cameraMode: CAMERA_MODE_ORBIT,
      position: STUDIO_EXTERIOR_CAMERA_PRESET.position,
      zoom: getExteriorCameraDistance(STUDIO_EXTERIOR_CAMERA_PRESET),
      target: [0, STUDIO_EXTERIOR_CAMERA_PRESET.targetY, 0]
    }
    const smartSystemPreset = {
      type: 'exterior',
      cameraMode: CAMERA_MODE_ORBIT,
      position: [0.08, 1.1, -3.1],
      zoom: 2.2,
      target: [0.08, 0.75, -0.2]
    }

    return {
      exterior: exteriorPreset,
      overview: exteriorPreset,
      interior: {
        type: 'interior',
        cameraMode: CAMERA_MODE_FIRST_PERSON,
        deck: '1'
      },
      engine: {
        type: 'exterior',
        cameraMode: CAMERA_MODE_ORBIT,
        position: [0.2, 1.08, -3.35],
        zoom: 2.52,
        target: [0.06, 0.6, -2.42]
      },
      console: {
        type: 'interior',
        cameraMode: CAMERA_MODE_FIRST_PERSON,
        deck: '1',
        position: [0, 0.82, -1.02],
        yaw: 0,
        pitch: -0.1
      },
      'smart-system': smartSystemPreset,
      ...createPointPresets(smartSystemPreset)
    }
  }

  return {
    exterior: defaultExteriorPreset,
    overview: defaultExteriorPreset,
    interior: defaultInteriorPreset,
    engine: {
      type: 'exterior',
      cameraMode: CAMERA_MODE_ORBIT,
      zoom: getExteriorCameraDistance(exteriorPreset) * 0.42,
      target: [0, exteriorTargetY * 0.72, -2.4],
      rotation: [6, -28, 0]
    },
    console: {
      type: 'interior',
      cameraMode: CAMERA_MODE_FIRST_PERSON,
      deck: '1',
      target: [0, 0.78, -0.75],
      rotation: [-6, 0, 0]
    },
    'smart-system': {
      type: 'interior',
      cameraMode: CAMERA_MODE_FIRST_PERSON,
      deck: '1',
      target: [0.35, 0.9, -0.95],
      rotation: [-4, -18, 0]
    },
    ...createPointPresets(defaultExteriorPreset)
  }
}



export function objectTransformToDebugPayload(object3d) {
  if (!object3d) {
    return normalizeDebugTransform()
  }

  return {
    position: {
      x: Number(object3d.position.x.toFixed(4)),
      y: Number(object3d.position.y.toFixed(4)),
      z: Number(object3d.position.z.toFixed(4))
    },
    rotation: {
      x: Number(THREE.MathUtils.radToDeg(object3d.rotation.x).toFixed(3)),
      y: Number(THREE.MathUtils.radToDeg(object3d.rotation.y).toFixed(3)),
      z: Number(THREE.MathUtils.radToDeg(object3d.rotation.z).toFixed(3))
    },
    scale: {
      x: Number(object3d.scale.x.toFixed(4)),
      y: Number(object3d.scale.y.toFixed(4)),
      z: Number(object3d.scale.z.toFixed(4))
    }
  }
}

export function applyDebugTransformToObject(object3d, transformValue) {
  if (!object3d || !transformValue) {
    return
  }

  const transform = normalizeDebugTransform(transformValue)
  object3d.position.set(...transform.position)
  object3d.rotation.set(
    THREE.MathUtils.degToRad(transform.rotation[0]),
    THREE.MathUtils.degToRad(transform.rotation[1]),
    THREE.MathUtils.degToRad(transform.rotation[2])
  )
  object3d.scale.set(...transform.scale)
}

export function degreesVectorToEuler(value, fallback = DEFAULT_CAMERA_ROTATION_DEGREES) {
  const degrees = focusVectorToArray(value, fallback)
  return new THREE.Euler(
    THREE.MathUtils.degToRad(degrees[0]),
    THREE.MathUtils.degToRad(degrees[1]),
    THREE.MathUtils.degToRad(degrees[2]),
    'YXZ'
  )
}

function getLookAnglesFromRotation(rotationValue, fallbackYaw = 0, fallbackPitch = 0) {
  if (rotationValue === undefined || rotationValue === null) {
    return {
      yaw: fallbackYaw,
      pitch: fallbackPitch
    }
  }

  const rotation = focusVectorToArray(rotationValue, DEFAULT_CAMERA_ROTATION_DEGREES)
  return {
    yaw: THREE.MathUtils.degToRad(rotation[1]),
    pitch: THREE.MathUtils.degToRad(rotation[0])
  }
}

export function getYawPitchFromCamera(camera) {
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)

  return {
    yaw: Math.atan2(direction.x, direction.z),
    pitch: Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))
  }
}

function hasNonZeroRotation(rotationValue) {
  if (rotationValue === undefined || rotationValue === null) {
    return false
  }

  return focusVectorToArray(rotationValue, DEFAULT_CAMERA_ROTATION_DEGREES)
                      .some((value) => Math.abs(value) > 0.0001)
}

export function getPresetRotationValue(preset) {
  return hasNonZeroRotation(preset?.rotation) ? preset.rotation : null
}

export function getOrbitViewDirectionFromRotation(rotationValue) {
  return new THREE.Vector3(0, 0, 1).applyEuler(degreesVectorToEuler(rotationValue)).normalize()
}

export function getFirstPersonLookAnglesFromPreset(preset, fallbackYaw = 0, fallbackPitch = 0) {
  return getLookAnglesFromRotation(getPresetRotationValue(preset), fallbackYaw, fallbackPitch)
}


export function normalizeOrderFocusPreset(preset, fallbackPreset = {}) {
  const safePreset = preset ?? {}
  const fallbackPosition = focusVectorToArray(fallbackPreset.position, DEFAULT_EXTERIOR_CAMERA_PRESET.position)
  const fallbackTarget = focusVectorToArray(fallbackPreset.target, [0, DEFAULT_EXTERIOR_CAMERA_PRESET.targetY, 0])
  const fallbackRotation = focusVectorToArray(fallbackPreset.rotation, DEFAULT_CAMERA_ROTATION_DEGREES)
  const rawType = `${safePreset.type ?? fallbackPreset.type ?? ''}`.trim()
  const rawCameraMode = safePreset.cameraMode ?? fallbackPreset.cameraMode
  const fallbackCameraMode = rawType === 'interior' ? CAMERA_MODE_FIRST_PERSON : CAMERA_MODE_ORBIT
  const cameraMode = normalizeCameraMode(rawCameraMode, fallbackCameraMode)
  const type = cameraMode === CAMERA_MODE_FIRST_PERSON
    ? 'interior'
    : (rawType === 'interior' ? 'interior' : 'exterior')

  return {
    type,
    cameraMode,
    position: focusVectorToArray(safePreset.position, fallbackPosition),
    zoom: Number.isFinite(Number(safePreset.zoom))
      ? Number(safePreset.zoom)
      : (Number(fallbackPreset.zoom) || DEFAULT_EXTERIOR_CAMERA_PRESET.zoom),
    target: focusVectorToArray(safePreset.target, fallbackTarget),
    rotation: focusVectorToArray(safePreset.rotation, fallbackRotation),
    coordinateSpace: normalizeFocusCoordinateSpace(safePreset.coordinateSpace, fallbackPreset.coordinateSpace),
    deck: `${safePreset.deck ?? fallbackPreset.deck ?? '1'}`.trim() || '1',
    yaw: Number.isFinite(Number(safePreset.yaw)) ? Number(safePreset.yaw) : fallbackPreset.yaw,
    pitch: Number.isFinite(Number(safePreset.pitch)) ? Number(safePreset.pitch) : fallbackPreset.pitch
  }
}

export function normalizeOrderFocusPresets(basePresets, externalPresets) {
  const aliases = {
    overview: 'exterior',
    smartSystem: 'smart-system',
    内部: 'interior',
    外部: 'exterior',
    发动机: 'engine',
    中控台: 'console',
    智能系统: 'smart-system'
  }
  const normalized = {}
  Object.entries(basePresets ?? {}).forEach(([key, preset]) => {
    normalized[key] = normalizeOrderFocusPreset(preset)
  })

  Object.entries(externalPresets ?? {}).forEach(([key, preset]) => {
    const rawKey = `${key ?? ''}`.trim()
    const normalizedKey = aliases[rawKey] ?? rawKey
    if (!normalizedKey) {
      return
    }

    normalized[normalizedKey] = normalizeOrderFocusPreset(
      preset,
      normalized[normalizedKey] ?? normalized.exterior ?? normalized.overview
    )
  })

  if (!normalized.exterior) {
    normalized.exterior = normalizeOrderFocusPreset(normalized.overview)
  }
  if (!normalized.overview) {
    normalized.overview = normalized.exterior
  }

  return normalized
}


export  function applyShaderTintMaterial(material, colorPreset, options = {}) {
  const {
    targetWhiteSurfaces = false,
    allowHighMetalness = false,
    forceTint = false
  } = options

  if (!material?.isMeshStandardMaterial || 
    (!forceTint && !isColorTintCandidate(material, { allowHighMetalness }))) {
    return material
  }

  const shaderTintUniforms = material.userData.shaderTintUniforms ?? {
    uShaderTintColor: { value: new THREE.Color(colorPreset.color) },
    uShaderTintStrength: { value: colorPreset.strength },
    uShaderTintLift: { value: colorPreset.lift },
    uShaderTintWhiteOnly: { value: targetWhiteSurfaces ? 1 : 0 }
  }

  shaderTintUniforms.uShaderTintColor.value.set(colorPreset.color)
  shaderTintUniforms.uShaderTintStrength.value = colorPreset.strength
  shaderTintUniforms.uShaderTintLift.value = colorPreset.lift
  shaderTintUniforms.uShaderTintWhiteOnly.value = targetWhiteSurfaces ? 1 : 0
  material.userData.shaderTintUniforms = shaderTintUniforms

  if (!material.userData.hasShaderTintHook) {
    const previousOnBeforeCompile = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      if (typeof previousOnBeforeCompile === 'function') {
        previousOnBeforeCompile(shader, renderer)
      }

      shader.uniforms.uShaderTintColor = shaderTintUniforms.uShaderTintColor
      shader.uniforms.uShaderTintStrength = shaderTintUniforms.uShaderTintStrength
      shader.uniforms.uShaderTintLift = shaderTintUniforms.uShaderTintLift
      shader.uniforms.uShaderTintWhiteOnly = shaderTintUniforms.uShaderTintWhiteOnly

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uShaderTintColor;
uniform float uShaderTintStrength;
uniform float uShaderTintLift;
uniform float uShaderTintWhiteOnly;
`
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          `vec4 diffuseColor = vec4( diffuse, opacity );
float tintLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
float tintChroma = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b) - min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);
float broadTintMask = smoothstep(0.04, 0.96, tintLuma);
float whiteTintMask = smoothstep(0.62, 0.94, tintLuma) * (1.0 - smoothstep(0.08, 0.24, tintChroma));
float tintMask = mix(broadTintMask, whiteTintMask, clamp(uShaderTintWhiteOnly, 0.0, 1.0)) * clamp(uShaderTintStrength, 0.0, 1.0);
vec3 tintTarget = diffuseColor.rgb * uShaderTintColor;
diffuseColor.rgb = mix(diffuseColor.rgb, tintTarget, tintMask);
diffuseColor.rgb += vec3(uShaderTintLift);
`
        )
    }

    const previousCacheKey = material.customProgramCacheKey
    material.customProgramCacheKey = () => `${previousCacheKey ? previousCacheKey() : ''}|salesboat-shader-tint-v1`
    material.userData.hasShaderTintHook = true
    material.needsUpdate = true
  }

  return material
}

export function clearShaderTintMaterial(material) {
  if (!material?.userData?.shaderTintUniforms) {
    return material
  }

  material.userData.shaderTintUniforms.uShaderTintStrength.value = 0
  material.userData.shaderTintUniforms.uShaderTintLift.value = 0
  material.needsUpdate = true
  return material
}

export function clearShaderTintTree(rootObject) {
  rootObject?.traverse?.((child) => {
    if (!child.isMesh || !child.material) {
      return
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach(clearShaderTintMaterial)
  })
}

 
export function applyPackedRmaoMaterial(material, packedTexture) {
  if (!material?.isMaterial || !packedTexture) {
    return material
  }

  material.userData.packedRmaoMap = packedTexture

  if (!material.userData.hasPackedRmaoHook) {
    const previousOnBeforeCompile = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      if (typeof previousOnBeforeCompile === 'function') {
        previousOnBeforeCompile(shader, renderer)
      }

      shader.fragmentShader = shader.fragmentShader
        .replace(
          'roughnessFactor *= texelRoughness.g;',
          'roughnessFactor *= texelRoughness.r;'
        )
        .replace(
          'metalnessFactor *= texelMetalness.b;',
          'metalnessFactor *= texelMetalness.g;'
        )
        .replace(
          'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
          'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).b - 1.0 ) * aoMapIntensity + 1.0;'
        )
    }

    const previousCacheKey = material.customProgramCacheKey
    material.customProgramCacheKey = () => `${previousCacheKey ? previousCacheKey() : ''}|salesboat-packed-rmao-v1`
    material.userData.hasPackedRmaoHook = true
  }

  material.needsUpdate = true
  return material
}

export function applyDitherFadeMaterial(material, opacity = 0.45) {
  if (!material?.isMaterial) {
    return material
  }

  const ditherUniforms = material.userData.ditherFadeUniforms ?? {
    uDitherOpacity: { value: opacity }
  }
  ditherUniforms.uDitherOpacity.value = THREE.MathUtils.clamp(opacity, 0.02, 1)
  material.userData.ditherFadeUniforms = ditherUniforms

  if (!material.userData.hasDitherFadeHook) {
    const previousOnBeforeCompile = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      if (typeof previousOnBeforeCompile === 'function') {
        previousOnBeforeCompile(shader, renderer)
      }

      shader.uniforms.uDitherOpacity = ditherUniforms.uDitherOpacity
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uDitherOpacity;
float salesboatDitherThreshold(vec2 position) {
  int x = int(mod(position.x, 4.0));
  int y = int(mod(position.y, 4.0));
  int index = x + y * 4;
  float threshold = 0.0;
  if (index == 0) threshold = 0.0;
  else if (index == 1) threshold = 8.0;
  else if (index == 2) threshold = 2.0;
  else if (index == 3) threshold = 10.0;
  else if (index == 4) threshold = 12.0;
  else if (index == 5) threshold = 4.0;
  else if (index == 6) threshold = 14.0;
  else if (index == 7) threshold = 6.0;
  else if (index == 8) threshold = 3.0;
  else if (index == 9) threshold = 11.0;
  else if (index == 10) threshold = 1.0;
  else if (index == 11) threshold = 9.0;
  else if (index == 12) threshold = 15.0;
  else if (index == 13) threshold = 7.0;
  else if (index == 14) threshold = 13.0;
  else threshold = 5.0;
  return (threshold + 0.5) / 16.0;
}
`
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          `vec4 diffuseColor = vec4( diffuse, opacity );
if (salesboatDitherThreshold(gl_FragCoord.xy) > clamp(uDitherOpacity, 0.02, 1.0)) {
  discard;
}
`
        )
    }

    const previousCacheKey = material.customProgramCacheKey
    material.customProgramCacheKey = () => `${previousCacheKey ? previousCacheKey() : ''}|salesboat-dither-fade-v1`
    material.userData.hasDitherFadeHook = true
  }

  material.transparent = false
  material.opacity = 1
  material.alphaTest = 0
  material.depthWrite = true
  material.depthTest = true
  material.needsUpdate = true
  return material
}
