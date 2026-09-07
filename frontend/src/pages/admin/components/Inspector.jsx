import React from 'react';
import { Collapse, Switch, Form, Input, Slider, ColorPicker } from 'antd';

// 1. 模拟当前选中的 3D 游戏对象的数据结构
const selectedObject = {
  id: "cube_102",
  name: "Main Ship Model",
  components: [
    {
      type: "Transform",
      enabled: true,
      data: { position: { x: 0, y: 10, z: -5 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    {
      type: "Light",
      enabled: false,
      data: { intensity: 1.5, color: "#ffffff" }
    }
  ]
};

// 2. 根据组件类型，动态分发渲染具体的表单内容
const Inspector = () => {
  return (
    <div style={{ width: 300, background: '#ffffff', padding: 8 }}>
      {/* 头部全局属性 */}
      <Input value={selectedObject.name} size="small" style={{ marginBottom: 12 }} />
      
      <Collapse defaultActiveKey={['Transform']} ghost>
        {selectedObject.components.map((comp) => (
          <Collapse.Panel 
            key={comp.type} 
            header={comp.type}
            extra={<Switch size="small" checked={comp.enabled} />}
          >
            <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} size="small">
              {comp.type === 'Transform' && (
                <>
                  <Form.Item label="Position">/* 渲染上面的 X Y Z 栅格 */</Form.Item>
                  <Form.Item label="Rotation">/* 渲染 R_X R_Y R_Z */</Form.Item>
                </>
              )}
              {comp.type === 'Light' && (
                <>
                  <Form.Item label="Intensity">
                    <Slider min={0} max={10} step={0.1} defaultValue={comp.data.intensity} />
                  </Form.Item>
                  <Form.Item label="Color">
                    <ColorPicker defaultValue={comp.data.color} />
                  </Form.Item>
                </>
              )}
            </Form>
          </Collapse.Panel>
        ))}
      </Collapse>
    </div>
  );
}

export default Inspector;