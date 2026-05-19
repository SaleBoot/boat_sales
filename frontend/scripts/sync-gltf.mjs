/**
 * @file
 * 该脚本用于同步、处理和优化 3D 模型资源（如 GLTF、FBX）及其纹理。
 *
 * 主要功能：
 * 1. 从源目录（'gltf'）读取模型和纹理文件。
 * 2. 将这些文件复制到 Vite 的公共资源目录（'public/gltf'）。
 * 3. 对指定的纹理进行优化，例如转换为 WebP 格式。
 * 4. 检查模型文件，提取材质和纹理信息。
 * 5. 生成一个 'asset-manifest.json' 文件，该文件包含了所有处理过的资源的元数据，
 *    供前端应用程序在运行时加载和使用 3D 模型。
 * 6. 脚本的行为由 'data/site-content.json' 和 'data/texture-assignments.json' 驱动。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// 获取当前脚本所在的目录。
// 
// import.meta 是一个对象，它包含了关于当前模块的元数据（meta-data）。
// 
// .url 是这个对象的一个属性，它的值是一个字符串，表示当前模块文件的完整 URL。
// 这个 URL 通常是以 file:/// 协议开头的，例如：
//     'file:///home/abner/Documents/jobs/task/SalesBoat02/frontend/scripts/sync-gltf.mjs'
// import.meta.url 获取到 sync-gltf.mjs 这个文件自身的 URL
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
// 解析出前端项目的根目录。
const frontendDir = path.resolve(scriptDir, '..')
// 解析出整个仓库的根目录。
const repoRoot = path.resolve(frontendDir, '..')

/**
 * 异步、安全地加载 'sharp' 图像处理库。
 * 如果 'sharp' 未安装，则返回 null，避免程序崩溃。
 * @returns {Promise<import('sharp') | null>}
 */
const loadSharp = async () => {
  try {
    // 尝试动态导入 sharp 模块。
    const sharpModule = await import('sharp')
    // 处理不同 ES 模块导出的情况。
    return sharpModule.default ?? sharpModule
  } catch {
    // 如果导入失败，则返回 null。
    return null
  }
}
// 等待 sharp 模块加载完成。
const sharp = await loadSharp()

// 仓库中的源资源目录。
const sourceDir = path.resolve(repoRoot, 'gltf')
// Vite 静态资源目标目录。
const targetDir = path.resolve(frontendDir, 'public/gltf')
// 生成的资源清单文件路径。
const manifestPath = path.join(targetDir, 'asset-manifest.json')
// 手动指定纹理分配的配置文件路径。
const textureAssignmentsPath = path.resolve(repoRoot, 'data', 'texture-assignments.json')
// 站点内容配置文件路径，定义了需要处理的模型等。
const siteContentPath = path.resolve(repoRoot, 'data', 'site-content.json')

// 允许同步的文件扩展名集合，用于过滤无关文件。
const allowedExtensions = new Set([
  '.glb',
  '.gltf',
  '.bin',
  '.fbx',
  '.obj',
  '.mtl',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ktx2',
  '.dds',
  '.hdr',
  '.exr'
])

// 模型文件的扩展名。
const modelExtensions = ['.glb', '.gltf', '.fbx', '.obj']
// 可以被优化的图像文件扩展名。
const optimizableImageExtensions = new Set(['.png', '.jpg', '.jpeg'])
// 默认的首选模型文件名列表。
const preferredModelFileNames = ['1.glb', '1.fbx', '2.glb', '2.fbx']
// 模型文件类型的优先级顺序。
const modelExtensionPriority = ['.glb', '.gltf', '.fbx', '.obj']
// 需要对其纹理进行优化的模型 ID 集合。
const optimizedTextureModelIds = new Set(['LiuYun'])
// 纹理文件可被优化的最小体积（256 KB）。
const minimumOptimizableTextureBytes = 256 * 1024
// 强制作为复合模型处理的模型 ID 集合。
const forceCompositeModelIds = new Set([])
const preferredCompositePartModelFileNames = {
  LiuYun: {
    cc: ['cc.fbx', 'cc.glb'],
    mt: ['mt.fbx', 'mt.glb']
  },
  TestHigh: {
    '灯带+控制台（1024）': ['灯带+控制台（完整）.fbx', '灯带+控制台.glb'],
    '船体+顶棚（2048）': ['船体+顶棚(整体).fbx', '船体+顶棚.glb'],
    '船舱+栏杆+沙发（2048）': ['船舱+栏杆+沙发（完整）.fbx', '船舱+栏杆+沙发.glb'],
    '马达（2048）': ['马达.fbx', '马达.glb']
  }
}

/**
 * 根据模型 ID 获取其首选的模型文件名列表。
 * @param {string} modelId - 模型 ID。
 * @returns {string[]} 小写的文件名列表。
 */
