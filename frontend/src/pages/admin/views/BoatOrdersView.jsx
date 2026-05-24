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
  Tag,
  Descriptions,
} from 'antd';
import {
  DeleteOutlined,
  RedoOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';

// --- Mock Data and API ---
const mockOrders = Array.from({ length: 8 }, (_, i) => ({
  id: `order-${i + 1}`,
  orderNumber: `JSSB-20240524-00${i + 1}`,
  createdAt: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
  updatedAt: new Date().toISOString(),
  boatName: `豪华游艇-G${i % 3 + 1}`,
  source: ['线上官网', '线下推荐', '合作伙伴'][i % 3],
  customerName: `客户-${String.fromCharCode(65 + i)}`,
  contact: `138-xxxx-000${i}`,
  boatType: 'Yacht',
  appearance: '珍珠白',
  color: '白色',
  interior: '高级皮革',
  power: '双引擎 500hp',
  price: `${(Math.random() * 500 + 200).toFixed(2)}万`,
  options: ['GPS导航', '高级音响', '拖车'][i % 3],
  images: [
    `https://picsum.photos/seed/boat${i % 3 + 1}/400/300`,
    `https://picsum.photos/seed/boat${i % 3 + 2}/400/300`,
    `https://picsum.photos/seed/boat${i % 3 + 3}/400/300`,
  ],
}));

const getBoatOrders = async () => {
  console.log('模拟获取订单列表');
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: mockOrders }), 500);
  });
};

const deleteBoatOrders = async (ids) => {
  console.log('模拟删除订单:', ids);
  return new Promise((resolve) => setTimeout(resolve, 500));
};
// --- End Mock ---

/**
 * 订单管理视图
 */
export default function BoatOrdersView() {
  const [orders, setOrders] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await getBoatOrders();
      setOrders(response.data);
      if (response.data.length > 0) {
        setCurrentOrder(response.data[0]);
      }
      message.success('订单列表已刷新');
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的订单。');
      return;
    }
    await deleteBoatOrders(selectedRowKeys);
    message.success('删除成功');
    setSelectedRowKeys([]);
    fetchOrders();
  };
  
  const handleDownloadCSV = () => {
    const dataToExport = selectedRowKeys.length > 0
      ? orders.filter(order => selectedRowKeys.includes(order.id))
      : orders;

    if (dataToExport.length === 0) {
      message.warning('没有可导出的数据。');
      return;
    }

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'boat-orders.csv');
    message.success('CSV文件已开始下载。');
  };

  const onSelectChange = (keys) => {
    setSelectedRowKeys(keys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns = [
    { title: '订单号', dataIndex: 'orderNumber', key: 'orderNumber', width: 200, fixed: 'left' },
    { title: '船舶名称', dataIndex: 'boatName', key: 'boatName', width: 150, fixed: 'left' },
    { title: '客户姓名', dataIndex: 'customerName', key: 'customerName', width: 100 },
    { title: '联系方式', dataIndex: 'contact', key: 'contact', width: 120 },
    { title: '价格', dataIndex: 'price', key: 'price', width: 120, sorter: (a, b) => parseFloat(a.price) - parseFloat(b.price) },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100, 
      render: source => <Tag color={source === '线上官网' ? 'blue' : 'green'}>{source}</Tag>
    },
    { title: '船型', dataIndex: 'boatType', key: 'boatType', width: 100 },
    { title: '外观', dataIndex: 'appearance', key: 'appearance', width: 100 },
    { title: '颜色', dataIndex: 'color', key: 'color', width: 100 },
    { title: '内饰', dataIndex: 'interior', key: 'interior', width: 120 },
    { title: '动力', dataIndex: 'power', key: 'power', width: 150 },
    { title: '选装', dataIndex: 'options', key: 'options', width: 120 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (text) => new Date(text).toLocaleString() },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (text) => new Date(text).toLocaleString() },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button icon={<RedoOutlined />} onClick={fetchOrders}>刷新</Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadCSV}>下载为CSV</Button>
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete} danger>删除</Button>
              </Space>
              <Input.Search
                placeholder="按订单号、客户姓名等查询..."
                onSearch={() => message.info('查询功能待实现')}
                style={{ width: 250, float: 'right' }}
              />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              onRow={(record) => ({
                onClick: () => setCurrentOrder(record),
              })}
              scroll={{ x: 2000 }}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title="订单详情"
            bodyStyle={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}
          >
            {currentOrder ? (
              <div>
                {currentOrder.images && currentOrder.images.length > 0 ? (
                  <Carousel autoplay style={{ marginBottom: '16px' }}>
                    {currentOrder.images.map((img, index) => (
                      <div key={index}>
                        <Image width="100%" src={img} />
                      </div>
                    ))}
                  </Carousel>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无宣传图片" style={{ marginBottom: '16px' }} />
                )}
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="订单号">{currentOrder.orderNumber}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{new Date(currentOrder.createdAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="更新时间">{new Date(currentOrder.updatedAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="船舶名称">{currentOrder.boatName}</Descriptions.Item>
                  <Descriptions.Item label="来源"><Tag color={currentOrder.source === '线上官网' ? 'blue' : 'green'}>{currentOrder.source}</Tag></Descriptions.Item>
                  <Descriptions.Item label="客户姓名">{currentOrder.customerName}</Descriptions.Item>
                  <Descriptions.Item label="联系方式">{currentOrder.contact}</Descriptions.Item>
                  <Descriptions.Item label="船型">{currentOrder.boatType}</Descriptions.Item>
                  <Descriptions.Item label="外观">{currentOrder.appearance}</Descriptions.Item>
                  <Descriptions.Item label="颜色">{currentOrder.color}</Descriptions.Item>
                  <Descriptions.Item label="内饰">{currentOrder.interior}</Descriptions.Item>
                  <Descriptions.Item label="动力">{currentOrder.power}</Descriptions.Item>
                  <Descriptions.Item label="价格">{currentOrder.price}</Descriptions.Item>
                  <Descriptions.Item label="选装">{currentOrder.options}</Descriptions.Item>
                </Descriptions>
              </div>
            ) : (
              <Empty description="请在左侧选择一个订单以查看详情" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}