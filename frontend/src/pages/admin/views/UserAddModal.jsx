import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';

const { Option } = Select;

/**
 * 添加新用户的模态框表单组件。
 * @param {object} props
 * @param {boolean} props.visible - 控制模态框是否可见
 * @param {function} props.onCancel - 取消或关闭模态框时的回调
 * @param {function} props.onFinish - 表单提交成功时的回调
 * @param {boolean} props.loading - 确认按钮的加载状态
 */
const AddUserModal = ({ open, onCancel, onFinish, loading }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form
      .validateFields()
      .then(values => {
        // 将 role 字段重命名为 roleId 以匹配后端
        const postData = {
          ...values,
          roleId: values.role,
        };
        delete postData.role;
        onFinish(postData);
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  return (
    <Modal
      title="增加新用户"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnHidden // 使用新属性，并在隐藏时销毁内部组件，避免状态残留
    >
      <Form
        form={form}
        layout="vertical"
        name="addUserForm"
        initialValues={{ role: 0 }} // 默认角色为普通用户
      >
        <Form.Item
          name="userName"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名！' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label="邮箱地址"
          rules={[{ required: true, message: '请输入邮箱地址！', type: 'email' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入初始密码！' }]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="role"
          label="角色"
          rules={[{ required: true, message: '请选择一个角色！' }]}
        >
          <Select>
            <Option value={1}>管理员用户</Option>
            <Option value={0}>普通用户</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUserModal;