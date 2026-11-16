import { useMemo, useState } from 'react'
import { Card, Table, Alert, Row, Col, Statistic, Space, Select, Input, Empty, Tag, Typography } from 'antd'
import { useStore } from '../store'
import { MethodTag } from '../ui'
import { Application } from '../types'

export default function PublicView() {
  const { phase, applications, labs, mentors, students } = useStore()
  const [labFilter, setLabFilter] = useState<string>('all')
  const [kw, setKw] = useState('')

  const confirmed = applications.filter((a) => a.status === 'confirmed')
  const studentOf = (id: string) => students.find((s) => s.id === id)!
  const mentorOf = (id: string) => mentors.find((m) => m.id === id)!
  const labOf = (id: string) => labs.find((l) => l.id === id)!

  const rows = useMemo(() => {
    const k = kw.trim()
    return confirmed
      .filter((a) => (labFilter === 'all' ? true : a.labId === labFilter))
      .filter((a) => {
        if (!k) return true
        const s = studentOf(a.studentId)
        return s.name.includes(k) || s.studentNo.includes(k)
      })
      .sort((a, b) => a.labId.localeCompare(b.labId) || a.mentorId.localeCompare(b.mentorId))
  }, [confirmed, labFilter, kw])

  if (phase !== 'published') {
    return (
      <Card>
        <Empty description="录取结果尚未公示">
          <Typography.Text type="secondary">
            管理员完成分轮录取与统筹调剂并点击「结果公示」后，这里将展示公开录取名单。
          </Typography.Text>
        </Empty>
      </Card>
    )
  }

  const columns = [
    { title: '学生', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.name },
    { title: '学号', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.studentNo },
    { title: '班级', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.className },
    { title: '实训室', dataIndex: 'labId', render: (v: string) => labOf(v)?.name },
    { title: '导师', dataIndex: 'mentorId', render: (v: string) => mentorOf(v)?.name },
    { title: '录取方式', dataIndex: 'method', render: (v: Application['method']) => <MethodTag method={v} /> },
  ]

  const activeLabs = labs.filter((l) => confirmed.some((a) => a.labId === l.id)).length

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="录取结果公示中 · 公示期 3 天"
        description="公示期内如有异议，请在「学生视图 → 异议申诉」提交，学院将在 24 小时内处理并回复。"
      />
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="录取总数" value={confirmed.length} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="覆盖实训室" value={activeLabs} suffix={`/ ${labs.length}`} /></Card></Col>
        <Col span={8}><Card><Statistic title="公示状态" value="公示中" valueStyle={{ fontSize: 18, color: '#2563eb' }} /></Card></Col>
      </Row>
      <Card
        title="公开录取名单"
        extra={
          <Space>
            <Select
              style={{ width: 200 }}
              value={labFilter}
              onChange={setLabFilter}
              options={[{ label: '全部实训室', value: 'all' }, ...labs.map((l) => ({ label: l.name, value: l.id }))]}
            />
            <Input.Search
              allowClear
              placeholder="姓名 / 学号"
              style={{ width: 180 }}
              onSearch={setKw}
              onChange={(e) => !e.target.value && setKw('')}
            />
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space size="small" wrap>
            {labs.map((l) => (
              <Tag key={l.id}>{l.name} {confirmed.filter((a) => a.labId === l.id).length}</Tag>
            ))}
          </Space>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 12, showSizeChanger: false }}
          />
        </Space>
      </Card>
    </Space>
  )
}