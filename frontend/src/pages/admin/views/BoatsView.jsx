import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Input,
  Space,
  message,
  Row,
  Col,
  Card,
  Descriptions,
  Carousel,
  Image,
  Empty,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, RedoOutlined } from '@ant-design/icons';
import { getBoats, addBoat, deleteBoats } from '../../../apis/adminApi';
import AddBoatModal from './BoatAddModal.jsx';

/**
 * 船舶管理视图
 */
export default function BoatsView() {
  const [boats, setBoats] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentBoat, setCurrentBoat] = useState(null); // 用于右侧详情显示
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取船舶列表
  const fetchBoats = async () => {
    setLoading(true);
    try {
      // 真实的API调用
      const response = await getBoats({ q: searchText });
      const boatsData = response.data || [];
      setBoats(boatsData);
      if (boatsData.length > 0) {
        setCurrentBoat(boatsData[0]); // 默认显示第一条详情
      }
      message.success('船舶列表已刷新');
    } catch (error) {
      message.error('获取船舶列表失败');
      console.error("Failed to fetch boats:", error);
      const mockBoats = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        chineseName: `泰坦尼克号 ${i + 1}`,
        englishName: `Titanic ${i + 1}`,
        type: '豪华邮轮',
        overallLength: '269.1m',
        waterlineLength: '260m',
        beam: '28m',
        moldedDepth: '19m',
        draft: '10.5m',
        navigationArea: '全球',
        mainEnginePower: '46000 hp',
        designSpeed: '23节',
        ratedCrew: 3547,
        propulsionType: '蒸汽轮机',
        material: '钢',
        certificateType: 'SOLAS',
        images: [
          `https://picsum.photos/seed/boat-a-${i}/400/300`,
          `https://picsum.photos/seed/boat-b-${i}/400/300`,
        ],
      }));
      setBoats(mockBoats);
      if (mockBoats.length > 0) {
        setCurrentBoat(mockBoats[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  // 在组件加载时获取数据
  useEffect(() => {
    fetchBoats();
  }, []);

  // 处理行选择变化的函数
  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
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
      fetchBoats(); // 重新获取列表
      setSelectedRowKeys([]); // 清空选择
    } catch (error) {
      message.error('删除船舶失败');
      console.error("Failed to delete boats:", error);
    }
  };

  // 处理新增船舶表单的提交
  const handleAddFinish = async (values) => {
    console.log("新增船舶信息:", values);
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
  
  const handleSearch = (value) => {
    setSearchText(value);
    // 在实际应用中，fetchBoats 应该接收 searchText 作为参数
    fetchBoats();
  }

  // 表格列的定义
  const columns = [
    { title: '船舶中文名称', dataIndex: 'chineseName', key: 'chineseName', width: 150 },
    { title: '船舶英文名称', dataIndex: 'englishName', key: 'englishName', width: 150 },
    { title: '船舶类型', dataIndex: 'type', key: 'type', width: 120 },
    { title: '总长', dataIndex: 'overallLength', key: 'overallLength', width: 100 },
    { title: '水线长', dataIndex: 'waterlineLength', key: 'waterlineLength', width: 100 },
    { title: '船宽', dataIndex: 'beam', key: 'beam', width: 100 },
    { title: '型深', dataIndex: 'moldedDepth', key: 'moldedDepth', width: 100 },
    { title: '吃水', dataIndex: 'draft', key: 'draft', width: 100 },
    { title: '航区', dataIndex: 'navigationArea', key: 'navigationArea', width: 100 },
    { title: '主机功率', dataIndex: 'mainEnginePower', key: 'mainEnginePower', width: 120 },
    { title: '设计航速', dataIndex: 'designSpeed', key: 'designSpeed', width: 100 },
    { title: '额定乘员', dataIndex: 'ratedCrew', key: 'ratedCrew', width: 100 },
    { title: '动力形式', dataIndex: 'propulsionType', key: 'propulsionType', width: 120 },
    { title: '材质', dataIndex: 'material', key: 'material', width: 100 },
    { title: '证书类型', dataIndex: 'certificateType', key: 'certificateType', width: 120 },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        {/* 左侧列表 */}
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={fetchBoats}>刷新列表</Button>
                <Button icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>增加</Button>
                <Button icon={<DeleteOutlined />} onClick={handleDelete} disabled={selectedRowKeys.length === 0} danger>删除</Button>
              </Space>
              <Input.Search
                placeholder="查询船舶..."
                onSearch={handleSearch}
                style={{ width: 300 }}
                enterButton
              />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={boats}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1800 }}
              pagination={{ pageSize: 10 }}
              onRow={(record) => ({
                onClick: () => setCurrentBoat(record),
              })}
            />
          </Card>
        </Col>

        {/* 右侧详情 */}
        <Col span={8}>
          <Card 
            title="船舶详情"
            styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' } }}
          >
            {currentBoat ? (
              <div>
                {currentBoat.images && currentBoat.images.length > 0 ? (
                  <Carousel autoplay style={{ marginBottom: '16px' }}>
                    {currentBoat.images.map((img, index) => (
                      <div key={index}><Image width="100%" src={img} /></div>
                    ))}
                  </Carousel>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无宣传图片" style={{ marginBottom: '16px' }} />
                )}
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="中文名称">{currentBoat.chineseName}</Descriptions.Item>
                  <Descriptions.Item label="英文名称">{currentBoat.englishName}</Descriptions.Item>
                  <Descriptions.Item label="船舶类型">{currentBoat.type}</Descriptions.Item>
                  <Descriptions.Item label="总长">{currentBoat.overallLength}</Descriptions.Item>
                  <Descriptions.Item label="水线长">{currentBoat.waterlineLength}</Descriptions.Item>
                  <Descriptions.Item label="船宽">{currentBoat.beam}</Descriptions.Item>
                  <Descriptions.Item label="型深">{currentBoat.moldedDepth}</Descriptions.Item>
                  <Descriptions.Item label="吃水">{currentBoat.draft}</Descriptions.Item>
                  <Descriptions.Item label="航区">{currentBoat.navigationArea}</Descriptions.Item>
                  <Descriptions.Item label="主机功率">{currentBoat.mainEnginePower}</Descriptions.Item>
                  <Descriptions.Item label="设计航速">{currentBoat.designSpeed}</Descriptions.Item>
                  <Descriptions.Item label="额定乘员">{currentBoat.ratedCrew}</Descriptions.Item>
                  <Descriptions.Item label="动力形式">{currentBoat.propulsionType}</Descriptions.Item>
                  <Descriptions.Item label="材质">{currentBoat.material}</Descriptions.Item>
                  <Descriptions.Item label="证书类型">{currentBoat.certificateType}</Descriptions.Item>
                </Descriptions>
              </div>
            ) : (
              <Empty description="请在左侧选择一艘船以查看详情" />
            )}
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