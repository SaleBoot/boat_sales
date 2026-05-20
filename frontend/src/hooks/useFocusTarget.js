import { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/utils_model';

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
    // 1. 处理空 ID 情况
    if (!selectedModelId) {
      setViewerFocusTargets({});
    //   setViewerFocusTarget('exterior'); // 同步重置 ??
      return;
    }

    let cancelled = false;
    // 2. 立即重置 UI 状态
    // setViewerFocusTarget('exterior'); //???

    const loadFocusTargets = async () => {
      try {
        const url = buildApiUrl(runtimeBasePath, 
            `api/models/${encodeURIComponent(selectedModelId)}/focus-targets`) 
        const response = await fetch( url );
        if (!response.ok) {
          throw new Error(`Failed to load focus targets: ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
            setViewerFocusTargets(payload?.focusTargets ?? {});
            //   // 如果后端返回了有效的 targets 则使用，否则尝试使用备选配置
            //   const targets = payload?.focusTargets || primaryModel?.orderConfig?.focusTargets || {};
            //   setViewerFocusTargets(targets); ///？？？         
        }
      } catch (error) {
        console.error(`Failed to load focus targets for ${selectedModelId}:`, error);
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
  }, [primaryModel?.orderConfig?.focusTargets, runtimeBasePath, selectedModelId]);

  return { viewerFocusTarget, setViewerFocusTarget, viewerFocusTargets };
}