const getPreferredModelFileNames = (modelId) => {
  if (modelId === '40mijianchuan') {
    return ['40.fbx', '40.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === 'Yacht') {
    return ['950.fbx', '950.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === '950') {
    return ['950ns.fbx', '950ns.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === 'LiuYun') {
    return ['1198.fbx', '1198.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === 'Cabnet') {
    return ['119b.fbx', '119b.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === 'FireFighting') {
    return ['13.fbx', '13.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  if (modelId === 'PleasureBoat1') {
    return ['11.fbx', '11.glb', ...preferredModelFileNames].map((fileName) => fileName.toLowerCase())
  }

  return preferredModelFileNames.map((fileName) => fileName.toLowerCase())
}

/**
 * 获取复合模型特定部件的首选文件名。
 * @param {string} modelId - 复合模型的 ID。
 * @param {string} partId - 部件的 ID。
 * @returns {string[]} 小写的文件名列表。
 */
const getPreferredCompositePartFileNames = (modelId, partId) => {
  return (
    preferredCompositePartModelFileNames[modelId]?.[partId]?.map((fileName) => fileName.toLowerCase()) ??
    []
  )
}

/**
 * 在 Node.js 环境中安装一个垫片（shim），模拟浏览器环境中的 `document` 和 `Image` 对象。
 * 这是为了让 Three.js 的加载器（如 FBXLoader）能够在没有浏览器 DOM 的情况下运行。
 */
const installNodeTextureInspectionShim = () => {
  // 如果已经存在 document 对象，则不执行任何操作。
  if (typeof globalThis.document !== 'undefined') {
    return
  }

  // 创建一个 Image 对象的存根（stub）。
  const createImageStub = () => ({
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    style: {},
    set src(_value) {},
    get src() {
      return ''
    }
  })

  // 在全局对象上挂载模拟的 document 和 Image。
  globalThis.document = {
    createElementNS: createImageStub
  }
  globalThis.Image = class {
    addEventListener() {}
    removeEventListener() {}
    setAttribute() {}
    set src(_value) {}
    get src() {
      return ''
    }
  }
}

/**
 * 规范化材质插槽名称。
 * 转换为小写，移除常见前缀和特殊字符。
 * @param {string} value - 原始材质名称。
 * @returns {string} 规范化后的名称。
 */
const normalizeMaterialSlotName = (value) => {
  if (!value) {
    return ''
  }

  return String(value)
    .toLowerCase()
    .replace(/^m[_\s-]*/, '')
    .replace(/[^a-z0-9]+/g, '')
}

// 检查源目录是否存在，如果不存在则退出脚本。
if (!fs.existsSync(sourceDir)) {
  console.warn(`[sync:gltf] Source directory not found: ${sourceDir}`)
  process.exit(0)
}

// 清理并重建目标目录。
fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(targetDir, { recursive: true })

// 初始化统计计数器。
let copiedCount = 0
let optimizedTextureCount = 0
let optimizedTextureSavedBytes = 0

/**
 * 将 Windows 风格的路径转换为 POSIX 风格（使用 / 作为分隔符）。
 * @param {string} value - 原始路径。
 * @returns {string} POSIX 风格的路径。
 */
const toPosixPath = (value) => value.replace(/\\/g, '/')

/**
 * 获取文件相对于源目录的相对路径。
 * @param {string} absolutePath - 文件的绝对路径。
 * @returns {string} 相对路径。
 */
const getSourceRelativePath = (absolutePath) => toPosixPath(path.relative(sourceDir, absolutePath))

/**
 * 将文件的绝对路径转换为可在 Web 上访问的公共资源路径。
 * @param {string} absolutePath - 文件的绝对路径。
 * @returns {string} 公共资源路径 (e.g., /gltf/model/file.glb)。
 */
const toPublicAssetPath = (absolutePath) => `/gltf/${getSourceRelativePath(absolutePath)}`

// 存储优化后纹理的公共路径映射。
const optimizedTexturePublicPaths = new Map()

/**
 * 将文件的绝对路径转换为优化后纹理的公共资源路径（.webp 格式）。
 * @param {string} absolutePath - 原始纹理的绝对路径。
 * @returns {string} 优化后纹理的公共路径 (e.g., /gltf/model/texture.optimized.webp)。
 */
const toOptimizedPublicAssetPath = (absolutePath) => {
  const relativePath = path.relative(sourceDir, absolutePath)
  const parsedPath = path.parse(relativePath)
  return `/gltf/${toPosixPath(path.join(parsedPath.dir, `${parsedPath.name}.optimized.webp`))}`
}

/**
 * 将原始文件的绝对路径转换为优化后文件在目标目录中的绝对路径。
 * @param {string} absolutePath - 原始文件的绝对路径。
 * @returns {string} 优化后文件在 'public' 目录下的完整路径。
 */
const toOptimizedTargetPath = (absolutePath) => {
  const relativePath = path.relative(sourceDir, absolutePath)
  const parsedPath = path.parse(relativePath)
  return path.join(targetDir, parsedPath.dir, `${parsedPath.name}.optimized.webp`)
}

/**
 * 获取纹理的最终公共资源路径。
 * 如果纹理已被优化，则返回优化后的路径；否则返回原始路径。
 * @param {string} absolutePath - 纹理的绝对路径。
 * @returns {string} 最终的公共资源路径。
 */
const toTexturePublicAssetPath = (absolutePath) => {
  const sourceRelativePath = getSourceRelativePath(absolutePath)
  return optimizedTexturePublicPaths.get(sourceRelativePath) ?? toPublicAssetPath(absolutePath)
}

/**
 * 将字节数格式化为更易读的字符串（B, KB, MB）。
 * @param {number} value - 字节数。
 * @returns {string} 格式化后的字符串。
 */
const formatBytes = (value) => {
  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 读取并解析 'texture-assignments.json' 文件。
 * 该文件用于手动指定纹理的用途（例如，哪个文件是法线贴图）。
 * @returns {{updatedAt: string, files: object, uvSets: object}}
 */
const readTextureAssignments = () => {
  if (!fs.existsSync(textureAssignmentsPath)) {
    return { updatedAt: new Date().toISOString(), files: {}, uvSets: {} }
  }

  const raw = JSON.parse(fs.readFileSync(textureAssignmentsPath, 'utf8'))
  const files = {}
  const uvSets = {}

  for (const [relativePath, rawAssignment] of Object.entries(raw.files ?? {})) {
    const normalizedPath = toPosixPath(relativePath).replace(/^\/+/, '')
    const normalizedAssignment = normalizeTextureAssignmentRecord(rawAssignment)
    if (!normalizedPath || !normalizedAssignment) {
      continue
    }

    files[normalizedPath] = normalizedAssignment
  }

  for (const [relativePath, rawAssignment] of Object.entries(raw.uvSets ?? {})) {
    const normalizedPath = toPosixPath(relativePath).replace(/^\/+/, '')
    const normalizedAssignment = normalizeUVSetAssignmentRecord(rawAssignment)
    if (!normalizedPath || !normalizedAssignment) {
      continue
    }

    uvSets[normalizedPath] = normalizedAssignment
  }

  return {
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    files,
    uvSets
  }
}

/**
 * 读取并解析 'site-content.json' 文件。
 * 该文件定义了站点的模型、设置等内容。
 * @returns {{settings: object, models: object}}
 */
const readSiteContent = () => {
  if (!fs.existsSync(siteContentPath)) {
    return { settings: {}, models: {} }
  }

  try {
    const raw = JSON.parse(fs.readFileSync(siteContentPath, 'utf8'))
    return {
      settings: raw.settings ?? {},
      models: raw.models ?? {}
    }
  } catch (error) {
    console.warn(`[sync:gltf] Failed to read site content: ${error.message}`)
    return { settings: {}, models: {} }
  }
}

/**
 * 根据文件名猜测纹理的类型（如 diffuse, normal, orm 等）。
 * @param {string} fileName - 纹理文件名。
 * @returns {string} 猜测的纹理类型。
 */
const classifyTexture = (fileName) => {
  const normalizedName = fileName
    .slice(0, fileName.length - path.extname(fileName).length)
    .toLowerCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')

  if (
    normalizedName.includes('r+m+ao') ||
    normalizedName.includes('r_m_ao')
  ) {
    return 'rmao'
  }

  if (
    normalizedName.includes('occlusionroughnessmetallic') ||
    normalizedName.includes('occlusion_roughness_metallic')
  ) {
    return 'orm'
  }

  if (hasStandaloneOrmToken(normalizedName)) {
    return 'orm'
  }

  if (
    normalizedName.includes('basecolor') ||
    normalizedName.includes('base_color') ||
    normalizedName.includes('albedo') ||
    normalizedName.includes('diffuse')
  ) {
    return 'baseColor'
  }

  if (normalizedName.includes('emissive') || normalizedName.includes('emission')) {
    return 'emissive'
  }

  if (normalizedName.includes('normal')) {
    return 'normal'
  }

  if (
    normalizedName === 'ao' ||
    normalizedName.startsWith('ao_') ||
    normalizedName.endsWith('_ao') ||
    normalizedName.includes('ambientocclusion') ||
    normalizedName.includes('ambient_occlusion') ||
    normalizedName.includes('occlusion')
  ) {
    return 'ao'
  }

  if (normalizedName.includes('roughness') || normalizedName.includes('rough')) {
    return 'roughness'
  }

  if (
    normalizedName.includes('metallic') ||
    normalizedName.includes('metalness') ||
    normalizedName.includes('metal')
  ) {
    return 'metalness'
  }

  if (
    normalizedName.includes('opacity') ||
    normalizedName.includes('transparency') ||
    normalizedName === 'alpha' ||
    normalizedName.startsWith('alpha_') ||
    normalizedName.endsWith('_alpha') ||
    normalizedName.includes('transparent')
  ) {
    return 'opacity'
  }

  return null
}

const hasStandaloneOrmToken = (value) => (
  value === 'orm' ||
  value.startsWith('orm.') ||
  value.endsWith('_orm') ||
  value.includes('_orm_')
)

/**
 * 将各种可能的纹理类型名称（如 'albedo', 'diffuse'）归一化为标准的纹理类型（如 'baseColor'）。
 * @param {string} value - 原始的纹理类型字符串。
 * @returns {string | null} 标准化的纹理类型或 null。
 */
const canonicalTextureType = (value) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase()

  switch (normalizedValue) {
    case 'basecolor':
    case 'base_color':
    case 'base color':
    case 'albedo':
    case 'diffuse':
      return 'baseColor'
    case 'emissive':
    case 'emission':
      return 'emissive'
    case 'normal':
      return 'normal'
    case 'ao':
    case 'ambientocclusion':
    case 'ambient_occlusion':
    case 'occlusion':
      return 'ao'
    case 'metalness':
    case 'metallic':
    case 'metal':
      return 'metalness'
    case 'roughness':
    case 'rough':
      return 'roughness'
    case 'rmao':
    case 'r+m+ao':
      return 'rmao'
    case 'orm':
    case 'occlusionroughnessmetallic':
    case 'occlusion_roughness_metallic':
      return 'orm'
    case 'opacity':
    case 'alpha':
    case 'transparent':
    case 'transparency':
      return 'opacity'
    default:
      return null
  }
}

/**
 * 规范化从配置文件中读取的纹理分配值。
 * @param {string} value - 原始分配值。
 * @returns {string | null} 'none'、标准纹理类型或 null。
 */
const normalizeTextureAssignment = (value) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (!normalizedValue || normalizedValue === 'auto') {
    return null
  }

  if (normalizedValue === 'none') {
    return 'none'
  }

  return canonicalTextureType(normalizedValue)
}

/**
 * 规范化从配置文件中读取的完整纹理分配记录（可能是一个对象）。
 * @param {object | string} value - 原始记录。
 * @returns {{textureType: string | null, useAlphaAsOpacity: boolean} | null} 规范化后的记录或 null。
 */
const normalizeTextureAssignmentRecord = (value) => {
  if (typeof value === 'string') {
    const textureType = normalizeTextureAssignment(value)
    if (!textureType) {
      return null
    }

    return {
      textureType,
      useAlphaAsOpacity: false
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const textureType = normalizeTextureAssignment(value.textureType)
  const useAlphaAsOpacity = value.useAlphaAsOpacity === true && (textureType === null || textureType === 'baseColor')

  if (!textureType && !useAlphaAsOpacity) {
    return null
  }

  return {
    textureType,
    useAlphaAsOpacity
  }
}

/**
 * 规范化 UV Set 的分配记录。
 * @param {object} value - 原始记录。
 * @returns {{materialNameHint: string, renderProfile?: object} | null} 规范化后的记录或 null。
 */
const normalizeUVSetAssignmentRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const materialNameHint = String(value.materialNameHint ?? '').trim()
  const renderProfile = normalizeUVSetRenderProfile(value.renderProfile)
  if (!materialNameHint && !renderProfile) {
    return null
  }

  return {
    materialNameHint,
    ...(renderProfile ? { renderProfile } : {})
  }
}

/**
 * 规范化并验证渲染配置文件的各个属性。
 * @param {object} value - 原始渲染配置对象。
 * @returns {object | null} 清理和验证后的渲染配置对象或 null。
 */
const normalizeUVSetRenderProfile = (value = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const alphaMode = String(value.alphaMode ?? '').trim().toLowerCase()
  const side = String(value.side ?? '').trim().toLowerCase()
  const depthWrite = String(value.depthWrite ?? '').trim().toLowerCase()
  const depthTest = String(value.depthTest ?? '').trim().toLowerCase()
  const alphaCutoff = Number(value.alphaCutoff)
  const renderOrder = Number(value.renderOrder)
  const hasMetalness = value.metalness !== '' && value.metalness !== null && value.metalness !== undefined
  const hasRoughness = value.roughness !== '' && value.roughness !== null && value.roughness !== undefined
  const hasEnvMapIntensity = value.envMapIntensity !== '' && value.envMapIntensity !== null && value.envMapIntensity !== undefined
  const metalness = Number(value.metalness)
  const roughness = Number(value.roughness)
  const envMapIntensity = Number(value.envMapIntensity)
  const hasClearcoat = value.clearcoat !== '' && value.clearcoat !== null && value.clearcoat !== undefined
  const hasClearcoatRoughness =
    value.clearcoatRoughness !== '' && value.clearcoatRoughness !== null && value.clearcoatRoughness !== undefined
  const clearcoat = Number(value.clearcoat)
  const clearcoatRoughness = Number(value.clearcoatRoughness)
  const profile = {}

  if (['opaque', 'cutout', 'blend'].includes(alphaMode)) {
    profile.alphaMode = alphaMode
  }
  if (['front', 'double'].includes(side)) {
    profile.side = side
  }
  if (['on', 'off'].includes(depthWrite)) {
    profile.depthWrite = depthWrite
  }
  if (['on', 'off'].includes(depthTest)) {
    profile.depthTest = depthTest
  }
  if (Number.isFinite(alphaCutoff) && alphaCutoff > 0 && alphaCutoff <= 1) {
    profile.alphaCutoff = alphaCutoff
  }
  if (Number.isFinite(renderOrder) && renderOrder >= -1000 && renderOrder <= 1000) {
    profile.renderOrder = Math.trunc(renderOrder)
  }
  if (hasMetalness && Number.isFinite(metalness) && metalness >= 0 && metalness <= 1) {
    profile.metalness = metalness
  }
  if (hasRoughness && Number.isFinite(roughness) && roughness >= 0 && roughness <= 1) {
    profile.roughness = roughness
  }
  if (hasEnvMapIntensity && Number.isFinite(envMapIntensity) && envMapIntensity >= 0 && envMapIntensity <= 8) {
    profile.envMapIntensity = envMapIntensity
  }
  if (hasClearcoat && Number.isFinite(clearcoat) && clearcoat >= 0 && clearcoat <= 1) {
    profile.clearcoat = clearcoat
  }
  if (hasClearcoatRoughness && Number.isFinite(clearcoatRoughness) && clearcoatRoughness >= 0 && clearcoatRoughness <= 1) {
    profile.clearcoatRoughness = clearcoatRoughness
  }

  return Object.keys(profile).length ? profile : null
}

/**
 * 解析纹理的最终类型。
 * 它会结合自动检测（基于文件名）和手动分配（来自配置文件）来确定最合适的类型。
 * @param {string} fileName - 纹理文件名。
 * @param {string} absolutePath - 纹理文件的绝对路径。
 * @param {object} textureAssignments - 已解析的纹理分配配置。
 * @returns {{effectiveType: string | null, useAlphaAsOpacity: boolean}}
 */
const resolveTextureType = (fileName, absolutePath, textureAssignments) => {
  const sourceRelativePath = getSourceRelativePath(absolutePath)
  const detectedType = classifyTexture(fileName)
  const assignment = textureAssignments.files[sourceRelativePath] ?? null
  const assignedTextureType = assignment?.textureType === 'orm' && /r(?:\+|_)m(?:\+|_)ao/i.test(sourceRelativePath)
    ? 'rmao'
    : assignment?.textureType ?? null

  if (assignedTextureType === 'none') {
    return {
      effectiveType: null,
      useAlphaAsOpacity: false
    }
  }

  const effectiveType = assignedTextureType ?? detectedType

  return {
    effectiveType,
    useAlphaAsOpacity: assignment?.useAlphaAsOpacity === true && effectiveType === 'baseColor'
  }
}

/**
 * 从文件名列表中推断材质名称的提示。
 * @param {string[]} fileNames - 文件名数组。
 * @returns {string | null} 推断出的材质名称提示或 null。
 */
const inferMaterialNameHint = (fileNames) => {
  for (const fileName of fileNames) {
    const match = fileName.match(/_(\d{2})\s-\sDefault/i)
    if (match) {
      return `M_${match[1]}___Default`
    }
  }

  return null
}

/**
 * 列出指定目录下的所有文件和子目录。
 * @param {string} dirPath - 目录路径。
 * @returns {fs.Dirent[]} 目录条目数组。
 */
const listFiles = (dirPath) => fs.readdirSync(dirPath, { withFileTypes: true })

/**
 * 根据纹理类型获取相应的 WebP 优化选项。
 * @param {string} textureType - 标准化的纹理类型。
 * @returns {object} sharp 库的 WebP 优化参数。
 */
const getTextureOptimizationOptions = (textureType) => {
  if (textureType === 'baseColor' || textureType === 'emissive') {
    // 对于颜色和自发光贴图，使用有损压缩以获得更好的压缩率。
    return {
      quality: 82,
      alphaQuality: 92,
      effort: 6,
      smartSubsample: true
    }
  }

  // 对于其他类型（如法线、ORM），使用无损压缩以保证数据精度。
  return {
    lossless: true,
    effort: 6
  }
}

/**
 * 规范化 UV Set 的相对路径。
 * @param {string} relativePath - 原始相对路径。
 * @returns {string} 规范化后的路径。
 */
const normalizeUVSetRelativePath = (relativePath = '') => {
  const normalizedPath = toPosixPath(relativePath).replace(/^\/+/, '').trim()
  if (!normalizedPath || normalizedPath === '.') {
    return ''
  }

  return normalizedPath
}

/**
 * 为 UV Set 分配构建一个唯一的键。
 * @param {string} modelId - 模型 ID。
 * @param {string} relativePath - 相对路径。
 * @returns {string} 构建的键 (e.g., 'MyModel/uv-set-1')。
 */
const buildUVSetAssignmentKey = (modelId, relativePath = '') => {
  const normalizedPath = normalizeUVSetRelativePath(relativePath)
  return normalizedPath
    ? toPosixPath(path.posix.join(modelId, normalizedPath))
    : modelId
}

/**
 * 从配置中解析手动的材质名称提示。
 * @param {object} textureAssignments - 纹理分配配置。
 * @param {string} modelId - 模型 ID。
 * @param {string} relativePath - 相对路径。
 * @returns {string} 材质名称提示。
 */
const resolveManualMaterialNameHint = (textureAssignments, modelId, relativePath = '') => (
  textureAssignments?.uvSets?.[buildUVSetAssignmentKey(modelId, relativePath)]?.materialNameHint ?? ''
)

/**
 * 从配置中解析手动的渲染配置文件。
 * @param {object} textureAssignments - 纹理分配配置。
 * @param {string} modelId - 模型 ID。
 * @param {string} relativePath - 相对路径。
 * @returns {object | null} 渲染配置对象或 null。
 */
const resolveManualRenderProfile = (textureAssignments, modelId, relativePath = '') => (
  textureAssignments?.uvSets?.[buildUVSetAssignmentKey(modelId, relativePath)]?.renderProfile ?? null
)

/**
 * 递归地收集目录中所有可被优化的纹理文件。
 * @param {string} dirPath - 要搜索的目录路径。
 * @param {object} textureAssignments - 纹理分配配置。
 * @param {Array} queue - 用于存储结果的队列。
 * @returns {Array} 包含可优化文件信息的数组。
 */
const collectOptimizableTextureFiles = (dirPath, textureAssignments, queue = []) => {
  for (const entry of listFiles(dirPath)) {
    const absolutePath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      collectOptimizableTextureFiles(absolutePath, textureAssignments, queue)
      continue
    }

    const ext = path.extname(entry.name).toLowerCase()
    if (!optimizableImageExtensions.has(ext)) {
      continue
    }

    const sourceRelativePath = getSourceRelativePath(absolutePath)
    const [modelId] = sourceRelativePath.split('/')
    if (!optimizedTextureModelIds.has(modelId)) {
      continue
    }

    const resolution = resolveTextureType(entry.name, absolutePath, textureAssignments)
    if (!resolution.effectiveType) {
      continue
    }

    const stat = fs.statSync(absolutePath)
    if (stat.size < minimumOptimizableTextureBytes) {
      continue
    }

    queue.push({
      absolutePath,
      sourceRelativePath,
      textureType: resolution.effectiveType,
      originalSize: stat.size
    })
  }

  return queue
}

/**
 * 异步优化所有已复制的、符合条件的纹理资源。
 * 它会遍历收集到的纹理，使用 sharp 将其转换为 WebP，并与原图对比，只有在体积变小时才保留优化结果。
 */
const optimizeCopiedTextureAssets = async () => {
  // 如果 sharp 库不可用，则跳过优化。
  if (!sharp) {
    console.warn('[sync:gltf] sharp not available, skipped texture optimization step')
    return
  }

  const textureAssignments = readTextureAssignments()
  const candidates = collectOptimizableTextureFiles(sourceDir, textureAssignments)

  for (const candidate of candidates) {
    const optimizedTargetPath = toOptimizedTargetPath(candidate.absolutePath)
    const optimizedPublicPath = toOptimizedPublicAssetPath(candidate.absolutePath)

    try {
      // 使用 sharp 进行 WebP 转换。
      await sharp(candidate.absolutePath)
        .webp(getTextureOptimizationOptions(candidate.textureType))
        .toFile(optimizedTargetPath)

      const optimizedSize = fs.statSync(optimizedTargetPath).size
      // 如果优化后的文件更大，则删除优化版本。
      if (optimizedSize >= candidate.originalSize) {
        fs.rmSync(optimizedTargetPath, { force: true })
        continue
      }

      // 记录优化成果。
      optimizedTexturePublicPaths.set(candidate.sourceRelativePath, optimizedPublicPath)
      optimizedTextureCount += 1
      optimizedTextureSavedBytes += candidate.originalSize - optimizedSize

      console.log(
        `[sync:gltf] Optimized ${candidate.sourceRelativePath} (${formatBytes(candidate.originalSize)} -> ${formatBytes(optimizedSize)})`
      )
    } catch (error) {
      console.warn(`[sync:gltf] Failed to optimize ${candidate.sourceRelativePath}: ${error.message}`)
    }
  }
}

/**
 * 从目录条目列表中选择最合适的模型文件。
 * 选择逻辑基于预定义的文件名偏好、文件扩展名优先级和字母顺序。
 * @param {fs.Dirent[]} entries - 目录条目数组。
 * @param {string} modelId - 模型 ID。
 * @param {string[]} extraPreferredFileNames - 额外的首选文件名。
 * @returns {fs.Dirent | undefined} 选中的模型文件条目。
 */
const selectModelFileEntry = (entries, modelId, extraPreferredFileNames = []) => entries
  .filter((entry) => entry.isFile() && modelExtensions.includes(path.extname(entry.name).toLowerCase()))
  .slice()
  .sort((left, right) => {
    const localPreferredModelFileNames = [
      ...extraPreferredFileNames.map((fileName) => fileName.toLowerCase()),
      ...getPreferredModelFileNames(modelId)
    ]
    const leftName = left.name.toLowerCase()
    const rightName = right.name.toLowerCase()
    const leftPreferredIndex = localPreferredModelFileNames.indexOf(leftName)
    const rightPreferredIndex = localPreferredModelFileNames.indexOf(rightName)

    if (leftPreferredIndex !== rightPreferredIndex) {
      if (leftPreferredIndex === -1) {
        return 1
      }

      if (rightPreferredIndex === -1) {
        return -1
      }

      return leftPreferredIndex - rightPreferredIndex
    }

    const leftExtIndex = modelExtensionPriority.indexOf(path.extname(left.name).toLowerCase())
    const rightExtIndex = modelExtensionPriority.indexOf(path.extname(right.name).toLowerCase())
    if (leftExtIndex !== rightExtIndex) {
      return leftExtIndex - rightExtIndex
    }

    return leftName.localeCompare(rightName, 'en')
  })[0]

/**
 * 收集指定目录下的所有纹理贴图及其相关信息。
 * @param {string} textureDir - 纹理目录。
 * @param {object} textureAssignments - 纹理分配配置。
 * @returns {{textures: object, textureOptions: object | undefined, textureFileNames: string[]}}
 */
const collectTextureMaps = (textureDir, textureAssignments) => {
  const textures = {}
  const textureOptions = {}
  const textureFileNames = []

  for (const textureEntry of listFiles(textureDir)) {
    if (!textureEntry.isFile()) {
      continue
    }

    const texturePath = path.join(textureDir, textureEntry.name)
    const ext = path.extname(textureEntry.name).toLowerCase()
    if (!allowedExtensions.has(ext)) {
      continue
    }

    textureFileNames.push(textureEntry.name)

    const resolution = resolveTextureType(textureEntry.name, texturePath, textureAssignments)
    if (resolution.effectiveType) {
      textures[resolution.effectiveType] = toTexturePublicAssetPath(texturePath)
      if (resolution.useAlphaAsOpacity) {
        textureOptions[resolution.effectiveType] = {
          useAlphaAsOpacity: true
        }
      }
    }
  }

  return {
    textures,
    textureOptions: Object.keys(textureOptions).length > 0 ? textureOptions : undefined,
    textureFileNames
  }
}

/**
 * 检查一个纹理集合是否包含任何贴图。
 * @param {object} textureSet - 纹理集合。
 * @returns {boolean}
 */
const hasCollectedTextureMaps = (textureSet) => Object.keys(textureSet?.textures ?? {}).length > 0

// 安装 Node.js 环境垫片，并初始化 FBX 加载器和缓存。
installNodeTextureInspectionShim()
const fbxLoader = new FBXLoader()
const modelInspectionCache = new Map()
const textDecoder = new TextDecoder()

/**
 * 检查一个已加载的 Three.js 场景对象，提取材质、网格等信息。
 * @param {THREE.Object3D} rootObject - 场景根对象。
 * @returns {object} 检查结果。
 */
const inspectSceneObject = (rootObject) => {
  const materialSlotMap = new Map()
  let meshCount = 0
  let meshWithUvCount = 0
  let meshWithUv2Count = 0

  rootObject?.traverse?.((child) => {
    if (!child?.isMesh) {
      return
    }

    meshCount += 1
    if (child.geometry?.attributes?.uv) {
      meshWithUvCount += 1
    }
    if (child.geometry?.attributes?.uv2) {
      meshWithUv2Count += 1
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      const name = `${material?.name ?? ''}`.trim() || '(unnamed)'
      const normalizedName = normalizeMaterialSlotName(name)
      const existingSlot = materialSlotMap.get(name)
      if (existingSlot) {
        existingSlot.meshCount += 1
        return
      }

      materialSlotMap.set(name, {
        name,
        normalizedName,
        meshCount: 1
      })
    })
  })

  return {
    meshCount,
    meshWithUvCount,
    meshWithUv2Count,
    uvCoverage: meshCount > 0 ? meshWithUvCount / meshCount : 0,
    uv2Coverage: meshCount > 0 ? meshWithUv2Count / meshCount : 0,
    materialSlots: Array.from(materialSlotMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'en'))
  }
}

/**
 * 检查 GLTF 或 GLB 文件，无需完全加载，直接从 JSON 块中提取材质等信息。
 * @param {string} absolutePath - 文件绝对路径。
 * @returns {object} 检查结果。
 */
const inspectGltfLikeFile = (absolutePath) => {
  const ext = path.extname(absolutePath).toLowerCase()
  let json

  if (ext === '.gltf') {
    json = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } else {
    const buffer = fs.readFileSync(absolutePath)
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546C67) {
      throw new Error('invalid glb header')
    }

    let offset = 12
    let jsonChunk = null
    while (offset + 8 <= buffer.length) {
      const chunkLength = buffer.readUInt32LE(offset)
      const chunkType = buffer.readUInt32LE(offset + 4)
      const chunkStart = offset + 8
      const chunkEnd = chunkStart + chunkLength
      if (chunkEnd > buffer.length) {
        throw new Error('invalid glb chunk length')
      }

      if (chunkType === 0x4E4F534A) { // 'JSON'
        jsonChunk = buffer.subarray(chunkStart, chunkEnd)
        break
      }

      offset = chunkEnd
    }

    if (!jsonChunk) {
      throw new Error('glb json chunk not found')
    }

    json = JSON.parse(textDecoder.decode(jsonChunk).replace(/\u0000+$/g, ''))
  }

  const materialSlotMap = new Map()
  let meshCount = 0
  let meshWithUvCount = 0
  let meshWithUv2Count = 0
  const materials = Array.isArray(json?.materials) ? json.materials : []
  const meshes = Array.isArray(json?.meshes) ? json.meshes : []

  for (const mesh of meshes) {
    for (const primitive of mesh?.primitives ?? []) {
      meshCount += 1
      const attributes = primitive?.attributes ?? {}
      if (Object.prototype.hasOwnProperty.call(attributes, 'TEXCOORD_0')) {
        meshWithUvCount += 1
      }
      if (Object.prototype.hasOwnProperty.call(attributes, 'TEXCOORD_1')) {
        meshWithUv2Count += 1
      }

      const materialIndex = Number.isInteger(primitive?.material) ? primitive.material : -1
      const material = materialIndex >= 0 ? materials[materialIndex] : null
      const name = `${material?.name ?? ''}`.trim() || '(unnamed)'
      const normalizedName = normalizeMaterialSlotName(name)
      const existingSlot = materialSlotMap.get(name)
      if (existingSlot) {
        existingSlot.meshCount += 1
      } else {
        materialSlotMap.set(name, {
          name,
          normalizedName,
          meshCount: 1
        })
      }
    }
  }

  return {
    meshCount,
    meshWithUvCount,
    meshWithUv2Count,
    uvCoverage: meshCount > 0 ? meshWithUvCount / meshCount : 0,
    uv2Coverage: meshCount > 0 ? meshWithUv2Count / meshCount : 0,
    materialSlots: Array.from(materialSlotMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'en'))
  }
}

/**
 * 检查模型文件（FBX, GLB, GLTF），提取材质、UV覆盖率等信息，并带缓存机制。
 * @param {string} absolutePath - 模型文件的绝对路径。
 * @returns {Promise<object>} 包含模型信息的检查结果。
 */
const inspectModelFile = async (absolutePath) => {
  const normalizedPath = path.resolve(absolutePath)
  if (modelInspectionCache.has(normalizedPath)) {
    return modelInspectionCache.get(normalizedPath)
  }

  const ext = path.extname(normalizedPath).toLowerCase()
  let inspection

  try {
    if (ext === '.fbx') {
      const buffer = fs.readFileSync(normalizedPath)
      const object = fbxLoader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')
      inspection = inspectSceneObject(object)
    } else if (ext === '.glb' || ext === '.gltf') {
      inspection = inspectGltfLikeFile(normalizedPath)
    } else {
      inspection = null
    }
  } catch (error) {
    inspection = {
      error: error?.message ?? String(error),
      meshCount: 0,
      meshWithUvCount: 0,
      meshWithUv2Count: 0,
      uvCoverage: 0,
      uv2Coverage: 0,
      materialSlots: []
    }
  }

  modelInspectionCache.set(normalizedPath, inspection)
  return inspection
}

/**
 * 从 UV Set 数组中提取所有规范化后的材质名称提示。
 * @param {object[]} uvSets - UV Set 配置数组。
 * @returns {Set<string>}
 */
const getUvSetNormalizedHints = (uvSets) => {
  const values = new Set()
  for (const uvSet of uvSets) {
    const hint = normalizeMaterialSlotName(uvSet?.materialNameHint)
    if (hint) {
      values.add(hint)
    }
  }
  return values
}

/**
 * 检查一个 UV Set 是否包含任何纹理贴图。
 * @param {object} uvSet - UV Set 配置。
 * @returns {boolean}
 */
const hasTextureMaps = (uvSet) => Object.keys(uvSet?.textures ?? {}).length > 0

/**
 * 根据规范化后的名称在材质插槽列表中查找匹配的插槽。
 * @param {object[]} materialSlots - 材质插槽数组。
 * @param {string} normalizedName - 规范化后的名称。
 * @returns {object | null}
 */
const getMaterialSlotByNormalizedName = (materialSlots = [], normalizedName = '') => {
  if (!normalizedName) {
    return null
  }

  return materialSlots.find((slot) => normalizeMaterialSlotName(slot?.name) === normalizedName || slot?.normalizedName === normalizedName) ?? null
}

/**
 * 使用从模型检查中获得的运行时信息，来修正或补充 UV Set 中的材质名称提示。
 * @param {object[]} uvSets - 原始 UV Set 数组。
 * @param {object} inspection - 模型检查结果。
 * @returns {object[]} 更新后的 UV Set 数组。
 */
const withRuntimeMaterialHints = (uvSets, inspection) => {
  const materialSlots = inspection?.materialSlots ?? []
  const texturedUvSets = uvSets.filter(hasTextureMaps)
  if (materialSlots.length === 0 || texturedUvSets.length === 0) {
    return uvSets
  }

  return uvSets.map((uvSet) => {
    if (!hasTextureMaps(uvSet)) {
      return uvSet
    }

    const normalizedHint = normalizeMaterialSlotName(uvSet.materialNameHint)
    const matchedSlot = getMaterialSlotByNormalizedName(materialSlots, normalizedHint)
    if (matchedSlot) {
      const slotName = matchedSlot.name
      if (slotName && slotName !== uvSet.materialNameHint) {
        return {
          ...uvSet,
          materialNameHint: slotName,
          materialHintSource: uvSet.materialHintSource === 'manual'
            ? 'manual-runtime'
            : 'runtime'
        }
      }

      return uvSet
    }

    // 如果模型只有一个材质，且只有一个带贴图的 UV Set，则强行匹配。
    if (materialSlots.length === 1 && texturedUvSets.length === 1) {
      return {
        ...uvSet,
        materialNameHint: materialSlots[0].name,
        materialHintSource: uvSet.materialHintSource === 'manual'
          ? 'manual-runtime-single'
          : 'runtime-single'
      }
    }

    return uvSet
  })
}

/**
 * 为模型检查结果打分，用于在多个候选模型文件中选择最优的一个。
 * 分数基于 UV 覆盖率、材质匹配度、文件名偏好等。
 * @param {object} inspection - 模型检查结果。
 * @param {object[]} uvSets - UV Set 数组。
 * @param {string} entryName - 模型文件名。
 * @param {string[]} preferredNames - 偏好文件名列表。
 * @returns {number} 分数。
 */
const scoreModelInspection = (inspection, uvSets, entryName, preferredNames) => {
  const normalizedHints = getUvSetNormalizedHints(uvSets)
  const matchedMaterialSlotCount = inspection?.materialSlots?.filter((slot) => normalizedHints.has(slot.normalizedName)).length ?? 0
  const preferredIndex = preferredNames.indexOf(entryName.toLowerCase())
  const preferredScore = preferredIndex === -1 ? 0 : Math.max(0, preferredNames.length - preferredIndex)

  return (
    (inspection?.uvCoverage ?? 0) * 1000 +
    matchedMaterialSlotCount * 100 +
    (inspection?.meshWithUv2Count ?? 0) * 0.001 +
    preferredScore
  )
}

/**
 * 解析材质名称提示的来源和值。
 * 优先级：手动配置 > 预设规则 > 从文件名推断。
 * @param {string} modelId - 模型 ID。
 * @param {string} uvSetRelativePath - UV Set 的相对路径。
 * @param {object} textureSet - 纹理集合。
 * @returns {{value: string | null, source: string}}
 */
const resolveMaterialNameHint = (modelId, uvSetRelativePath, textureSet) => {
  const uvSetId = normalizeUVSetRelativePath(uvSetRelativePath).split('/').filter(Boolean).at(-1) ?? ''
  const manualHint = resolveManualMaterialNameHint(textureSet.textureAssignments, modelId, uvSetRelativePath)
  if (manualHint) {
    return {
      value: manualHint,
      source: 'manual'
    }
  }

  if (modelId === 'LiuYun') {
    if (uvSetId === 'cc') {
      return {
        value: 'M_01___Default',
        source: 'preset'
      }
    }

    if (uvSetId === 'mt') {
      return {
        value: 'M_02___Default',
        source: 'preset'
      }
    }
  }

  const inferredHint = inferMaterialNameHint(textureSet.textureFileNames)
  return inferredHint
    ? {
        value: inferredHint,
        source: 'inferred'
      }
    : {
        value: null,
        source: ''
      }
}

/**
 * 创建一个 UV Set 的配置对象。
 * @param {string} modelId - 模型 ID。
 * @param {string} id - UV Set 的 ID。
 * @param {string[]} directorySegments - 目录路径分段。
 * @param {object} textureSet - 纹理集合。
 * @returns {object} UV Set 配置对象。
 */
const createUvSetConfig = (modelId, id, directorySegments, textureSet) => {
  const uvSetRelativePath = directorySegments.slice(1).join('/')
  const materialHint = resolveMaterialNameHint(modelId, uvSetRelativePath, textureSet)
  const renderProfile = resolveManualRenderProfile(textureSet.textureAssignments, modelId, uvSetRelativePath)

  return {
    id,
    label: `UV ${id}`,
    directory: `/gltf/${directorySegments.map((segment) => toPosixPath(segment)).join('/')}`,
    materialNameHint: materialHint.value,
    materialHintSource: materialHint.source,
    textures: textureSet.textures,
    textureOptions: textureSet.textureOptions,
    ...(renderProfile ? { renderProfile } : {})
  }
}

/**
 * 递归地构建一个模型的所有 UV Set 配置。
 * 它会处理直接位于模型目录下的纹理，以及位于子目录中的纹理。
 * @param {string} modelId - 模型 ID。
 * @param {string} modelDir - 模型根目录。
 * @param {string[]} basePathSegments - 基础路径分段。
 * @param {object} textureAssignments - 纹理分配配置。
 * @returns {object[]} UV Set 配置数组。
 */
const buildUvSets = (modelId, modelDir, basePathSegments, textureAssignments) => {
  const childEntries = listFiles(modelDir)
  const directTextureSet = {
    ...collectTextureMaps(modelDir, textureAssignments),
    textureAssignments
  }
  const directUvSetId = basePathSegments[basePathSegments.length - 1] ?? modelId
  const directUvSets = hasCollectedTextureMaps(directTextureSet)
    ? [createUvSetConfig(modelId, directUvSetId, basePathSegments, directTextureSet)]
    : []

  const nestedUvSets = childEntries
    .filter((childEntry) => childEntry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .flatMap((childEntry) => {
      const uvDir = path.join(modelDir, childEntry.name)
      const childTextureSet = {
        ...collectTextureMaps(uvDir, textureAssignments),
        textureAssignments
      }

      if (hasCollectedTextureMaps(childTextureSet)) {
        return [createUvSetConfig(modelId, childEntry.name, [...basePathSegments, childEntry.name], childTextureSet)]
      }

      // 进一步处理嵌套的 UV Set 目录。
      return listFiles(uvDir)
        .filter((nestedEntry) => nestedEntry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name, 'en'))
        .map((nestedEntry) => {
          const nestedUvDir = path.join(uvDir, nestedEntry.name)
          const nestedTextureSet = {
            ...collectTextureMaps(nestedUvDir, textureAssignments),
            textureAssignments
          }

          if (!hasCollectedTextureMaps(nestedTextureSet)) {
            return null
          }

          return createUvSetConfig(
            modelId,
            `${childEntry.name}/${nestedEntry.name}`,
            [...basePathSegments, childEntry.name, nestedEntry.name],
            nestedTextureSet
          )
        })
        .filter(Boolean)
    })

  return [...directUvSets, ...nestedUvSets]
}

/**
 * 构建单个模型的完整配置，包括模型信息、UV Set 和运行时检查数据。
 * @param {string} modelId - 模型 ID。
 * @param {string} modelDir - 模型目录。
 * @param {fs.Dirent} modelFileEntry - 模型文件条目。
 * @param {object} textureAssignments - 纹理分配配置。
 * @param {string[]} [basePathSegments=[modelId]] - 基础路径分段。
 * @param {string} [modelFileBaseDir=modelDir] - 模型文件所在的基目录。
 * @returns {Promise<object>} 模型的完整配置。
 */
const buildSingleModelConfig = async (
  modelId,
  modelDir,
  modelFileEntry,
  textureAssignments,
  basePathSegments = [modelId],
  modelFileBaseDir = modelDir
) => {
  const modelFilePath = path.join(modelFileBaseDir, modelFileEntry.name)
  const uvSets = buildUvSets(modelId, modelDir, basePathSegments, textureAssignments)
  const inspection = await inspectModelFile(modelFilePath)
  const runtimeUvSets = withRuntimeMaterialHints(uvSets, inspection)

  return {
    id: modelId,
    label: modelId,
    model: {
      format: path.extname(modelFileEntry.name).slice(1).toLowerCase(),
      path: toPublicAssetPath(modelFilePath)
    },
    defaultUvSetId: runtimeUvSets[0]?.id ?? null,
    uvSets: runtimeUvSets,
    runtime: {
      materialSlots: inspection?.materialSlots ?? [],
      meshCount: inspection?.meshCount ?? 0,
      meshWithUvCount: inspection?.meshWithUvCount ?? 0,
      meshWithUv2Count: inspection?.meshWithUv2Count ?? 0,
      uvCoverage: inspection?.uvCoverage ?? 0,
      uv2Coverage: inspection?.uv2Coverage ?? 0,
      inspectionError: inspection?.error ?? ''
    }
  }
}

/**
 * 解析并构建一个嵌套在子目录中的单一模型的配置。
 * 这种情况通常用于一个模型 ID 对应一个包含模型文件和纹理的独立文件夹。
 * @param {string} modelId - 模型 ID。
 * @param {string} modelDir - 模型所在的根目录。
 * @param {object} textureAssignments - 纹理分配配置。
 * @returns {Promise<object | null>} 模型的完整配置或 null。
 */
const resolveNestedSingleModelConfig = async (modelId, modelDir, textureAssignments) => {
  const childDirectories = listFiles(modelDir)
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))

  const nestedCandidates = childDirectories
    .map((childEntry) => {
      const childDir = path.join(modelDir, childEntry.name)
      const nestedModelFileEntry = selectModelFileEntry(listFiles(childDir), modelId)

      if (!nestedModelFileEntry) {
        return null
      }

      return {
        childDir,
        childEntry,
        nestedModelFileEntry
      }
    })
    .filter(Boolean)

  // 仅当只有一个子目录包含有效模型文件时，才认为它是一个合法的嵌套模型。
  if (nestedCandidates.length !== 1) {
    return null
  }

  const [{ childDir, childEntry, nestedModelFileEntry }] = nestedCandidates

  return buildSingleModelConfig(
    modelId,
    childDir,
    nestedModelFileEntry,
    textureAssignments,
    [modelId, childEntry.name],
    childDir
  )
}

