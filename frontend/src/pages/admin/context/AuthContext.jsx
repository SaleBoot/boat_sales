import { createContext, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi, logoutApi } from '../../../apis/adminApi';

// 1. 创建 Auth Context
const AuthContext = createContext(null);

/**
 * 2. 创建 AuthProvider 组件
 * 这个组件将包裹整个应用，提供登录状态和登录/登出方法。
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const isAuthenticated = useMemo(() => !!user, [user]);

  const login = async (email, password) => {
    try {
      // 调用封装好的 API 函数
      const responseData = await loginApi({ email, password });

      // 检查拦截器处理后的数据结构，提取真正的用户对象
      // 后端可能返回 { user: {...}, token: '...' }
      const userObject = responseData.user || responseData;

      if (userObject && userObject.email) {
        setUser(userObject); // 保存真正的用户信息对象
        navigate('/admin', { replace: true });
        return { success: true };
      }
      return { success: false, error: '登录失败：无法获取有效的用户数据。' };

    } catch (error) {
      // axios 拦截器抛出的错误会在这里被捕获
      return { success: false, error: error.message || '用户名或密码错误。' };
    }
  };

  const logout = async () => {
    try {
      // 调用封装好的 API 函数
      await logoutApi();
    } catch (error) {
      console.error('Logout failed', error);
    }
    setUser(null);
    navigate('/login', { replace: true });
  };

  const value = { isAuthenticated, user, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 3. 创建一个自定义 Hook
 * 这使得在其他组件中可以方便地使用 Auth Context。
 */
export function useAuth() {
  return useContext(AuthContext);
}