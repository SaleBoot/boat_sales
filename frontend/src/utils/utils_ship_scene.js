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
  DEFAULT_CAMERA_ROTATION_DEGREES ,
  FOCUS_COORDINATE_SPACE_SCENE,
  FOCUS_COORDINATE_SPACE_MODEL_LOCAL 
} from '../constants/constants_ship_scene.js';

// 将“原材料名称”转化为一种标准化的、只有小写字母和数字的格式。
export function normalizeMaterialName(value) {
  if (!value) {
    return ''
  }

  return value
    .toLowerCase()  // 统一转小写
    // 删除前缀 m
    // ^m：匹配字符串开头的一个字符 m。
    // [_\s-]*：匹配后面跟着的任意个（0个或多个）下划线 _、空格 \s 或连字符 -。
    .replace(/^m[_\s-]*/, '')
    // 剔除所有非字母数字字符：删掉所有的空格、特殊符号、特殊标点。
    // [^a-z0-9]：匹配除了小写字母和数字以外的所有字符。
    // +：匹配一个或多个。
    // g：全局匹配（整串扫描）。
    .replace(/[^a-z0-9]+/g, '')
}

export function formatTransferSize(bytes) {
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

export function formatTransferSpeed(bytesPerSecond) {
  return `${formatTransferSize(bytesPerSecond)}/s`
}

function normalizeBaseUrl(baseUrl) {
  const normalizedValue = `${baseUrl ?? ''}`.trim()
  if (!normalizedValue) {
    return '/'
  }

  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}

export function getAssetDisplayLabel(assetPath) {
  const normalizedPath = `${assetPath ?? ''}`.replace(/\\/g, '/')
  const rawLabel = normalizedPath.split('/').pop() ?? normalizedPath

  try {
    return decodeURIComponent(rawLabel)
  } catch {
    return rawLabel
  }
}



export function getStaticAssetBaseUrl(staticAssetOrigin, fallbackBaseUrl) {
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

export function createInitialLoadingState(hasRenderableModel) {
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

export function isStudioLookModel(modelId) {
  return modelId === 'TestHigh';
}

export function getExteriorCameraPreset(modelId) {
  return isStudioLookModel(modelId)
    ? STUDIO_EXTERIOR_CAMERA_PRESET
    : DEFAULT_EXTERIOR_CAMERA_PRESET;
}


export function normalizeCameraMode(value, fallback = CAMERA_MODE_ORBIT) {
  const normalized = `${value ?? ''}`.trim().toLowerCase()
  if (normalized === CAMERA_MODE_FIRST_PERSON || 
      normalized === 'firstperson' || 
      normalized === 'fps' || 
      normalized === '第一人称') 
  {
    return CAMERA_MODE_FIRST_PERSON
  }

  if (normalized === CAMERA_MODE_ORBIT || 
      normalized === 'around' || 
      normalized === '环视') 
  {
    return CAMERA_MODE_ORBIT
  }

  return fallback
}

export function normalizeFocusCoordinateSpace(value, fallback = FOCUS_COORDINATE_SPACE_SCENE) {
  const normalized = `${value ?? ''}`.trim().toLowerCase()
  if (['model-local', 'modellocal', 'local', 'model', '模型局部'].includes(normalized)) {
    return FOCUS_COORDINATE_SPACE_MODEL_LOCAL
  }
  if (['scene', 'world', 'normalized', '归一化', '场景'].includes(normalized)) {
    return FOCUS_COORDINATE_SPACE_SCENE
  }

  return fallback
}

export function resolveRequestedFocusTarget(modelId, requestedTarget) {
  return `${requestedTarget ?? ''}`.trim() || 'exterior'
}

export function resolveAppliedFocusTarget(
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


export function getColorShaderPreset(colorConfig, options = {}) {
  const { explicitMaterialSlots = false } = options
  const fallbackHex = colorConfig?.hex ?? '#f2f3f5'

  return {
    color: fallbackHex,
    strength: explicitMaterialSlots ? 1 : 0.6,
    lift: explicitMaterialSlots ? 0.015 : 0
  }
}

// ----------------
export function getColorConfigMaterialSlots(colorConfig) {
  if (!Array.isArray(colorConfig?.materialSlots)) {
    return new Set()
  }

  return new Set(
    colorConfig.materialSlots
      .map((slot) => normalizeMaterialName(slot))
      .filter(Boolean)
  )
}

export function materialMatchesColorSlots(material, colorMaterialSlots) {
  if (!colorMaterialSlots?.size) {
    return false
  }

  return colorMaterialSlots.has(normalizeMaterialName(material?.name))
}

export function normalizeOptionalMaterialOverrides(overrides) {
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

export function materialMatchesOverrideSlots(material, override) {
  return override?.materialSlots?.has(normalizeMaterialName(material?.name))
}
// ----
export function isColorTintCandidate(material, options = {}) {
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

export function shouldApplyColorway(modelId, partRole) {
  if (partRole === 'hull') {
    return true
  }

  return ['PleasureBoat', 'PleasureBoat1', 'Yacht'].includes(modelId) && partRole === 'full'
}