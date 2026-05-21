import { useState, useEffect, useMemo } from 'react';
import { normalizeCompareModelIds } from '../utils/utils_homepage';

/**
 * 一个自定义 Hook，用于封装和管理“详情对比”功能的所有状态和逻辑。
 *
 * @param {Array} models - 所有可用船型模型的列表。
 * @param {string} selectedModelId - 当前选中的主展示模型的 ID。
 * @param {number} maxCompareModelCount - 允许同时对比的最大模型数量。
 * @returns {{
 *   compareModelIds: string[],
 *   compareModels: object[],
 *   enteringCompareModelId: string,
 *   handleCompareToggle: (modelId: string) => void,
 *   handleAddCompareCard: () => void,
 *   handleCompareModelChange: (currentModelId: string, nextModelId: string) => void,
 *   setCompareModelIds: React.Dispatch<React.SetStateAction<string[]>>
 * }}
 */
export function useDetailCompare(
    models, 
    selectedModelId, 
    maxCompareModelCount
    ) 
{
  //  (用于对比的船型列表),
  const [compareModelIds, setCompareModelIds] = useState([]);
  const [enteringCompareModelId, setEnteringCompareModelId] = useState('');

  const compareModels = useMemo(
    () =>
      compareModelIds
        .map((modelId) => models.find((model) => model.id === modelId) ?? null)
        .filter(Boolean),
    [compareModelIds, models]
  );

  useEffect(() => {
    setCompareModelIds((current) => normalizeCompareModelIds(current, models, 
                    selectedModelId, maxCompareModelCount) )
  }, [models, selectedModelId, maxCompareModelCount])

  const handleCompareToggle = (modelId) => {
    if (!modelId) {
      return
    }

    setCompareModelIds((current) => {
      if (current.includes(modelId)) {
        return current.filter((currentId) => currentId !== modelId)
      }

      if (current.length >= maxCompareModelCount) {
        return current
      }

      return normalizeCompareModelIds([...current, modelId],
         models,
          selectedModelId,
          maxCompareModelCount )
    })
  }

  const handleAddCompareCard = () => {
    setCompareModelIds((current) => {
      if (current.length >= maxCompareModelCount) {
        return current
      }

      const usedIds = new Set([selectedModelId, ...current])
      const nextModel = models.find((model) => !usedIds.has(model.id))
      if (!nextModel) {
        return current
      }

      setEnteringCompareModelId(nextModel.id)
      return normalizeCompareModelIds( [...current, nextModel.id],
        models,
        selectedModelId,
        maxCompareModelCount)
    })
  }

  useEffect(() => {
    if (!enteringCompareModelId) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setEnteringCompareModelId((current) => (current === enteringCompareModelId ? '' : current))
    }, 540)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [enteringCompareModelId])

  const handleCompareModelChange = (currentModelId, nextModelId) => {
    if (!currentModelId || !nextModelId || nextModelId === selectedModelId) {
      return
    }

    setOpenCompareSelectId(null)

    setCompareModelIds((current) => {
      if (!current.includes(currentModelId)) {
        return current
      }

      if (current.includes(nextModelId) && nextModelId !== currentModelId) {
        return current
      }

      return current.map((modelId) => (modelId === currentModelId ? nextModelId : modelId))
    })
  }

  return {
    compareModelIds,
    compareModels,
    enteringCompareModelId,
    handleCompareToggle,
    handleAddCompareCard,
    handleCompareModelChange,
    setCompareModelIds, // 导出以备不时之需，例如从 URL 初始化
  };
}
