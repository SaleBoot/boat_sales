import { useState, useEffect, useMemo } from 'react';
import {
  buildComparisonCardItems, 
  getModelPriceLabel,
  normalizeCompareModelGids,
} from '../../../utils/utils_homepage';
import DetailCompareCard from './DetailCompareCard'; 
import { createStructuredModel } from '../../../utils/utils_homepage.js' 

/**
 * 一个功能完备的组件，负责渲染和管理整个“详情对比”区域。
 * 它内部调用 useDetailCompare Hook 来封装所有相关的状态和逻辑。
 */
export default function DetailCompareStack({
  boats,
  selectedModelGid,
  maxCompareModelCount,
  openCompareSelectId,
  setOpenCompareSelectId,
  // handleCompareSelectToggle,
  handleModelSelect,
  resolveStaticPath,
}) {
  //  (用于对比的船型列表),
  const [compareModelGids, setCompareModelGids] = useState([]);
  const [enteringCompareModelGid, setEnteringCompareModelGid] = useState({});

  // 增强型model数据
  const augmentedBoatModelList =useMemo( 
    () =>{
      if (!boats || boats.length === 0) 
        return [];
      
      
      let boatModels = [] //  增强型model 数据列表
      for (const boat of boats) 
      {
        for (const model of boat.models) 
        {
          if (model) 
          {           
            const boatModel = createStructuredModel(boat, model); 
            boatModels.push( boatModel);
          }
        }
      } 
      return boatModels;
    },
    [boats]
  );

  const compareModels = useMemo( 
    () =>{
      return compareModelGids
        .map((modelGid) => {
          const foundModel = augmentedBoatModelList.find(
            (boat) => boat.boatId === modelGid.boatId && boat.modelId === modelGid.modelId
          );

          if(!foundModel){
            return {};
          }
           
          return  foundModel;          
        })
        .filter(Boolean)
    },
    [compareModelGids, augmentedBoatModelList]
  );

  const compareModelGidsStrList = useMemo(
    () => new Set( compareModelGids.map(gid => `${gid.boatId}-${gid.modelId}`) ),
  [compareModelGids]
  );
 

  useEffect(() => {
    setCompareModelGids((current) => normalizeCompareModelGids(current, boats, 
                    selectedModelGid, maxCompareModelCount) )
  }, [boats, selectedModelGid, maxCompareModelCount])

  const handleCompareSelectToggle = (modelGid) => {
    if (!modelGid) {
      return;
    }

    setOpenCompareSelectId((current) => ( 
      (current.boatId === modelGid.boatId && current.modelId === modelGid.modelId) 
      ? null 
      : current
    ));
  };


  const handleCompareToggle = (modelGid) => {
    if (!modelGid) {
      return
    }

    const modelGidStr = `${modelGid.boatId}-${modelGid.modelId}`

    setCompareModelGids((current) => {
      const currentGidStrList = current.map(item => `${item.boatId}-${item.modelId}`)

      if (currentGidStrList.includes(modelGidStr)) {
        return current.filter(
          (curGid) => (curGid.boatId !== modelGid.boatId || 
                      curGid.modelId !== modelGid.modelId)
        )
      }

      if (current.length >= maxCompareModelCount) {
        return current
      }

      return normalizeCompareModelGids([...current, modelGid],
         boats,
          selectedModelGid,
          maxCompareModelCount )
    })
  }

  const handleAddCompareCard = () => {
    setCompareModelGids((current) => {
      if (current.length >= maxCompareModelCount) {
        return current
      }

      const usedKeys = new Set(
        current.map(item => `${item.boatId}-${item.modelId}`)
      );
      if (selectedModelGid) {
        usedKeys.add(`${selectedModelGid.boatId}-${selectedModelGid.modelId}`);
      }

      let nextModelGid = null;

      // 寻找第一艘有可用型号的“船”
      boats.find(boat => {
        // 在这艘船里寻找第一个未使用的“型号”
        const foundModel = boat.models.find(model => {
          return !usedKeys.has(`${boat.id}-${model.id}`);
        });
 
        // 如果找到了，赋值并返回 true（返回 true 会直接中断外层的 boats.find）
        if (foundModel) {
          nextModelGid = { boatId: boat.id, modelId: foundModel.id };
          return true;
        }
        return false;
      });
 

      if (!nextModelGid) return current;

      setEnteringCompareModelGid(nextModelGid)
      return normalizeCompareModelGids( [...current, nextModelGid],
        boats,
        selectedModelGid,
        maxCompareModelCount)
    })
  }

  useEffect(() => {
    if (!enteringCompareModelGid) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setEnteringCompareModelGid((current) => (
        current.boatId === enteringCompareModelGid.boatId && current.modelId === enteringCompareModelGid.modelId
        ? '' 
        : current))
    }, 540)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [enteringCompareModelGid])

  const handleCompareModelChange = (currentModelGid, nextModelGid) => {
    if (!currentModelGid || !nextModelGid || 
      (nextModelGid.boatId === selectedModelGid.boatId && 
        nextModelGid.modelId === selectedModelGid.modelId)
      ) 
    {
      return
    }

    setOpenCompareSelectId(null)

    setCompareModelGids((current) => {
      const curGid_found = current.find( 
         (gid) => gid.boatId === currentModelGid.boatId && 
                     gid.modelId === currentModelGid.modelId )
      if (!curGid_found) {
        return current
      }

      // current.includes(nextModelId)
      const nextGid_found = current.find( (gid) => gid.boatId === nextModelGid.boatId && 
                                                   gid.modelId === nextModelGid.modelId 
                                                  )
      const isCurNext_notEqual = (nextModelGid.boatId !== currentModelGid.boatId || 
                                  nextModelGid.modelId !== currentModelGid.modelId)
      if (nextGid_found && isCurNext_notEqual) {
        return current
      }

      return current.map((modelGid) => (modelGid.boatId === curGid_found.boatId && 
                                      modelGid.modelId === curGid_found.modelId 
                                      ? nextModelGid 
                                      : modelGid))
    })
  }  
  // ------------------------------------------
  return (
    <section className="detail-compare-stack" aria-label="对比卡片">
      <div className="detail-compare-toolbar">
        <div>
          <p className="detail-card-eyebrow">方案对比</p>
          <h4 className="detail-compare-heading" style={{color: '#FFFFFF'}}>最多四型同屏对比</h4>
        </div>

        <div className="detail-compare-toolbar-actions">
          <p className="detail-compare-status">
            {`已加入 ${compareModels.length} / ${maxCompareModelCount} 个船型`}
          </p>
          <button type="button"  className="mini-btn detail-compare-add-btn"
            onClick={handleAddCompareCard}
            disabled={ compareModels.length >= maxCompareModelCount ||
	                  boats.length <= compareModels.length + 1 }
          >
            添加对比船型
          </button>
        </div>
      </div>

      {compareModels.length > 0 ? (
        <div
          className="detail-compare-grid"
          style={{
            '--compare-columns': `${Math.max(2, Math.min(compareModels.length, maxCompareModelCount))}`
          }}
        >
            { 

            compareModels.map((model) => { 
            const compareImagePath = resolveStaticPath(model.modelInf?.adImgs?.[0] || '');
            const comparePriceLabel = getModelPriceLabel(model);
            const isCompareSelectOpen = (openCompareSelectId?.boatId === model.boatId &&
              openCompareSelectId?.modelId === model.modelId
            );
            const selectableModels = augmentedBoatModelList.filter(
              (candidate) => {
                const notSameId=(candidate.boatId !== selectedModelGid.boatId || 
                                 candidate.modelId !== selectedModelGid.modelId );
                if (notSameId) {
                  return true;
                }
                const bFound = compareModelGidsStrSet.has(`${candidate.boatId}-${candidate.modelId}`);                
                return !bFound;
            })

              return (
                  <DetailCompareCard  
                    model={model}
                    enteringCompareModelGid={enteringCompareModelGid}
                    compareImagePath={compareImagePath}
                    comparePriceLabel={comparePriceLabel}
                    isCompareSelectOpen={isCompareSelectOpen}
                    selectableModels={selectableModels}
                    setOpenCompareSelectId={setOpenCompareSelectId} 
                    handleCompareSelectToggle={handleCompareSelectToggle}
                    handleCompareModelChange={handleCompareModelChange}
                    handleCompareToggle={handleCompareToggle}
                    handleModelSelect={handleModelSelect}
                  />
              )
            })}
          </div>
        ) : (
          <div className="detail-compare-empty">
            <p>添加对比船型后，可在同一视图内并排查看最多 4 个型号的关键参数、参考价格与外观缩略图。</p>
          </div>
        )}
      </section>      
  );
}