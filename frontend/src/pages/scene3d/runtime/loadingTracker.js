
// 加载进度逻辑
import {
  createInitialLoadingState,
  getAssetDisplayLabel
} from '../../../utils/utils_ship_scene.js'

export function createLoadingTracker({
  trackedAssetUrls,
  setLoadingState,
  isDisposed
}) {
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
    if (isDisposed()) {
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

  const estimateAssetSizes = (signal) => {
    trackedAssetUrls.forEach((assetUrl) => {
      fetch(assetUrl, {method: 'HEAD', signal})
        .then((response) => {
          if (!response.ok) {
            return
          }

          const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
          if (Number.isFinite(contentLength) && contentLength > 0) {
            setAssetExpectedBytes(assetUrl, contentLength)
          }
        })
        .catch(() => { })
    })
  }

  const dispose = () => {
    if (progressFrameId) {
      window.cancelAnimationFrame(progressFrameId)
      progressFrameId = 0
    }
  }

  return {
    beginTrackedAsset,
    markAssetCompleted,
    noteDownloadedBytes,
    setAssetExpectedBytes,
    estimateAssetSizes,
    dispose
  }
}
