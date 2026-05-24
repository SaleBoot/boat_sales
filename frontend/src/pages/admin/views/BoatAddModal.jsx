import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message } from 'antd';

const { Option } = Select;

const boatTypes = [
  { id: 'NewEnergyShip', name: '新能源船' },
  { id: 'EmergencyRescueShip', name: '应急救援船' },
  { id: 'OfficialLawEnforcementBoat', name: '公务执法艇' },
  { id: 'Yacht', name: '游艇' },
];

/**
 * 新增/编辑船舶的模态框
 */
const AddBoatModal = ({ open, onCancel, onFinish, loading }) => {
  const [form] = Form.useForm();

  // 当模态框打开时，可以进行一些初始化操作，但这里暂时不需要
  // useEffect(() => {
  //   if (open) {
  //     form.resetFields();
  //   }
  // }, [open, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        // 在这里可以对值进行最后的处理
        console.log('Form values:', values);
        onFinish(values); // 将表单数据传递给父组件
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
        message.error('请检查表单输入！');
      });
  };

  return (
    <Modal
      title="增加新船舶"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={800} // 加宽模态框以容纳两列表单
      destroyOnHidden // 关闭时销毁表单状态
    >
      <Form form={form} layout="vertical" name="addBoatForm">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="chineseName"
              label="船舶中文名称"
              rules={[{ required: true, message: '请输入船舶中文名称' }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="englishName"
              label="船舶英文名称"
              rules={[{ required: true, message: '请输入船舶英文名称' }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="type" 
              label="船舶类型"
              rules={[{ required: true, message: '请选择船舶类型' }]}
            >
              <Select placeholder="请选择一个船舶类型">
                {boatTypes.map(type => (
                  <Option key={type.id} value={type.id}>
                    {type.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="overallLength" label="总长">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="waterlineLength" label="水线长">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="beam" label="船宽">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="moldedDepth" label="型深">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="draft" label="吃水">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="navigationArea" label="航区">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="mainEnginePower" label="主机功率">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="designSpeed" label="设计航速">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ratedCrew" label="额定乘员">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="propulsionType" label="动力形式">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="material" label="材质">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="certificateType" label="证书类型">
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default AddBoatModal;