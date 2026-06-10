import React from 'react';
import { Image } from 'antd'; // 只保留 Image

// 移除 Typography 和 Card 的导入

/**
 * 引擎动力展示组件
 * 用于在首页展示引擎的图片和简介信息。
 *
 * @param {object} props - 组件属性
 * @param {string} props.engineImage - 引擎图片的URL
 * @param {string} props.engineTitle - 引擎的标题
 * @param {string} props.engineDescription - 引擎的详细简介
 */
const EnginePowerShowcase = ({ engineImage, engineTitle, engineDescription }) => {
  if (!engineImage && !engineTitle && !engineDescription) {
    return null; // 如果没有数据，则不渲染任何内容
  }

  return (
    <section className="detail-spec-showcase" aria-label="引擎动力信息">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          {engineImage ? (
            <div style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Image
                className="detail-spec-image"
                src={engineImage}
                alt={engineTitle || "Engine Image"}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                preview={false}
              />
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
            {engineDescription && <p>{engineDescription}</p>}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnginePowerShowcase;