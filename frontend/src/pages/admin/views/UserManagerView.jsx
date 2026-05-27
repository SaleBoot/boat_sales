import React, { useState, useMemo, useEffect } from 'react';
import { Button, Table, Input, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, RedoOutlined } from '@ant-design/icons';
import { getUsers, addUser, deleteUsers } from '../../../apis/adminApi';
import AddUserModal from './UserAddModal';


/**
 * 用户管理视图，提供用户列表的增删改查功能。
 * 界面风格参考了 Gmail，分为操作栏和内容列表区。
 */
export default function UserManagerView() {
  const [users, setUsers] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsers();
      console.log("获取到的用户列表数据:", response);
      setUsers(response);
    } catch (error) {
      message.error('获取用户列表失败');
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  // 在组件加载时获取用户数据
  useEffect(() => {
    fetchUsers();
  }, []);

  // 处理行选择变化的函数
  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  // 刷新用户列表
  const handleGetUserList = () => {
    fetchUsers();
  };

  // 删除选定用户
  const handleDeleteUsers = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的用户。');
      return;
    }
    try {
      await deleteUsers(selectedRowKeys);
      message.success('用户删除成功');
      fetchUsers(); // 重新获取用户列表
      setSelectedRowKeys([]); // 清空选择
    } catch (error) {
      message.error('删除用户失败');
      console.error("Failed to delete users:", error);
    }
  };

  // 处理新增用户表单的提交
  const handleAddUserFinish = async (values) => {
    setIsSubmitting(true);
    try {
      await addUser(values);
      message.success('用户添加成功');
      setIsModalVisible(false); // 关闭模态框
      fetchUsers(); // 重新获取用户列表
    } catch (error) {
      message.error(error.message || '添加用户失败');
      console.error("Failed to add user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 根据搜索文本过滤用户
  const filteredUsers = useMemo(() => {
    if (!searchText) {
      return users;
    }
    return users.filter(user => {
      const roleText = user.roleId === 1 ? '管理员用户' : '普通用户';
      return (
        (user.userName || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchText.toLowerCase()) ||
        roleText.toLowerCase().includes(searchText.toLowerCase())
      );
    });
  }, [users, searchText]);

  // 表格列的定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: '邮箱地址',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'roleId',
      key: 'role',
      render: (roleId) => (roleId === 1 ? '管理员用户' : '普通用户'),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      {/* 操作栏 */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<RedoOutlined />} onClick={handleGetUserList}>
            刷新列表
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            增加
          </Button>
          <Button
            icon={<DeleteOutlined />}
            onClick={handleDeleteUsers}
            disabled={selectedRowKeys.length === 0}
            danger
          >
            删除
          </Button>
        </Space>
        <Input
          placeholder="查找用户..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      {/* 用户列表 */}
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={filteredUsers}
        rowKey="ID"
        pagination={{ pageSize: 10 }}
        loading={loading}
      />

      <AddUserModal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onFinish={handleAddUserFinish}
        loading={isSubmitting}
      />
    </div>
  );
}