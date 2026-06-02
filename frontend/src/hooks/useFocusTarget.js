import { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/utils_homepage';

/**
 * 自定义 Hook，用于管理和同步视觉焦点目标。
 *
 * @param {string} selectedModelId - 当前选中的模型 ID。
 * @param {object} primaryModel - 当前选中的模型对象。
 * @param {string} runtimeBasePath - API 的基础路径。
 * @returns {{
 *   viewerFocusTarget: string,
 *   setViewerFocusTarget: React.Dispatch<React.SetStateAction<string>>,
 *   viewerFocusTargets: object
 * }} - 返回焦点目标、其设置函数以及可用的焦点目标列表。
 */
export function useFocusTarget(selectedModelId,  
                            primaryModel = {}, 
                            runtimeBasePath = ''
                            )
{
  const [viewerFocusTarget, setViewerFocusTarget] = useState('exterior');
  const [viewerFocusTargets, setViewerFocusTargets] = useState({});

  // 当选中的模型 ID 变化时，重置视觉焦点为 'exterior'
  useEffect(() => {
    setViewerFocusTarget('exterior');
  }, [selectedModelId]);

  // 当选中的模型 ID 或其配置变化时，异步加载该模型的焦点目标列表
  useEffect(() => {
    if (!selectedModelId) {
      setViewerFocusTargets({});
      return;
    }

    let cancelled = false;

    const loadFocusTargets = async () => {
      try {
        // 优先尝试从 API 加载焦点数据
        const url = buildApiUrl(runtimeBasePath, `api/models/${encodeURIComponent(selectedModelId)}/focus-targets`);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP status ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setViewerFocusTargets(payload?.focusTargets ?? {});
        }
      } catch (error) {
        console.warn(`Could not fetch focus targets for model '${selectedModelId}' from API: ${error.message}. Falling back to local config.`);
        // 如果 API 请求失败，则回退到使用模型配置中的默认焦点目标
        if (!cancelled) {
          setViewerFocusTargets(primaryModel?.orderConfig?.focusTargets ?? {});
        }
      }
    };

    loadFocusTargets();

    // 清理函数：在组件卸载或依赖项变化时，取消任何正在进行的异步操作
    return () => {
      cancelled = true;
    };
  }, [selectedModelId, runtimeBasePath, primaryModel?.orderConfig?.focusTargets]);

  return { viewerFocusTarget, setViewerFocusTarget, viewerFocusTargets };
}