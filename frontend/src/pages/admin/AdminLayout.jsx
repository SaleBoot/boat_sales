import { Suspense } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';




/**
 * 后台管理界面的主布局。
 * 包含一个固定的侧边栏和一个用于渲染子路由内容的主区域。
 * 布局和样式复用自旧的 AdminPage 组件。
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();

  // NavLink 在匹配当前 URL 时会自动添加 'active' 类，我们需要适配为 'is-active'
  const getNavLinkClass = ({ isActive }) => 
    `admin-nav-button ${isActive ? 'is-active' : ''}`;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <header className="admin-sidebar-header">
          <p className="admin-kicker">Admin Console</p>
          <h1 style={{ color: '#f5f5f7' }}>京穗船舶后台管理</h1>
        </header>

        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-group">
            <p className="admin-sidebar-label">工作台</p>
            {/* 'end' 属性确保只有在路径完全匹配 /admin 时才激活 */}
            <NavLink to="/admin" end className={getNavLinkClass}>
              <span>运营看板</span>
            </NavLink>
            <NavLink to="/admin/boat-categories" className={getNavLinkClass}>
              <span>船舶类别管理</span>
            </NavLink>
            
            <NavLink to="/admin/engine" className={getNavLinkClass}>
              <span>船舶引擎型号管理</span>
            </NavLink> 
            
            <NavLink to="/admin/models" className={getNavLinkClass}>
              <span>船模管理</span>
            </NavLink>
            <NavLink to="/admin/orders" className={getNavLinkClass}>
              <span>订单管理</span>
            </NavLink>   
            <NavLink to="/admin/videos" className={getNavLinkClass}>
              <span>视频管理</span>
            </NavLink>                             
            <NavLink to="/admin/users" className={getNavLinkClass}>
              <span>用户管理</span>
            </NavLink>            
            <NavLink to="/admin/settings" className={getNavLinkClass}>
              <span>个人设置</span>
            </NavLink>
          </div>
        </nav>

        <footer className="admin-sidebar-footer">
          {user && (
            <p style={{ color: '#f5f5f7' }}> 已登录为 <strong className="text-accent">{user.email || '管理员'}</strong> </p>
          )}
          <button type="button" className="btn text" onClick={logout}>
            退出登录
          </button>
          <NavLink to="/" className="btn text admin-header-frontend-link" style={{ marginTop: '0.5rem' }}>
            返回前端首页
          </NavLink>
        </footer>
      </aside>

      <main className="admin-content">
        {/* 
          这个 header 是页面内容的通用头部，
          未来可以配合 useMatches 或其他库来动态显示面包屑导航。
        */}
        <header className="admin-page-header">
          <div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img 
              src="/img/logo.jpg" 
              alt="京穗船舶 Logo" 
              style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} 
            />
            <h2>京穗船舶</h2>
          </div>
        </header>
        
        {/* Suspense 用于处理子路由组件懒加载时的 loading 状态 */}
        <Suspense fallback={<div className="loading-pane">加载中...</div>}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  );
}