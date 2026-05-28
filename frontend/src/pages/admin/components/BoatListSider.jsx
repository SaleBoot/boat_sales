import React from 'react';
import { Card, Button, Space, Select, Table, ConfigProvider, theme } from 'antd';
import { RedoOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const BoatListSider = ({
  loading,
  boats,
  boatCategories,
  selectedRowKeys,
  onRefresh,
  onAdd,
  onDelete,
  onCategoryChange,
  onSelectChange,
  onRowClick,
}) => {
  const columns = [
    { title: '船名', dataIndex: 'boatName', key: 'boatName', width: 150 },
    { title: '模型名', dataIndex: 'modelName', key: 'modelName', width: 150 },
    {
      title: '船舶类型',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      // Note: The mapping logic will be handled in the parent component
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const { compactAlgorithm } = theme;

  return (
    <ConfigProvider theme={{ algorithm: compactAlgorithm }}>
      <Card title="船舶列表">
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<RedoOutlined />} onClick={onRefresh}>刷新</Button>
            <Button icon={<PlusOutlined />} onClick={onAdd}>增加</Button>
            <Button icon={<DeleteOutlined />} onClick={onDelete} disabled={selectedRowKeys.length === 0} danger>删除</Button>
          </Space>
        </div>
        <Select
          placeholder="按船舶类型查询..."
          style={{ width: '100%', marginBottom: 16 }}
          onChange={onCategoryChange}
          onClear={() => onCategoryChange(null)}
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
            onClick: () => onRowClick(record),
          })}
          scroll={{ y: 'calc(100vh - 400px)' }}
        />
      </Card>
    </ConfigProvider>
  );
};

export default BoatListSider;