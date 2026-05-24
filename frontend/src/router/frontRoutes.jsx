// 这个文件将定义所有面向用户的页面的路由。
import { lazy } from 'react';

// 使用 React.lazy 动态导入组件
const HomePage = lazy(() => import('../pages/front/HomePage'));
const OrderPage = lazy(() => import('../pages/front/OrderPage'));
const OrderSuccessPage = lazy(() => import('../pages/front/OrderSuccessPage'));

const frontRoutes = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/order',
    element: <OrderPage />,
  },
  {
    path: '/order-success',
    element: <OrderSuccessPage />,
  },
];

export default frontRoutes;