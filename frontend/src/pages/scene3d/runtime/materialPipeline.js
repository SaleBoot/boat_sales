import * as THREE from 'three'

import {
  applyDitherFadeMaterial,
  applyPackedRmaoMaterial,
  applyShaderTintMaterial,
  clearShaderTintMaterial,
  clearShaderTintTree
} from '../../../utils/utils_3js.js'

import {
  getColorConfigMaterialSlots,
  getColorShaderPreset,
  materialMatchesColorSlots,
  materialMatchesOverrideSlots,
  normalizeMaterialName,
  normalizeOptionalMaterialOverrides,
  shouldApplyColorway
} from '../../../utils/utils_ship_scene.js'

import {
  UV_SET_ALPHA_MODE_BLEND,
  UV_SET_ALPHA_MODE_CUTOUT,
  UV_SET_ALPHA_MODE_OPAQUE,
  UV_SET_DEPTH_TEST_OFF,
  UV_SET_DEPTH_TEST_ON,
  UV_SET_DEPTH_WRITE_OFF,
  UV_SET_DEPTH_WRITE_ON,
  UV_SET_DITHER_MODE_OFF,
  UV_SET_DITHER_MODE_ON,
  UV_SET_SIDE_DOUBLE,
  UV_SET_SIDE_FRONT
} from '../../../constants/constants_ship_scene.js'

