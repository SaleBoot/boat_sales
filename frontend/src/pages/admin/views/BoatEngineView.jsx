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
  Select,
  InputNumber
} from 'antd';
import { PlusOutlined, RedoOutlined } from '@ant-design/icons';
import { getBoatEngines, addBoatEngine, updateBoatEngine, deleteBoatEngines } from '../../../apis/adminApi';
import { BOAT_ENGINE_CATEGORY_OPTIONS } from '../../../constants/constants_common.js'

// 公共时间格式化方法
const formatTime = (text) => {
  if (!text) return '';
  const safeDate = text.substring(0, 23);
  return new Date(safeDate).toLocaleString();
};

const BoatEngineView = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 1. 监听引擎类别变化
  const engineCategory = Form.useWatch('engineCategoryID', form);
  // 获取列表数据（支持分页参数）
  const fetchBoatEngines = async (params = {}) => {
    setLoading(true);
    try {
      const reqParams = {
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...params,
      };
      const response = await getBoatEngines(reqParams);
      console.log('Fetched boat-engines:', response);


      setData(response.list || response);
      // 优先使用后端返回 total，无则取数组长度
      const total = response.total ?? response.length;
      setPagination(prev => ({ ...prev, current: reqParams.page, pageSize: reqParams.pageSize, total }));
      message.success('列表刷新成功！');
    } catch (error) {
      console.error('Failed to fetch boat engines:', error);
      message.error('获取船舶引擎列表失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoatEngines();
  }, []);

  // 新增
  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  // 编辑
  const handleEdit = (record) => {
    setEditingItem(record);
    // 直接回填原始字段，无需转换
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  // 批量删除
  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的条目。');
      return;
    }
    setLoading(true);
    try {
      await deleteBoatEngines(selectedRowKeys);
      message.success('删除成功！');
      setSelectedRowKeys([]);
      fetchBoatEngines(); // Refresh data
    } catch (error) {
      console.error('Failed to delete boat engines:', error);
      message.error('删除船舶引擎失败。');
    } finally {
      setLoading(false);
    }
  };

  // 弹窗确定（新增/编辑）
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editingItem) {
        //  调用正确的引擎更新接口
        await updateBoatEngine(editingItem.ID, values);
        message.success('修改成功！');
      } else {
        // 新增
        await addBoatEngine(values);
        message.success('增加成功！');
      }
      setIsModalVisible(false);
      fetchBoatEngines(); // Refresh data
    } catch (error) {
      console.error('Failed to save boat engine:', error);
      message.error('保存船舶引擎失败。');
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

  // StrID -> Label 映射，用于表格翻译
  const categoryMap = {};
  BOAT_ENGINE_CATEGORY_OPTIONS.forEach(item => {
    categoryMap[item.StrID] = item.Label;
  });

  // 表格列：dataIndex 严格对应后端原始字段
  const columns = [
    {
      title: '引擎类别',
      dataIndex: 'engineCategoryID',
      key: 'engineCategoryID',
      render: (strId) => {
        // 匹配 Label，找不到则显示 未知
        return categoryMap[strId] || '未知';
      }      
    },
    { title: '引擎型号名称', dataIndex: 'engineName',  key: 'engineName'},
    { title: '额定功率(kW)', dataIndex: 'powerKW', key: 'powerKW'  },
    { title: '电池容量(kWh)', dataIndex: 'batteryKWh', key: 'batteryKWh'},
    { title: '燃油排量(L)', dataIndex: 'displacement', key: 'displacement'  },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '创建时间', dataIndex: 'CreatedAt',  key: 'CreatedAt', render: formatTime },
    { title: '修改时间', dataIndex: 'UpdatedAt', key: 'UpdatedAt', render: formatTime},
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

    // 分页切换
  const onPageChange = (page, pageSize) => {
    fetchBoatEngines({ page, pageSize });
  };

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<RedoOutlined />} onClick={() => fetchBoatEngines()}>
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
        <Button onClick={handleSearch}>查询</Button>
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
          onChange: onPageChange,
          showSizeChanger: true,
        }}
        onRow={(record) => ({
          onDoubleClick: () => handleEdit(record),
        })}
      />
      <Modal
        title={editingItem ? '修改船舶引擎型号' : '增加船舶引擎型号'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" name="boatEngineForm">
          {/* 引擎类别 */}
          <Form.Item
            name="engineCategoryID"
            label="引擎类别"
            rules={[{ required: true, message: '请选择引擎类别' }]}
          >
            <Select placeholder="请选择引擎类别">
              {BOAT_ENGINE_CATEGORY_OPTIONS.map(option => (
                <Select.Option key={option.StrID} value={option.StrID}>
                  {option.Label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* 引擎名称 */}
          <Form.Item
            name="engineName"
            label="引擎型号名称"
            rules={[
              { required: true, message: '请输入引擎型号名称' },
              { pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/,  
                message: '只能输入中文、字母、数字和下划线，禁止输入空格' 
              },
            ]}
          >
            <Input />
          </Form.Item>

          {/* 额定功率：改用数字输入框 */}
          <Form.Item
            name="powerKW"
            label="额定功率(kW)"
            rules={[{ required: true, message: '请输入额定功率(kW)' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>

          {/* 电池容量 */}
          <Form.Item
            name="batteryKWh"
            label="电池容量(kWh)"
            rules={[{ required: true, message: '请输入电池容量(kWh)' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={0.01}
              // 假设燃油类 StrID：diesel / gasoline，根据你实际枚举修改
              disabled={engineCategory === 'diesel' || engineCategory === 'gasoline'}
              value={engineCategory === 'diesel' || engineCategory === 'gasoline' ? 0 : undefined}
              onChange={(val) => {
                // 选中燃油时强制赋值为 0
                if (engineCategory === 'diesel' || engineCategory === 'gasoline') {
                  form.setFieldValue('batteryKWh', 0.0);
                }
              }}
            />
          </Form.Item>

          {/* 排量 */}
          <Form.Item name="displacement" label="燃油排量(L)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} 
              disabled={engineCategory === 'electric'}
              value={engineCategory === 'electric' ? 0 : undefined}
              onChange={(val) => {
                if (engineCategory === 'electric') {
                  form.setFieldValue('displacement', 0.0);
                }
              }}
            />
          </Form.Item>

          {/* 描述 */}
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BoatEngineView;