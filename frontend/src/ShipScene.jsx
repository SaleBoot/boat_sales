import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

function updateOrthographicFrustum(camera, aspect, frustumHeight) {
  const safeAspect = Math.max(aspect, 0.01)
  const halfHeight = frustumHeight / 2
  const halfWidth = halfHeight * safeAspect

  camera.left = -halfWidth
  camera.right = halfWidth
  camera.top = halfHeight
  camera.bottom = -halfHeight
}

function normalizeMaterialName(value) {
  if (!value) {
    return ''
  }

  return value
    .toLowerCase()
    .replace(/^m[_\s-]*/, '')
    .replace(/[^a-z0-9]+/g, '')
}

const WATER_SURFACE_ENABLED = true
const EXTERIOR_STAGE_Y_OFFSET = 0.42
const EXTERIOR_TARGET_Y = 0.5 + EXTERIOR_STAGE_Y_OFFSET * 0.35
const EMPTY_ARRAY = []
const DEFAULT_WATER_TUNING = {
  levelFactor: 0.18,
  radiusScale: 0.84,
  zOffset: 0.16,
  exteriorModelLiftY: 0
}
const UV_SET_ALPHA_MODE_OPAQUE = 'opaque'
const UV_SET_ALPHA_MODE_CUTOUT = 'cutout'
const UV_SET_ALPHA_MODE_BLEND = 'blend'
const UV_SET_SIDE_FRONT = 'front'
const UV_SET_SIDE_DOUBLE = 'double'
const UV_SET_DEPTH_WRITE_ON = 'on'
const UV_SET_DEPTH_WRITE_OFF = 'off'
const UV_SET_DEPTH_TEST_ON = 'on'
const UV_SET_DEPTH_TEST_OFF = 'off'
const UV_SET_DITHER_MODE_ON = 'on'
const UV_SET_DITHER_MODE_OFF = 'off'
const CAMERA_MODE_ORBIT = 'orbit'
const CAMERA_MODE_FIRST_PERSON = 'first-person'
const FOCUS_COORDINATE_SPACE_SCENE = 'scene'
const FOCUS_COORDINATE_SPACE_MODEL_LOCAL = 'model-local'
const DEFAULT_CAMERA_ROTATION_DEGREES = [0, 0, 0]
const TWO_LAYER_TRACKED_TEXTURE_PATHS = [
  'gltf/TwoLayerBoat/1/1_01 - Default_Emissive.png',
  'gltf/TwoLayerBoat/1/1_01 - Default_Normal.png',
  'gltf/TwoLayerBoat/1/AO.png',
  'gltf/TwoLayerBoat/1/meti.png',
  'gltf/TwoLayerBoat/1/rou.png',
  'gltf/TwoLayerBoat/2/1_02 - Default_Normal.png',
  'gltf/TwoLayerBoat/2/AO_3.png',
  'gltf/TwoLayerBoat/2/meti_1.png',
  'gltf/TwoLayerBoat/2/rou_2.png'
]
const MODEL_WATER_TUNING = {
  PleasureBoat: {
    levelFactor: 0.06,
    exteriorModelLiftY: -0.02
  },
  PleasureBoat1: {
    exteriorModelLiftY: 0.1
  },
  Yacht: {
    exteriorModelLiftY: 0.06
  }
}

const DEFAULT_EXTERIOR_CAMERA_PRESET = {
  position: [-6.2, 1.65, 1.7],
  zoom: 1.18,
  targetY: EXTERIOR_TARGET_Y,
  stageOffsetY: EXTERIOR_STAGE_Y_OFFSET
}

const STUDIO_EXTERIOR_CAMERA_PRESET = {
  position: [-5.4, 1.32, 2.18],
  zoom: 1.34,
  targetY: 0.28,
  stageOffsetY: 0
}

const DEFAULT_INTERIOR_DECK_PRESETS = {
  '1': {
    position: [0, 0, -0.66],
    yaw: 0,
    pitch: -0.08
  },
  '2': {
    position: [0, 0.98, -0.66],
    yaw: 0,
    pitch: -0.08
  }
}

const ENGINE_MODEL_LIBRARY = {
  'outboard-a': {
    format: 'fbx',
    path: '/gltf/TestHigh/马达（2048）/马达.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'tt',
        label: 'UV tt',
        directory: '/gltf/TestHigh/马达（2048）/tt',
        materialNameHint: 'M_07___Default',
        textures: {
          baseColor: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_BaseColor.png',
          metalness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Metallic.png',
          normal: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Normal.png',
          roughness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Roughness.png'
        }
      }
    ]
  },
  'outboard-b': {
    format: 'fbx',
    path: '/gltf/TestHigh/马达（2048）/马达.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'tt',
        label: 'UV tt',
        directory: '/gltf/TestHigh/马达（2048）/tt',
        materialNameHint: 'M_07___Default',
        textures: {
          baseColor: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_BaseColor.png',
          metalness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Metallic.png',
          normal: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Normal.png',
          roughness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Roughness.png'
        }
      }
    ]
  },
  'electric-outboard': {
    format: 'fbx',
    path: '/gltf/Dabao/dd.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'Texture',
        label: 'UV Texture',
        directory: '/gltf/Dabao/Texture',
        materialNameHint: 'diandong_19___Default',
        textures: {
          baseColor: '/gltf/Dabao/Texture/diandong_19 - Default_BaseColor.png',
          normal: '/gltf/Dabao/Texture/diandong_19 - Default_Normal.png',
          rmao: '/gltf/Dabao/Texture/diandong_19 - Default_R+M+AO.png'
        }
      }
    ]
  }
}

const TEST_HIGH_INTERIOR_DECK_PRESETS = {
  '1': {
    position: [0, 0.78, -1.55],
    yaw: 0,
    pitch: -0.14
  },
  '2': {
    position: [0, 0.78, -1.55],
    yaw: 0,
    pitch: -0.14
  }
}

function isStudioLookModel(modelId) {
  return modelId === 'TestHigh'
}

function getExteriorCameraPreset(modelId) {
  return isStudioLookModel(modelId)
    ? STUDIO_EXTERIOR_CAMERA_PRESET
    : DEFAULT_EXTERIOR_CAMERA_PRESET
}

function getExteriorCameraDistance(preset = DEFAULT_EXTERIOR_CAMERA_PRESET) {
  const position = focusVectorToArray(preset.position, DEFAULT_EXTERIOR_CAMERA_PRESET.position)
  const target = focusVectorToArray(preset.target, [0, preset.targetY ?? EXTERIOR_TARGET_Y, 0])

  return Math.max(
    new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...target)),
    0.01
  )
}

function scaleFocusDistance(distance, visualScale = 1) {
  const safeDistance = Number.isFinite(Number(distance)) && Number(distance) > 0
    ? Number(distance)
    : getExteriorCameraDistance()
  const safeScale = Number.isFinite(Number(visualScale)) && Number(visualScale) > 0
    ? Number(visualScale)
    : 1

  return safeDistance / THREE.MathUtils.clamp(safeScale, 0.2, 4)
}

function getInteriorDeckPresets(modelId) {
  return modelId === 'TestHigh'
    ? TEST_HIGH_INTERIOR_DECK_PRESETS
    : DEFAULT_INTERIOR_DECK_PRESETS
}

function getWaterTuning(modelId) {
  return {
    ...DEFAULT_WATER_TUNING,
    ...(MODEL_WATER_TUNING[modelId] ?? {})
  }
}

