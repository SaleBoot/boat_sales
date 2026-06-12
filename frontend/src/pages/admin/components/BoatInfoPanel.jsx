import React from 'react';
import {
  Form,
  Input,
  Button,
  Row,
  Col,
  Select,
  Divider,
  Image,
  Empty,
  ConfigProvider,
  theme,
} from 'antd';

import { 
  BOAT_NAV_AREA_OPTIONS,
  BOAT_MATERIAL_OPTIONS,
  BOAT_CERTI_TYPE_OPTIONS
} from '../../../constants/constants_common.js'

// 模拟后端 GetBoatCertiTypeByNavArea 函数
const getBoatCertiTypeByNavArea = (aNavAreaID) => {
  const allCertiTypes = BOAT_CERTI_TYPE_OPTIONS;

  if (aNavAreaID === "InlandClassA" ||
      aNavAreaID === "InlandClassB" ||
      aNavAreaID === "RestrictedWaters") {
    return allCertiTypes.filter(certi =>
      certi.value === "CCSInlandSurvey" ||
      certi.value === "LocalShipSurvey" ||
      certi.value === "MSASmallCraftSurvey"
    );
  }

  if (aNavAreaID === "ShelteredArea" ||
      aNavAreaID === "CoastalArea" ||
      aNavAreaID === "NearshoreArea") {
    return allCertiTypes.filter(certi =>
      certi.value === "CCSSeagoingSurvey"
    );
  }

  if (aNavAreaID === "OffshoreArea") {
    return allCertiTypes.filter(certi =>
      certi.value === "CCSSeagoingSurvey" ||
      certi.value === "CCSClassSurvey"
    );
  }

  return allCertiTypes;
}; 

const BoatInfoPanel = ({ boat, boatCategories, form, onUpdate, isSubmitting }) => {
  const { compactAlgorithm } = theme;
  const navigationArea = Form.useWatch('navigationArea', form);

  const filteredCertiTypes = React.useMemo(() => {
    return getBoatCertiTypeByNavArea(navigationArea);
  }, [navigationArea]);

  if (!boat) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="请在左侧选择一艘船以查看详情" />
      </div>
    );
  }

  return (
    <ConfigProvider theme={{ algorithm: compactAlgorithm }}>
      <div style={{ padding: '24px' }}>
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
          onFinish={onUpdate}
          initialValues={boat}
        >
          <Form.Item style={{ marginTop: '8px' }}>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ marginRight: 8 }}>
              保存修改
            </Button>
            <Button onClick={() => form.setFieldsValue(boat)}>
              重置
            </Button>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="boatName" label="船名" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="boatEnName" label="船舶英文名" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="price" label="价格" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="categoryStrID" label="船舶类别">
                <Select placeholder="请选择船舶类别">
                  {boatCategories.map(cat => (
                    <Select.Option key={cat.categoryStrID} value={cat.categoryStrID}>
                      {cat.cnName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}><Form.Item name="description" label="简介" labelCol={{ span: 3 }} wrapperCol={{ span: 21 }}><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={12}><Form.Item name="overallLength" label="总长" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="waterlineLength" label="水线长" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="beam" label="船宽" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="moldedDepth" label="型深" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="draft" label="吃水" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="navigationArea" label="航区">
                <Select placeholder="请选择航区">
                  {BOAT_NAV_AREA_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="material" label="材质">
                <Select placeholder="请选择材质">
                  {BOAT_MATERIAL_OPTIONS.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="certificateType" label="证书类型">
                <Select placeholder="请选择证书类型" allowClear>
                  {filteredCertiTypes.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    </ConfigProvider>
  );
};

export default BoatInfoPanel;