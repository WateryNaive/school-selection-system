import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Row, Segmented, Space, Statistic, Switch, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

// ---------- Mock 数据 ----------
const LABS = [
  '智能视觉',
  '自然语言处理',
  '智能机器人',
  '大数据与挖掘',
  '网络安全',
  '物联网',
  '智能软件工程',
]

const BASE_SIGNUPS = [128, 96, 87, 74, 65, 58, 52]

const MENTORS = [
  { name: '王浩然', quota: 12 },
  { name: '李子涵', quota: 12 },
  { name: '张欣怡', quota: 10 },
  { name: '刘宇轩', quota: 10 },
  { name: '陈梓萱', quota: 8 },
  { name: '杨思远', quota: 8 },
  { name: '赵嘉琪', quota: 6 },
  { name: '黄一鸣', quota: 6 },
]
const OTHER_MENTORS_QUOTA = 40

type Round = 'first' | 'second'

const jitter = (value: number, range = 18) =>
  Math.max(10, value + Math.round((Math.random() - 0.5) * range))

export default function Dashboard() {
  const [round, setRound] = useState<Round>('first')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [signups, setSignups] = useState<number[]>(BASE_SIGNUPS)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  const refresh = () => {
    setSignups((prev) => prev.map((v) => jitter(v)))
    setUpdatedAt(new Date())
  }

  const switchRound = (next: Round) => {
    setRound(next)
    setSignups(BASE_SIGNUPS.map((v) => jitter(v, next === 'first' ? 18 : 30)))
    setUpdatedAt(new Date())
  }

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(refresh, 4000)
    return () => window.clearInterval(timer)
  }, [autoRefresh])

  const { totalSignups, totalQuota } = useMemo(
    () => ({
      totalSignups: signups.reduce((a, b) => a + b, 0),
      totalQuota: MENTORS.reduce((a, b) => a + b.quota, OTHER_MENTORS_QUOTA),
    }),
    [signups],
  )

  const barOption: EChartsOption = {
    grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => `${v} 人`,
    },
    xAxis: {
      type: 'category',
      data: LABS.map((l) => `${l}实训室`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d8e2ef' } },
      axisLabel: { color: '#5b6b82', interval: 0, fontSize: 11, rotate: 18 },
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
        data: signups,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#22d3ee' },
              { offset: 1, color: '#2563eb' },
            ],
          },
        },
        emphasis: {
          itemStyle: { color: '#0891b2' },
        },
        label: { show: true, position: 'top', color: '#2563eb', fontWeight: 600 },
      },
    ],
  }

  const pieData = [
    ...MENTORS.map((m) => ({ name: `${m.name} 老师`, value: m.quota })),
    { name: '其他导师', value: OTHER_MENTORS_QUOTA },
  ]

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

  return (
    <div className="xb-rise">
      <Card
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space size={10} wrap>
              <BarChartOutlined style={{ color: '#0891b2', fontSize: 20 }} />
              <Typography.Title level={4} style={{ margin: 0, color: '#0f2540' }}>
                数据看板
              </Typography.Title>
              <Tag color="blue">Mock 演示数据</Tag>
            </Space>
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>
              最近更新：{updatedAt.toLocaleTimeString('zh-CN')}
            </div>
          </Col>
          <Col>
            <Space size={12} wrap>
              <Segmented
                value={round}
                onChange={(v) => switchRound(v as Round)}
                options={[
                  { label: '第一轮选报', value: 'first' },
                  { label: '第二轮递补', value: 'second' },
                ]}
              />
              <Space size={6} style={{ color: '#5b6b82', fontSize: 13 }}>
                自动刷新
                <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
              </Space>
              <Button icon={<ReloadOutlined />} onClick={refresh}>
                刷新数据
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="累计报名人数"
              value={totalSignups}
              suffix="人"
              prefix={<UserOutlined style={{ color: '#0891b2' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="实训室数量" value={LABS.length} suffix="个" prefix={<BarChartOutlined style={{ color: '#2563eb' }} />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="导师总名额" value={totalQuota} suffix="人" prefix={<TeamOutlined style={{ color: '#7c3aed' }} />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="当前阶段" value={round === 'first' ? '第一轮' : '第二轮'} prefix={<PieChartOutlined style={{ color: '#10b981' }} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card title="各实训室报名人数" extra={<Tag color="cyan">柱状图</Tag>}>
            <ReactECharts option={barOption} style={{ height: 380 }} notMerge lazyUpdate />
          </Card>
        </Col>
        <Col xs={24} lg={11}>
          <Card title="导师名额分配" extra={<Tag color="geekblue">饼图</Tag>}>
            <ReactECharts option={pieOption} style={{ height: 380 }} notMerge lazyUpdate />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
