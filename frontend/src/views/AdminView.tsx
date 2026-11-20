import { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Typography,
  App,
  Alert,
  Row,
  Col,
  Statistic,
  Tag,
  Steps,
  Empty,
  Modal,
  Input,
  Radio,
  Select,
  Form,
} from 'antd'
import { useStore } from '../store'
import { MethodTag, methodMeta, ObjectionTag } from '../ui'
import { AdmissionMethod, Phase, Objection, ObjectionStatus, Lab, Mentor } from '../types'

const PHASE_TEXT: Record<Phase, string> = {
  round: '分轮录取 / 补录',
  adjustment: '统筹调剂',
  published: '结果公示',
}
const PHASE_STEP: Record<Phase, number> = { round: 0, adjustment: 1, published: 2 }
const ADJUST_METHODS: AdmissionMethod[] = ['intra', 'cross', 'manual']

export default function AdminView() {
  const { message } = App.useApp()
  const {
    labs, mentors, students, applications, round, phase, paused, objections,
    settleRound, setFilingPaused, startNextRound, runAdjustment, allocateAdjustment, publish, resolveObjection, adminUpdateMentorProfile,
  } = useStore()
  const [settledRound, setSettledRound] = useState<number | null>(null)
  const [handling, setHandling] = useState<Objection | null>(null)
  const [handleStatus, setHandleStatus] = useState<ObjectionStatus>('resolved')
  const [handleReply, setHandleReply] = useState('')
  const [mentorSearch, setMentorSearch] = useState('')
  const [editingMentor, setEditingMentor] = useState<Mentor | null>(null)
  const [editDraft, setEditDraft] = useState({ labId: '', direction: '' })
  const [savingMentor, setSavingMentor] = useState(false)

  const confirmed = applications.filter((a) => a.status === 'confirmed')
  const placedIds = new Set(confirmed.map((a) => a.studentId))
  const seatsForLab = (lab: Lab) => Math.min(
    lab.quota,
    mentors.filter((m) => m.registered && m.labId === lab.id).reduce((s, m) => s + m.capacity, 0),
  )
  const totalSeats = labs.reduce((s, l) => s + seatsForLab(l), 0)
  const placed = placedIds.size
  const unplaced = students.length - placed
  const remaining = Math.max(0, totalSeats - confirmed.length)

  const studentOf = (id: string) => students.find((s) => s.id === id)!
  const mentorOf = (id: string) => mentors.find((m) => m.id === id)!
  const labOf = (id: string) => labs.find((l) => l.id === id)!

  const roundSettled = settledRound === round
  const canSettle = phase === 'round' && !roundSettled
  const canNext = phase === 'round' && roundSettled && round < 3
  const canAdjust = phase === 'round'
  const canPublish = phase === 'adjustment'

  const doSettle = async () => {
    if (!(await settleRound())) return
    setSettledRound(round)
    message.success(`第 ${round} 轮已结算，请查看录取结果`)
  }
  const doNext = async () => {
    if (!(await startNextRound())) return
    message.success(`已开启第 ${round + 1} 轮补录，未录取学生可重新填报`)
  }
  const doAdjust = async () => {
    if (!(await runAdjustment())) return
    message.success('已进入统筹调剂：导师现在可查看其他同意调剂的候选学生，尚未执行调剂分配', 6)
  }
  const doAllocate = async () => {
    if (!(await allocateAdjustment())) return
    message.success('已按学生意愿执行室内 → 跨室调剂分配（仅限已注册导师）。结果见下方记录，仍未录取学生待学院约谈。', 6)
  }
  const doPublish = async () => {
    if (!(await publish())) return
    message.success('录取结果已公示，流程结束')
  }
  const doTogglePause = async () => {
    if (await setFilingPaused(!paused)) message.success(paused ? '已恢复填报，学生可以继续提交或修改意向' : '已暂停填报，学生暂不能提交或修改意向')
  }

  const guidance =
    phase === 'published'
      ? '录取结果已公示，下方为录取去向与调剂记录；仍未录取学生待学院约谈。'
      : phase === 'adjustment'
        ? '仅在调剂阶段，导师可查看其他同意调剂的候选学生。点击「执行调剂分配」，按学生意愿向已注册导师先室内、后跨室分配；不自动安置未同意调剂的学生，仍未录取学生待学院约谈。核对结果后再公示。'
        : !roundSettled
          ? `当前第 ${round} 轮。请核对面试评分、拟录取及学生确认情况后结算本轮。`
          : round < 3
            ? `第 ${round} 轮已结算。可「开启第 ${round + 1} 轮补录」让未录取学生重新填报，或「进入统筹调剂」开放候选学生查看；进入阶段不自动分配。`
            : '第 3 轮已结算，补录轮次已用尽。可「进入统筹调剂」开放候选学生查看，再单独执行调剂分配。'

  const labRows = labs.map((l) => {
    const labConfirmed = confirmed.filter((a) => a.labId === l.id).length
    const roundApps = applications.filter((a) => a.labId === l.id && a.round === round)
    const quota = seatsForLab(l)
    return {
      id: l.id,
      name: l.name,
      quota,
      confirmed: labConfirmed,
      remaining: Math.max(0, quota - labConfirmed),
      roundApps: roundApps.length,
      provisional: roundApps.filter((a) => a.status === 'provisional').length,
      waitlist: roundApps.filter((a) => a.status === 'waitlist').length,
    }
  })

  const labColumns = [
    { title: '实训室', dataIndex: 'name' },
    { title: '实际名额', dataIndex: 'quota' },
    { title: '已录取', dataIndex: 'confirmed', render: (v: number) => <b style={{ color: '#16a34a' }}>{v}</b> },
    { title: '剩余', dataIndex: 'remaining', render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <Tag>满</Tag>) },
    { title: '本轮报名', dataIndex: 'roundApps' },
    { title: '本轮拟录取', dataIndex: 'provisional' },
    { title: '本轮递补', dataIndex: 'waitlist' },
  ]

  const methodCount = (m: AdmissionMethod) => confirmed.filter((a) => a.method === m).length
  const adjusted = applications
    .filter((a) => a.method && ADJUST_METHODS.includes(a.method))
    .sort((a, b) => ADJUST_METHODS.indexOf(a.method!) - ADJUST_METHODS.indexOf(b.method!) || b.total - a.total)

  const adjustColumns = [
    { title: '学生', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.name },
    { title: '学号', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.studentNo },
    { title: '班级', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.className },
    { title: '去向实训室', dataIndex: 'labId', render: (v: string) => labOf(v)?.name },
    { title: '导师', dataIndex: 'mentorId', render: (v: string) => mentorOf(v)?.name },
    { title: '调剂方式', dataIndex: 'method', render: (v: AdmissionMethod) => <><MethodTag method={v} />{v === 'manual' && <Typography.Text type="secondary">（历史记录）</Typography.Text>}</> },
    { title: '参考总分', dataIndex: 'total' },
  ]

  const pendingCount = objections.filter((o) => o.status === 'pending').length
  const openHandle = (o: Objection) => {
    setHandling(o)
    setHandleStatus('resolved')
    setHandleReply('')
  }
  const submitHandle = async () => {
    if (!handling) return
    if (!(await resolveObjection(handling.id, handleStatus, handleReply.trim()))) return
    message.success(handleStatus === 'resolved' ? '已受理并回复学生' : '已驳回并回复学生')
    setHandling(null)
  }
  const objectionColumns = [
    { title: '学生', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.name },
    { title: '学号', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.studentNo },
    { title: '异议理由', dataIndex: 'reason' },
    { title: '提交时间', dataIndex: 'time' },
    { title: '状态', dataIndex: 'status', render: (v: ObjectionStatus) => <ObjectionTag status={v} /> },
    { title: '回复', dataIndex: 'reply', render: (v: string) => v || '—' },
    {
      title: '操作',
      render: (_: unknown, r: Objection) =>
        r.status === 'pending' ? (
          <Button size="small" type="primary" onClick={() => openHandle(r)}>处理</Button>
        ) : (
          <Typography.Text type="secondary">已处理</Typography.Text>
        ),
    },
  ]

  const appCountFor = (id: string) => applications.filter((a) => a.mentorId === id).length
  const confirmedCountFor = (id: string) => applications.filter((a) => a.mentorId === id && a.status === 'confirmed').length
  const openEditMentor = (m: Mentor) => {
    setEditingMentor(m)
    setEditDraft({ labId: m.labId, direction: m.direction })
  }
  const saveMentor = async () => {
    if (!editingMentor || savingMentor) return
    const direction = editDraft.direction.trim()
    if (!direction) {
      message.warning('请填写研究方向')
      return
    }
    setSavingMentor(true)
    try {
      if (await adminUpdateMentorProfile(editingMentor.id, editDraft.labId, direction) === true) {
        message.success('已保存导师实训室与研究方向')
        setEditingMentor(null)
      }
    } finally {
      setSavingMentor(false)
    }
  }
  const mentorKeyword = mentorSearch.trim().toLowerCase()
  const filteredMentors = mentors
    .filter((m) => !mentorKeyword || m.name.toLowerCase().includes(mentorKeyword) || (m.account ?? '').includes(mentorKeyword) || m.direction.toLowerCase().includes(mentorKeyword))
    .sort((a, b) => Number(b.registered) - Number(a.registered) || a.name.localeCompare(b.name, 'zh-CN'))
  const mentorColumns = [
    { title: '导师', dataIndex: 'name' },
    { title: '账号', dataIndex: 'account', render: (v: string) => v ?? '—' },
    { title: '实训室', dataIndex: 'labId', render: (v: string) => labOf(v)?.name ?? '—' },
    { title: '研究方向', dataIndex: 'direction' },
    { title: '容量', dataIndex: 'capacity' },
    { title: '状态', dataIndex: 'registered', render: (v: boolean) => (v ? <Tag color="cyan">已注册</Tag> : <Tag>预置</Tag>) },
    { title: '报名', render: (_: unknown, m: Mentor) => appCountFor(m.id) },
    { title: '已录取', render: (_: unknown, m: Mentor) => confirmedCountFor(m.id) },
    { title: '操作', render: (_: unknown, m: Mentor) => <Button size="small" onClick={() => openEditMentor(m)}>编辑</Button> },
  ]
  const editLabChanged = !!editingMentor && editDraft.labId !== editingMentor.labId
  const editAppCount = editingMentor ? appCountFor(editingMentor.id) : 0
  const editConfirmedCount = editingMentor ? confirmedCountFor(editingMentor.id) : 0
  const editWillMigrate = editLabChanged && editAppCount > 0

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Steps
          size="small"
          current={PHASE_STEP[phase]}
          status={phase === 'published' ? 'finish' : 'process'}
          items={[
            { title: '分轮录取 / 补录', description: `第 ${round} 轮` },
            { title: '统筹调剂', description: '开放候选查看 → 按意愿分配' },
            { title: '结果公示', description: '正式入组' },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col span={4}><Card><Statistic title="实际总名额" value={totalSeats} /></Card></Col>
        <Col span={4}><Card><Statistic title="已录取" value={placed} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="未录取" value={unplaced} valueStyle={{ color: unplaced ? '#dc2626' : '#16a34a' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="剩余名额" value={remaining} valueStyle={{ color: '#2563eb' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="当前轮次" value={round} suffix="/ 3" /></Card></Col>
        <Col span={4}><Card><Statistic title="阶段" value={PHASE_TEXT[phase]} valueStyle={{ fontSize: 18 }} /></Card></Col>
      </Row>

      <Card title="录取进度控制台">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type={phase === 'published' ? 'success' : 'info'} showIcon message={guidance} />
          <Space size="middle" wrap>
            <Button type="primary" disabled={!canSettle} onClick={doSettle}>
              结算第 {round} 轮
            </Button>
            <Button disabled={!canNext} onClick={doNext}>
              开启第 {round + 1} 轮补录
            </Button>
            <Button disabled={!canAdjust} onClick={doAdjust}>
              进入统筹调剂
            </Button>
            {phase === 'adjustment' && (
              <Button type="primary" onClick={doAllocate}>
                执行调剂分配
              </Button>
            )}
            <Button type="primary" danger disabled={!canPublish} onClick={doPublish}>
              结果公示
            </Button>
          </Space>
          <Space size="small" wrap>
            <Typography.Text type="secondary">录取方式分布：</Typography.Text>
            {(Object.keys(methodMeta) as AdmissionMethod[]).filter((m) => m !== 'manual').map((m) => (
              <Tag key={m} color={methodMeta[m].color}>{methodMeta[m].text} {methodCount(m)}</Tag>
            ))}
          </Space>
          <Space size="middle" wrap>
            <Typography.Text type="secondary">意向填报：</Typography.Text>
            {paused ? <Tag color="orange">已暂停</Tag> : <Tag color="green">开放中</Tag>}
            <Button danger={!paused} disabled={phase !== 'round'} onClick={doTogglePause}>
              {paused ? '恢复填报' : '暂停填报'}
            </Button>
            <Typography.Text type="secondary">暂停后学生无法提交或修改意向，已填报的数据保留；导师评分与轮次结算不受影响。</Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card title="各实训室名额看板">
        <Typography.Paragraph type="secondary">实际名额取实训室限额与本室已注册导师容量之和的较小值。</Typography.Paragraph>
        <Table rowKey="id" columns={labColumns} dataSource={labRows} pagination={false} />
      </Card>

      <Card
        title="导师信息维护"
        extra={
          <Input.Search
            allowClear
            placeholder="搜索姓名 / 账号 / 方向"
            style={{ width: 240 }}
            value={mentorSearch}
            onChange={(e) => setMentorSearch(e.target.value)}
          />
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="可修改任意导师的所在实训室与研究方向，不受导师端「有报名即锁定」限制。更换实训室时，该导师名下的报名（含已录取学生）会一并迁入新实训室。" />
          <Table
            rowKey="id"
            columns={mentorColumns}
            dataSource={filteredMentors}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </Space>
      </Card>

      <Card title="统筹调剂记录（按意愿：室内 → 跨室）">
        {adjusted.length === 0 ? (
          <Empty description="暂无调剂记录；进入调剂阶段不会自动分配，仍未录取学生待学院约谈" />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={8}><Card><Statistic title="室内调剂" value={methodCount('intra')} valueStyle={{ color: '#0891b2' }} /></Card></Col>
              <Col span={8}><Card><Statistic title="跨室调剂" value={methodCount('cross')} valueStyle={{ color: '#4f46e5' }} /></Card></Col>
              <Col span={8}><Card><Statistic title="约谈安置（仅历史记录）" value={methodCount('manual')} valueStyle={{ color: '#7c3aed' }} /></Card></Col>
            </Row>
            <Table
              rowKey="id"
              columns={adjustColumns}
              dataSource={adjusted}
              scroll={{ x: 900 }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </Space>
        )}
      </Card>

      <Card
        title={`异议处理工作台（公示期 3 天 · 24 小时内处理）${pendingCount ? ` · 待处理 ${pendingCount}` : ''}`}
      >
        {objections.length === 0 ? (
          <Empty description="暂无异议，公示期内学生可在学生视图提交" />
        ) : (
          <Table
            rowKey="id"
            columns={objectionColumns}
            dataSource={objections}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        )}
      </Card>

      <Modal
        title={handling ? `处理异议 · ${studentOf(handling.studentId)?.name}` : '处理异议'}
        open={!!handling}
        onOk={submitHandle}
        onCancel={() => setHandling(null)}
        okText="提交处理结果"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">异议理由：{handling?.reason}</Typography.Text>
          <Radio.Group value={handleStatus} onChange={(e) => setHandleStatus(e.target.value)}>
            <Radio value="resolved">受理（复核属实）</Radio>
            <Radio value="rejected">驳回（不予采纳）</Radio>
          </Radio.Group>
          <Input.TextArea
            rows={3}
            value={handleReply}
            onChange={(e) => setHandleReply(e.target.value)}
            placeholder="回复学生（将同步站内信 + 钉钉）"
          />
        </Space>
      </Modal>

      <Modal
        title={editingMentor ? `编辑导师 · ${editingMentor.name}` : '编辑导师'}
        open={!!editingMentor}
        onOk={saveMentor}
        onCancel={() => { if (!savingMentor) setEditingMentor(null) }}
        confirmLoading={savingMentor}
        cancelButtonProps={{ disabled: savingMentor }}
        closable={!savingMentor}
        maskClosable={!savingMentor}
        keyboard={!savingMentor}
        okText="保存修改"
        cancelText="取消"
        okButtonProps={{ danger: editWillMigrate }}
      >
        <Form layout="vertical">
          {editWillMigrate && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`更换实训室将把该导师名下 ${editAppCount} 条报名（含 ${editConfirmedCount} 名已录取学生）一并迁入新实训室，名额统计随之变化，请确认。`}
            />
          )}
          <Form.Item label="所在实训室" required>
            <Select
              value={editDraft.labId}
              onChange={(v) => setEditDraft((d) => ({ ...d, labId: v }))}
              options={labs.map((l) => ({ label: l.name, value: l.id }))}
            />
          </Form.Item>
          <Form.Item label="研究方向" required>
            <Input
              maxLength={100}
              placeholder="如：目标检测与跟踪"
              value={editDraft.direction}
              onChange={(e) => setEditDraft((d) => ({ ...d, direction: e.target.value }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}