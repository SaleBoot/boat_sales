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

const BoatInfoPanel = ({ boat, boatCategories, form, onUpdate, isSubmitting }) => {
  const { compactAlgorithm } = theme;

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
            <Col span={12}><Form.Item name="navigationArea" label="航区" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="mainEnginePower" label="主机功率" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="designSpeed" label="设计航速" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="ratedCrew" label="额定乘员"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="propulsionType" label="动力形式" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="material" label="材质" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="certificateType" label="证书类型" normalize={(v) => v && v.trim()}><Input /></Form.Item></Col>
          </Row>
        </Form>
      </div>
    </ConfigProvider>
  );
};

export default BoatInfoPanel;