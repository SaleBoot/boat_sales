import React, { useState, useEffect } from 'react';
import { Image } from 'antd'; // 只保留 Image

/**
 * 智能系统展示组件
 * 用于在首页展示智能系统的图片和简介信息。
 *
 * @param {object} props - 组件属性
 * @param {stringArray} props.smartSystemImgs - 智能系统图片的URL数组
 * @param {string} props.smartSystemTitle - 智能系统的标题
 * @param {string} props.smartSystemDescription - 智能系统的详细简介
 */
const SmartSystemShowcase = ({ smartSystemImgs, smartSystemTitle, smartSystemDescription }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!smartSystemImgs || smartSystemImgs.length <= 1) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % smartSystemImgs.length);
    }, 3000); // 每3秒切换一次图片

    return () => clearTimeout(timer);
  }, [currentIndex, smartSystemImgs]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + smartSystemImgs.length) % smartSystemImgs.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % smartSystemImgs.length);
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = (e) => {
    e.stopPropagation(); // 防止事件冒泡到外层div的onClick
    setIsModalOpen(false);
  };

  if (!smartSystemImgs && !smartSystemTitle && !smartSystemDescription) {
    return null; // 如果没有数据，则不渲染任何内容
  }

  return (
    <section className="detail-spec-showcase" aria-label="智能系统信息">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          {smartSystemImgs && smartSystemImgs.length > 0 ? (
            <div style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Image
                key={currentIndex} // 使用 key 来触发图片重新渲染
                className="detail-spec-image"
                src={smartSystemImgs[currentIndex]}
                alt={`${smartSystemTitle || "Smart System"} 宣传图 ${currentIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
                preview={false}
                onClick={handleImageClick}
              />
              {smartSystemImgs.length > 1 && (
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
            <p className="detail-card-eyebrow">智能系统</p>
            {smartSystemTitle && <h3>{smartSystemTitle}</h3>}
            {smartSystemDescription && (
              <p>
                {smartSystemDescription.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < smartSystemDescription.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
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
          <Image
            src={smartSystemImgs[currentIndex]}
            alt={`${smartSystemTitle || "Smart System"} 宣传图 ${currentIndex + 1} (enlarged)`}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
            }}
            preview={false}
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

export default SmartSystemShowcase;