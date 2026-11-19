import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Button, Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  DashboardOutlined,
  GlobalOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { StoreProvider, api } from './store'
import { Auth, Role, Session } from './types'
import StudentView from './views/StudentView'
import MentorView from './views/MentorView'
import AdminView from './views/AdminView'
import PublicView from './views/PublicView'
import Dashboard from './views/Dashboard'
import NoticeCenter from './NoticeCenter'
import AuthView from './AuthView'
import ChangePassword from './ChangePassword'

const AUTH_KEY = 'xuanbao.auth'

const roleMeta: Record<Role, { label: string; icon: ReactNode }> = {
  student: { label: '学生', icon: <UserOutlined /> },
  mentor: { label: '导师', icon: <SolutionOutlined /> },
  admin: { label: '管理员', icon: <SafetyCertificateOutlined /> },
  public: { label: '访客', icon: <GlobalOutlined /> },
}

function readAuth(): Auth | null {
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null')
    if (!v) return null
    if (v.role === 'public') return { role: v.role }
    if (['student', 'mentor', 'admin'].includes(v.role) && v.token && v.userId) return v as Session
    return null
  } catch {
    return null
  }
}

function Shell({
  auth,
  pwdOpen,
  onOpenPwd,
  onPwdClose,
  onPwdChanged,
  onLogout,
}: {
  auth: Auth
  pwdOpen: boolean
  onOpenPwd: () => void
  onPwdClose: () => void
  onPwdChanged: () => void
  onLogout: () => void
}) {
  const { role } = auth
  const who = 'token' in auth ? `${auth.name} · ${auth.account}` : role === 'admin' ? '学院统筹 · 教务管理员' : '公示大厅'
  const viewKey = `${role}:${'token' in auth ? auth.userId : ''}`
  const location = useLocation()
  const navigate = useNavigate()

  const homeLabel =
    role === 'student' ? '我的选报' : role === 'mentor' ? '导师工作台' : role === 'admin' ? '管理后台' : '公示大厅'
  const menuItems = [
    { key: '/home', icon: roleMeta[role].icon, label: homeLabel },
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
  ]
  const selectedKey = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        className="xb-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          height: 'auto',
          minHeight: 64,
          padding: '12px 24px',
          background: 'linear-gradient(90deg, rgba(255,255,255,.97), rgba(243,247,252,.97))',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Space size="middle">
          <Typography.Title level={4} style={{ color: '#0f2540', margin: 0, whiteSpace: 'nowrap', textShadow: '0 0 18px rgba(8,145,178,.15)' }}>
            实训室进组选报系统
          </Typography.Title>
          <Tag color="blue">Demo · 演示数据</Tag>
        </Space>
        <Space size="middle" wrap>
          <Space size={8} style={{ color: '#334155' }}>
            <Avatar size={24} icon={roleMeta[role].icon} style={{ background: 'linear-gradient(135deg,#06b6d4,#2563eb)', color: '#fff' }} />
            <span style={{ whiteSpace: 'nowrap' }}>{who}</span>
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {roleMeta[role].label}
            </Tag>
          </Space>
          {'token' in auth && auth.role !== 'admin' && (
            <Button type="text" icon={<KeyOutlined />} style={{ color: '#5b6b82' }} onClick={onOpenPwd}>
              修改密码
            </Button>
          )}
          {role === 'student' && <NoticeCenter />}
          <Button type="text" icon={<LogoutOutlined />} style={{ color: '#5b6b82' }} onClick={onLogout}>
            退出登录
          </Button>
        </Space>
      </Layout.Header>
      <Layout>
        <Layout.Sider
          theme="light"
          width={208}
          breakpoint="lg"
          collapsedWidth={0}
          style={{ borderRight: '1px solid #e8eef6', background: 'rgba(255,255,255,.82)' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: 'none', paddingTop: 12, background: 'transparent' }}
          />
        </Layout.Sider>
        <Layout.Content style={{ padding: 24, width: '100%' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Routes>
              <Route
                path="/home"
                element={
                  role === 'student' ? (
                    <StudentView key={viewKey} />
                  ) : role === 'mentor' ? (
                    <MentorView key={viewKey} />
                  ) : role === 'admin' ? (
                    <AdminView key={viewKey} />
                  ) : (
                    <PublicView key={viewKey} />
                  )
                }
              />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </div>
        </Layout.Content>
      </Layout>
      {'token' in auth && auth.role !== 'admin' && (
        <ChangePassword open={pwdOpen} initial={auth.pwdInitial} token={auth.token} onClose={onPwdClose} onChanged={onPwdChanged} />
      )}
    </Layout>
  )
}

export default function App() {
  const [auth, setAuth] = useState<Auth | null>(readAuth)
  const [pwdOpen, setPwdOpen] = useState(false)

  // 刷新后校验本地会话是否仍有效（同一账号异地登录会顶掉旧会话）
  useEffect(() => {
    const a = readAuth()
    if (a && 'token' in a) {
      api<Session>(`auth/me?token=${encodeURIComponent(a.token)}`)
        .then((s) => {
          localStorage.setItem(AUTH_KEY, JSON.stringify(s))
          setAuth(s)
        })
        .catch(() => {
          localStorage.removeItem(AUTH_KEY)
          setAuth(null)
        })
    }
  }, [])

  const login = (a: Auth) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(a))
    setAuth(a)
    setPwdOpen('token' in a && a.pwdInitial)
  }
  const logout = () => {
    if (auth && 'token' in auth) api('auth/logout', { token: auth.token }).catch(() => {})
    localStorage.removeItem(AUTH_KEY)
    setAuth(null)
    setPwdOpen(false)
  }
  const pwdChanged = () => {
    if (auth && 'token' in auth) {
      const next = { ...auth, pwdInitial: false }
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      setAuth(next)
    }
    setPwdOpen(false)
  }

  return (
    <StoreProvider
      key={auth && 'token' in auth ? auth.token : auth?.role ?? 'guest'}
      auth={auth}
      onSessionExpired={() => { localStorage.removeItem(AUTH_KEY); setAuth(null); setPwdOpen(false) }}
    >
      {auth === null ? (
        <AuthView onLogin={login} />
      ) : (
        <HashRouter>
          <Shell
            auth={auth}
            pwdOpen={pwdOpen}
            onOpenPwd={() => setPwdOpen(true)}
            onPwdClose={() => setPwdOpen(false)}
            onPwdChanged={pwdChanged}
            onLogout={logout}
          />
        </HashRouter>
      )}
    </StoreProvider>
  )
}