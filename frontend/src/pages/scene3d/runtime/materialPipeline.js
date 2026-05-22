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
  effectiveModelFormat,
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

    const colorPreset = getColorShaderPreset(nextColorConfig, { explicitMaterialSlots: hasExplicitColorSlots })
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