function mergeVectorPreset(basePreset = {}, overridePreset = {}) {
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

function mergeInteriorDeckPresets(basePresets = {}, overridePresets = {}) {
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

function normalizeBaseUrl(baseUrl) {
  const normalizedValue = `${baseUrl ?? ''}`.trim()
  if (!normalizedValue) {
    return '/'
  }

  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}

function getStaticAssetBaseUrl(staticAssetOrigin, fallbackBaseUrl) {
  const explicitOrigin = `${staticAssetOrigin ?? ''}`.trim()
  if (explicitOrigin) {
    return normalizeBaseUrl(explicitOrigin)
  }

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/'
    const basePath = pathname.endsWith('/')
      ? pathname
      : pathname.slice(0, pathname.lastIndexOf('/') + 1)

    return normalizeBaseUrl(basePath || '/')
  }

  return normalizeBaseUrl(fallbackBaseUrl)
}

function getResourceDirectory(assetPath) {
  const normalizedPath = `${assetPath ?? ''}`.replace(/\\/g, '/')
  const lastSlashIndex = normalizedPath.lastIndexOf('/')

  if (lastSlashIndex === -1) {
    return ''
  }

  return normalizedPath.slice(0, lastSlashIndex + 1)
}

function getAssetDisplayLabel(assetPath) {
  const normalizedPath = `${assetPath ?? ''}`.replace(/\\/g, '/')
  const rawLabel = normalizedPath.split('/').pop() ?? normalizedPath

  try {
    return decodeURIComponent(rawLabel)
  } catch {
    return rawLabel
  }
}

function formatTransferSize(bytes) {
  const safeBytes = Number.isFinite(bytes) ? Math.max(bytes, 0) : 0

  if (safeBytes >= 1024 * 1024 * 1024) {
    return `${(safeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (safeBytes >= 1024 * 1024) {
    return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (safeBytes >= 1024) {
    return `${(safeBytes / 1024).toFixed(1)} KB`
  }

  return `${Math.round(safeBytes)} B`
}

function formatTransferSpeed(bytesPerSecond) {
  return `${formatTransferSize(bytesPerSecond)}/s`
}

function createInitialLoadingState(hasRenderableModel) {
  return {
    phase: hasRenderableModel ? '正在准备模型与贴图资源…' : '正在等待当前选中的模型…',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    loadedItems: 0,
    totalItems: 0,
    speedBytesPerSecond: 0,
    activeLabel: '',
    hasKnownTotal: false
  }
}

function createWaterSurface() {
  const geometry = new THREE.CircleGeometry(1, 120)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color('#72b8e9') },
      uDeepColor: { value: new THREE.Color('#0d3b61') },
      uHighlightColor: { value: new THREE.Color('#f2fbff') }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;

      uniform float uTime;

      void main() {
        vUv = uv;

        vec3 transformed = position;
        float primaryWave = sin((position.x * 10.0) + uTime * 1.35) * 0.018;
        float secondaryWave = cos((position.y * 13.0) - uTime * 1.05) * 0.014;
        transformed.z += primaryWave + secondaryWave;
        vWave = transformed.z;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;

      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uDeepColor;
      uniform vec3 uHighlightColor;

      void main() {
        float dist = distance(vUv, vec2(0.5));
        float surfaceMask = smoothstep(0.56, 0.08, dist);
        float shimmer = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 24.0 + uTime * 0.9 + vWave * 40.0);
        float edgeGlow = smoothstep(0.55, 0.24, dist);
        float innerShadow = smoothstep(0.0, 0.44, dist);

        vec3 color = mix(uDeepColor, uBaseColor, 0.62 + vWave * 7.5);
        color = mix(color, uDeepColor * 0.9, innerShadow * 0.18);
        color = mix(color, uHighlightColor, shimmer * 0.14 * edgeGlow);

        float alpha = surfaceMask * (0.26 + shimmer * 0.12 + edgeGlow * 0.18);
        gl_FragColor = vec4(color, alpha);
      }
    `
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, -0.8, 0.2)
  mesh.renderOrder = -1000

  return { mesh, material, geometry }
}

function createReflectionEnvironmentScene() {
  const environmentScene = new THREE.Scene()
  const disposables = []

  const registerMesh = (geometry, material, transform) => {
    const mesh = new THREE.Mesh(geometry, material)
    transform(mesh)
    environmentScene.add(mesh)
    disposables.push(geometry, material)
    return mesh
  }

  registerMesh(
    new THREE.SphereGeometry(14, 48, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bcd3ea'),
      side: THREE.BackSide
    }),
    (mesh) => {
      mesh.scale.set(1, 0.88, 1)
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(20, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#d7e6f5') }),
    (mesh) => {
      mesh.position.set(-6.4, 2.2, 1.8)
      mesh.rotation.y = Math.PI / 2.55
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#edf4fb') }),
    (mesh) => {
      mesh.position.set(5.6, 2.8, -2.6)
      mesh.rotation.y = -Math.PI / 2.2
    }
  )

  registerMesh(
    new THREE.CircleGeometry(1.2, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8') }),
    (mesh) => {
      mesh.position.set(-3.8, 4.6, 2.4)
      mesh.lookAt(0, 0.8, 0)
    }
  )

  registerMesh(
    new THREE.PlaneGeometry(22, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d6f7e') }),
    (mesh) => {
      mesh.position.set(0, -2.8, 0.4)
      mesh.rotation.x = -Math.PI / 2
    }
  )

  return {
    scene: environmentScene,
    dispose: () => {
      disposables.forEach((resource) => resource.dispose?.())
      environmentScene.clear()
    }
  }
}

function createInteriorSkySphere() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024

  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  const { width, height } = canvas
  const skyGradient = context.createLinearGradient(0, 0, 0, height)
  skyGradient.addColorStop(0, '#7fc8ff')
  skyGradient.addColorStop(0.38, '#a8dcff')
  skyGradient.addColorStop(0.72, '#d5efff')
  skyGradient.addColorStop(1, '#eef8ff')
  context.fillStyle = skyGradient
  context.fillRect(0, 0, width, height)

  const glowGradient = context.createRadialGradient(
    width * 0.74,
    height * 0.22,
    width * 0.03,
    width * 0.74,
    height * 0.22,
    width * 0.24
  )
  glowGradient.addColorStop(0, 'rgba(255, 253, 245, 0.72)')
  glowGradient.addColorStop(0.45, 'rgba(255, 251, 240, 0.28)')
  glowGradient.addColorStop(1, 'rgba(255, 251, 240, 0)')
  context.fillStyle = glowGradient
  context.fillRect(0, 0, width, height)

  const hazeGradient = context.createLinearGradient(0, height * 0.56, 0, height)
  hazeGradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  hazeGradient.addColorStop(1, 'rgba(255, 255, 255, 0.36)')
  context.fillStyle = hazeGradient
  context.fillRect(0, height * 0.56, width, height * 0.44)

  const drawCloud = (centerX, centerY, cloudWidth, cloudHeight, alpha) => {
    const puffs = [
      [-0.28, 0.08, 0.26],
      [-0.08, -0.06, 0.31],
      [0.18, -0.03, 0.29],
      [0.38, 0.1, 0.22]
    ]

    puffs.forEach(([offsetX, offsetY, scale]) => {
      const radius = cloudWidth * scale
      const puffX = centerX + cloudWidth * offsetX
      const puffY = centerY + cloudHeight * offsetY
      const puff = context.createRadialGradient(
        puffX,
        puffY,
        radius * 0.1,
        puffX,
        puffY,
        radius
      )
      puff.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
      puff.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.76})`)
      puff.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = puff
      context.fillRect(puffX - radius, puffY - radius, radius * 2, radius * 2)
    })
  }

  ;[
    [width * 0.18, height * 0.21, width * 0.16, height * 0.09, 0.82],
    [width * 0.42, height * 0.28, width * 0.19, height * 0.1, 0.74],
    [width * 0.72, height * 0.18, width * 0.17, height * 0.09, 0.78],
    [width * 0.86, height * 0.33, width * 0.14, height * 0.08, 0.68],
    [width * 0.3, height * 0.46, width * 0.23, height * 0.12, 0.54],
    [width * 0.64, height * 0.52, width * 0.2, height * 0.1, 0.5]
  ].forEach((cloud) => drawCloud(...cloud))

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const geometry = new THREE.SphereGeometry(260, 64, 32)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  mesh.renderOrder = -1000

  return {
    mesh,
    geometry,
    material,
    texture
  }
}

function getOrderFocusPresets(modelId) {
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

function focusVectorToArray(value, fallback = [0, 0, 0]) {
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

function normalizeDebugTransform(value = {}) {
  return {
    position: transformVectorToArray(value.position, [0, 0, 0]),
    rotation: transformVectorToArray(value.rotation, [0, 0, 0]),
    scale: transformVectorToArray(value.scale, [1, 1, 1]).map((item) => {
      const nextValue = Number(item)
      return Number.isFinite(nextValue) && Math.abs(nextValue) > 0.0001 ? nextValue : 1
    })
  }
}

function objectTransformToDebugPayload(object3d) {
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

function applyDebugTransformToObject(object3d, transformValue) {
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

function degreesVectorToEuler(value, fallback = DEFAULT_CAMERA_ROTATION_DEGREES) {
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

function getYawPitchFromCamera(camera) {
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

  return focusVectorToArray(rotationValue, DEFAULT_CAMERA_ROTATION_DEGREES).some((value) => Math.abs(value) > 0.0001)
}

function getPresetRotationValue(preset) {
  return hasNonZeroRotation(preset?.rotation) ? preset.rotation : null
}

function getOrbitViewDirectionFromRotation(rotationValue) {
  return new THREE.Vector3(0, 0, 1).applyEuler(degreesVectorToEuler(rotationValue)).normalize()
}

function getFirstPersonLookAnglesFromPreset(preset, fallbackYaw = 0, fallbackPitch = 0) {
  return getLookAnglesFromRotation(getPresetRotationValue(preset), fallbackYaw, fallbackPitch)
}

function normalizeCameraMode(value, fallback = CAMERA_MODE_ORBIT) {
  const normalized = `${value ?? ''}`.trim().toLowerCase()
  if (normalized === CAMERA_MODE_FIRST_PERSON || normalized === 'firstperson' || normalized === 'fps' || normalized === '第一人称') {
    return CAMERA_MODE_FIRST_PERSON
  }
  if (normalized === CAMERA_MODE_ORBIT || normalized === 'around' || normalized === '环视') {
    return CAMERA_MODE_ORBIT
  }

  return fallback
}

function normalizeFocusCoordinateSpace(value, fallback = FOCUS_COORDINATE_SPACE_SCENE) {
  const normalized = `${value ?? ''}`.trim().toLowerCase()
  if (['model-local', 'modellocal', 'local', 'model', '模型局部'].includes(normalized)) {
    return FOCUS_COORDINATE_SPACE_MODEL_LOCAL
  }
  if (['scene', 'world', 'normalized', '归一化', '场景'].includes(normalized)) {
    return FOCUS_COORDINATE_SPACE_SCENE
  }

  return fallback
}

function normalizeOrderFocusPreset(preset, fallbackPreset = {}) {
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

function normalizeOrderFocusPresets(basePresets, externalPresets) {
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

function resolveRequestedFocusTarget(modelId, requestedTarget) {
  return `${requestedTarget ?? ''}`.trim() || 'exterior'
}

function resolveAppliedFocusTarget(
  modelId,
  requestedTarget,
  availablePresets,
  strategy = 'default'
) {
  const normalizedTarget = resolveRequestedFocusTarget(modelId, requestedTarget)
  const presets = availablePresets ?? {}
  const hasPreset = (key) => Boolean(key) && Boolean(presets[key])

  if (strategy === 'console-driven') {
    return hasPreset(normalizedTarget)
      ? normalizedTarget
      : hasPreset('exterior')
      ? 'exterior'
      : hasPreset('overview')
      ? 'overview'
      : normalizedTarget
  }

  if (hasPreset(normalizedTarget)) {
    return normalizedTarget
  }
  if (normalizedTarget === 'smart-system' && hasPreset('console')) {
    return 'console'
  }
  if (normalizedTarget === 'console' && hasPreset('interior')) {
    return 'interior'
  }
  if (normalizedTarget === 'interior' && hasPreset('console')) {
    return 'console'
  }
  if (normalizedTarget === 'engine' && hasPreset('exterior')) {
    return 'exterior'
  }
  if (hasPreset('exterior')) {
    return 'exterior'
  }
  if (hasPreset('overview')) {
    return 'overview'
  }

  return normalizedTarget
}

function getColorShaderPreset(colorConfig, options = {}) {
  const { explicitMaterialSlots = false } = options
  const fallbackHex = colorConfig?.hex ?? '#f2f3f5'

  return {
    color: fallbackHex,
    strength: explicitMaterialSlots ? 1 : 0.6,
    lift: explicitMaterialSlots ? 0.015 : 0
  }
}

function getColorConfigMaterialSlots(colorConfig) {
  if (!Array.isArray(colorConfig?.materialSlots)) {
    return new Set()
  }

  return new Set(
    colorConfig.materialSlots
      .map((slot) => normalizeMaterialName(slot))
      .filter(Boolean)
  )
}

function materialMatchesColorSlots(material, colorMaterialSlots) {
  if (!colorMaterialSlots?.size) {
    return false
  }

  return colorMaterialSlots.has(normalizeMaterialName(material?.name))
}

function normalizeOptionalMaterialOverrides(overrides) {
  if (!Array.isArray(overrides)) {
    return []
  }

  return overrides.map((override) => {
    const materialSlots = new Set(
      (Array.isArray(override?.materialSlots) ? override.materialSlots : [])
        .map((slot) => normalizeMaterialName(slot))
        .filter(Boolean)
    )
    const baseColorPath = `${override?.baseColorPath ?? override?.baseColor ?? ''}`.trim()

    return {
      materialSlots,
      baseColorPath
    }
  }).filter((override) => override.materialSlots.size > 0 && (
    override.baseColorPath
  ))
}

function materialMatchesOverrideSlots(material, override) {
  return override?.materialSlots?.has(normalizeMaterialName(material?.name))
}

function isColorTintCandidate(material, options = {}) {
  const { allowHighMetalness = false } = options
  if (!material) {
    return false
  }

  const materialName = `${material.name ?? ''}`.toLowerCase()
  if (
    material.transparent ||
    material.opacity < 0.98 ||
    materialName.includes('glass') ||
    materialName.includes('window') ||
    materialName.includes('rail') ||
    materialName.includes('metal')
  ) {
    return false
  }

  if (allowHighMetalness) {
    return true
  }

  return (material.metalness ?? 0) < 0.72
}

function applyShaderTintMaterial(material, colorPreset, options = {}) {
  const {
    targetWhiteSurfaces = false,
    allowHighMetalness = false,
    forceTint = false
  } = options

  if (!material?.isMeshStandardMaterial || (!forceTint && !isColorTintCandidate(material, { allowHighMetalness }))) {
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

function clearShaderTintMaterial(material) {
  if (!material?.userData?.shaderTintUniforms) {
    return material
  }

  material.userData.shaderTintUniforms.uShaderTintStrength.value = 0
  material.userData.shaderTintUniforms.uShaderTintLift.value = 0
  material.needsUpdate = true
  return material
}

function clearShaderTintTree(rootObject) {
  rootObject?.traverse?.((child) => {
    if (!child.isMesh || !child.material) {
      return
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach(clearShaderTintMaterial)
  })
}

function applyPackedRmaoMaterial(material, packedTexture) {
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

function applyDitherFadeMaterial(material, opacity = 0.45) {
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

function shouldApplyColorway(modelId, partRole) {
  if (partRole === 'hull') {
    return true
  }

  return ['PleasureBoat', 'PleasureBoat1', 'Yacht'].includes(modelId) && partRole === 'full'
}

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
  const resolveManifestPath = (assetPath) => {
    if (!assetPath) {
      return ''
    }

    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath
    }

    if (assetPath.startsWith('/')) {
      return `${assetBaseUrl}${assetPath.slice(1)}`
    }

    return `${assetBaseUrl}${assetPath}`
  }

  const modelId = modelConfig?.id ?? ''
  const resolvedRequestedFocusTarget = resolveRequestedFocusTarget(modelId, focusTarget)
  const renderConfig = modelConfig?.renderConfig ?? {}
  const waterConfig = renderConfig?.water ?? {}
  const waterTuning = {
    ...getWaterTuning(modelId),
    ...(waterConfig && typeof waterConfig === 'object' ? waterConfig : {})
  }
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
  const modelFormat = (effectiveModelConfig?.format ?? 'glb').toLowerCase()
  const modelPath = effectiveModelConfig?.path
    ? resolveManifestPath(effectiveModelConfig.path)
    : ''
  const isTwoLayerBoat = modelId === 'TwoLayerBoat'
  const isStudioLook = typeof renderConfig.studioLook === 'boolean'
    ? renderConfig.studioLook
    : isStudioLookModel(modelId)
  const baseExteriorCameraPreset = mergeVectorPreset(getExteriorCameraPreset(modelId), renderConfig.exteriorCamera)
  const exteriorCameraPreset = {
    ...baseExteriorCameraPreset,
    zoom: baseExteriorCameraPreset.zoom * overviewZoomScale
  }
  const interiorDeckPresetConfig = mergeInteriorDeckPresets(getInteriorDeckPresets(modelId), renderConfig.interiorDecks)
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

    const exteriorCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.005, 5000)
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

    const updatePresentationOffset = (mode) => {
      presentationRoot.position.y = mode === 'exterior' ? exteriorCameraPreset.stageOffsetY : 0
      modelRoot.position.y = mode === 'exterior' && shouldShowWaterSurface ? waterTuning.exteriorModelLiftY : 0
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
    setViewPresetRef.current('interior', deck, resolvedOrderFocusPresets.interior ?? { cameraMode: CAMERA_MODE_FIRST_PERSON })
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
