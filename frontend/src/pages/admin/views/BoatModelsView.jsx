import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Table,
  Input,
  Space,
  message,
  Image,
  Carousel,
  Empty,
  Descriptions,
  Select,
  Tabs,
  Form,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  RedoOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import ShipScene from '../../scene3d/ShipScene.jsx';
import { getBoatCategories, getBoats, addBoat, deleteBoats } from '../../../apis/adminApi';
import AddBoatModal from './BoatAddModal.jsx';

// --- Mock Data and API ---
const mockModels = Array.from({ length: 12 }, (_, i) => {
  const types = ['Yacht', 'New Energy Ship', 'Emergency Rescue Ship', 'Official Law Enforcement Boat'];
  return {
    id: `model-${i + 1}`,
    modelName: `SuperYacht-X${i + 1}`,
    boatType: types[i % types.length],
    storagePath: `/gltf/57sites/57.glb`,
    fbxFileName: `model_${i + 1}.fbx`,
    glbFileName: `model_${i + 1}.glb`,
    materialSlots: ['hull', 'deck', 'interior'],
    uvDir1: '/uv/model_1/',
    uvDir2: '/uv/model_2/',
    uvDir3: '/uv/model_3/',
    // 假设这是3D模型的路径
    modelUrl: '/gltf/951/951NS/950ns.glb',
  };
});

const getBoatModels = async (params) => {
  console.log('模拟获取船模列表, 参数:', params);
  return new Promise((resolve) => {
    setTimeout(() => {
      if (params?.boatType) {
        const filteredData = mockModels.filter(m => m.boatType === params.boatType);
        resolve({ data: filteredData });
      } else {
        resolve({ data: mockModels });
      }
    }, 100);
  });
};

const deleteBoatModels = async (ids) => {
  console.log('模拟删除船模:', ids);
  return new Promise((resolve) => setTimeout(resolve, 500));
};
// --- End Mock ---

/**
 * 船模管理视图
 */
