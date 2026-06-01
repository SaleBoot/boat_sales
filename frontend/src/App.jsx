import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { App as AntApp } from 'antd';
import { AuthProvider } from './pages/admin/context/AuthContext'

function MainApp() {
  return <Outlet />;
}

// -------------------------------------------------------
export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/login';

  return (
    <AntApp>
      <AuthProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </AntApp>
  )
}