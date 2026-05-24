import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * 路由守卫组件。
 * 用于保护需要登录才能访问的后台页面。
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth(); // 从 AuthContext 中获取 isAuthenticated 状态。
  const location = useLocation();

  if (!isAuthenticated) {
    // 如果用户未登录：
    // 1. 重定向到 /login 页面。
    // 2. 使用 `replace` 来替换历史记录，防止用户通过后退按钮回到受保护的页面。
    // 3. 将用户原本想访问的路径 (location) 存储在 state 中，
    //    以便登录成功后可以跳转回来。
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果用户已登录，则直接渲染他们想要访问的子组件 (例如 AdminLayout)。
  return children;
}