export default function BoatModelsView() {
  // State for boat models (original, kept for linking)
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState(null);

  // State for boat list (from BoatsView, now primary)
  const [boats, setBoats] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentBoat, setCurrentBoat] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shared state
  const [boatCategories, setBoatCategories] = useState([]);
  const [form] = Form.useForm();

  // --- Functions for Boat List ---

  // 获取船舶列表
  const fetchBoats = async (filters = {}) => {
    setLoading(true);
    try {
      const response = await getBoats(filters);
      const boatsData = (response || []).map(({ id, Id, iD, ID, ...rest }) => ({
        ID: id ?? Id ?? iD ?? ID,
        ...rest
      }));
      setBoats(boatsData);

      // After filtering, update the current boat and model view
      if (boatsData.length > 0) {
        const newCurrentBoat = boatsData.find(b => b.ID === currentBoat?.ID) || boatsData[0];
        setCurrentBoat(newCurrentBoat);
        const correspondingModel = models.find(m => m.modelName === newCurrentBoat.modelName);
        setCurrentModel(correspondingModel || null);
      } else {
        setCurrentBoat(null);
        setCurrentModel(null);
      }
      
      message.success('船舶列表已刷新');
    } catch (error) {
      message.error('获取船舶列表失败');
      console.error("Failed to fetch boats:", error);
      // Mock data as fallback
      const mockBoats = Array.from({ length: 5 }, (_, i) => ({
        ID: i + 1,
        chineseName: `泰坦尼克号 ${i + 1}`,
        englishName: `Titanic ${i + 1}`,
        category: '豪华邮轮',
        price: `¥${(100 + i * 50).toLocaleString()}`,
      }));
      setBoats(mockBoats);
      if (mockBoats.length > 0 && !currentBoat) {
        setCurrentBoat(mockBoats[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理行选择变化的函数
  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  // 删除选定船舶
  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的船舶。');
      return;
    }
    try {
      await deleteBoats(selectedRowKeys);
      message.success('船舶删除成功');
      fetchBoats();
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('删除船舶失败');
    }
  };

  // 处理新增船舶表单的提交
  const handleAddFinish = async (values) => {
    setIsSubmitting(true);
    try {
      await addBoat(values);
      message.success('船舶添加成功');
      setIsAddModalOpen(false);
      fetchBoats();
    } catch (error) {
      message.error(error.message || '添加船舶失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBoat = async (values) => {
    if (!currentBoat) {
      message.error('请先选择一艘船');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateBoat(currentBoat.ID, values);
      message.success('船舶信息更新成功');
      // Refresh the list to show updated data
      await fetchBoats();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- End Functions for Boat List ---

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [modelsResponse, categoriesResponse, boatsResponse] = await Promise.all([
        getBoatModels(),
        getBoatCategories(),
        getBoats(), // Initial boat fetch
      ]);

      const allModels = modelsResponse.data || [];
      setModels(allModels);
      
      setBoatCategories(categoriesResponse.data || []);

      const boatsData = (boatsResponse || []).map(({ id, Id, iD, ID, ...rest }) => ({
        ID: id ?? Id ?? iD ?? ID,
        ...rest
      }));
      setBoats(boatsData);
      
      if (boatsData.length > 0) {
        const firstBoat = boatsData[0];
        setCurrentBoat(firstBoat);
        // Link to the model on initial load
        const correspondingModel = allModels.find(m => m.modelName === firstBoat.modelName);
        if (correspondingModel) {
          setCurrentModel(correspondingModel);
        } else if (allModels.length > 0) {
          setCurrentModel(allModels[0]); // Fallback to the first model if no link found
        }
      }
      
    } catch (error) {
      message.error('初始化数据失败');
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (currentBoat) {
      // 增加一个日志，方便我们在浏览器控制台查看数据是否正确
      console.log("Current boat selected, attempting to set form values:", currentBoat);
      // 使用 setTimeout 确保在 Form 组件完全渲染后再执行 setFieldsValue
      // 这可以解决因组件渲染时序导致的问题
      setTimeout(() => {
        form.setFieldsValue(currentBoat);
      }, 0);
    }
  }, [currentBoat, form]);

  // --- Column and selection definitions for Boat List ---
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns = [
    { title: '船名', dataIndex: 'boatName', key: 'boatName', width: 150 },
    { title: '模型名', dataIndex: 'modelName', key: 'modelName', width: 150 },
    { title: '船舶类型', dataIndex: 'category', key: 'category', width: 120 },
  ];
  // --- End definitions ---

  return (
    <div style={{ padding: '1px' }}>
      <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
        {/* 左侧列表 (from BoatsView) */}
        <Col span={8}>
          <Card>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={() => fetchBoats()}>刷新</Button>
                <Button icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>增加</Button>
                <Button icon={<DeleteOutlined />} onClick={handleDelete} disabled={selectedRowKeys.length === 0} danger>删除</Button>
              </Space>
            </div>
            <Select
              placeholder="按船舶类型查询..."
              style={{ width: '100%', marginBottom: 16 }}
              onChange={(value) => fetchBoats({ category: value })}
              onClear={() => fetchBoats()}
              allowClear
            >
              {boatCategories.map(cat => (
                <Select.Option key={cat.ID} value={cat.englishName}>
                  {cat.chineseName}
                </Select.Option>
              ))}
            </Select>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={boats}
              rowKey="ID"
              loading={loading}
              pagination={{ pageSize: 8 }}
              onRow={(record) => ({
                onClick: () => {
                  setCurrentBoat(record);
                  const correspondingModel = models.find(m => m.modelName === record.modelName);
                  if (correspondingModel) {
                    setCurrentModel(correspondingModel);
                    message.info(`已选择船舶: ${record.boatName}`);
                  } else {
                    setCurrentModel(null);
                    message.warning(`未找到 ${record.boatName} 关联的模型`);
                  }
                },
              })}
              scroll={{ y: 'calc(100vh - 400px)' }}
            />
          </Card>
        </Col>

        {/* 中间预览 - 使用原生div替代Card以解决事件穿透问题 */}
        <Col span={8} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            border: '1px solid #f0f0f0', 
            borderRadius: '8px', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid #f0f0f0',
              fontWeight: 'bold'
            }}>
              模型预览
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {currentModel ? (
                <ShipScene 
                  modelConfig={{
                    id: currentModel.id,
                    model: { path: currentModel.modelUrl }
                  }} 
                />
              ) : (
                <Empty description="请在左侧选择一个模型进行预览" />
              )}
            </div>
          </div>
        </Col>

        {/* 右侧详情与参数 */}
        <Col span={8}>
          <Card 
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'hidden', padding: 0 }}
          >
            <Tabs 
              defaultActiveKey="1" 
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              tabBarStyle={{ paddingLeft: '24px', paddingRight: '24px', flexShrink: 0, marginBottom: 0 }}
              tabPaneStyle={{ flex: 1, overflowY: 'auto', padding: '24px' }}
            >
              <Tabs.TabPane tab="船舶基础信息" key="1">
                {currentBoat ? (
                  <Form
                    form={form}
                    layout="horizontal"
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    onFinish={handleUpdateBoat}
                  >
                    <Form.Item style={{ marginTop: '8px' }}>
                      <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ marginRight: 8 }}>
                        保存修改
                      </Button>
                      <Button onClick={() => form.setFieldsValue(currentBoat)}>
                        重置
                      </Button>
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}><Form.Item name="boatName" label="船名"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="modelName" label="模型名"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="price" label="价格"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="category" label="船舶类型"><Input /></Form.Item></Col>
                      <Col span={24}><Form.Item name="description" label="简介" labelCol={{ span: 3 }} wrapperCol={{ span: 21 }}><Input.TextArea rows={2} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="overallLength" label="总长"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="waterlineLength" label="水线长"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="beam" label="船宽"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="moldedDepth" label="型深"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="draft" label="吃水"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="navigationArea" label="航区"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="mainEnginePower" label="主机功率"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="designSpeed" label="设计航速"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="ratedCrew" label="额定乘员"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="propulsionType" label="动力形式"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="material" label="材质"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="certificateType" label="证书类型"><Input /></Form.Item></Col>
                    </Row>
                    <Divider>宣传图片</Divider>
                    <div>
                      {((currentBoat.images && currentBoat.images.length > 0) ? currentBoat.images : [
                          'https://picsum.photos/seed/default-boat-1/400/300',
                          'https://picsum.photos/seed/default-boat-2/400/300',
                          'https://picsum.photos/seed/default-boat-3/400/300',
                      ]).map((img, index) => (
                        <Image key={index} width={100} src={img} style={{ marginRight: 8 }} />
                      ))}
                    </div>
                  </Form>
                ) : (
                  <Empty description="请在左侧选择一艘船以查看详情" />
                )}
              </Tabs.TabPane>
              <Tabs.TabPane tab="模型参数配置" key="2">
                {currentModel ? (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="FBX 文件名">{currentModel.fbxFileName}</Descriptions.Item>
                    <Descriptions.Item label="GLB 文件名">{currentModel.glbFileName}</Descriptions.Item>
                    <Descriptions.Item label="材质槽数组">{currentModel.materialSlots.join(', ')}</Descriptions.Item>
                    <Descriptions.Item label="UV 目录">{currentModel.uvDir1}</Descriptions.Item>
                    <Descriptions.Item label="UV 目录 2">{currentModel.uvDir2}</Descriptions.Item>
                    <Descriptions.Item label="UV 目录 3">{currentModel.uvDir3}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Empty description="未找到关联的模型或未选择船舶" />
                )}
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* 新增船舶模态框 */}
      <AddBoatModal
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onFinish={handleAddFinish}
        loading={isSubmitting}
      />
    </div>
  );
}