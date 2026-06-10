import React from 'react';
import { Image } from 'antd'; // 只保留 Image

// 移除 Typography 和 Card 的导入

/**
 * 智能系统展示组件
 * 用于在首页展示智能系统的图片和简介信息。
 *
 * @param {object} props - 组件属性
 * @param {string} props.smartSystemImage - 智能系统图片的URL
 * @param {string} props.smartSystemTitle - 智能系统的标题
 * @param {string} props.smartSystemDescription - 智能系统的详细简介
 */
const SmartSystemShowcase = ({ smartSystemImage, smartSystemTitle, smartSystemDescription }) => {
  if (!smartSystemImage && !smartSystemTitle && !smartSystemDescription) {
    return null; // 如果没有数据，则不渲染任何内容
  }

  return (
    <section className="detail-spec-showcase" aria-label="智能系统信息">
      <div className="detail-spec-combined-card">
        <div className="detail-spec-visual">
          {smartSystemImage ? (
            <div style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Image
                className="detail-spec-image"
                src={smartSystemImage}
                alt={smartSystemTitle || "Smart System Image"}
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
            <p className="detail-card-eyebrow">智能系统</p>
            {smartSystemTitle && <h3>{smartSystemTitle}</h3>}
            {smartSystemDescription && <p>{smartSystemDescription}</p>}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SmartSystemShowcase;