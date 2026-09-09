const fs = require('node:fs');

function validateGlb(file) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const data = fs.readFileSync(file);
  if (data.length < 20 || data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length)
    fail('请选择完整的 GLB 2.0 模型');
  const length = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a || length % 4 || 20 + length > data.length) fail('GLB JSON 数据损坏');
  let doc;
  try { doc = JSON.parse(data.subarray(20, 20 + length).toString('utf8')); } catch { fail('GLB JSON 数据损坏'); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail('GLB JSON 数据损坏');
  for (const key of ['buffers', 'bufferViews', 'images', 'meshes', 'materials', 'textures', 'extensionsRequired']) {
    if (doc[key] !== undefined && (!Array.isArray(doc[key]) || doc[key].some(item => item === null || (key === 'extensionsRequired' ? typeof item !== 'string' : typeof item !== 'object' || Array.isArray(item))))) fail('GLB 数据结构无效');
  }
  if (!doc.asset || doc.asset.version !== '2.0' || !doc.meshes?.length) fail('GLB 中没有有效船模网格');
  const binStart = 20 + length;
  const binSize = binStart + 8 <= data.length && data.readUInt32LE(binStart + 4) === 0x004e4942 ? data.readUInt32LE(binStart) : 0;
  if (!binSize || binStart + 8 + binSize !== data.length) fail('GLB 缺少完整内嵌二进制数据');
  if (doc.buffers?.length !== 1 || doc.buffers[0].uri || !Number.isInteger(doc.buffers[0].byteLength) || doc.buffers[0].byteLength <= 0 || doc.buffers[0].byteLength > binSize) fail('模型须内嵌所有网格和贴图，不允许外部文件');
  for (const view of doc.bufferViews || []) {
    if (view.buffer !== 0 || !Number.isInteger(view.byteLength) || view.byteLength < 0 || !Number.isInteger(view.byteOffset || 0) || (view.byteOffset || 0) < 0 || (view.byteOffset || 0) + view.byteLength > doc.buffers[0].byteLength) fail('GLB 数据区域越界');
  }
  for (const image of doc.images || []) {
    if (image.uri || !Number.isInteger(image.bufferView) || !doc.bufferViews?.[image.bufferView]) fail('贴图必须内嵌在 GLB 中');
    if (!['image/png', 'image/jpeg'].includes(image.mimeType)) fail('内嵌贴图只支持 PNG/JPEG');
  }
  if ((doc.extensionsRequired || []).some(x => !['KHR_materials_unlit', 'KHR_texture_transform'].includes(x))) fail('请导出标准 PBR GLB，关闭 Draco/KTX 和非标准材质扩展');
  for (const mesh of doc.meshes) {
    if (!Array.isArray(mesh.primitives) || !mesh.primitives.length || mesh.primitives.some(item => !item || typeof item !== 'object' || Array.isArray(item))) fail('GLB 网格数据无效');
    for (const primitive of mesh.primitives) {
    const material = doc.materials?.[primitive.material];
    const maps = [material?.pbrMetallicRoughness?.baseColorTexture, material?.pbrMetallicRoughness?.metallicRoughnessTexture, material?.normalTexture, material?.occlusionTexture, material?.emissiveTexture].filter(Boolean);
    for (const map of maps) {
      if (!doc.images?.[doc.textures?.[map.index]?.source]) fail('材质引用了不存在的贴图');
      const uv = map.extensions?.KHR_texture_transform?.texCoord ?? map.texCoord ?? 0;
      if (primitive.attributes?.['TEXCOORD_' + uv] == null) fail('带贴图的网格缺少对应 UV');
    }
  }
  }
  return { meshes: doc.meshes.length, materials: doc.materials?.length || 0, images: doc.images?.length || 0 };
}

module.exports = { validateGlb };
