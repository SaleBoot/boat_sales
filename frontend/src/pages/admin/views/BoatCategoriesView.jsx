import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, RedoOutlined } from '@ant-design/icons';
import { getBoatCategories, addBoatCategory, updateBoatCategory, deleteBoatCategories } from '../../../apis/adminApi';

const initialData = [
    { id: 1, englishName: 'New Energy Ship', chineseName: '新能源船', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { id: 2, englishName: 'Emergency Rescue Ship', chineseName: '应急救援船', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { id: 3, englishName: 'Official Law Enforcement Boat', chineseName: '公务执法艇', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { id: 4, englishName: 'Yacht', chineseName: '游艇', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:0<PASSWORD>Z' },
];

const BoatCategoriesView = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 2, // 设置一个较小的页面大小以便观察分页器
    total: 0,
  });

  const fetchBoatCategories = async (params = {}) => {
    setLoading(true);
    try {
      const response = await getBoatCategories({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...params,
      });
      setData(response.data);
      setPagination(prev => ({ ...prev, total: response.total || response.data.length })); // 假设后端返回总数
      message.success('列表刷新成功！');
    } catch (error) {
      console.error('Failed to fetch boat categories:', error);
      message.error('获取船舶类型列表失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoatCategories();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的条目。');
      return;
    }
    setLoading(true);
    try {
      await deleteBoatCategories(selectedRowKeys);
      message.success('删除成功！');
      setSelectedRowKeys([]);
      fetchBoatCategories(); // Refresh data
    } catch (error) {
      console.error('Failed to delete boat categories:', error);
      message.error('删除失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editingItem) {
        // 更新
        await updateBoatCategory(editingItem.id, values);
        message.success('修改成功！');
      } else {
        // 新增
        await addBoatCategory(values);
        message.success('增加成功！');
      }
      setIsModalVisible(false);
      fetchBoatCategories(); // Refresh data
    } catch (error) {
      console.error('Failed to save boat category:', error);
      message.error('保存失败。');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const onSelectChange = (keys) => {
    setSelectedRowKeys(keys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const columns = [
    {
      title: '船舶类型英文名',
      dataIndex: 'englishName',
      key: 'englishName',
    },
    {
      title: '船舶类型中文名',
      dataIndex: 'chineseName',
      key: 'chineseName',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '修改时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <a onClick={() => handleEdit(record)}>编辑</a>
        </Space>
      ),
    },
  ];

  const handleSearch = () => {
    // TODO: Implement search functionality
    message.info('查询功能待实现。');
  };

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          增加
        </Button>
        <Popconfirm
          title={`确定要删除选中的 ${selectedRowKeys.length} 个条目吗？`}
          onConfirm={handleDelete}
          disabled={selectedRowKeys.length === 0}
        >
          <Button type="primary" danger disabled={selectedRowKeys.length === 0}>
            删除
          </Button>
        </Popconfirm>
        <Button icon={<RedoOutlined />} onClick={fetchBoatCategories}>
          刷新列表
        </Button>
        <Button onClick={handleSearch}>
          查询
        </Button>
      </Space>
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize: pageSize });
            // 如果需要后端分页，可以在这里调用 fetchBoatCategories({ page, pageSize });
          },
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            handleEdit(record);
          },
        })}
      />
      <Modal
        title={editingItem ? '修改船舶类型' : '增加船舶类型'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" name="boatCategoryForm">
          <Form.Item
            name="englishName"
            label="船舶类型英文名"
            rules={[{ required: true, message: '请输入船舶类型英文名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="chineseName"
            label="船舶类型中文名"
            rules={[{ required: true, message: '请输入船舶类型中文名' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BoatCategoriesView;