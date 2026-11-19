import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Row, Segmented, Space, Spin, Statistic, Switch, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

// ---------- 后端看板接口返回结构 ----------
type DashboardStats = {
  round: number
  phase: string
  totalSignups: number
  totalStudents: number
  totalQuota: number
  totalMentors: number
  confirmedCount: number
  labs: Array<{ labId: string; name: string; quota: number; signupCount: number }>
  mentors: Array<{ mentorId: string; name: string; capacity: number; labName: string }>
}

const EMPTY: DashboardStats = {
  round: 1,
  phase: 'round',
  totalSignups: 0,
  totalStudents: 0,
  totalQuota: 0,
  totalMentors: 0,
  confirmedCount: 0,
  labs: [],
  mentors: [],
}

type RoundKey = 1 | 2

export default function Dashboard() {
  const [roundKey, setRoundKey] = useState<RoundKey>(1)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [stats, setStats] = useState<DashboardStats>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  const load = async (r: RoundKey) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/stats/dashboard?round=${r}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DashboardStats = await res.json()
      setStats(data)
      setUpdatedAt(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(roundKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => load(roundKey), 4000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, roundKey])

  const { labs, mentors } = stats

  const barOption: EChartsOption = {
    grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : (params as { name?: string; value?: number; dataIndex?: number })
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0
        const lab = labs[idx]
        if (!lab) return ''
        return `<strong>${lab.name}</strong><br/>报名：${lab.signupCount} 人 / 名额：${lab.quota} 人`
      },
    },
    xAxis: {
      type: 'category',
      data: labs.map((l) => l.name.replace(/实训室$/, '')),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d8e2ef' } },
      axisLabel: { color: '#5b6b82', interval: 0, fontSize: 11, rotate: labs.length > 5 ? 18 : 0 },
    },
    yAxis: {
      type: 'value',
      name: '报名人数',
      nameTextStyle: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#eef3f9' } },
      axisLabel: { color: '#5b6b82' },
    },
    series: [
      {
        name: '报名人数',
        type: 'bar',
        barWidth: '46%',
        data: labs.map((l) => l.signupCount),
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#22d3ee' },
              { offset: 1, color: '#2563eb' },
            ],
          },
        },
        emphasis: { itemStyle: { color: '#0891b2' } },
        label: { show: true, position: 'top', color: '#2563eb', fontWeight: 600 },
      },
    ],
  }

  const pieData = mentors.map((m) => ({
    name: m.name,
    value: m.capacity,
  }))

  const pieOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>名额：{c} 人（{d}%）',
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 8,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#5b6b82', fontSize: 12 },
    },
    series: [
      {
        name: '导师名额分配',
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['36%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 8,
          label: { show: true, fontSize: 14, fontWeight: 600, formatter: '{b}\n{c} 人' },
        },
        data: pieData,
        color: ['#06b6d4', '#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'],
      },
    ],
  }

  const phaseLabel = stats.phase === 'published' ? '结果公示' : stats.phase === 'adjustment' ? '统筹调剂' : '常规阶段'

  return (
    <div className="xb-rise">
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space size={10} wrap>
              <BarChartOutlined style={{ color: '#0891b2', fontSize: 20 }} />
              <Typography.Title level={4} style={{ margin: 0, color: '#0f2540' }}>
                数据看板
              </Typography.Title>
              <Tag color="cyan">实时数据</Tag>
              <Tag color="gold">阶段 {phaseLabel}</Tag>
            </Space>
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>
              最近更新：{updatedAt.toLocaleTimeString('zh-CN')}
              {loading && <span style={{ marginLeft: 8 }}>· 加载中…</span>}
              {error && <span style={{ marginLeft: 8, color: '#ef4444' }}>· 接口异常：{error}</span>}
            </div>
          </Col>
          <Col>
            <Space size={12} wrap>
              <Segmented
                value={roundKey}
                onChange={(v) => setRoundKey(v as RoundKey)}
                options={[
                  { label: '第一轮选报', value: 1 },
                  { label: '第二轮递补', value: 2 },
                ]}
              />
              <Space size={6} style={{ color: '#5b6b82', fontSize: 13 }}>
                自动刷新
                <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
              </Space>
              <Button icon={<ReloadOutlined />} onClick={() => load(roundKey)} loading={loading}>
                刷新数据
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message="无法获取看板数据"
          description={`/api/stats/dashboard 请求失败：${error}。请确认后端服务是否已启动。`}
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="累计报名人数"
              value={stats.totalSignups}
              suffix="人"
              prefix={<UserOutlined style={{ color: '#0891b2' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="实训室数量" value={stats.labs.length} suffix="个" prefix={<BarChartOutlined style={{ color: '#2563eb' }} />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="导师总名额" value={stats.totalQuota} suffix="人" prefix={<TeamOutlined style={{ color: '#7c3aed' }} />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="已确认入组"
              value={stats.confirmedCount}
              suffix="人"
              prefix={<PieChartOutlined style={{ color: '#10b981' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card title="各实训室报名人数" extra={<Tag color="cyan">柱状图</Tag>}>
            <Spin spinning={loading && stats.labs.length === 0}>
              <ReactECharts option={barOption} style={{ height: 380 }} notMerge lazyUpdate />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={11}>
          <Card title="导师名额分配" extra={<Tag color="geekblue">饼图</Tag>}>
            <Spin spinning={loading && stats.mentors.length === 0}>
              <ReactECharts option={pieOption} style={{ height: 380 }} notMerge lazyUpdate />
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
