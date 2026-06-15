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

import { 
  getBoatEngineCategoryLabelByID,
  getSalesOrderStatusLabelByID 
} from '../../../constants/constants_common';

import {  
  getSalesOrders, 
  deleteSalesOrders, 
  getSaleOrdersByContact 
} from '../../../../src/apis/adminApi';

/**
 * 订单管理视图
 */
export default function BoatOrdersView() {
  const [orders, setOrders] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const fetchOrders = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await getSalesOrders({ page, pageSize });
      console.log('获取订单列表响应:', response);    
        
      setOrders(response.list);
      setPagination({
        current: response.page,
        pageSize: response.pageSize,
        total: response.total,
      });
      if (response.list.length > 0) {
        setCurrentOrder(response.list[0]);
      } else {
        setCurrentOrder(null);
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
    await deleteSalesOrders(selectedRowKeys);
    message.success('删除成功');
    setSelectedRowKeys([]);
    fetchOrders(pagination.current, pagination.pageSize);
  };

  const handleSearch = async (value) => {
    if (!value) {
      message.warning('请输入客户联系方式进行查询。');
      fetchOrders(); // 如果搜索框为空，则重新加载所有订单
      return;
    }
    setLoading(true);
    try {
      // 调用新的API函数进行查询
      const response = await getSaleOrdersByContact(value);
      console.log('按联系方式获取订单列表响应:', response);

      setOrders(response.list);
      setPagination({
        current: 1, // 搜索后重置为第一页
        pageSize: pagination.pageSize,
        total: response.list.length, // 搜索结果的总数
      });
      message.success(`已找到 ${response.list.length} 条相关订单。`);
    } catch (error) {
      message.error('查询订单失败。');
    } finally {
      setLoading(false);
    }
  };

  
  const handleDownloadCSV = () => {
    const dataToExport = selectedRowKeys.length > 0
      ? orders.filter(order => selectedRowKeys.includes(order.ID))
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
    { title: '订单号', dataIndex: 'ID', key: 'ID', width: 100, fixed: 'left' }, 
    { 
      title: '状态',  dataIndex: 'status',  key: 'status',  width: 100, fixed: 'left',
      render: status => {
        let color = 'default'; 
        
        if (status === 'finished') {
          color = 'success';
        } else if (status === 'processing') {
          color = 'warning';
        } else if (status === 'new') {
          color = 'processing';
        }
        const statusLabel = getSalesOrderStatusLabelByID(status);
        return <Tag color={color}>{statusLabel}</Tag>;
      }
    },    
    { title: '船型ID', dataIndex: 'modelID', key: 'modelID', width: 100, fixed: 'left' },    
    { title: '船型名称', dataIndex: 'modelLabel', key: 'modelLabel', width: 150, fixed: 'left' },
    { title: '船舶分类', dataIndex: 'category', key: 'category', width: 100 },    

    { title: '客户姓名', dataIndex: 'customerName', key: 'customerName', width: 100 },
    { title: '联系方式', dataIndex: 'customerContact', key: 'customerContact', width: 120 },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100, 
      render: source => <Tag color={source === '线上官网' ? 'blue' : 'green'}>{source}</Tag>
    },  
    { title: '外观颜色', dataIndex: 'exteriorColor', key: 'exteriorColor', width: 100 },
    { title: '甲板颜色', dataIndex: 'deckColor', key: 'deckColor', width: 100 },
    { title: '内饰颜色', dataIndex: 'interiorColor', key: 'interiorColor', width: 120 },
    
    { title: '发动机分类', dataIndex: 'engineCategoryID', key: 'engineCategoryID', width: 150, 
      render: engineCategoryID => getBoatEngineCategoryLabelByID(engineCategoryID)  
    }, 
    { title: '发动机名称', dataIndex: 'engineName', key: 'engineName', width: 150 },
    { title: '总价', dataIndex: 'totalPrice', key: 'totalPrice', width: 120, 
      sorter: (a, b) => parseFloat(a.totalPrice) - parseFloat(b.totalPrice), 
      render: (text) => `¥${text}` },   
    // { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (text) => new Date(text).toLocaleString() }, // 后端返回的createdAt是时间戳
    // { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (text) => new Date(text).toLocaleString() }, // 后端返回的updatedAt是时间戳
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Space> 
                <Button icon={<RedoOutlined />} onClick={() => fetchOrders()}>刷新</Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadCSV}>下载为CSV</Button>
                <Button icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete} danger>删除</Button>
              </Space>
              <Input.Search
                placeholder="按客户联系方式查询..."
                onSearch={value => handleSearch(value)}
                style={{ width: 250, float: 'right' }}
              />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={orders}
              rowKey="ID"
              loading={loading}
              onRow={(record) => ({
                onClick: () => setCurrentOrder(record),
              })}
              scroll={{ x: 2000 }}
              pagination={{
                ...pagination,
                showSizeChanger: true, // 允许用户改变每页显示条数
                pageSizeOptions: ['5','10', '20', '50', '100'], // 可选的每页条数                
                onChange: (page, pageSize) => fetchOrders(page, pageSize),
              }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title="订单详情"
            styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' } }}
          >
            {currentOrder ? (
              <div>
                {currentOrder.adImgs && currentOrder.adImgs.length > 0 ? (
                  <Carousel autoplay style={{ marginBottom: '16px' }}>
                    {currentOrder.adImgs.map((img, index) => (
                      <div key={index}>
                        <Image width="100%" src={img} />
                      </div>
                    ))}
                  </Carousel>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无宣传图片" style={{ marginBottom: '16px' }} />
                )}
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="订单号">{currentOrder.ID}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={currentOrder.status === '已完成' ? 'success' : currentOrder.status === '跟进中' ? 'warning' : 'processing'}>
                      {getSalesOrderStatusLabelByID(currentOrder.status)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">{new Date(currentOrder.createAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="更新时间">{new Date(currentOrder.updatedAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="船型名称">{currentOrder.modelLabel}</Descriptions.Item>
                  <Descriptions.Item label="船型ID">{currentOrder.modelID}</Descriptions.Item>
                  <Descriptions.Item label="船舶分类">{currentOrder.category}</Descriptions.Item>                  
                  <Descriptions.Item label="客户姓名">{currentOrder.customerName}</Descriptions.Item>
                  <Descriptions.Item label="联系方式">{currentOrder.customerContact}</Descriptions.Item>
                  <Descriptions.Item label="来源">
                    <Tag color={currentOrder.source === '线上官网' ? 'blue' : 'green'}>
                      {currentOrder.source}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="外观颜色">{currentOrder.exteriorColor}</Descriptions.Item>
                  <Descriptions.Item label="内饰颜色">{currentOrder.interiorColor}</Descriptions.Item>
                  <Descriptions.Item label="甲板颜色">{currentOrder.deckColor}</Descriptions.Item>
                  <Descriptions.Item label="发动机分类">
                    {getBoatEngineCategoryLabelByID(currentOrder.engineCategoryID)}
                  </Descriptions.Item>
                  <Descriptions.Item label="发动机名称">{currentOrder.engineName}</Descriptions.Item>
                  <Descriptions.Item label="总价">¥{currentOrder.totalPrice}</Descriptions.Item>
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