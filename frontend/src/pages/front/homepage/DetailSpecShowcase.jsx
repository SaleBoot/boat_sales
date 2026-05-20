export default function DetailSpecShowcase({
  specImagePath,
  selectedModelLabel,
  selectedModelPriceLabel,
  primaryDetailSpecCards,
}) {
  return (
    <section className="detail-spec-showcase" aria-label="主要技术参数">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          {specImagePath && (
            <img
              className="detail-spec-image"
              src={specImagePath}
              alt={`${selectedModelLabel} 渲染图`}
              loading="lazy"
              decoding="async"
            />
          )}
        </div>

        <div className="detail-spec-panel">
          <div className="detail-spec-head">
            <p className="detail-card-eyebrow">技术概览</p>
            <h3>{selectedModelLabel} 参数与方案概览</h3>
            {selectedModelPriceLabel && (
              <p className="detail-spec-price">{selectedModelPriceLabel}</p>
            )}
            <p>围绕总长、吃水、主机功率等关键指标展示，便于快速完成船型初筛、方案沟通与多型号对比。</p>
          </div>

          <div className="detail-spec-card-grid">
            {primaryDetailSpecCards.map((card) => (
              <article key={card.title} className="detail-spec-card">
                <h4>{card.title}</h4>
                <div className="detail-spec-table" role="table" aria-label={card.title}>
                  {card.items.map((item) => (
                    <div key={item.key} className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">{item.label}</span>
                      <span className="detail-spec-value" role="cell">{item.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

        </div>
        
      </div>
    </section>
  );
}
