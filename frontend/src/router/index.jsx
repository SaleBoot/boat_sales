// 这个文件是路由的入口，它会整合所有路由配置，并使用 react-router-dom 的 createBrowserRouter 来创建路由实例。

import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import frontRoutes from './frontRoutes.jsx';
import adminRoutes from './adminRoutes.jsx';

// 将 App 作为根布局路由，其他路由作为其子路由
const allRoutes = [
  {
    path: '/',
    element: <App />,
    // 子路由将在这里通过 App 组件中的 <Outlet /> 渲染
    children: [
      ...frontRoutes,
      ...adminRoutes,
    ],
  },
];

const router = createBrowserRouter(allRoutes, {
  basename: import.meta.env.BASE_URL,
});

export default router;