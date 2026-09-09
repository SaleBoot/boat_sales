module.exports = function glbFixture(change = () => {}) {
  const doc = { asset: { version: '2.0' }, buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,1,0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  change(doc);
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bytes = Buffer.alloc(28 + padded.length + 36);
  bytes.writeUInt32LE(0x46546c67); bytes.writeUInt32LE(2,4); bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(padded.length,12); bytes.writeUInt32LE(0x4e4f534a,16); padded.copy(bytes,20);
  bytes.writeUInt32LE(36,20+padded.length); bytes.writeUInt32LE(0x004e4942,24+padded.length);
  bytes.writeFloatLE(1,28+padded.length+12); bytes.writeFloatLE(1,28+padded.length+28);
  return bytes;
};
