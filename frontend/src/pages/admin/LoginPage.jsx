import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DEFAULT_ADMIN_EMAIL = 'display@preview.com'

/**
 * 后台登录页面组件。
 * 结构和样式基于旧的 AdminLogin 组件。
 */
export default function LoginPage() {
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // isSubmitting 状态是必需的，以防止重复提交并提供用户反馈
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    // 假设 login 是异步的，并返回一个包含 success 和 error 的对象
    // 如果您还没有实现真实登录，可以暂时保持同步逻辑
    try {
      const result = await login(email, password);
      if (!result || !result.success) {
        setError(result?.error || '用户名或密码错误，请重试。');
      }
    } catch (e) {
      setError(e.message || '发生未知错误。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-auth-shell">
      <section className="admin-auth-card">
        <header className="admin-auth-header">
          <p className="admin-kicker">Admin Console</p>
          <h1>京穗船舶后台管理</h1>
          <p className="admin-auth-copy">
            这里是完整的模型上传与贴图应用入口。登录后可以上传模型、查看材质槽、标记贴图通道、同步资源并检查订单。
          </p>
        </header>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span>管理员邮箱</span>
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={DEFAULT_ADMIN_EMAIL}
              autoComplete="username"
              required
            />
          </label>

          <label className="admin-field">
            <span>密码</span>
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入后台密码"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="admin-actions">
            <button type="submit" className="btn primary" disabled={isSubmitting}>
              {isSubmitting ? '登录中...' : '登录后台'}
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button 
            type="button" 
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#1677ff',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            返回前端首页
          </button>
        </div>

        {error && (
          <section className="admin-notice error">
            <p>{error}</p>
          </section>
        )}
      </section>
    </div>
  );
}