/**
 * 递归地将源目录中所有支持的资源文件（模型、纹理等）复制到目标目录。
 * @param {string} fromDir - 源目录。
 * @param {string} toDir - 目标目录。
 */
const copySupportedAssets = (fromDir, toDir) => {
  const entries = listFiles(fromDir)

  for (const entry of entries) {
    const fromPath = path.join(fromDir, entry.name)
    const toPath = path.join(toDir, entry.name)

    if (entry.isDirectory()) {
      // 递归复制时保留源目录的层级结构。
      fs.mkdirSync(toPath, { recursive: true })
      copySupportedAssets(fromPath, toPath)
      continue
    }

    const ext = path.extname(entry.name).toLowerCase()
    if (!allowedExtensions.has(ext)) {
      continue
    }

    fs.copyFileSync(fromPath, toPath)
    copiedCount += 1
  }
}

/**
 * 从多个候选模型文件中，通过检查和评分，选出最佳的一个。
 * @param {fs.Dirent[]} entries - 候选文件条目数组。
 * @param {string} modelId - 模型 ID。
 * @param {object[]} uvSets - UV Set 数组。
 * @param {function(fs.Dirent): string} resolveAbsolutePath - 将条目解析为绝对路径的函数。
 * @param {string[]} [extraPreferredFileNames=[]] - 额外的偏好文件名。
 * @returns {Promise<{selected: fs.Dirent | null, candidates: object[]}>}
 */
