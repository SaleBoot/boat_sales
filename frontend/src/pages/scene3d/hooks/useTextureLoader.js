import { useRef, useCallback } from 'react';
import * as THREE from 'three';

/**
 * 纹理资产管理器 Hook
 * @param {Object} loadingTracker 进度追踪器实例
 * @returns 
 */
export function useTextureAssetManager(loadingTracker) {
  // 1. 使用 ref 保持缓存和外部纹理引用，避免由于组件重渲染导致缓存丢失或重复触发
  const texturePromiseCacheRef = useRef(new Map());
  const externalTexturesRef = useRef([]);
  const textureLoaderRef = useRef(new THREE.TextureLoader());

  /**
   * 核心加载函数
   */
  const loadTextureAsync = useCallback((path) => {
    const cache = texturePromiseCacheRef.current;
    
    // 如果已有缓存，直接返回
    if (cache.has(path)) {
      return cache.get(path);
    }

    const texturePromise = new Promise((resolve, reject) => {
      // 联动外层传入的 loadingTracker
      const assetState = loadingTracker?.beginTrackedAsset(path, '正在下载贴图资源…');

      textureLoaderRef.current.load(
        path,
        (texture) => {
          // 记录下载量，更新进度条
          if (assetState && assetState.totalBytes > assetState.loadedBytes) {
            const deltaBytes = assetState.totalBytes - assetState.loadedBytes;
            assetState.loadedBytes = assetState.totalBytes;
            loadingTracker.noteDownloadedBytes(deltaBytes);
          }
          loadingTracker?.markAssetCompleted(path, '正在下载贴图资源…');
          
          // 收集成功加载的纹理，方便后续统一 dispose
          externalTexturesRef.current.push(texture);
          
          texturePromise.__resolvedTexture = texture;
          resolve(texture);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });

    cache.set(path, texturePromise);
    return texturePromise;
  }, [loadingTracker]);

  /**
   * 一键销毁释放内存函数
   */
  const disposeTextures = useCallback(() => {
    console.log('开始清理外部纹理内存...');
    externalTexturesRef.current.forEach((texture) => {
      if (texture) {
        texture.dispose();
      }
    });
    externalTexturesRef.current = [];
    texturePromiseCacheRef.current.clear();
  }, []);

  return {
    loadTextureAsync,
    externalTextures: externalTexturesRef.current,
    texturePromiseCache: texturePromiseCacheRef.current,
    disposeTextures
  };
}
