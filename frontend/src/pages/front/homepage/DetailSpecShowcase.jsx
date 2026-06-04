import { useState, useEffect } from 'react';

export default function DetailSpecShowcase({
  specImagePaths,
  selectedModelLabel,
  selectedModelPriceLabel,
  primaryDetailSpecCards,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!specImagePaths || specImagePaths.length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % specImagePaths.length);
    }, 3000); // 每3秒切换一次图片

    return () => clearTimeout(timer);
  }, [currentIndex, specImagePaths]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + specImagePaths.length) % specImagePaths.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % specImagePaths.length);
  };

  return (
    <section className="detail-spec-showcase" aria-label="主要技术参数">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          {specImagePaths && specImagePaths.length > 0 && (
            <div style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                key={currentIndex} // 使用 key 来触发图片重新渲染
                className="detail-spec-image"
                src={specImagePaths[currentIndex]}
                alt={`${selectedModelLabel} 渲染图 ${currentIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              {specImagePaths.length > 1 && (
                <>
                  <button onClick={handlePrev} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '20px' }}>
                    &#10094;
                  </button>
                  <button onClick={handleNext} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '20px' }}>
                    &#10095;
                  </button>
                </>
              )}
            </div>
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