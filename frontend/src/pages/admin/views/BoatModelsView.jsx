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
import { getBoatCategories } from '../../../apis/adminApi';

// --- Mock Data and API ---
const mockModels = Array.from({ length: 12 }, (_, i) => {
  const types = ['Yacht', 'New Energy Ship', 'Emergency Rescue Ship', 'Official Law Enforcement Boat'];
  return {
    id: `model-${i + 1}`,
    boatName: `SuperYacht-X${i + 1}`,
    boatType: types[i % types.length],
    storagePath: `/gltf/57sites/57.glb`,
    fbxFileName: `model_${i + 1}.fbx`,
    glbFileName: `model_${i + 1}.glb`,
    materialSlots: ['hull', 'deck', 'interior'],
    promoImage1: `https://picsum.photos/seed/${i + 1}/400/300`,
    promoImage2: `https://picsum.photos/seed/${i + 2}/400/300`,
    promoImage3: `https://picsum.photos/seed/${i + 3}/400/300`,
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
    }, 300);
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
  const [models, setModels] = useState([]);
  const [boatCategories, setBoatCategories] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState(null);

  // 获取列表数据
  const fetchModels = async (filterParams = {}) => {
    setLoading(true);
    try {
      const response = await getBoatModels(filterParams);
      setModels(response.data);
      // 当筛选时，不清空当前预览的模型，除非筛选结果为空
      if (response.data.length > 0) {
        if (!currentModel || !response.data.find(m => m.id === currentModel.id)) {
          setCurrentModel(response.data[0]);
        }
      } else {
        setCurrentModel(null);
      }
      if(Object.keys(filterParams).length === 0) {
         message.success('模型列表已刷新');
      } else {
         message.success('筛选成功');
      }
    } catch (error) {
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [modelsResponse, categoriesResponse] = await Promise.all([
        getBoatModels(),
        getBoatCategories(),
      ]);

      setModels(modelsResponse.data);
      if (modelsResponse.data.length > 0) {
        setCurrentModel(modelsResponse.data[0]);
      }
      
      // 假设API返回的数据结构是 { data: [...] }
      setBoatCategories(categoriesResponse.data || []);
      
    } catch (error) {
      message.error('初始化数据失败');
      // 在真实场景中，这里可能需要更详细的错误处理
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 处理删除
  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的模型。');
      return;
    }
    await deleteBoatModels(selectedRowKeys);
    message.success('删除成功');
    setSelectedRowKeys([]);
    fetchModels(); // 重新获取列表
  };

  // 处理行选择
  const onSelectChange = (keys) => {
    setSelectedRowKeys(keys);
  };

  // 处理双击行
  const handleRowDoubleClick = (record) => {
    setCurrentModel(record);
    message.info(`正在预览模型: ${record.boatName}`);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns = [
    { title: '船舶名称(英文)', dataIndex: 'boatName', key: 'boatName', width: 180 },
    { title: '船舶类型', dataIndex: 'boatType', key: 'boatType', width: 120 },
    { title: '存放路径', dataIndex: 'storagePath', key: 'storagePath' },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        {/* 左侧列表 */}
        <Col span={8}>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={() => fetchModels()}>刷新</Button>
                <Button icon={<UploadOutlined />} onClick={() => message.info('上传功能待实现')}>上传</Button>
                <Button icon={<DownloadOutlined />} disabled={!currentModel} onClick={() => message.info('下载功能待实现')}>下载</Button>
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete} danger>删除</Button>
              </Space>
              <Select
                placeholder="按船舶类型查询..."
                style={{ width: '100%', marginTop: '10px' }}
                onChange={(value) => fetchModels({ boatType: value })}
                onClear={() => fetchModels()}
                allowClear
              >
                {boatCategories.map(cat => (
                  <Select.Option key={cat.id} value={cat.englishName}>
                    {cat.chineseName}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={models}
              rowKey="id"
              loading={loading}
              onRow={(record) => ({
                onDoubleClick: () => handleRowDoubleClick(record),
              })}
              pagination={{ pageSize: 10 }}
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

        {/* 右侧参数 */}
        <Col span={8}>
          <Card 
            title="模型参数配置"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflowY: 'auto' }}
          >
            {currentModel ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="FBX 文件名">{currentModel.fbxFileName}</Descriptions.Item>
                <Descriptions.Item label="GLB 文件名">{currentModel.glbFileName}</Descriptions.Item>
                <Descriptions.Item label="材质槽数组">{currentModel.materialSlots.join(', ')}</Descriptions.Item>
                <Descriptions.Item label="宣传图片1"><Image width={100} src={currentModel.promoImage1} /></Descriptions.Item>
                <Descriptions.Item label="宣传图片2"><Image width={100} src={currentModel.promoImage2} /></Descriptions.Item>
                <Descriptions.Item label="宣传图片3"><Image width={100} src={currentModel.promoImage3} /></Descriptions.Item>
                <Descriptions.Item label="UV 目录">{currentModel.uvDir1}</Descriptions.Item>
                <Descriptions.Item label="UV 目录 2">{currentModel.uvDir2}</Descriptions.Item>
                <Descriptions.Item label="UV 目录 3">{currentModel.uvDir3}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="请在左侧选择一个模型以查看其参数" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}