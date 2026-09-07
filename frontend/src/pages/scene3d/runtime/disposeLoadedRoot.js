export function disposeLoadedRoot({
  loadedRoot,
  modelRoot,
  transformControls
}) {
  if (!loadedRoot) {
    return
  }

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
