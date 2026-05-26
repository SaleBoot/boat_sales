import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message, Divider } from 'antd';

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
        console.log('Form values before processing:', values);

        // 创建一个新对象用于存储处理后的值
        const processedValues = { ...values };

        // 定义需要转换为数字的字段列表
        const numericFields = [
          'Price', 'ratedCrew', 'overallLength', 'waterlineLength',
          'beam', 'moldedDepth', 'draft', 'designSpeed'
        ];

        numericFields.forEach(field => {
          if (processedValues[field] !== undefined && processedValues[field] !== null) {
            const parsed = parseFloat(processedValues[field]);
            processedValues[field] = isNaN(parsed) ? 0 : parsed;
          }
        });
        
        console.log('Form values after processing:', processedValues);
        onFinish(processedValues); // 将处理后的表单数据传递给父组件
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
      <Form 
        form={form} 
        layout="horizontal" 
        name="addBoatForm"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={{ Price: 0, ratedCrew: 0 }}
      >
        <Divider orientation="left">基本信息</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="boatName"
              label="船名"
              rules={[{ required: true, message: '请输入船名' }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="modelName"
              label="模型名"
              rules={[
                { required: true, message: '请输入模型名' },
                {
                  pattern: /^[a-zA-Z0-9_-]+$/,
                  message: '模型名只能包含英文、数字、下划线或连字符，且不能包含空格',
                },
              ]}
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
            <Form.Item name="Price" label="价格">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Form.Item name="description" label="简介" labelCol={{span: 4}} wrapperCol={{span: 20}}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">宣传图片</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="adImg0" label="宣传图0路径">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="adImg1" label="宣传图1路径">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="adImg2" label="宣传图2路径">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">技术参数(Specs)</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="overallLength" label="总长">
              <Input placeholder="例如 15.80" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="waterlineLength" label="水线长">
              <Input placeholder="例如 15.10" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="beam" label="船宽">
              <Input placeholder="例如 3.50" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="moldedDepth" label="型深">
              <Input placeholder="例如 1.20" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="draft" label="吃水">
              <Input placeholder="例如 0.50" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="navigationArea" label="航区">
              <Input placeholder="例如 内河 B 级" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="mainEnginePower" label="主机功率">
              <Input placeholder="例如 2 x 150 HP" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="designSpeed" label="设计航速">
              <Input placeholder="例如 42" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ratedCrew" label="额定乘员">
              <InputNumber style={{ width: '100%' }} placeholder="例如 12" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="propulsionType" label="动力形式">
              <Input placeholder="例如 双船外机" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="material" label="材质">
              <Input placeholder="例如 铝合金" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="certificateType" label="证书类型">
              <Input placeholder="例如 CCS" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default AddBoatModal;