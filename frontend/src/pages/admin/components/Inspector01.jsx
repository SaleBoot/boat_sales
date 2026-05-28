import React from 'react';
import { Form, Input, InputNumber, Space, Collapse, Switch, Select, ColorPicker } from 'antd';
import { CaretRightOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

// 自定义一个 Vector3 紧凑组件
  const Vector3Input = ({ value = { x: 0, y: 0, z: 0 }, onChange }) => {
    const triggerChange = (changedValue) => {
      onChange?.({ ...value, ...changedValue });
    };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input style={{ width: '15%', textAlign: 'center', background: '#f5f5f5', color: 'rgba(0, 0, 0, 0.25)', padding: '0 4px' }} value="X" disabled />
      <InputNumber style={{ width: '18.33%' }} value={value.x} onChange={(v) => triggerChange({ x: v })} />
      <Input style={{ width: '15%', textAlign: 'center', background: '#f5f5f5', color: 'rgba(0, 0, 0, 0.25)', padding: '0 4px' }} value="Y" disabled />
      <InputNumber style={{ width: '18.33%' }} value={value.y} onChange={(v) => triggerChange({ y: v })} />
      <Input style={{ width: '15%', textAlign: 'center', background: '#f5f5f5', color: 'rgba(0, 0, 0, 0.25)', padding: '0 4px' }} value="Z" disabled />
      <InputNumber style={{ width: '18.33%' }} value={value.z} onChange={(v) => triggerChange({ z: v })} />
    </Space.Compact>
  );
};

const Inspector = () => {
  const [form] = Form.useForm();

  const handleValuesChange = (changedValues, allValues) => {
    console.log('Inspector 数据更新:', allValues);
  };

  return (
    <div style={{ width: 320, background: '#ffffff', height: '100vh', padding: 8, boxSizing: 'border-box' }}>
      {/* 顶部 GameObject 基础信息 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Switch size="small" defaultChecked />
        <Input size="small" defaultValue="Cube" style={{ flex: 1 }} />
      </div>

      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 8 }}      // 标签占 1/3 宽度
        wrapperCol={{ span: 16 }}  // 控件占 2/3 宽度
        labelAlign="left"
        size="small"
        onValuesChange={handleValuesChange}
      >
        <Collapse
          defaultActiveKey={['transform', 'mesh']}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
          ghost
          style={{ background: 'transparent' }}
        >
          {/* Transform 组件折叠面板 */}
          <Panel header="Transform" key="transform" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <Form.Item label="Position" name={['transform', 'position']} initialValue={{ x: 0, y: 0, z: 0 }}>
              <Vector3Input />
            </Form.Item>
            <Form.Item label="Rotation" name={['transform', 'rotation']} initialValue={{ x: 0, y: 0, z: 0 }}>
              <Vector3Input />
            </Form.Item>
            <Form.Item label="Scale" name={['transform', 'scale']} initialValue={{ x: 1, y: 1, z: 1 }}>
              <Vector3Input />
            </Form.Item>
          </Panel>

          {/* Mesh Renderer 组件折叠面板 */}
          <Panel header="Mesh Renderer" key="mesh" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <Form.Item label="Cast Shadows" name={['mesh', 'castShadows']} valuePropName="checked" initialValue={true}>
              <Switch size="small" />
            </Form.Item>
            <Form.Item label="Material Level" name={['mesh', 'level']} initialValue="opaque">
              <Select options={[
                { value: 'opaque', label: 'Opaque' },
                { value: 'transparent', label: 'Transparent' }
              ]} />
            </Form.Item>
            <Form.Item label="Main Color" name={['mesh', 'color']} initialValue="#ffffff">
              <ColorPicker showText size="small" />
            </Form.Item>
          </Panel>
        </Collapse>
      </Form>
    </div>
  );
};

export default Inspector;