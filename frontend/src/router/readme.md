 
<!--  -->
#  路由示例（React Router）
const App = () => (
  <Router>
    {/* 前台：用户访问的页面 */}
    <Route path="/" component={Home} />
    <Route path="/product" component={Product} />

    {/* 后台管理：内部员工使用 */}
    <Route path="/admin" component={AdminLayout} />
    <Route path="/admin/dashboard" component={Dashboard} />
    <Route path="/admin/user" component={UserList} />
  </Router>
)

#  最标准的「前后台一体」React 项目结构 

这是 React 项目中**前台 + 后台管理系统放在一起**最标准、最通用、大厂最常用的**文件目录结构**，你可以直接照着搭建，非常清晰。

我给你的是 **React 18 + React Router v6 + 模块化最佳实践**，直接复制可用。

---

# 一、最标准的「前后台一体」React 项目结构
```
src/
├── assets/            # 静态资源（图片、图标、全局样式）
├── components/        # 全局公共组件（按钮、弹窗、表格等）
├── layouts/           # 布局组件（关键！区分前台和后台）
│   ├── FrontLayout.jsx    # 前台布局（导航、页脚、整体结构）
│   └── AdminLayout.jsx    # 后台布局（侧边栏、顶栏、菜单）
├── pages/             # 所有页面（核心区分前台/admin）
│   ├── front/         # 前台用户页面
│   │   ├── Home.jsx
│   │   ├── About.jsx
│   │   └── Product.jsx
│   └── admin/         # 后台管理页面
│       ├── Dashboard.jsx
│       ├── UserList.jsx
│       ├── OrderList.jsx
│       └── Setting.jsx
├── router/            # 路由配置（核心！）
│   ├── index.js       # 总路由
│   ├── frontRoutes.js # 前台路由
│   └── adminRoutes.js # 后台路由
├── utils/             # 工具函数（请求、格式化、加密等）
├── api/               # 接口请求
│   ├── frontApi.js    # 前台接口
│   └── adminApi.js    # 后台接口
├── store/             # 状态管理（Redux/Zustand/Jotai）
├── App.jsx            # 根组件
└── main.jsx           # 入口文件
```

---

# 二、为什么这样组织？（3 个核心优势）
1. **完全分离前台 / 后台代码**，不会混乱
2. **路由独立配置**，方便权限控制、懒加载
3. **布局独立**（前台导航、后台侧边栏互不干扰）

---

# 三、最关键：路由怎么写？（直接复制可用）
`src/router/index.js`
```jsx
import { createBrowserRouter } from 'react-router-dom'
import FrontLayout from '@/layouts/FrontLayout'
import AdminLayout from '@/layouts/AdminLayout'
import frontRoutes from './frontRoutes'
import adminRoutes from './adminRoutes'

const router = createBrowserRouter([
  // 前台路由
  {
    path: '/',
    element: <FrontLayout />,
    children: frontRoutes
  },

  // 后台管理路由
  {
    path: '/admin',
    element: <AdminLayout />,
    children: adminRoutes
  }
])

export default router
```

`src/router/frontRoutes.js`
```jsx
import Home from '@/pages/front/Home'
import About from '@/pages/front/About'

export default [
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
]
```

`src/router/adminRoutes.js`
```jsx
import Dashboard from '@/pages/admin/Dashboard'
import UserList from '@/pages/admin/UserList'

export default [
  { path: '/admin/dashboard', element: <Dashboard /> },
  { path: '/admin/user', element: <UserList /> },
]
```

---

# 四、布局文件示例（区分前后台）
## 前台布局（带导航、页脚）
`FrontLayout.jsx`
```jsx
import { Outlet } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'

export default function FrontLayout() {
  return (
    <div className="front-container">
      <Header />  {/* 前台顶部导航 */}
      <main>
        <Outlet /> {/* 前台页面内容 */}
      </main>
      <Footer />  {/* 页脚 */}
    </div>
  )
}
```

## 后台布局（侧边栏 + 顶部）
`AdminLayout.jsx`
```jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import AdminHeader from './components/AdminHeader'

export default function AdminLayout() {
  return (
    <div className="admin-container">
      <Sidebar />    {/* 后台侧边菜单 */}
      <div className="admin-content">
        <AdminHeader /> {/* 后台顶部 */}
        <Outlet />      {/* 后台页面内容 */}
      </div>
    </div>
  )
}
```
 