export function createMaterialPipeline({
  modelId,
  colorConfig, 
  resolveAssetPath,
  resolveManifestPath,
  loadTextureAsync,
  externalTextures,
  texturePromiseCache
}) {
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
      // renderOrder（渲染层级顺序，控制哪个物体先画、哪个后画），需要确保它是一个整数
      // 兜底：如果根本不是合法数字，则赋予 null，不干扰引擎默认排序。
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
      //环境贴图强度。最大限制为 8（防止曝光过度导致画面全白）
      profile?.envMapIntensity !== '' &&
      profile?.envMapIntensity !== null &&
      profile?.envMapIntensity !== undefined &&
      Number.isFinite(Number(profile.envMapIntensity))
        ? Math.max(0, Math.min(8, Number(profile.envMapIntensity)))
        : null,
    clearcoat:
      // 清漆层强度。
      profile?.clearcoat !== '' &&
      profile?.clearcoat !== null &&
      profile?.clearcoat !== undefined &&
      Number.isFinite(Number(profile.clearcoat))
        ? Math.max(0, Math.min(1, Number(profile.clearcoat)))
        : null,
    clearcoatRoughness:// 清漆层粗糙度。
      profile?.clearcoatRoughness !== '' &&
      profile?.clearcoatRoughness !== null &&
      profile?.clearcoatRoughness !== undefined &&
      Number.isFinite(Number(profile.clearcoatRoughness))
        ? Math.max(0, Math.min(1, Number(profile.clearcoatRoughness)))
        : null,
    ditherMode: `${profile?.ditherMode ?? ''}`.trim().toLowerCase(),
    ditherOpacity: // 抖动透明度
      // 1. 什么是 Dither（抖动）？在 3D 渲染中，处理“半透明物体”是非常昂贵且麻烦的。
      // 传统的透明渲染（Alpha Blending）需要将物体从后往前依次排序渲染，否则就会出现
      // 严重的遮挡错乱（比如透过玻璃看不到后面的车坐垫）。这种排序不仅消耗 CPU，在面对
      // 复杂的交叉模型时还会直接失效。
      // 为了解决这个性能痛点，Dithered（抖动/像素剔除）技术应运而生：
      // 它不使用传统的物理透明度，而是利用一种类似报纸印刷的点阵网格（Pixel Dither Pattern）。
      // 通过在屏幕像素上有规律地“丢弃（Discard）”一部分像素，让后面的物体露出来，从而在
      // 视觉上“骗”过人眼，伪造出半透明的效果。
      profile?.ditherOpacity !== '' &&
      profile?.ditherOpacity !== null &&
      profile?.ditherOpacity !== undefined &&
      Number.isFinite(Number(profile.ditherOpacity))
        ? Math.max(0, Math.min(1, Number(profile.ditherOpacity)))
        : null
  })

  const createPbrMaterial = (material) => {
    //  基于 MeshStandardMaterial 创建一个新的材质实例，尽可能保留原材质的属性 
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
      // envMapIntensity: 1.28: 环境贴图影响强度。这里写死了 1.28，意味着这个材质会
      // 稍微放大环境光（天空盒）的反射亮度，让物体看起来更亮丽、更有立体感。
      envMapIntensity: 1.28
    })
    // 尽可能保留原材质的贴图。
    if (material?.map) {// (颜色/纹理贴图)
      upgradedMaterial.map = material.map
    }  
    if (material?.normalMap) {
      // (法线贴图),
      // 通过改变表面光照方向，在不增加模型网格面的情况下，凭空模拟出凹凸不平的细节（如砖墙的缝隙、皮肤的毛孔）。
      upgradedMaterial.normalMap = material.normalMap
    }
    if (material?.alphaMap) {
      // (透明度贴图)**：用黑白灰阶来控制材质的透明区域（黑色完全透明，白色完全不透明）。
      upgradedMaterial.alphaMap = material.alphaMap
    }
    if (material?.aoMap) {
      // (环境光遮蔽贴图)**：模拟物体缝隙、阴影处的自阴影效果，让模型更有立体感，避免“漂浮感”。
      upgradedMaterial.aoMap = material.aoMap
    }
    if (material?.metalnessMap) {
      //  (金属/粗糙度贴图)**：精确控制模型上哪些地方是金属、哪些地方粗糙。
      // 例如，一把刀的刀刃部分在贴图上是亮的（高金属度），木质刀柄是暗的（低金属度）。
      upgradedMaterial.metalnessMap = material.metalnessMap
    }
    if (material?.roughnessMap) {
      upgradedMaterial.roughnessMap = material.roughnessMap
    }
    if (material?.emissiveMap) {
      // (自发光贴图)**：控制物体表面哪些局部区域会发光（如科幻装甲上的发光条）。
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
      metalness: 'metalness' in (material ?? {}) ? material.metalness : 0.24,//-
      roughness: 'roughness' in (material ?? {}) ? material.roughness : 0.34,//-
      envMapIntensity: material?.envMapIntensity ?? 1.52,//-
      clearcoat: material?.clearcoat ?? 0,// 清漆层（Clearcoat）
      clearcoatRoughness: material?.clearcoatRoughness ?? 0.08 //
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
      // aoMapIntensity (环境光遮蔽强度): 用来控制模型缝隙阴影的深浅。这里确保了
      // 如果原材质调整过阴影的死角黑度，新材质能百分之百继承过来。
      upgradedMaterial.aoMapIntensity = material.aoMapIntensity
    }
    if (material?.userData?.packedRmaoMap) {
      upgradedMaterial.userData.packedRmaoMap = material.userData.packedRmaoMap
      applyPackedRmaoMaterial(upgradedMaterial, material.userData.packedRmaoMap)
    }

    return upgradedMaterial
  }
  // uv set 渲染配置真正落地的核心函数。
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
    } else if (normalizedProfile.alphaCutoff > 0 && 
               (hasOpacityTexture || useBaseColorAlpha || targetMaterial.transparent)) 
    {
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

  /**
   * 将各种纹理贴图（maps）应用到 Three.js 材质上。
   * 这个函数根据传入的 `maps` 对象，将对应的纹理设置到 `material` 的属性上，
   * 并根据纹理类型调整材质的相关属性（如颜色、金属度、粗糙度、透明度等）。
   *
   * @param {THREE.Material} material - 要应用贴图的 Three.js 材质对象。
   * @param {object} maps - 包含各种纹理贴图的对象。
   * @param {THREE.Texture} [maps.basecolor] - 基础颜色贴图。
   * @param {THREE.Texture} [maps.emissive] - 自发光贴图。
   * @param {THREE.Texture} [maps.normal] - 法线贴图。
   * @param {THREE.Texture} [maps.orm] - 环境光遮蔽（AO）、粗糙度（Roughness）、金属度（Metalness）打包贴图。
   * @param {THREE.Texture} [maps.rmao] - 粗糙度（Roughness）、金属度（Metalness）、环境光遮蔽（AO）打包贴图。
   * @param {THREE.Texture} [maps.ao] - 环境光遮蔽贴图。
   * @param {THREE.Texture} [maps.metalness] - 金属度贴图。
   * @param {THREE.Texture} [maps.roughness] - 粗糙度贴图。
   * @param {THREE.Texture} [maps.opacity] - 透明度贴图。
   * @param {object} options - 配置选项。
   * @param {boolean} [options.canUseUvMaps=true] - 是否允许使用 UV 贴图。
   * @param {object} [options.textureOptions={}] - 纹理相关的额外选项。
   * @param {object} [options.textureOptions.baseColor] - 基础颜色纹理选项。
   * @param {boolean} [options.textureOptions.baseColor.useAlphaAsOpacity=false] - 是否将基础颜色贴图的 Alpha 通道用作透明度。
   */
  const applyMapsToMaterial = (material, maps, options = {}) => {
    const {
      canUseUvMaps = true,
      textureOptions = {}
    } = options
    const shouldUseBaseColorAlpha = textureOptions.baseColor?.useAlphaAsOpacity === true
    // console.log('applyMapsToMaterial::maps', maps)

    if (maps.basecolor && canUseUvMaps) {
      if (material.color) {
        material.color.set('#ffffff')
      }
      material.map = maps.basecolor
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
  // 
  // 定义函数：应用消防CC清漆效果，接收材质对象作为参数
  // 
  const applyFireFightingCcClearcoat = (material) => {
    // 1. 安全判断：如果传入的是物理材质直接用，否则转换为物理材质
    const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

    // 2. 金属度
    targetMaterial.metalness = targetMaterial.metalnessMap ? 0.26 : 0.1
    // 3. 粗糙度
    targetMaterial.roughness = targetMaterial.roughnessMap ? 1 : 0.56
    // 4. 清漆效果（核心）：清漆强度 + 清漆粗糙度
    targetMaterial.clearcoat = 0.22
    targetMaterial.clearcoatRoughness = 0.34
    // 5. 环境光强度：取原值和0.92的最大值（保证不低于0.92）
    targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 0.92)
    // 6. 兼容高光属性（旧版Three.js材质）
    if ('specularIntensity' in targetMaterial) {
      targetMaterial.specularIntensity = 0.42
    }
    // 7. 兼容判断：如果材质支持高光颜色且有set方法，设置为红色系
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
  // 函数：应用流云玻璃材质效果
  const applyLiuYunGlassFinish = (material) => {
    const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

    // ========== 透明/渲染核心 ==========
    targetMaterial.transparent = true    // 开启透明
    targetMaterial.opacity = 1          // 不透明度100%（配合玻璃透光）
    targetMaterial.alphaTest = 0.02      // 极低透明裁剪阈值
    targetMaterial.depthWrite = true     // 开启深度写入（玻璃需要正确的深度排序）
    targetMaterial.side = THREE.DoubleSide // 双面渲染

    // ========== PBR 基础属性 ==========
    targetMaterial.metalness = 0         // 玻璃无金属感
    targetMaterial.roughness = 0.22      // 低粗糙度 → 高光滑玻璃
    targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 1.18) // 环境反光强度

    // ========== 玻璃光学属性（兼容判断） ==========
    if ('transmission' in targetMaterial) {
      // 性能优化：transmission = 1 属于特技渲染，会导致显卡进行非常昂贵的
      // 屏幕缓冲拷贝（Screen Space Refraction）计算，极度消耗网页性能。把它设为 0 可以暴省算力。
      targetMaterial.transmission = 0 // 透光率（0=关闭光线穿透）
    }
    if ('ior' in targetMaterial) {
      targetMaterial.ior = 1.5  // 折射率（标准玻璃折射率）
    }
    if ('thickness' in targetMaterial) {
      targetMaterial.thickness = 0  // 厚度
    }
    if ('attenuationDistance' in targetMaterial) {
      targetMaterial.attenuationDistance = Infinity  // 光线衰减距离（无衰减）
    }
    targetMaterial.needsUpdate = true // 通知Three.js更新材质

    return targetMaterial
  }

  /**
   * 应用“流云”模型的不透明材质效果。
   * “流云”是指一种特定的模型类型或来源，这里针对性地调整其材质以达到预期的视觉效果。
   * @param {THREE.Material} material 原始材质。
   * @param {object} context 上下文信息，可能包含子对象、贴图等。
   * @returns {THREE.Material} 调整后的材质。
   */
  const applyLiuYunOpaqueFinish = (material, context = {}) => {
    // 特殊处理：如果子对象的名称是 'Box025'，则应用玻璃材质效果，这是一个针对特定模型的硬编码分支。
    if (context.child?.name === 'Box025') {
      return applyLiuYunGlassFinish(material)
    }

    // 判断是否应保持透明效果。如果存在透明度贴图或基础颜色贴图明确使用 alpha 通道作为透明度，则为 true。
    const shouldKeepTransparency =
      context.maps?.opacity ||
      context.textureOptions?.baseColor?.useAlphaAsOpacity === true

    // 确保材质是 MeshPhysicalMaterial 类型，以便支持 PBR 属性；如果不是，则基于原材质创建一个新的物理材质。
    const targetMaterial = material?.isMeshPhysicalMaterial ? material : createPhysicalMaterial(material)

    // LiuYun 的 mt BaseColor 虽然带 alpha，但当前更像是导出残留；
    // 若整组开启透明会导致排序和穿帮，因此先按不透明材质处理。
    // 根据之前的判断设置材质的透明属性。
    targetMaterial.transparent = shouldKeepTransparency
    // 设置 alpha 测试值。仅在需要透明时启用，用于处理半透明像素的渲染，避免因深度排序问题导致的穿帮。
    targetMaterial.alphaTest = shouldKeepTransparency
      ? Math.max(targetMaterial.alphaTest ?? 0, 0.02)
      : 0
    targetMaterial.depthWrite = true // 开启深度写入，确保不透明对象能正确遮挡其他对象。
    targetMaterial.depthTest = true // 开启深度测试，确保对象能被其他对象正确遮挡。
    targetMaterial.side = THREE.DoubleSide // 设置为双面渲染，以避免因法线方向问题导致部分面片不可见。
    // 调整金属度。如果存在金属度贴图，使用一个较低的值，否则使用一个更低的基础值，这是为了获得特定的视觉效果。
    targetMaterial.metalness = targetMaterial.metalnessMap ? 0.22 : 0.08
    // 调整粗糙度。如果存在粗糙度贴图，使用一个较高的值，否则使用一个适中的基础值。
    targetMaterial.roughness = targetMaterial.roughnessMap ? 0.88 : 0.52
    // 增强环境贴图的强度，使其至少为 1.18，以获得更强的反射效果。
    targetMaterial.envMapIntensity = Math.max(targetMaterial.envMapIntensity ?? 0, 1.18)
    targetMaterial.needsUpdate = true // 标记材质需要更新，以便 Three.js 应用这些更改。

    return targetMaterial // 返回调整后的材质。
  }

  /**
   * 收集场景中所有网格材质的插槽信息。
   * 这个函数会遍历一个 3D 对象（及其所有子对象），找出所有网格（Mesh）上使用的材质，
   * 并将它们的名称进行规范化处理，最终返回一个包含材质信息的数组。
   * 这对于材质管理和替换非常有用。
   * @param {THREE.Object3D} rootObject - 要遍历的根对象。
   * @returns {Array<{normalizedName: string, name: string}>} - 一个包含材质插槽信息的数组，每个对象包含规范化名称和原始名称。
   */
  const collectRuntimeMaterialSlots = (rootObject) => {
    // 使用 Map 来存储材质插槽，键为规范化后的材质名称，值为原始名称。
    // Map 可以确保每个规范化名称只被添加一次，自动处理了重复材质。
    const materialSlots = new Map()

    // 遍历 rootObject 及其所有子对象。
    rootObject.traverse((child) => {
      // 如果当前对象不是网格（Mesh）或者没有材质，则跳过。
      if (!child.isMesh || !child.material) {
        return
      }

      // 一个网格可能有一个或多个材质（存储在数组中），所以这里统一处理为数组。
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        const name = `${material?.name ?? ''}`.trim()
        // 对材质名称进行规范化处理（例如，转换为小写，移除特殊字符等）。
        const normalizedName = normalizeMaterialName(name)
        // 如果规范化后的名称为空，或者已经存在于 materialSlots 中，则跳过。
        if (!normalizedName || materialSlots.has(normalizedName)) {
          return
        }

        // 将规范化名称和原始名称存入 Map。
        materialSlots.set(normalizedName, name)
      })
    })

    // 将 Map 转换为数组，并返回。数组的每个元素都是一个包含 normalizedName 和 name 的对象。
    return Array.from(materialSlots, ([normalizedName, name]) => ({ normalizedName, name }))
  }

  /**
   * 更新网格的材质。
   * 此函数接收一个网格（mesh）和一个材质转换函数（transformMaterial），
   * 它会应用该转换函数到网格的所有材质上，并处理旧材质的释放。
   * @param {THREE.Mesh} mesh - 需要更新材质的网格对象。
   * @param {Function} transformMaterial - 一个接收旧材质并返回新材质的函数。
   */
  const updateMeshMaterials = (mesh, transformMaterial) => {
    // 网格的 material 属性可能是一个单独的材质，也可能是一个材质数组，这里统一处理为数组。
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    // 对每个材质应用转换函数，生成新的材质数组。
    const updatedMaterials = materials.map((material) => transformMaterial(material))

    // 如果原始的 mesh.material 就是一个数组（多材质对象）。
    if (Array.isArray(mesh.material)) {
      // 遍历原始材质，如果新材质和旧材质不是同一个对象，则释放旧材质以防止内存泄漏。
      materials.forEach((material, index) => {
        if (updatedMaterials[index] !== material) {
          material?.dispose?.()
        }
      })
      // 将更新后的材质数组赋值回网格。
      mesh.material = updatedMaterials
      return
    }

    // 如果原始的 mesh.material 是单个材质。
    // 如果新材质和旧材质不是同一个对象，则释放旧材质。
    if (updatedMaterials[0] !== mesh.material) {
      mesh.material?.dispose?.()
      // 将更新后的单个材质赋值回网格。
      mesh.material = updatedMaterials[0]
    }
  }

  /**
   * 将一组 UV 贴图应用到场景中的特定材质上。
   * 这个函数会遍历整个场景，根据材质名称提示（materialNameHint）找到匹配的材质，
   * 然后将指定的贴图（maps）应用上去。它还支持材质转换、渲染配置、后备逻辑等高级功能。
   *
   * @param {THREE.Object3D} rootObject - 场景的根对象。
   * @param {object} uvSet - 包含 UV 信息和材质名称提示的对象。
   * @param {object} maps - 一个包含各种贴图（如 baseColor, normal, orm 等）的对象。
   * @param {object} [options={}] - 可选的配置对象。
   * @param {Function|null} [options.materialTransform=null] - 一个可选的函数，用于在应用贴图后进一步转换材质。
   * @param {object} [options.textureOptions={}] - 贴图相关的选项。
   * @param {object} [options.renderProfile={}] - 渲染相关的配置。
   * @param {boolean} [options.allowSingleMaterialFallback=false] - 如果为 true，并且场景中只有一个材质时，即使名称不匹配也应用贴图。
   * @returns {{appliedCount: number, skippedMeshCount: number}} - 返回一个对象，包含成功应用贴图的材质数量和因缺少 UV 而跳过的网格数量。
   */
  const applyUvSetMaps = (rootObject, aMatSlot, maps, options = {}) => {
    
    const hint = aMatSlot.matName // matSlotName
    // console.log('applyUvSetMaps::aMatSlot', aMatSlot)
    // 规范化材质名称提示。
    const normalizedHint = normalizeMaterialName(hint)
    // 解构并设置默认选项。
    const {
      materialTransform = null, // 材质的额外转换函数
      textureOptions = {}, // 贴图选项
      renderProfile = {}, // 渲染配置
      allowSingleMaterialFallback = false // 是否允许在单一材质时回退
    } = options
    let appliedCount = 0 // 成功应用的计数器
    let skippedMeshCount = 0 // 跳过的网格计数器

    // 如果提供了材质名称提示，则收集场景中所有的材质插槽。
    const runtimeMaterialSlots = hint ? collectRuntimeMaterialSlots(rootObject) : []
    // console.log('applyUvSetMaps::runtimeMaterialSlots', runtimeMaterialSlots )
    // 检查提示的材质名称是否存在于运行时的材质插槽中。
    const hintMatchesRuntimeSlot = !hint || runtimeMaterialSlots.some((slot) => slot.normalizedName === normalizedHint)
    // 定义单一材质回退逻辑：如果允许回退、提供了提示、提示的材质不存在，并且场景中只有一个材质，则使用该材质作为回退目标。
    const singleMaterialFallbackSlot = allowSingleMaterialFallback && hint && !hintMatchesRuntimeSlot && runtimeMaterialSlots.length === 1
      ? runtimeMaterialSlots[0]
      : null
    // console.log('applyUvSetMaps::singleMaterialFallbackSlot', singleMaterialFallbackSlot )

    // 遍历场景中的所有对象。
    rootObject.traverse((child) => {
      // 只处理有材质的网格对象。
      if (!child.isMesh || !child.material) {
        return
      }
      // console.log('rootObject.traverse::child', child)
      // 确保网格有 AO UV 坐标（通常是第二套 UV）。
      const hasUv = ensureAoUv(child)
      // 将材质统一处理为数组。
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      // 映射并更新材质数组。
      const updatedMaterials = materials.map((material) => {
        const normalizedMaterialName = normalizeMaterialName(material?.name)
        // 检查当前材质是否匹配名称提示。
        const matchesMaterialHint = !hint || normalizedMaterialName === normalizedHint
        // console.log('applyUvSetMaps::normalizedMaterialName', normalizedMaterialName,
        //   ",normalizedHint=",normalizedHint, ",matchesMaterialHint=",matchesMaterialHint )           
        // 检查当前材质是否匹配单一材质回退的插槽。
        const matchesSingleMaterialFallback =
          singleMaterialFallbackSlot && normalizedMaterialName === singleMaterialFallbackSlot.normalizedName
        // console.log('applyUvSetMaps::matchesSingleMaterialFallback', matchesSingleMaterialFallback,
        //   ",matchesMaterialHint=",matchesMaterialHint )          
        // 如果两种情况都不匹配，则不作任何修改，返回原始材质。
        if (!matchesMaterialHint && !matchesSingleMaterialFallback) {
          return material
        }

                
        // 获取用于应用 UV 贴图的目标材质。如果需要，会创建一个新的 PhysicalMaterial。
        let targetMaterial = getMaterialForUvMaps(material, options)
        // console.log('applyUvSetMaps::targetMaterial=...=', targetMaterial ,"...hasUv=",hasUv)     
        // 如果网格没有所需的 UV 坐标。
        if (!hasUv) {
          skippedMeshCount += 1 // 增加跳过的网格计数。
          // 即使没有 UV，也应用非 UV 相关的贴图（例如，纯色）。
          applyMapsToMaterial(targetMaterial, maps, { canUseUvMaps: false, textureOptions })
          // 如果有材质转换函数，则执行它。
          if (materialTransform) {
            targetMaterial = materialTransform(targetMaterial, {
              child,
              aMatSlot,
              normalizedMaterialName,
              maps,
              textureOptions
            })
          }
          // 应用渲染配置到材质上。
          targetMaterial = applyUvSetRenderProfileToMaterial(targetMaterial, renderProfile, {
            child,
            aMatSlot,
            maps,
            textureOptions
          })
          return targetMaterial
        }
        // console.log('applyUvSetMaps::to..applyMapsToMaterial=...=', targetMaterial ,"...maps=",maps)     
        // 如果网格有 UV 坐标，则应用所有贴图。
        applyMapsToMaterial(targetMaterial, maps, { canUseUvMaps: true, textureOptions })
        // 如果有材质转换函数，则执行它。
        if (materialTransform) {
          targetMaterial = materialTransform(targetMaterial, {
            child,
            aMatSlot,
            normalizedMaterialName,
            maps,
            textureOptions
          })
        }
        // 应用渲染配置到材质上。
        targetMaterial = applyUvSetRenderProfileToMaterial(targetMaterial, renderProfile, {
          child,
          aMatSlot,
          maps,
          textureOptions
        })
        appliedCount += 1 // 增加成功应用的计数。
        return targetMaterial
      })

      // 更新网格的材质，并释放旧材质。
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

    // 返回计数结果。
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
    const [emissive, normal, ao, metalness, roughness, 
      normal2, ao2, metalness2, roughness2] = await Promise.all([
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

  /**
   * 材质处理流程的绝对核心函数。
   * 负责根据指定的UV Set配置，异步加载纹理，并将它们应用到3D模型对象(rootObject)上。
   * 它将一个“素胚”模型转变为具有丰富细节和真实质感的最终成品。
   *
   * @param {THREE.Object3D} rootObject - 需要应用材质的根3D对象。
   * @param {Array} targetUvSets - 一个UV Set配置对象数组，通常来自 asset-manifest.json。
   *                               每个对象都描述了一套纹理以及如何应用它们。
   * @param {string} targetModelFormat - 目标模型的格式 (如 'fbx', 'glb')，用于辅助决策。
   * @param {string} targetLabel - 用于调试和日志记录的标签，通常是模型ID或部件ID。
   */
  const loadAndApplyUvMaps = async (rootObject, targetMatSlots, targetModelFormat, targetLabel) => {
    // 根据模型格式决定是否需要垂直翻转Y轴。FBX格式通常不需要翻转。
    const shouldFlipY = targetModelFormat !== 'fbx'
    // 计算有多少个UV set是真正带有纹理的，这用于后续的“单一材质回退”逻辑。
    // ???
    // 计算：有有效纹理的材质槽数量
    const texturedMatSlotCount = targetMatSlots.filter(matSlot => {
      const tex = matSlot.textures || {};
      // 只要任意一个纹理有路径，就算有效
      return !!( tex.basecolor || tex.normal || tex.ao || tex.roughness || tex.metalness
      );
    }).length;

    // --- 步骤一：遍历每个UV Set配置，逐个加载并应用 ---
    // 与旧版一次性加载所有纹理不同，新策略是按UV Set的顺序，加载一个，应用一个。
    // 这样可以更好地处理复杂的材质覆盖和转换逻辑。
    for (const matSlot of targetMatSlots) 
    {
      // 提取当前UV Set中所有有效的纹理路径。
      const textureEntries = Object.entries(matSlot.textures ?? {}).filter(([, path]) => Boolean(path))
      // 如果当前UV Set没有任何纹理，则直接跳到下一个。
      if (textureEntries.length === 0) {
        continue
      }

      // 提取出纹理选项和渲染配置，方便后续使用。
      const textureOptions = matSlot.textureOptions ?? {}
      const renderProfile = matSlot.renderProfile ?? {}

      // --- 步骤二：并行加载当前UV Set的所有纹理 ---
      // 使用 Promise.all 并行加载当前UV Set所需的所有纹理，提高效率。
      const loadedTextures = await Promise.all(
        textureEntries.map(async ([type, path]) => {
          // 异步加载纹理图片。
          const texture = await loadTextureAsync(resolveManifestPath(path))
          // 根据模型格式设置Y轴翻转。
          texture.flipY = shouldFlipY ? false : true
          // 对颜色和自发光贴图设置正确的色彩空间（SRGB），确保颜色显示正确。
          if (type === 'basecolor' || type === 'emissive') {
            texture.colorSpace = THREE.SRGBColorSpace
          }
          texture.needsUpdate = true
          // 将加载的纹理存入外部数组，以便统一管理和释放。
          externalTextures.push(texture)
          return [type, texture]
        })
      )

      // 将加载好的纹理数组转换为一个以类型为键的对象（如 { baseColor: texture, normal: texture }）。
      const textureMap = Object.fromEntries(loadedTextures)

      // --- 步骤三：准备材质转换逻辑和应用贴图 ---
      // 检查UV Set是否包含明确的渲染配置。
      const hasExplicitRenderProfile = Object.values(matSlot.renderProfile ?? {})
                          .some((value) => value !== '' && value !== 0 && value !== null)
      // **核心转换逻辑**：根据模型ID和UV Set ID，决定是否应用特殊的材质转换函数。
      // 如果有明确的渲染配置，则不应用这些硬编码的转换。
      const materialTransform = hasExplicitRenderProfile
        ? null // 有显式配置，不使用硬编码转换
        : modelId === 'FireFighting' // 如果是消防船模型
          ? ( // 且UV Set ID是 'tt/cc'
              matSlot.id === 'tt/cc'
                ? applyFireFightingCcClearcoat // 应用消防船清漆效果
                : matSlot.id === 'tt/langan' // 且UV Set ID是 'tt/langan'
                  ? applyFireFightingRailingTransparency // 应用消防船栏杆透明效果
                  : null
            )
          : modelId === 'LiuYun' && matSlot.id === 'mt' // 如果是流云模型且ID是'mt'
            ? applyLiuYunOpaqueFinish // 应用流云不透明材质效果
            : null

      // **最终应用**：调用 applyUvSetMaps 函数，将加载好的纹理和转换逻辑应用到场景中匹配的材质上。
      const initialResult = applyUvSetMaps(rootObject, matSlot, textureMap, {
        preferPbrFinish: targetModelFormat === 'fbx', // FBX模型优先使用PBR材质
        materialTransform, // 传入上面决定的材质转换函数
        textureOptions,
        renderProfile,
        // 如果整个模型只有一个带纹理的UV Set，则允许在材质名称不匹配时也应用贴图，作为一种容错机制。
        allowSingleMaterialFallback: texturedMatSlotCount === 1
      })

      // --- 步骤四：处理应用结果，输出警告信息 ---
      // 如果应用计数为0，说明没有一个材质被成功应用贴图，需要发出警告。
      if (initialResult.appliedCount === 0) {
        // 多材质模型如果提示未命中，宁可保留原材质，也不要把整套贴图错误铺满整船。
        if (initialResult.skippedMeshCount > 0) {
          console.warn(`Skipped UV texture application for ${targetLabel}/${matSlot.id}: model meshes do not contain UV coordinates.`)
        } else {
          console.warn(`Skipped UV texture application for ${targetLabel}/${matSlot.id}: material name hint did not match any runtime material slot.`)
        }
      } else if (initialResult.skippedMeshCount > 0) {
        // 如果部分网格因缺少UV坐标而跳过，也发出警告。
        console.warn(`Partially skipped UV texture application for ${targetLabel}/${matSlot.id}: some meshes do not contain UV coordinates.`)
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

  const applyColorConfigToObject = (rootObject, partRole, nextColorConfig = colorConfig) => {
    const colorMaterialSlots = getColorConfigMaterialSlots(nextColorConfig)
    const hasExplicitColorSlots = colorMaterialSlots.size > 0
    if (!hasExplicitColorSlots && !shouldApplyColorway(modelId, partRole)) {
      return
    }

    const colorPreset = getColorShaderPreset(nextColorConfig, 
                                { explicitMaterialSlots: hasExplicitColorSlots })
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

  return {
    applyCabnetTwinEngineFinish,
    applyColorConfigToObject,
    applyOptionalMaterialOverridesToObject,
    applyTestHighStudioOverrides,
    applyTwoLayerOverrides,
    clearShaderTintTree,
    getTestHighPartRole,
    loadAndApplyTwoLayerMaps,
    loadAndApplyUvMaps,
    preloadOptionalMaterialOverrideTextures
  }
}