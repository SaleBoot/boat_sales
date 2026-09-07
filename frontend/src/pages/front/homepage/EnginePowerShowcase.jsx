import React, { useState, useEffect } from 'react';
import { Image } from 'antd'; // 只保留 Image

// 移除 Typography 和 Card 的导入

/**
 * 引擎动力展示组件
 * 用于在首页展示引擎的图片和简介信息。
 *
 * @param {object} props - 组件属性
 * @param {stringArray} props.engineImgs - 引擎图片的URL数组
 * @param {string} props.engineTitle - 引擎的标题
 * @param {string} props.engineDescription - 引擎的详细简介
 */
const EnginePowerShowcase = ({ engineImgs, engineTitle, engineParams }) => {
const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!engineImgs || engineImgs.length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % engineImgs.length);
    }, 3000); // 每3秒切换一次图片

    return () => clearTimeout(timer);
  }, [currentIndex, engineImgs]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + engineImgs.length) % engineImgs.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % engineImgs.length);
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = (e) => {
    e.stopPropagation(); // 防止事件冒泡到外层div的onClick
    setIsModalOpen(false);
  };

  // ------------------
  if (!engineImgs || engineImgs.length === 0 && 
      !engineTitle && !engineParams) {
    return null; // 如果没有数据，则不渲染任何内容
  }

  return (
    <section className="detail-spec-showcase" aria-label="引擎动力信息">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          { engineImgs && engineImgs.length > 0 ? (
            <div style={{ position: 'relative', height: '400px', width: '100%', 
                          display: 'flex', justifyContent: 'center', 
                          alignItems: 'center' }}>
              <Image
                key={currentIndex} // 使用 key 来触发图片重新渲染
                className="detail-spec-image"
                src={engineImgs[currentIndex]}
                alt={`${engineTitle || "Engine"} 宣传图 ${currentIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
                preview={false}
                onClick={handleImageClick}
              />
              {engineImgs.length > 1 && (
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
          ) : (
            <div style={{
              width: '100%',
              height: '400px',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              color: '#999',
            }}>
              暂无图片
            </div>
          )}
        </div>

        <div className="detail-spec-panel">
          <div className="detail-spec-head">
            <p className="detail-card-eyebrow">动力系统</p>
            {engineTitle && <h3>{engineTitle}</h3>}
            {engineParams && (
              <>
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">设计速度</span>
                      <span className="detail-spec-value" role="cell">{engineParams.designSpeed}km/h</span>
                    </div>               
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">巡航速度</span>
                      <span className="detail-spec-value" role="cell">{engineParams.cruiseSpeed}km/h</span>
                    </div>               
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">巡航范围</span>
                      <span className="detail-spec-value" role="cell">{engineParams.cruiseRange}km</span>
                    </div>               
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">舱型</span>
                      <span className="detail-spec-value" role="cell">{engineParams.cabinType}</span>
                    </div>            
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">控制模式</span>
                      <span className="detail-spec-value" role="cell">{engineParams.controlMode}</span>
                    </div>                          
                    <div className="detail-spec-row" role="row">
                      <span className="detail-spec-label" role="cell">乘客人数</span>
                      <span className="detail-spec-value" role="cell">{engineParams.passengerNum}</span>
                    </div>         
             </>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            cursor: 'zoom-out',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <img
            src={engineImgs[currentIndex]}
            alt={`${engineTitle || "Engine"} 宣传图 ${currentIndex + 1} (enlarged)`}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={handleCloseModal}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '30px',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>
      )}
    </section>
  );
};

export default EnginePowerShowcase;