const chooseBestModelFileEntry = async (entries, 
                                        modelId, 
                                        uvSets, 
                                        resolveAbsolutePath, 
                                        extraPreferredFileNames = []) => 
{
  const candidates = entries
    .filter((entry) => entry.isFile() && modelExtensions.includes(path.extname(entry.name).toLowerCase()))
    .slice()

  if (candidates.length === 0) {
    return { selected: null, candidates: [] }
  }

  const preferredNames = [
    ...extraPreferredFileNames.map((fileName) => fileName.toLowerCase()),
    ...getPreferredModelFileNames(modelId)
  ]

  const inspectedCandidates = []
  for (const entry of candidates) {
    const absolutePath = resolveAbsolutePath(entry)
    const inspection = await inspectModelFile(absolutePath)
    inspectedCandidates.push({
      entry,
      inspection,
      score: scoreModelInspection(inspection, uvSets, entry.name, preferredNames)
    })
  }

  // 根据分数、偏好和名称排序，分数最高的排在最前面。
  inspectedCandidates.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }

    const leftPreferredIndex = preferredNames.indexOf(left.entry.name.toLowerCase())
    const rightPreferredIndex = preferredNames.indexOf(right.entry.name.toLowerCase())
    if (leftPreferredIndex !== rightPreferredIndex) {
      if (leftPreferredIndex === -1) {
        return 1
      }
      if (rightPreferredIndex === -1) {
        return -1
      }
      return leftPreferredIndex - rightPreferredIndex
    }

    return left.entry.name.localeCompare(right.entry.name, 'en')
  })

  return {
    selected: inspectedCandidates[0]?.entry ?? null,
    candidates: inspectedCandidates.map((candidate) => ({
      fileName: candidate.entry.name,
      format: path.extname(candidate.entry.name).slice(1).toLowerCase(),
      path: toPublicAssetPath(path.join(sourceDir, modelId, candidate.entry.name)),
      score: candidate.score,
      materialSlots: candidate.inspection?.materialSlots ?? [],
      meshCount: candidate.inspection?.meshCount ?? 0,
      meshWithUvCount: candidate.inspection?.meshWithUvCount ?? 0,
      meshWithUv2Count: candidate.inspection?.meshWithUv2Count ?? 0,
      uvCoverage: candidate.inspection?.uvCoverage ?? 0,
      uv2Coverage: candidate.inspection?.uv2Coverage ?? 0,
      inspectionError: candidate.inspection?.error ?? ''
    }))
  }
}

