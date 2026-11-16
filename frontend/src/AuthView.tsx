import { useState } from 'react'
import {
  Alert,
  Button,
  Divider,
  Form,
  Grid,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  GlobalOutlined,
  LockOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Auth, Session } from './types'
import { api, useStore } from './store'

type LoginRole = 'student' | 'mentor'

const STAGES = ['集中宣讲', '开放日', '意向填报', '导师面试', '拟录取确认', '分轮补录', '统筹调剂', '结果公示入组']

const phaseText: Record<string, string> = {
  round: '分轮录取 / 补录',
  adjustment: '统筹调剂',
  published: '结果公示',
}

export default function AuthView({ onLogin }: { onLogin: (a: Auth) => void }) {
  const { round, phase, labs, mentors } = useStore()
  const screens = Grid.useBreakpoint()
  const wide = screens.md ?? true

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<LoginRole>('student')
  const [loginForm] = Form.useForm<{ account: string; password: string }>()
  const [regForm] = Form.useForm<{ name: string; className?: string; labId?: string; direction?: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [registered, setRegistered] = useState<{ role: LoginRole; account: string; initialPassword: string } | null>(null)

  const demo = { account: '20260001', password: '260001', label: '演示学生 · 张同学' }

  const switchRole = (r: LoginRole) => {
    setRole(r)
    setError('')
    setRegistered(null)
    loginForm.resetFields()
    regForm.resetFields()
  }
  const switchTab = (t: string) => {
    setTab(t as 'login' | 'register')
    setError('')
    setRegistered(null)
  }

  const doLogin = async (v: { account: string; password: string }) => {
    setBusy(true)
    setError('')
    try {
      const s = await api<Session>('auth/login', { role, account: v.account, password: v.password })
      onLogin(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doRegister = async (v: { name: string; className?: string; labId?: string; direction?: string }) => {
    setBusy(true)
    setError('')
    try {
      const r = await api<{ role: LoginRole; account: string; initialPassword: string }>('auth/register', { role, ...v })
      setRegistered(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const goLogin = () => {
    if (!registered) return
    setRole(registered.role)
    setTab('login')
    loginForm.setFieldsValue({ account: registered.account, password: registered.initialPassword })
    setRegistered(null)
    setError('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #eef4fb 0%, #e8f0fa 48%, #e2ecf7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div className="xb-auth-bg" aria-hidden>
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
        <div className="grid" />
        <div className="grain" />
      </div>
      <div
        className="xb-auth-card xb-rise"
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 940,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(31,45,61,.12), 0 0 40px rgba(8,145,178,.06)',
          border: '1px solid rgba(8,145,178,.18)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {wide && (
          <div
            style={{
              width: 330,
              flexShrink: 0,
              background: 'linear-gradient(165deg, #0ea5e9 0%, #0284c7 55%, #2563eb 100%)',
              borderRight: '1px solid rgba(8,145,178,.18)',
              color: '#fff',
              padding: '36px 30px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Space size={12} align="center">
              <div
                className="xb-logo"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: '#ffffff',
                  color: '#0891b2',
                  boxShadow: '0 0 18px rgba(255,255,255,.4)',
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReadOutlined />
              </div>
              <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
                实训室进组选报系统
              </Typography.Title>
            </Space>
            <div className="xb-stages" style={{ marginTop: 28, flex: 1 }}>
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  className="xb-stage xb-rise"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, lineHeight: '30px', animationDelay: `${0.15 + i * 0.07}s` }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.22)',
                      color: '#fff',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="xb-stage-text" style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>{s}</span>
                </div>
              ))}
            </div>
            <Space size={6} wrap style={{ marginTop: 20 }}>
              <Tag color="processing">第 {round} 轮</Tag>
              <Tag color="blue">{phaseText[phase] ?? phase}</Tag>
            </Space>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginTop: 10 }}>
              {labs.length} 个实训室 · {mentors.filter((m) => m.registered).length} 位已注册导师
              <br />
              演示环境 · 数据保存在 PostgreSQL
            </div>
          </div>
        )}

        <div className="xb-fade" style={{ flex: 1, background: '#ffffff', padding: '30px 36px', minWidth: 0, animationDelay: '.12s' }}>
          <Segmented
            block
            value={role}
            onChange={(v) => switchRole(v as LoginRole)}
            options={[
              { label: '学生', value: 'student', icon: <UserOutlined /> },
              { label: '导师', value: 'mentor', icon: <TeamOutlined /> },
            ]}
          />
          <Tabs
            activeKey={tab}
            onChange={switchTab}
            items={[
              { key: 'login', label: '登录' },
              { key: 'register', label: '注册' },
            ]}
          />

          <div style={{ display: tab === 'login' ? 'block' : 'none' }}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="账号与密码规则"
              description={
                <>
                  账号 = 年份 + 序号（8 位数字，如 20260001）；初始密码 = 账号后六位（20260001 → 260001）。
                  首次登录后可选择是否修改密码，一次仅登录一个账号。
                </>
              }
            />
            <Form form={loginForm} layout="vertical" onFinish={doLogin} requiredMark={false}>
              <Form.Item
                name="account"
                label="账号"
                rules={[
                  { required: true, message: '请输入账号' },
                  { pattern: /^\d{8}$/, message: '账号为 8 位数字（年份 + 序号）' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="年份 + 序号，如 20260001" autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="初始密码为账号后六位" autoComplete="current-password" />
              </Form.Item>
              {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
              <Form.Item style={{ marginBottom: 8 }}>
                <Button type="primary" htmlType="submit" block loading={busy}>
                  登 录
                </Button>
              </Form.Item>
              {role === 'student' ? (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => {
                  loginForm.setFieldsValue({ account: demo.account, password: demo.password })
                  setError('')
                }}>填入{demo.label}（{demo.account}）</Button>
              ) : <Typography.Text type="secondary">导师需先注册，注册成功后才会出现在学生的志愿选项中。</Typography.Text>}
            </Form>
          </div>

          <div style={{ display: tab === 'register' && !registered ? 'block' : 'none' }}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="注册说明"
              description={`账号由系统按「年份 + 序号」自动分配，初始密码为账号后六位，首次登录后可修改。${role === 'mentor' ? '导师注册成功后，学生即可选择你填报志愿；普通轮次只能查看报给自己的学生。' : ''}`}
            />
            <Form form={regForm} layout="vertical" onFinish={doRegister} requiredMark={false}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请填写姓名' }]}>
                <Input prefix={<UserOutlined />} placeholder={role === 'student' ? '学生姓名' : '导师姓名'} />
              </Form.Item>
              {role === 'student' ? (
                <Form.Item name="className" label="班级" rules={[{ required: true, message: '请填写班级' }]}>
                  <Input placeholder="如 计算机2601" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item name="labId" label="所在实训室" rules={[{ required: true, message: '请选择实训室' }]}>
                    <Select placeholder="选择实训室" options={labs.map((l) => ({ label: l.name, value: l.id }))} />
                  </Form.Item>
                  <Form.Item name="direction" label="研究方向（可选）">
                    <Input placeholder="默认跟随实训室方向" />
                  </Form.Item>
                </>
              )}
              {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={busy}>
                  注 册
                </Button>
              </Form.Item>
            </Form>
          </div>

          {tab === 'register' && registered && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <CheckCircleOutlined className="xb-pop" style={{ fontSize: 42, color: '#16a34a' }} />
              <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 16 }}>
                注册成功
              </Typography.Title>
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>你的账号（年份 + 序号）</div>
              <Typography.Title level={3} copyable style={{ margin: '4px 0 14px', letterSpacing: 2 }}>
                {registered.account}
              </Typography.Title>
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>初始密码（账号后六位）</div>
              <Typography.Title level={3} copyable style={{ margin: '4px 0 14px', letterSpacing: 2 }}>
                {registered.initialPassword}
              </Typography.Title>
              <Alert type="warning" showIcon message="首次登录后可选择修改密码，也可以暂不修改" style={{ textAlign: 'left' }} />
              <Button type="primary" block style={{ marginTop: 16 }} onClick={goLogin}>
                用该账号去登录
              </Button>
            </div>
          )}

          <Divider plain style={{ margin: '20px 0 10px', color: '#8c8c8c', fontSize: 12 }}>
            其他入口
          </Divider>
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => { setError(''); setAdminOpen(true) }}>
              管理员登录
            </Button>
            <Button type="link" size="small" icon={<GlobalOutlined />} onClick={() => onLogin({ role: 'public' })}>
              公示大厅（免登录）
            </Button>
          </Space>
        </div>
      </div>
      <Modal title="管理员登录" open={adminOpen} onCancel={() => { setAdminOpen(false); setError('') }} footer={null} destroyOnHidden>
        <Alert type="info" showIcon message="管理员账号：admin" description="请使用服务端配置的管理员口令；本机未配置时，启动后端的终端会显示本次启动口令。" style={{ marginBottom: 16 }} />
        <Form layout="vertical" onFinish={async (v: { password: string }) => {
          setBusy(true)
          setError('')
          try { onLogin(await api<Session>('auth/login', { role: 'admin', account: 'admin', password: v.password })) }
          catch (e) { setError((e as Error).message) }
          finally { setBusy(false) }
        }}>
          <Form.Item name="password" label="管理员口令" rules={[{ required: true, message: '请输入管理员口令' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" block loading={busy}>登录管理后台</Button>
        </Form>
      </Modal>
    </div>
  )
}