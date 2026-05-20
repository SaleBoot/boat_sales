import { buildComparisonCardItems, getModelDisplayLabel } from '../../../utils/utils_model';

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
        key={model.id}
        className={`detail-compare-card ${enteringCompareModelId === model.id ? 'is-entering' : ''}`}
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
            <h4>{getModelDisplayLabel(model)}</h4>
            {comparePriceLabel && (
              <p className="detail-compare-card-price">{comparePriceLabel}</p>
            )}
            <div className="detail-compare-select-wrap">
              <span className="detail-compare-select-label">切换对比船型</span>
              <div
                className={`detail-compare-select-group ${isCompareSelectOpen ? 'is-open' : ''}`}
                onMouseEnter={() => setOpenCompareSelectId(model.id)}
                onMouseLeave={() => setOpenCompareSelectId((current) => (current === model.id ? null : current))}
              >
                <button type="button" 
                  className="detail-compare-select-trigger"
                  onClick={() => handleCompareSelectToggle(model.id)}
                  aria-expanded={isCompareSelectOpen}
                  aria-haspopup="menu"
                >
                  <span>{getModelDisplayLabel(model)}</span>
                  <span className="detail-compare-select-caret" aria-hidden="true">▾</span>
                </button>

                <div className="detail-compare-select-dropdown" role="menu" aria-label="船型选择">
                  {selectableModels.map((candidate) => {
                    const isActiveCandidate = candidate.id === model.id

                    return (
                      <button  key={candidate.id}  type="button"
                        className={`detail-compare-select-option ${isActiveCandidate ? 'active' : ''}`}
                        onClick={() => handleCompareModelChange(model.id, candidate.id)}
                        role="menuitem"
                      >
                        <span>{getModelDisplayLabel(candidate)}</span>
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
              onClick={() => handleModelSelect(model.id)}
            >
              {'\u8bbe\u4e3a\u4e3b\u5c55\u793a'}
            </button>
            <button
              type="button"  className="mini-btn detail-compare-remove-btn"
              onClick={() => handleCompareToggle(model.id)}
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
