// 这个文件定义所有后台管理页面的路由。
import { lazy } from 'react';
import ProtectedRoute from '../pages/admin/context/ProtectedRoute';
import AdminLayout from '../pages/admin/AdminLayout';

// 懒加载页面组件
const LoginPage = lazy(() => import('../pages/admin/LoginPage'));
const DashboardView = lazy(() => import('../pages/admin/views/DashboardView'));
const UserManagerView = lazy(() => import('../pages/admin/views/UserManagerView'));
const BoatModelsView = lazy(() => import('../pages/admin/views/BoatModelsView')); // 新增
const BoatCategoriesView = lazy(() => import('../pages/admin/views/BoatCategoriesView'));
const UserSetting = lazy(() => import('../pages/admin/views/UserSetting.jsx'));
const BoatOrdersView = lazy(() => import('../pages/admin/views/BoatOrdersView.jsx'));
const VideoManagerView = lazy(() => import('../pages/admin/views/VideoManagerView.jsx'));

const adminRoutes = [
  // 1. 公共路由：登录页面
  {
    path: '/login',
    element: <LoginPage />,
  },
  // 2. 受保护的路由组：后台管理界面
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    // AdminLayout 内部的 <Outlet> 将渲染这里的 children
    children: [
      // 默认子路由，访问 /admin 时直接显示仪表盘
      {
        index: true,
        element: <DashboardView />,
      },
      // 为未来的功能模块规划路由
      {
        path: 'users',
        element: <UserManagerView />,
      },
      {
        path: 'boat-categories',
        element: <BoatCategoriesView />,
      },      
      // {
      //   path: 'boats',
      //   element: <BoatsView />,
      // },
      {
        path: 'models',
        element: <BoatModelsView />,
      },

      {
        path: 'settings',
        element: <UserSetting />,
      },
      {
        path: 'orders',
        element: <BoatOrdersView />,
      },
      {
        path: 'videos',
        element: <VideoManagerView />,
      },
      // ... 其他模块
    ],
  },
];

export default adminRoutes;