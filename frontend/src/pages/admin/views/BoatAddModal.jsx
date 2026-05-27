import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, message, Divider, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getCosPresignedUrl } from '../../../apis/adminApi';
import { uploadByPresignedUrl } from '../../../apis/cosApi';

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
const AddBoatModal = ({ open, onCancel, onAddComplete, loading }) => {
  const [form] = Form.useForm();
  const [isProcessing, setIsProcessing] = useState(false);

  // 当模态框打开时，可以进行一些初始化操作，但这里暂时不需要
  // useEffect(() => {
  //   if (open) {
  //     form.resetFields();
  //   }
  // }, [open, form]);

  // 上传前的校验拦截器
  const handleBeforeUpload = (file) => {
    // 1. 检查模型名是否填写
    const modelName = form.getFieldValue('modelName');
    if (!modelName) {
      message.error('请先填写模型名再上传图片！');
      return Upload.LIST_IGNORE;
    }

    // 2. 校验文件名
    const invalidCharsRegex = /[\u4e00-\u9fa5\s]/;
    if (invalidCharsRegex.test(file.name)) {
      message.error('文件名不能包含中文或空格，请修改后重新上传！');
      return Upload.LIST_IGNORE;
    }

    // 3. 校验文件大小
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB!');
      return Upload.LIST_IGNORE;
    }

    // 校验通过，但我们不希望它自动上传，所以返回 false
    // Upload 组件会将文件保留在列表中，等待我们手动处理
    return false;
  };

  // 独立的上传辅助函数，负责编排
  const uploadFileToCos = async (file, modelName) => {
    if (!file || !modelName) return null;

    try {
      // 1. 从自己的后端获取预签名 URL 和最终访问 URL
      const res = await getCosPresignedUrl(modelName, file.name);
      
      // 从响应中解构URL
      let { uploadUrl, accessUrl } = res;

      // 清理 accessUrl: 移除可能存在的前后空格和反引号
      if (accessUrl && typeof accessUrl === 'string') {
        accessUrl = accessUrl.trim().replace(/`/g, '');
      }

      if (!uploadUrl) {
        throw new Error(`获取 ${file.name} 的上传地址失败`);
      }

      // 2. 使用独立的 cosApi 上传文件到云服务
      await uploadByPresignedUrl(uploadUrl, file);

      // 3. 返回可访问的 URL
      return accessUrl;
    } catch (error) {
      console.error(`上传文件 ${file.name} 失败:`, error);
      message.error(`上传文件 ${file.name} 失败，请重试`);
      throw error; // 抛出错误，中断整个 handleOk 流程
    }
  };


  const handleOk = async () => {
    setIsProcessing(true);
    try {
      // 1. 触发表单校验
      const values = await form.validateFields();
      const processedValues = { ...values };

      // 2. 从 adImgs 字段中提取文件列表并处理上传
      const fileList = values.adImgs || [];
      const uploadPromises = fileList.map(file => {
        if (file.originFileObj) {
          // 新上传的文件
          return uploadFileToCos(file.originFileObj, values.modelName);
        }
        if (file.url) {
          // 可能是已存在的文件（用于编辑模式）
          return Promise.resolve(file.url);
        }
        return Promise.resolve(null);
      });

      // 并行处理所有图片上传
      const imageUrls = await Promise.all(uploadPromises);

      // 3. 将返回的 URL 依次分配给 adImg0, adImg1, adImg2
      processedValues.adImg0 = imageUrls[0] || '';
      processedValues.adImg1 = imageUrls[1] || '';
      processedValues.adImg2 = imageUrls[2] || '';
      
      // 从最终提交的数据中删除临时的 adImgs 字段
      delete processedValues.adImgs;

      // 4. 定义需要转换为数字的字段列表
      const numericFields = [
        'price', 'ratedCrew', 'overallLength', 'waterlineLength',
        'beam', 'moldedDepth', 'draft', 'designSpeed'
      ];

      numericFields.forEach(field => {
        if (processedValues[field] !== undefined && processedValues[field] !== null) {
          const parsed = parseFloat(processedValues[field]);
          processedValues[field] = isNaN(parsed) ? 0 : parsed;
        }
      });

      // 5. 将最终处理好的表单数据传递给父组件
      onAddComplete(processedValues);

    } catch (info) {
      if (info.errorFields) {
        console.log('表单校验失败:', info);
        message.error('请检查表单输入是否完整！');
      } else {
        console.log('提交过程中发生错误:', info);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      title="增加新船舶"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading || isProcessing}
      width={800} // 加宽模态框以容纳两列表单
      destroyOnHidden // 关闭时销毁表单状态
    >
      <Form 
        form={form} 
        layout="horizontal" 
        name="addBoatForm"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={{ price: 0, ratedCrew: 0 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="boatName"
              label="船名"
              rules={[{ required: true, message: '请输入船名' }]}
              style={{ marginBottom: '4px' }}
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
              style={{ marginBottom: '4px' }}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="category" 
              label="船舶类型"
              rules={[{ required: true, message: '请选择船舶类型' }]}
              style={{ marginBottom: '4px' }}
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
            <Form.Item name="price" label="价格">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Form.Item name="description" label="简介" 
                       style={{ marginBottom: '4px' }} 
                       labelCol={{span: 4}} wrapperCol={{span: 20}}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="adImgs"
              label="宣传图片"
              valuePropName="fileList"
              getValueFromEvent={(e) => (Array.isArray(e) ? e : e && e.fileList)}
              labelCol={{span: 4}} 
              wrapperCol={{span: 20}}
            >
              <Upload
                listType="picture-card"
                maxCount={3}
                multiple
                beforeUpload={handleBeforeUpload}
              >
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>选择图片（最多3张）</div>
                </div>
              </Upload>
            </Form.Item>
          </Col>
        </Row>
        
        <Divider titlePlacement="left">技术参数(Specs)</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="overallLength" label="总长" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 15.80" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="waterlineLength" label="水线长" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 15.10" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="beam" label="船宽" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 3.50" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="moldedDepth" label="型深" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 1.20" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="draft" label="吃水" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 0.50" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="navigationArea" label="航区" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 内河 B 级" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="mainEnginePower" label="主机功率" style={{ marginBottom: '2px' }}>
              <Input placeholder="例如 2 x 150 HP" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="designSpeed" label="设计航速" style={{ marginBottom: '2px' }}>
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