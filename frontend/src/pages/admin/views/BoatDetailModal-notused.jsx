import React from 'react';
import { Modal, Descriptions, Tag } from 'antd';

/**
 * 船舶详情展示模态框
 */
const BoatDetailModal = ({ open, boat, onCancel }) => {
  // 如果没有船舶数据，则不渲染任何内容
  if (!boat) {
    return null;
  }

  return (
    <Modal
      title="船舶详情"
      open={open}
      onCancel={onCancel}
      footer={null} // 这是一个只读视图，所以不需要底部按钮
      width={800}
    >
      <Descriptions bordered column={2} labelStyle={{ fontWeight: 'bold' }}>
        <Descriptions.Item label="船舶中文名称" span={1}>{boat.chineseName}</Descriptions.Item>
        <Descriptions.Item label="船舶英文名称" span={1}>{boat.englishName}</Descriptions.Item>
        
        <Descriptions.Item label="船舶类型">{boat.type}</Descriptions.Item>
        <Descriptions.Item label="材质">{boat.material}</Descriptions.Item>

        <Descriptions.Item label="总长">{boat.overallLength}</Descriptions.Item>
        <Descriptions.Item label="水线长">{boat.waterlineLength}</Descriptions.Item>

        <Descriptions.Item label="船宽">{boat.beam}</Descriptions.Item>
        <Descriptions.Item label="型深">{boat.moldedDepth}</Descriptions.Item>

        <Descriptions.Item label="吃水">{boat.draft}</Descriptions.Item>
        <Descriptions.Item label="航区">{boat.navigationArea}</Descriptions.Item>

        <Descriptions.Item label="主机功率">{boat.mainEnginePower}</Descriptions.Item>
        <Descriptions.Item label="设计航速">{boat.designSpeed}</Descriptions.Item>

        <Descriptions.Item label="动力形式">{boat.propulsionType}</Descriptions.Item>
        <Descriptions.Item label="额定乘员">{boat.ratedCrew}</Descriptions.Item>

        <Descriptions.Item label="证书类型" span={2}>
          <Tag color="blue">{boat.certificateType}</Tag>
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default BoatDetailModal;
