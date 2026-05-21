import {
  buildComparisonCardItems,
  getModelDetailImageAssetPath,
  getModelPriceLabel,
} from '../../../utils/utils_homepage';
import DetailCompareCard from './DetailCompareCard';
import { useDetailCompare } from '../../../hooks/useDetailCompare';

/**
 * 一个功能完备的组件，负责渲染和管理整个“详情对比”区域。
 * 它内部调用 useDetailCompare Hook 来封装所有相关的状态和逻辑。
 */
export default function DetailCompareStack({
  models,
  selectedModelId,
  maxCompareModelCount,
  openCompareSelectId,
  setOpenCompareSelectId,
  handleCompareSelectToggle,
  handleModelSelect,
  resolveStaticPath,
}) {
  const {
    compareModels,
    enteringCompareModelId,
    handleCompareToggle,
    handleAddCompareCard,
    handleCompareModelChange,
    compareModelIds,
  } = useDetailCompare(models, selectedModelId, maxCompareModelCount);

  return (
    <section className="detail-compare-stack" aria-label="对比卡片">
      <div className="detail-compare-toolbar">
        <div>
          <p className="detail-card-eyebrow">方案对比</p>
          <h4 className="detail-compare-heading">最多四型同屏对比</h4>
        </div>

        <div className="detail-compare-toolbar-actions">
          <p className="detail-compare-status">
            {`已加入 ${compareModels.length} / ${maxCompareModelCount} 个船型`}
          </p>
          <button type="button"  className="mini-btn detail-compare-add-btn"
            onClick={handleAddCompareCard}
            disabled={ compareModels.length >= maxCompareModelCount ||
	                  models.length <= compareModels.length + 1 }
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
          {compareModels.map((model) => {
            const cardItems = buildComparisonCardItems(model);
            const compareImagePath = resolveStaticPath(getModelDetailImageAssetPath(model));
            const comparePriceLabel = getModelPriceLabel(model);
            const isCompareSelectOpen = openCompareSelectId === model.id;
            const selectableModels = models.filter(
              (candidate) => (
                candidate.id !== selectedModelId &&
                (candidate.id === model.id || !compareModelIds.includes(candidate.id))
            ))

              return (
                  <DetailCompareCard 
                    key={model.id}
                    model={model}
                    enteringCompareModelId={enteringCompareModelId}
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