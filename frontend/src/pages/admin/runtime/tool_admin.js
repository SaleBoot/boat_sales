
export const buildModelConfig4AdminPage = (subfolderName, subfolderFiles, sourcePath) => {
  // 1. Determine the required extension from the source path
  const requiredExtension = sourcePath.split('.').pop()?.toLowerCase();

  // 2. Filter for model files (fbx/glb) that match the required extension
  const partPaths = subfolderFiles
    .filter(f => {
      const fileExtension = f.key.split('.').pop()?.toLowerCase();
      return fileExtension === requiredExtension;
    })
    .map(f => `/${f.key.replace(/^\//, '')}`);

  const textureFiles = subfolderFiles.filter(f => {
    const lowerKey = f.key.toLowerCase();
    const fileName = lowerKey.substring(lowerKey.lastIndexOf('/') + 1);
    if (fileName.startsWith('adimg')) return false;
    return lowerKey.endsWith('.png') || lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg');
  });

  const matSlots = textureFiles.reduce((acc, file) => {
    const pathParts = file.key.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const parts = fileNameWithoutExt.split('_');

    if (parts.length < 3 || parts[0] !== 'mat') return acc;

    const matName = `${parts[0]}_${parts[1]}`;
    const textureType = parts.slice(2).join('_');

    let matSlot = acc.find(slot => slot.matName === matName);
    if (!matSlot) {
      matSlot = {
        matName: matName,
        textures: { basecolor: "", normal: "", roughness: "", metalness: "", ao: "", emissive: "" }
      };
      acc.push(matSlot);
    }

    let finalTextureType = textureType === 'metallic' ? 'metalness' : textureType;
    if (finalTextureType in matSlot.textures) {
      matSlot.textures[finalTextureType] = `/${file.key}`;
    }
    return acc;
  }, []);

  return {
    id: subfolderName,
    label: subfolderName,
    partPaths: partPaths,
    matSlots: matSlots
  };
};
