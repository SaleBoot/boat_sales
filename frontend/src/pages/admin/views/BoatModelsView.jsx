import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
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
import { getBoatCategories, getBoats, addBoat, updateBoat, deleteBoats } from '../../../apis/adminApi';
import BoatListSider from '../components/BoatListSider';
import BoatInfoPanel from '../components/BoatInfoPanel.jsx';
import ModelParametersPanel from '../components/ModelParametersPanel.jsx';
import Inspector from '../components/Inspector.jsx';
import Inspector01 from '../components/Inspector01.jsx';
import AddBoatModal from './BoatAddModal.jsx';

// --- Mock Data and API ---
const mockModels = Array.from({ length: 12 }, (_, i) => {
  return {
    id: `model-${i + 1}`,
    modelName: `SuperYacht-X${i + 1}`,
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
  const [isPathModalVisible, setIsPathModalVisible] = useState(false);
  const [tempPath, setTempPath] = useState('');

  // Shared state
  const [boatCategories, setBoatCategories] = useState([]);
  const [form] = Form.useForm();

  // 动态生成类型映射
  const boatTypeMap = useMemo(() => {
    if (!boatCategories) return {};
    return boatCategories.reduce((acc, cat) => {
      acc[cat.englishName] = cat.chineseName;
      return acc;
    }, {});
  }, [boatCategories]);

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
  // 参数 values 是由 AddBoatModal 内部的 handleOk 函数处理好后，手动传递过来的。
  // 处理新增船舶表单的提交
  // 参数 values 是由 AddBoatModal 内部的 handleOk 函数处理好后，手动传递过来的。
  const handleAddComplete = async (values) => {
    setIsSubmitting(true);
    try {
      console.log('接收到来自Modal的最终数据:', values);
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

  const handleModelChange = (changedValues) => {
    setCurrentModel(prevModel => ({
      ...prevModel,
      ...changedValues,
    }));
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

  const handleOpenPathModal = () => {
    if (!currentModel) {
      message.warning('请先选择一个有关联模型的船舶。');
      return;
    }
    const folderPath = currentModel.storagePath ? currentModel.storagePath.substring(0, currentModel.storagePath.lastIndexOf('/') + 1) : '';
    setTempPath(folderPath);
    setIsPathModalVisible(true);
  };

  const handlePathChange = () => {
    if (currentModel) {
      // 确保路径以斜杠结尾
      const formattedPath = tempPath.endsWith('/') || tempPath === '' ? tempPath : tempPath + '/';
      const newStoragePath = formattedPath + currentModel.glbFileName;

      setCurrentModel(prev => ({
        ...prev,
        storagePath: newStoragePath,
      }));
      message.success('模型路径已在本地更新。');
    }
    setIsPathModalVisible(false);
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
      console.log("初始数据获取成功:", { modelsResponse, categoriesResponse, boatsResponse });
      const allModels = (modelsResponse.data || []).map((model) => ({
        ...model,
      }));
      setModels(allModels);
      
      setBoatCategories(categoriesResponse || []);

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
    { 
      title: '船舶类型', 
      dataIndex: 'category', 
      key: 'category', 
      width: 120,
      render: (category) => boatTypeMap[category] || category,
    },
  ];

  const handleRowClick = (record) => {
    setCurrentBoat(record);
    const correspondingModel = models.find(m => m.modelName === record.modelName);
    if (correspondingModel) {
      setCurrentModel(correspondingModel);
      message.info(`已选择船舶: ${record.boatName}`);
    } else {
      // 即使在 mock models 中找不到，也创建一个基础对象
      // 这样右侧面板就能知道模型名，并显示“上传”按钮
      setCurrentModel({ modelName: record.modelName, storagePath: '' });
      message.warning(`未找到 ${record.boatName} 关联的详细模型数据`);
    }
  };
  // --- End definitions ---

  // 为新的 Tabs items API 准备数据
  const tabItems = [
    {
      key: '1',
      label: '船舶基础信息',
      children: (
        <BoatInfoPanel
          boat={currentBoat}
          boatCategories={boatCategories}
          form={form}
          onUpdate={handleUpdateBoat}
          isSubmitting={isSubmitting}
        />
      ),
    },
    {
      key: '2',
      label: '模型参数配置',
      children: (
        <ModelParametersPanel
          model={currentModel}
          onModelChange={handleModelChange}
        />
      ),
    },
    {
      key: '3',
      label: 'Inspector',
      children: <Inspector />,
    },
    {
      key: '4',
      label: 'Inspector01',
      children: <Inspector01 />,
    },
  ];

  return (
    <div style={{ padding: '1px' }}>
      <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
        {/* 左侧列表 (from BoatsView) */}
        <Col span={8}>
          <BoatListSider
            loading={loading}
            boats={boats}
            boatCategories={boatCategories}
            selectedRowKeys={selectedRowKeys}
            onRefresh={() => fetchBoats()}
            onAdd={() => setIsAddModalOpen(true)}
            onDelete={handleDelete}
            onCategoryChange={(value) => fetchBoats({ category: value })}
            onSelectChange={onSelectChange}
            onRowClick={handleRowClick}
          />
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
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 0 } }}
          >
            <Tabs 
              defaultActiveKey="1" 
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              tabBarStyle={{ paddingLeft: '24px', paddingRight: '24px', flexShrink: 0, marginBottom: 0 }}
              items={tabItems}
            />
          </Card>
        </Col>
      </Row>

      {/* 新增船舶模态框 */}
      <AddBoatModal
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        onAddComplete={handleAddComplete}
        loading={isSubmitting}
      />

      {/* 路径选择模态框 */}
      <Modal
        title="选择模型文件夹路径"
        open={isPathModalVisible}
        onOk={handlePathChange}
        onCancel={() => setIsPathModalVisible(false)}
        destroyOnHidden
      >
        <p>后端API暂未实现，请手动输入或粘贴路径。</p>
        <Input 
          value={tempPath}
          onChange={(e) => setTempPath(e.target.value)}
          placeholder="例如: /gltf/57sites/"
        />
      </Modal>
    </div>
  );
}