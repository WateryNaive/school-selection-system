import { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Typography,
  App,
  Alert,
  Modal,
  InputNumber,
  Row,
  Col,
  Statistic,
  Tag,
  Popconfirm,
  Form,
  Input,
  Select,
  Drawer,
  Descriptions,
  Empty,
} from 'antd'
import { useStore } from '../store'
import { StatusTag } from '../ui'
import { Application, Prefs, Scores, Student } from '../types'

const emptyDraft: Scores = { attitude: 20, logic: 20, programming: 20, time: 20 }

export default function MentorView() {
  const { message } = App.useApp()
  const { labs, students, currentMentor, applications, adjustmentCandidates, resumes, round, phase, scoreApplication, sendInterviewNotice, generateLists, updateMentorBio, updateMentorProfile, saveEvaluation } = useStore()
  const [scoring, setScoring] = useState<Application | null>(null)
  const [draft, setDraft] = useState<Scores>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false)
  const [noticeSelection, setNoticeSelection] = useState<string[]>([])
  const [noticeAppIds, setNoticeAppIds] = useState<string[] | null>(null)
  const [interviewDraft, setInterviewDraft] = useState({ interviewTime: '', location: '', note: '' })
  const [sendingNotice, setSendingNotice] = useState(false)
  const [bioOpen, setBioOpen] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [evalApp, setEvalApp] = useState<Application | null>(null)
  const [evalDraft, setEvalDraft] = useState('')
  const [savingEval, setSavingEval] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState({ labId: '', direction: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [resumeStudent, setResumeStudent] = useState<Student | null>(null)

  if (!currentMentor) {
    return <Alert type="warning" showIcon message="未找到当前登录导师信息，无法查看报名。" />
  }

  const lab = labs.find((l) => l.id === currentMentor.labId)
  const ownApps = applications.filter((a) => a.mentorId === currentMentor.id)
  const labLocked = ownApps.length > 0
  const roundApps = ownApps.filter((a) => a.round === round)
  const confirmedOwn = ownApps.filter((a) => a.status === 'confirmed').length
  const studentOf = (id: string) => students.find((s) => s.id === id)
  const count = (s: Application['status']) => roundApps.filter((a) => a.status === s).length
  const unscored = count('submitted')
  const scored = roundApps.filter((a) => a.scores).length
  const canScore = (app: Application) => phase === 'round'
    && app.mentorId === currentMentor.id
    && app.round === round
    && (app.status === 'submitted' || app.status === 'scored')
  const activeScoring = roundApps.find((a) => a.id === scoring?.id && canScore(a))
  const selectedNoticeIds = noticeSelection.filter((id) => roundApps.some((a) => a.id === id && canScore(a)))
  const noticeApps = roundApps.filter((a) => noticeAppIds?.includes(a.id) && canScore(a))

  const sorted = [...roundApps].sort((a, b) => {
    if (a.status === 'submitted' && b.status !== 'submitted') return -1
    if (b.status === 'submitted' && a.status !== 'submitted') return 1
    return b.total - a.total
  })

  const openScore = (app: Application) => {
    if (!canScore(app)) return
    setScoring(app)
    setDraft(app.scores ?? { ...emptyDraft })
  }
  const saveScore = async () => {
    if (!activeScoring || saving) return
    setSaving(true)
    try {
      if (await scoreApplication(activeScoring.id, draft) === true) {
        message.success('已保存分数')
        setScoring(null)
      }
    } finally {
      setSaving(false)
    }
  }
  const activeEval = roundApps.find((a) => a.id === evalApp?.id && canScore(a))
  const openEval = (app: Application) => {
    if (!canScore(app)) return
    setEvalApp(app)
    setEvalDraft(app.evaluation ?? '')
  }
  const saveEval = async () => {
    if (!activeEval || savingEval) return
    setSavingEval(true)
    try {
      if (await saveEvaluation(activeEval.id, evalDraft.trim()) === true) {
        message.success('已保存面试评价')
        setEvalApp(null)
      }
    } finally {
      setSavingEval(false)
    }
  }
  const openNotice = (ids: string[]) => {
    if (phase !== 'round' || !ids.length) return
    setNoticeAppIds(ids)
    setInterviewDraft({ interviewTime: '', location: '', note: '' })
  }
  const sendNotice = async () => {
    if (!noticeAppIds || sendingNotice) return
    const interviewTime = interviewDraft.interviewTime
    const location = interviewDraft.location.trim()
    if (!noticeApps.length || noticeApps.length !== noticeAppIds.length || !interviewTime || !location) {
      message.warning('请选择本轮待面试的学生，并填写面试时间和地点')
      return
    }
    setSendingNotice(true)
    try {
      if (await sendInterviewNotice(noticeAppIds, { interviewTime, location, note: interviewDraft.note.trim() }) === true) {
        message.success(`已向 ${noticeAppIds.length} 名学生发送面试通知`)
        setNoticeAppIds(null)
        setNoticeSelection([])
      }
    } finally {
      setSendingNotice(false)
    }
  }
  const gen = async () => {
    if (phase !== 'round' || generating) return
    setGenerating(true)
    try {
      if (await generateLists() === true) {
        message.success('已生成我的拟录取名单')
        setGenerateConfirmOpen(false)
      }
    } finally {
      setGenerating(false)
    }
  }
  const saveBio = async () => {
    if (savingBio) return
    setSavingBio(true)
    try {
      if (await updateMentorBio(bioDraft.trim()) === true) {
        message.success('简介已保存')
        setBioOpen(false)
      }
    } finally {
      setSavingBio(false)
    }
  }
  const openProfile = () => {
    setProfileDraft({ labId: currentMentor.labId, direction: currentMentor.direction })
    setProfileOpen(true)
  }
  const saveProfile = async () => {
    if (savingProfile) return
    const direction = profileDraft.direction.trim()
    if (!direction) {
      message.warning('请填写研究方向')
      return
    }
    setSavingProfile(true)
    try {
      if (await updateMentorProfile(profileDraft.labId, direction) === true) {
        message.success('已保存实训室与研究方向')
        setProfileOpen(false)
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const columns = [
    { title: '学生', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.name ?? '—' },
    { title: '学号', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.studentNo ?? '—' },
    { title: '班级', dataIndex: 'studentId', render: (v: string) => studentOf(v)?.className ?? '—' },
    { title: '态度', render: (_: unknown, r: Application) => r.scores?.attitude ?? '—' },
    { title: '逻辑', render: (_: unknown, r: Application) => r.scores?.logic ?? '—' },
    { title: '编程', render: (_: unknown, r: Application) => r.scores?.programming ?? '—' },
    { title: '投入', render: (_: unknown, r: Application) => r.scores?.time ?? '—' },
    { title: '总分', dataIndex: 'total', render: (v: number, r: Application) => (r.scores ? <b>{v}</b> : '—') },
    { title: '状态', dataIndex: 'status', render: (v: Application['status']) => <StatusTag status={v} /> },
    {
      title: '操作',
      width: 310,
      render: (_: unknown, r: Application) => (
        <Space size={4}>
          <Button size="small" onClick={() => setResumeStudent(studentOf(r.studentId) ?? null)}>简历</Button>
          {canScore(r) && (
            <>
              <Button size="small" onClick={() => openScore(r)}>
                {r.scores ? '改分' : '打分'}
              </Button>
              <Button size="small" onClick={() => openEval(r)}>{r.evaluation ? '改评价' : '评价'}</Button>
              <Button size="small" onClick={() => openNotice([r.id])}>面试通知</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const candidateColumns = [
    { title: '学生', dataIndex: 'name' },
    { title: '学号', dataIndex: 'studentNo' },
    { title: '班级', dataIndex: 'className' },
    {
      title: '调剂意愿',
      dataIndex: 'prefs',
      render: (prefs: Prefs) => (
        <Space wrap>
          <Tag color={prefs.intra ? 'cyan' : 'default'}>室内调剂：{prefs.intra ? '同意' : '不同意'}</Tag>
          <Tag color={prefs.cross ? 'blue' : 'default'}>跨实训室调剂：{prefs.cross ? '同意' : '不同意'}</Tag>
        </Space>
      ),
    },
    { title: '参考总分', dataIndex: 'total' },
    {
      title: '操作',
      render: (_: unknown, r: Student) => <Button size="small" onClick={() => setResumeStudent(r)}>简历</Button>,
    },
  ]

  const draftTotal = draft.attitude + draft.logic + draft.programming + draft.time

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={`当前进度：第 ${round} 轮 · ${phase === 'round' ? '分轮录取 / 补录' : phase === 'adjustment' ? '统筹调剂' : '结果公示'} · 报名与统计仅包含报给我的学生`}
      />
      <Card>
        <Space size="large" wrap>
          <Typography.Text strong>所属实训室：{lab?.name ?? '—'}</Typography.Text>
          <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
            登录导师：{currentMentor.name} · {currentMentor.direction}
          </Tag>
          <Popconfirm
            title="生成我的拟录取名单"
            description={`仅对报给我的本轮已评分报名排序，按并列顺位规则及实际剩余名额生成名单。我的容量为 ${currentMentor.capacity} 人，不生成其他导师的名单。`}
            open={generateConfirmOpen && phase === 'round'}
            onOpenChange={(open) => { if (open) setGenerateConfirmOpen(true) }}
            onConfirm={gen}
            onCancel={() => setGenerateConfirmOpen(false)}
            okButtonProps={{ loading: generating }}
            cancelButtonProps={{ disabled: generating }}
            okText="生成"
            cancelText="取消"
            disabled={phase !== 'round'}
          >
            <Button type="primary" disabled={phase !== 'round'} loading={generating}>生成我的拟录取名单</Button>
          </Popconfirm>
        </Space>
      </Card>

      <Card
        title="实训室与研究方向"
        extra={<Button onClick={openProfile}>编辑信息</Button>}
      >
        <Space size="large" wrap>
          <Typography.Text>所属实训室：<b>{lab?.name ?? '—'}</b></Typography.Text>
          <Typography.Text>研究方向：<b>{currentMentor.direction}</b></Typography.Text>
          {labLocked && <Typography.Text type="secondary">已有学生报名，实训室已锁定</Typography.Text>}
        </Space>
      </Card>

      <Card
        title="我的简介"
        extra={<Button onClick={() => { setBioDraft(currentMentor.bio); setBioOpen(true) }}>编辑简介</Button>}
      >
        {currentMentor.bio ? (
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentMentor.bio}</Typography.Paragraph>
        ) : (
          <Typography.Text type="secondary">还没有填写简介。学生在「实训室一览」里点开你的资料时会看到这段介绍，点右上角「编辑简介」写一段吧。</Typography.Text>
        )}
      </Card>

      <Row gutter={16}>
        <Col span={4}><Card><Statistic title="我的本轮报名" value={roundApps.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="我的已评分" value={scored} /></Card></Col>
        <Col span={4}><Card><Statistic title="我的拟录取" value={count('provisional')} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="我的递补" value={count('waitlist')} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="我的未通过" value={count('rejected')} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="我的已确认占用" value={confirmedOwn} suffix={`/ ${currentMentor.capacity}`} /></Card></Col>
      </Row>

      {phase === 'round' && unscored > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`本轮报给我的学生中还有 ${unscored} 人未打分，请先打分再生成我的拟录取名单。`}
        />
      )}

      <Card
        title={`我的第 ${round} 轮报名${phase === 'round' ? '与面试打分' : ''}`}
        extra={phase === 'round' ? (
          <Button disabled={!selectedNoticeIds.length} onClick={() => openNotice(selectedNoticeIds)}>
            批量发送面试通知{selectedNoticeIds.length ? `（${selectedNoticeIds.length}）` : ''}
          </Button>
        ) : null}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={sorted}
          rowSelection={phase === 'round' ? {
            selectedRowKeys: selectedNoticeIds,
            onChange: (keys) => setNoticeSelection(keys.map(String)),
            getCheckboxProps: (r) => ({ disabled: !canScore(r) }),
          } : undefined}
          locale={{ emptyText: '本轮暂无报给我的学生' }}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      {phase === 'adjustment' && (
        <Card title="调剂候选学生（只读）">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="仅展示后端筛选的未录取且同意调剂的其他学生：室内调剂限本实训室，跨实训室调剂面向全院。仅供参考，不展示其他报名或面试明细。"
            />
            <Table
              rowKey="id"
              columns={candidateColumns}
              dataSource={adjustmentCandidates}
              locale={{ emptyText: '暂无符合条件的调剂候选学生；仅展示未录取且同意相应调剂范围的其他学生。' }}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </Space>
        </Card>
      )}

      <Modal
        title={activeScoring ? `面试打分 · ${studentOf(activeScoring.studentId)?.name ?? '—'}` : '面试打分'}
        open={!!activeScoring}
        onOk={saveScore}
        onCancel={() => { if (!saving) setScoring(null) }}
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        maskClosable={!saving}
        keyboard={!saving}
        okText="保存分数"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {([
            ['attitude', '学习态度'],
            ['logic', '逻辑思维'],
            ['programming', '编程基础'],
            ['time', '时间投入'],
          ] as [keyof Scores, string][]).map(([key, label]) => (
            <Row key={key} align="middle" gutter={16}>
              <Col span={8}>{label}（0–25）</Col>
              <Col span={16}>
                <InputNumber
                  min={0}
                  max={25}
                  value={draft[key]}
                  onChange={(v) => setDraft((d) => ({ ...d, [key]: Number(v ?? 0) }))}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          ))}
          <Typography.Title level={5} style={{ margin: 0 }}>
            总分：{draftTotal} / 100
          </Typography.Title>
        </Space>
      </Modal>

      <Modal
        title={`发送面试通知${noticeAppIds ? ` · ${noticeAppIds.length} 名学生` : ''}`}
        open={noticeAppIds !== null}
        onOk={sendNotice}
        onCancel={() => { if (!sendingNotice) setNoticeAppIds(null) }}
        confirmLoading={sendingNotice}
        okButtonProps={{ disabled: !noticeApps.length || !interviewDraft.interviewTime || !interviewDraft.location.trim() }}
        cancelButtonProps={{ disabled: sendingNotice }}
        closable={!sendingNotice}
        maskClosable={!sendingNotice}
        keyboard={!sendingNotice}
        okText="发送通知"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="接收学生">
            <Alert type="info" showIcon message={noticeApps.map((a) => studentOf(a.studentId)?.name ?? '—').join('、') || '暂无可通知学生'} />
          </Form.Item>
          <Form.Item label="面试时间" required>
            <Input
              type="datetime-local"
              value={interviewDraft.interviewTime}
              onChange={(e) => setInterviewDraft((d) => ({ ...d, interviewTime: e.target.value }))}
            />
          </Form.Item>
          <Form.Item label="面试地点" required>
            <Input
              maxLength={100}
              placeholder="如：求实楼 302"
              value={interviewDraft.location}
              onChange={(e) => setInterviewDraft((d) => ({ ...d, location: e.target.value }))}
            />
          </Form.Item>
          <Form.Item label="补充说明（选填）">
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="如：请携带作品集，提前 10 分钟到场"
              value={interviewDraft.note}
              onChange={(e) => setInterviewDraft((d) => ({ ...d, note: e.target.value }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑我的简介"
        open={bioOpen}
        onOk={saveBio}
        onCancel={() => { if (!savingBio) setBioOpen(false) }}
        confirmLoading={savingBio}
        cancelButtonProps={{ disabled: savingBio }}
        closable={!savingBio}
        maskClosable={!savingBio}
        keyboard={!savingBio}
        okText="保存简介"
        cancelText="取消"
      >
        <Input.TextArea
          rows={6}
          maxLength={1000}
          showCount
          placeholder="介绍你的研究方向、项目经历、对学生的期望等，学生填报前会看到这段简介"
          value={bioDraft}
          onChange={(e) => setBioDraft(e.target.value)}
        />
      </Modal>

      <Modal
        title="编辑实训室与研究方向"
        open={profileOpen}
        onOk={saveProfile}
        onCancel={() => { if (!savingProfile) setProfileOpen(false) }}
        confirmLoading={savingProfile}
        cancelButtonProps={{ disabled: savingProfile }}
        closable={!savingProfile}
        maskClosable={!savingProfile}
        keyboard={!savingProfile}
        okText="保存信息"
        cancelText="取消"
      >
        <Form layout="vertical">
          {labLocked && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="已有学生报名，实训室已锁定，不能更换；研究方向仍可修改。如需换室请联系教务管理员。"
            />
          )}
          <Form.Item label="所在实训室" required>
            <Select
              disabled={labLocked}
              value={profileDraft.labId}
              onChange={(v) => setProfileDraft((d) => ({ ...d, labId: v }))}
              options={labs.map((l) => ({ label: l.name, value: l.id }))}
            />
          </Form.Item>
          <Form.Item label="研究方向" required>
            <Input
              maxLength={100}
              placeholder="如：目标检测与跟踪"
              value={profileDraft.direction}
              onChange={(e) => setProfileDraft((d) => ({ ...d, direction: e.target.value }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={activeEval ? `面试评价 · ${studentOf(activeEval.studentId)?.name ?? '—'}` : '面试评价'}
        open={!!activeEval}
        onOk={saveEval}
        onCancel={() => { if (!savingEval) setEvalApp(null) }}
        confirmLoading={savingEval}
        cancelButtonProps={{ disabled: savingEval }}
        closable={!savingEval}
        maskClosable={!savingEval}
        keyboard={!savingEval}
        okText="保存评价"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="记录该生面试中的优缺点，仅你本人和管理员可见，学生看不到。" />
          <Input.TextArea
            rows={6}
            maxLength={2000}
            showCount
            placeholder="如：优点——编程基础扎实、逻辑清晰；缺点——项目经验偏少、表达略紧张。可记录后续培养建议。"
            value={evalDraft}
            onChange={(e) => setEvalDraft(e.target.value)}
          />
        </Space>
      </Modal>

      <Drawer
        title={resumeStudent ? `学生简历 · ${resumeStudent.name}` : '学生简历'}
        open={!!resumeStudent}
        onClose={() => setResumeStudent(null)}
        width={560}
      >
        {resumeStudent && (() => {
          const resume = resumes[resumeStudent.id]
          if (!resume) return <Empty description="该学生尚未提交简历" />
          return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Descriptions
                column={2}
                size="small"
                bordered
                items={[
                  { key: 'name', label: '姓名', children: resumeStudent.name },
                  { key: 'no', label: '学号', children: resumeStudent.studentNo },
                  { key: 'class', label: '班级', children: resumeStudent.className },
                  { key: 'phone', label: '联系电话', children: resume.phone || '—' },
                  { key: 'email', label: '邮箱', children: resume.email || '—' },
                  { key: 'updated', label: '更新时间', children: new Date(resume.updatedAt).toLocaleString('zh-CN', { hour12: false }) },
                ]}
              />
              {([
                ['个人简介', resume.intro],
                ['获奖情况', resume.awards],
                ['自我评价', resume.selfEval],
              ] as [string, string][]).map(([label, content]) => (
                <div key={label}>
                  <Typography.Title level={5}>{label}</Typography.Title>
                  {content ? (
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{content}</Typography.Paragraph>
                  ) : (
                    <Typography.Text type="secondary">未填写</Typography.Text>
                  )}
                </div>
              ))}
            </Space>
          )
        })()}
      </Drawer>
    </Space>
  )
}