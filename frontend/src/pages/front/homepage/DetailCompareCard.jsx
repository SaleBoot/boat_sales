import { useState, useEffect, useMemo } from 'react';
import { buildComparisonCardItems, getModelDisplayLabel } from '../../../utils/utils_homepage';

export default function DetailCompareCard({
  model,
  enteringCompareModelId,
  compareImagePath,
  comparePriceLabel,
  isCompareSelectOpen,
  selectableModels,
  setOpenCompareSelectId, 
  handleCompareSelectToggle,
  handleCompareModelChange,
  handleCompareToggle,
  handleModelSelect,
}) {
  const cardItems = buildComparisonCardItems(model);

  return (
      <article
        key={model.modelId}
        className={`detail-compare-card ${enteringCompareModelId === model.modelId ? 'is-entering' : ''}`}
      >
        {compareImagePath && (
          <div className="detail-compare-image-shell">
            <img className="detail-compare-image"
              src={compareImagePath}
              alt={`${getModelDisplayLabel(model)} ${'\u7565\u7f29\u56fe'}`} // 略缩图
              loading="lazy"
            />
          </div>
        )}

        <div className="detail-compare-card-head">
          <div>
            <p className="detail-compare-card-kicker">{model.type || '船型对比'}</p>
            <h4 style={{color: '#FFFFFF'}}>{getModelDisplayLabel(model)}</h4>
            {comparePriceLabel && (
              <p className="detail-compare-card-price">{comparePriceLabel}</p>
            )}
            <div className="detail-compare-select-wrap">
              <span className="detail-compare-select-label">切换对比船型</span>
              <div
                className={`detail-compare-select-group ${isCompareSelectOpen ? 'is-open' : ''}`}
                onMouseEnter={() => setOpenCompareSelectId(
                  {
                    boatId: model.boatId, 
                    modelId:model.modelId
                })}
                onMouseLeave={() => setOpenCompareSelectId((current) => 
                  ( current?.boatId === model.boatId &&current?.modelId === model.modelId ? null : current))}
              >
                <button type="button" 
                  className="detail-compare-select-trigger"
                  onClick={() => handleCompareSelectToggle({
                    boatId: model.boatId, 
                    modelId:model.modelId
                })}
                  aria-expanded={isCompareSelectOpen}
                  aria-haspopup="menu"
                >
                  <span style={{color: '#FFFFFF'}}>{getModelDisplayLabel(model)}</span>
                  <span className="detail-compare-select-caret" aria-hidden="true">▾</span>
                </button>

                <div className="detail-compare-select-dropdown" role="menu" aria-label="船型选择">
                  {selectableModels.map((candidate) => {
                    const isActiveCandidate = candidate.boatId === model.boatId && candidate.modelId === model.modelId

                    return (
                      <button  key={candidate.modelId}  type="button"
                        className={`detail-compare-select-option ${isActiveCandidate ? 'active' : ''}`}
                        onClick={() => {
                          handleCompareModelChange(
                            { boatId: model.boatId, modelId:model.modelId }, 
                            { boatId: candidate.boatId, modelId: candidate.modelId }
                          );
                          // 延迟关闭下拉列表，以避免潜在的竞争条件
                          setTimeout(() => {
                            setOpenCompareSelectId(null);
                          }, 0);
                        }}
                        role="menuitem"
                      >
                        <span style={{color: '#FFFFFF'}}>{getModelDisplayLabel(candidate)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="detail-compare-card-actions">
            <button  type="button"
              className="mini-btn detail-compare-focus-btn"
              onClick={() => handleModelSelect({
                boatId: model.boatId, 
                modelId:model.modelId
              })}
            >
              {'\u8bbe\u4e3a\u4e3b\u5c55\u793a'}
            </button>
            <button
              type="button"  className="mini-btn detail-compare-remove-btn"
              onClick={() => handleCompareToggle({
                boatId: model.boatId, 
                modelId:model.modelId
              })}
            >
              {'\u79fb\u9664'}
            </button>
          </div>
        </div>

        <div className="detail-spec-table" role="table" 
             aria-label={`${getModelDisplayLabel(model)} ${'\u5bf9\u6bd4\u53c2\u6570'}` }> 
          {cardItems.map((item) => (
            <div key={item.key} className="detail-spec-row" role="row">
              <span className="detail-spec-label" role="cell">{item.label}</span>
              <strong className="detail-spec-value" role="cell">{item.value}</strong>
            </div>
          ))}
        </div>
      </article>    
  );
}