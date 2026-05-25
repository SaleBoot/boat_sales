import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Col, Row } from 'antd';
import { useAuth } from '../context/AuthContext';
import { getUserByEmail, updateUserByEmail } from '../../../apis/adminApi';

const { Option } = Select;

// 模拟从API获取当前用户信息的函数
// const fetchCurrentUser = async (user) => {
//   // 在实际应用中，这里会是一个API调用
//   // 'user' from AuthContext might not have all details, so we might fetch more here.
//   console.log('Fetching user details for:', user.email);
//   return Promise.resolve({
//     username: user.Username || user.username || 'Admin User',
//     email: user.email,
//     role: user.role || 'admin', // 默认角色
//   });
// };

// 模拟更新用户信息的API函数
// const updateUserSettings = async (values) => {
//   // 在实际应用中，这将向后端发送一个PATCH或PUT请求
//   console.log('Updating user settings with:', values);
//   return new Promise(resolve => setTimeout(() => {
//     resolve({ success: true });
//   }, 1000));
// };


export default function UserSetting() {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleOptions = [
    { id: 'regularUser', name: '普通用户' },
    { id: 'admin', name: '管理员' },
  ];

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user || !user.email) return;

      setLoading(true);
      try {
        const data = await getUserByEmail(user.email);
        form.setFieldsValue({
          username: data.Username || data.username,
          email: data.email,
          role: data.roleId === 1 ? 'admin' : 'regularUser',
        });
      } catch (error) {
        message.error('无法加载用户信息');
      } finally {
        setLoading(false);
      }
    };
    loadUserProfile();
  }, [user, form]);

  const onFinish = async (values) => {
    if (!user || !user.email) {
      message.error('无法获取当前用户信息，请重新登录。');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        username: values.username,
      };
      // 只有在输入了新密码时才更新密码
      if (values.password) {
        updateData.password = values.password;
      }
      console.log("updateUserByEmail个人信息更新",updateData);
      await updateUserByEmail(user.email, updateData);
      message.success('个人信息更新成功！');
      // 清空密码字段
      form.resetFields(['password', 'confirmPassword']);
    } catch (error) {
      message.error(error.message || '更新个人信息时发生错误。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <Row>
        <Col xs={24} sm={24} md={16} lg={12} xl={10}>
          <Card title="个人信息设置" loading={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入您的用户名' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱地址"
              >
                <Input disabled />
              </Form.Item>

              <Form.Item
                name="role"
                label="角色"
              >
                <Select disabled>
                  {roleOptions.map(role => (
                    <Option key={role.id} value={role.id}>
                      {role.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="password"
                label="新密码 (如不修改请留空)"
                rules={[
                  {
                    min: 12,
                    message: '密码长度不能少于12个字符',
                  },
                ]}
              >
                <Input.Password placeholder="请输入新密码" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['password']}
                hasFeedback
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isSubmitting}>
                  保存更改
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}