/**
 * 根据相对路径在目录条目中查找模型文件。
 * @param {fs.Dirent[]} entries - 目录条目数组。
 * @param {string} selectedModelPath - 选定的模型相对路径。
 * @returns {fs.Dirent | null}
 */
const findModelEntryByRelativePath = (entries, selectedModelPath) => {
  const normalizedPath = toPosixPath(String(selectedModelPath ?? '').trim()).replace(/^\/+/, '')
  if (!normalizedPath || normalizedPath.includes('..')) {
    return null
  }

  const normalizedFileName = path.basename(normalizedPath).toLowerCase()
  return entries.find((entry) => (
    entry.isFile() &&
    entry.name.toLowerCase() === normalizedFileName &&
    modelExtensions.includes(path.extname(entry.name).toLowerCase())
  )) ?? null
}

/**
 * 将 site-content.json 中的配置应用到最终生成的清单文件中。
 * 这允许通过 CMS 或配置文件来覆盖默认选择的模型或设置主模型。
 * @param {object} manifest - 初始清单对象。
 * @param {object} siteContent - 从 site-content.json 读取的内容。
 * @returns {object} 更新后的清单对象。
 */
const applySiteContentToManifest = (manifest, siteContent) => {
  const settings = siteContent?.settings ?? {}
  const configuredPrimaryModelId = String(settings.primaryModelId ?? '').trim()
  if (configuredPrimaryModelId && manifest.models.some((model) => model.id === configuredPrimaryModelId)) {
    manifest.primaryModelId = configuredPrimaryModelId
  }

  for (const model of manifest.models) {
    const configuredModelPath = String(siteContent?.models?.[model.id]?.selectedModelPath ?? '').trim()
    if (!configuredModelPath) {
      continue
    }

    const publicPath = `/gltf/${model.id}/${toPosixPath(configuredModelPath).replace(/^\/+/, '')}`
    const candidate = model.runtime?.candidates?.find((item) => item.path === publicPath)
    model.model = {
      format: path.extname(publicPath).slice(1).toLowerCase(),
      path: publicPath
    }

    if (candidate) {
      model.runtime = {
        ...(model.runtime ?? {}),
        materialSlots: candidate.materialSlots ?? [],
        meshCount: candidate.meshCount ?? 0,
        meshWithUvCount: candidate.meshWithUvCount ?? 0,
        meshWithUv2Count: candidate.meshWithUv2Count ?? 0,
        uvCoverage: candidate.uvCoverage ?? 0,
        uv2Coverage: candidate.uv2Coverage ?? 0,
        inspectionError: candidate.inspectionError ?? ''
      }
    }
  }

  return manifest
}

/**
 * 构建包含所有模型信息的清单文件 (asset-manifest.json)。
 * 这是脚本的核心业务逻辑，它会遍历所有模型目录，并为每个模型生成配置。
 * @returns {Promise<object>}
 */
const buildModelManifest = async () => {
  const textureAssignments = readTextureAssignments()
  const siteContent = readSiteContent()
  const topLevelEntries = listFiles(sourceDir)
  const models = []

  for (const entry of topLevelEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const modelDir = path.join(sourceDir, entry.name)
    const childEntries = listFiles(modelDir)
    const uvSets = buildUvSets(entry.name, modelDir, [entry.name], textureAssignments)
    const configuredModelPath = siteContent.models?.[entry.name]?.selectedModelPath
    const runtimeSelection = forceCompositeModelIds.has(entry.name)
      ? { selected: null, candidates: [] }
      : await chooseBestModelFileEntry(
        childEntries,
        entry.name,
        uvSets,
        (candidateEntry) => path.join(modelDir, candidateEntry.name)
      )
    const configuredModelEntry = findModelEntryByRelativePath(childEntries, configuredModelPath)
    const modelFileEntry = configuredModelEntry ?? runtimeSelection.selected

    if (modelFileEntry) {
      const modelConfig = await buildSingleModelConfig(entry.name, modelDir, modelFileEntry, textureAssignments)
      modelConfig.runtime = {
        ...(modelConfig.runtime ?? {}),
        candidates: runtimeSelection.candidates
      }
      models.push(modelConfig)
      continue
    }

    const nestedSingleModelConfig = await resolveNestedSingleModelConfig(entry.name, modelDir, textureAssignments)
    if (nestedSingleModelConfig) {
      models.push(nestedSingleModelConfig)
      continue
    }

    const partConfigs = childEntries
      .filter((childEntry) => childEntry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))
      .map(async (childEntry) => {
        const partDir = path.join(modelDir, childEntry.name)
        const partEntries = listFiles(partDir)
        const partUvSets = buildUvSets(entry.name, partDir, [entry.name, childEntry.name], textureAssignments)
        const siblingPartModelEntries = childEntries.filter((partEntry) => (
          partEntry.isFile()
          && modelExtensions.includes(path.extname(partEntry.name).toLowerCase())
          && path.basename(partEntry.name, path.extname(partEntry.name)).toLowerCase() === childEntry.name.toLowerCase()
        ))
        const runtimeSelection = await chooseBestModelFileEntry(
          [...partEntries, ...siblingPartModelEntries],
          entry.name,
          partUvSets,
          (candidateEntry) => {
            const usesSiblingPartModel = siblingPartModelEntries.includes(candidateEntry)
            return path.join(usesSiblingPartModel ? modelDir : partDir, candidateEntry.name)
          },
          [
            ...getPreferredCompositePartFileNames(entry.name, childEntry.name),
            `${childEntry.name}.glb`,
            `${childEntry.name}.fbx`,
            `${childEntry.name}.gltf`
          ]
        )
        const partModelFileEntry = runtimeSelection.selected

        if (!partModelFileEntry) {
          return null
        }

        const usesSiblingPartModel = siblingPartModelEntries.includes(partModelFileEntry)
        const partConfig = await buildSingleModelConfig(
          entry.name,
          partDir,
          partModelFileEntry,
          textureAssignments,
          [entry.name, childEntry.name],
          usesSiblingPartModel ? modelDir : partDir
        )

        return {
          ...partConfig,
          runtime: {
            ...(partConfig.runtime ?? {}),
            candidates: runtimeSelection.candidates
          },
          id: childEntry.name,
          label: childEntry.name
        }
      })
    const resolvedPartConfigs = (await Promise.all(partConfigs)).filter(Boolean)

    if (resolvedPartConfigs.length === 0) {
      continue
    }

    const mergedMaterialSlots = new Map()
    let mergedMeshCount = 0
    let mergedMeshWithUvCount = 0
    let mergedMeshWithUv2Count = 0
    for (const part of resolvedPartConfigs) {
      const partRuntime = part.runtime ?? {}
      mergedMeshCount += partRuntime.meshCount ?? 0
      mergedMeshWithUvCount += partRuntime.meshWithUvCount ?? 0
      mergedMeshWithUv2Count += partRuntime.meshWithUv2Count ?? 0
      for (const slot of partRuntime.materialSlots ?? []) {
        const key = `${slot.name ?? ''}`
        const existingSlot = mergedMaterialSlots.get(key)
        if (existingSlot) {
          existingSlot.meshCount += slot.meshCount ?? 0
        } else {
          mergedMaterialSlots.set(key, { ...slot })
        }
      }
    }

    models.push({
      id: entry.name,
      label: entry.name,
      model: resolvedPartConfigs[0].model,
      defaultUvSetId: null,
      uvSets: [],
      parts: resolvedPartConfigs,
      runtime: {
        materialSlots: Array.from(mergedMaterialSlots.values()).sort((left, right) => left.name.localeCompare(right.name, 'en')),
        meshCount: mergedMeshCount,
        meshWithUvCount: mergedMeshWithUvCount,
        meshWithUv2Count: mergedMeshWithUv2Count,
        uvCoverage: mergedMeshCount > 0 ? mergedMeshWithUvCount / mergedMeshCount : 0,
        uv2Coverage: mergedMeshCount > 0 ? mergedMeshWithUv2Count / mergedMeshCount : 0,
        inspectionError: '',
        candidates: []
      }
    })
  }

  models.sort((left, right) => left.id.localeCompare(right.id, 'en'))

  return applySiteContentToManifest({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      assetRoot: toPosixPath(path.relative(frontendDir, sourceDir)),
      publicRoot: 'public/gltf'
    },
    primaryModelId: models[0]?.id ?? null,
    models
  }, siteContent)
}

// --- 脚本主执行逻辑 ---

// 1. 复制所有支持的资源文件。
copySupportedAssets(sourceDir, targetDir)

// 2. 异步优化纹理（如果 sharp 可用）。
await optimizeCopiedTextureAssets()

// 3. 构建模型清单。
const manifest = await buildModelManifest()

// 4. 将最终的清单文件写入 public 目录。
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

if (manifest.models.length === 0) {
  console.warn(`[sync:gltf] No model directories found under ${sourceDir}`)
}

console.log(
  `[sync:gltf] Copied ${copiedCount} asset(s) and wrote manifest for ${manifest.models.length} model(s) from ${sourceDir} to ${targetDir}`
)

if (optimizedTextureCount > 0) {
  console.log(
    `[sync:gltf] Generated ${optimizedTextureCount} optimized texture(s), saved ${formatBytes(optimizedTextureSavedBytes)}`
  )
}