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
    { ID: 1, CategoryStrID: "NewEnergy", EnName: "New Energy", CnName: "新能源船", createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { ID: 2, CategoryStrID: "EmergencyRescue", EnName: "Emergency Rescue", CnName: "应急救援船", createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { ID: 3, CategoryStrID: "OfficialEnforcement", EnName: "Official Law Enforcement", CnName: "公务执法艇", createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { ID: 4, CategoryStrID: "Yacht", EnName: "Yacht", CnName: "游艇", createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
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
    pageSize: 8, // 设置一个较小的页面大小以便观察分页器
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
      console.log('Fetched boat categories:', response);
      
      // 强制将 'id', 'Id', 'iD', 'ID' 等统一转换成 'ID'
      const normalizedData = response.map((item) => ({
        // 按照优先级，用 ?? 一路“或者”过去
        ID: item.id ?? item.Id ?? item.iD ?? item.ID,
        CategoryStrID: item.categoryStrID,
        EnName: item.enName,
        CnName: item.cnName,
        CreatedAt: item.CreatedAt,
        UpdatedAt: item.UpdatedAt,
      }));
      console.log("normalizedData = ",normalizedData)
      setData(normalizedData); 
      // 假设后端返回的数据就是当前页的全部数据，用其长度作为 total
      // 注意：如果后端支持返回总数，这里的逻辑需要调整
      setPagination(prev => ({ ...prev, total: normalizedData.length }));
      message.success('列表刷新成功！');
    } catch (error) {
      console.error('Failed to fetch boat categories:', error);
      message.error('获取船舶类别列表失败。');
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
        await updateBoatCategory(editingItem.ID, values);
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
      title: '类别ID',
      dataIndex: 'CategoryStrID',
      key: 'categoryStrID',
    },
    {
      title: '英文名称',
      dataIndex: 'EnName',
      key: 'enName',
    },
    {
      title: '中文名称',
      dataIndex: 'CnName',
      key: 'cnName',
    },
    {
      title: '创建时间',
      dataIndex: 'CreatedAt',
      key: 'createdAt',
      render: (text) => {
        if (!text) return '';
        // 后端返回的日期可能包含纳秒，JS Date不完全支持，截断到毫秒
        const safeDate = text.substring(0, 23);
        return new Date(safeDate).toLocaleString();
      },
    },
    {
      title: '修改时间',
      dataIndex: 'UpdatedAt',
      key: 'updatedAt',
      render: (text) => {
        if (!text) return '';
        const safeDate = text.substring(0, 23);
        return new Date(safeDate).toLocaleString();
      },
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
        <Button icon={<RedoOutlined />} onClick={fetchBoatCategories}>
          刷新列表
        </Button>      

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
        
        <Button onClick={handleSearch}>
          查询
        </Button>
      </Space>
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="ID"
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
        title={editingItem ? '修改船舶类别' : '增加船舶类别'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" name="boatCategoryForm">
          <Form.Item
            name="CategoryStrID"
            label="类别ID"
            rules={[
              { required: true, message: '请输入类别ID' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '只能输入字母、数字和下划线' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="EnName"
            label="英文名称"
            rules={[
              { required: true, message: '请输入英文名称' },
              { pattern: /^[a-zA-Z0-9_ ]+$/, message: '只能输入字母、空格、数字和下划线' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="CnName"
            label="中文名称"
            rules={[{ required: true, message: '请输入中文名称' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BoatCategoriesView;