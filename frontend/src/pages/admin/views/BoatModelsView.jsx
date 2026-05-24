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
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  RedoOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useAdminBoatScene } from '../../../hooks/useAdminBoatScene';
import { Spin } from 'antd';

// --- Mock Data and API ---
const mockModels = Array.from({ length: 3 }, (_, i) => ({
  id: `model-${i + 1}`,
  boatName: `SuperYacht-X${i + 1}`,
  boatType: 'Yacht',
  modelSize: `${(Math.random() * 100 + 20).toFixed(2)} MB`,
  fileCount: Math.floor(Math.random() * 50 + 10),
  storagePath: `/gltf/57sites/57.glb`,
  images: [
    `https://picsum.photos/seed/${i + 1}/400/300`,
    `https://picsum.photos/seed/${i + 2}/400/300`,
    `https://picsum.photos/seed/${i + 3}/400/300`,
  ],
  // 假设这是3D模型的路径
  modelUrl: '/gltf/Yacht/950.glb',
}));

const getBoatModels = async () => {
  console.log('模拟获取船模列表');
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockModels }), 500);
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
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState(null);

  // 3D Scene Hook
  const { containerRef, loading: sceneLoading } = useAdminBoatScene({ 
    modelPath: currentModel ? currentModel.modelUrl : null 
  });

  // 获取列表数据
  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await getBoatModels();
      setModels(response.data);
      if (response.data.length > 0) {
        setCurrentModel(response.data[0]); // 默认选中第一个
      }
      message.success('模型列表已刷新');
    } catch (error) {
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
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
    fetchModels();
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
    { title: '模型大小', dataIndex: 'modelSize', key: 'modelSize', width: 120 },
    { title: '文件总数', dataIndex: 'fileCount', key: 'fileCount', width: 100 },
    { title: '存放路径', dataIndex: 'storagePath', key: 'storagePath' },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        {/* 左侧列表 */}
        <Col span={14}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={fetchModels}>刷新</Button>
                <Button icon={<UploadOutlined />} onClick={() => message.info('上传功能待实现')}>上传</Button>
                <Button icon={<DownloadOutlined />} disabled={!currentModel} onClick={() => message.info('下载功能待实现')}>下载</Button>
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete} danger>删除</Button>
              </Space>
              <Input.Search
                placeholder="按名称或类型查询..."
                onSearch={() => message.info('查询功能待实现')}
                style={{ width: 250, float: 'right' }}
              />
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

        {/* 右侧预览 */}
        <Col span={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card title="模型预览">
              <div style={{ position: 'relative', height: '300px' }}>
                {sceneLoading && sceneLoading.isLoading && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
                    <Spin size="large" description="模型加载中..." />
                  </div>
                )}
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
              </div>
            </Card>
            <Card title="船型宣传图片预览">
              {currentModel && currentModel.images.length > 0 ? (
                <Carousel autoplay>
                  {currentModel.images.map((img, index) => (
                    <div key={index}>
                      <Image width="100%" src={img} />
                    </div>
                  ))}
                </Carousel>
              ) : (
                <Empty description="暂无宣传图片" />
              )}
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
}