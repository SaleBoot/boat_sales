import { useState, useEffect, useCallback } from 'react';
import { getFocusTargets } from '../apis/frontApi'; // 导入新的 API 函数

/**
 * 自定义 Hook，用于管理和同步视觉焦点目标。
 *
 * @param {string} selectedModelGid - 当前选中的模型 ID。
 * @param {object} primaryModel - 当前选中的模型对象。
 * @param {string} runtimeBasePath - API 的基础路径。
 * @returns {{
 *   viewerFocusTarget: string,
 *   setViewerFocusTarget: (target: string) => void,
 *   viewerFocusTargets: object
 * }} - 返回焦点目标、其设置函数以及可用的焦点目标列表。
 */
export function useFocusTarget(selectedModelGid,  
                            primaryModel = {}, 
                            runtimeBasePath = ''
                            )
{
  const [viewerFocusTarget, setViewerFocusTargetState] = useState('exterior');
  const setViewerFocusTarget = useCallback((target) => {
    setViewerFocusTargetState(target);
  }, []);

  const [viewerFocusTargets, setViewerFocusTargets] = useState({});

  // 当选中的模型 ID 变化时，重置视觉焦点为 'exterior'
  useEffect(() => {
    setViewerFocusTarget('exterior');
  }, [selectedModelGid, setViewerFocusTarget]);

  // 当选中的模型 ID 或其配置变化时，异步加载该模型的焦点目标列表
  useEffect(() => { 
    const modelPath = primaryModel?.modelInf?.partPaths?.[0] || '';
    if (!modelPath) {
      setViewerFocusTargets({});
      return;
    }    

    let cancelled = false;

    const loadFocusTargets = async () => {
      try {

        // 使用封装后的 API 函数
        const payload = await getFocusTargets( modelPath );
        if (!cancelled) {
          setViewerFocusTargets(payload?.focusTargets ?? {});
        }
      } catch (error) {
        console.warn(`Could not fetch focus targets for model '${selectedModelGid}' from API: ${error.message}. Falling back to local config.`);
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
  }, [primaryModel?.modelInf?.partPaths, runtimeBasePath, primaryModel?.orderConfig?.focusTargets]);

  return { viewerFocusTarget, setViewerFocusTarget, viewerFocusTargets };
}