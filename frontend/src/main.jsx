import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { App } from 'antd'
import router from './router'
import 'antd/dist/reset.css';
import './style.css'

// React 应用入口：将路由提供者挂载到根节点。
createRoot(document.getElementById('root')).render(
  <App>
    <RouterProvider router={router} />
  </App>
)