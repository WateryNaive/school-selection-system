import { useState } from 'react'
import {
  Card,
  Select,
  Switch,
  Button,
  Space,
  Table,
  Typography,
  App,
  Alert,
  Radio,
  Tabs,
  Empty,
  Row,
  Col,
  Statistic,
  Input,
  Drawer,
  Descriptions,
  Form,
} from 'antd'
import { useStore } from '../store'
import { StatusTag, MethodTag, ObjectionTag } from '../ui'
import { Application, Mentor, Objection, Student } from '../types'

export default function StudentView() {
  const { currentStudent } = useStore()
  return currentStudent ? <StudentDashboard currentStudent={currentStudent} /> : <Empty description="未找到当前学生信息" />
}

function StudentDashboard({ currentStudent }: { currentStudent: Student }) {
  const { message } = App.useApp()
  const { labs, mentors, applications, prefs, resumes, round, phase, paused, objections, fileIntentions, confirmAdmission, fileObjection, saveResume, refresh } = useStore()
  const selectableMentors = mentors.filter((m) => m.registered)
  const [submitting, setSubmitting] = useState(false)
  const myApps = applications.filter((a) => a.studentId === currentStudent.id)
  const myRoundApps = myApps.filter((a) => a.round === round)
  const initPref = prefs[currentStudent.id] || { intra: false, cross: false }

  const [selected, setSelected] = useState<string[]>(
    myRoundApps.filter((a) => a.status === 'submitted' && selectableMentors.some((m) => m.id === a.mentorId)).map((a) => a.mentorId),
  )
  const [intra, setIntra] = useState(initPref.intra)
  const [cross, setCross] = useState(initPref.cross)
  const [offer, setOffer] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [profile, setProfile] = useState<Mentor | null>(null)
  const myResume = resumes[currentStudent.id]
  const [resumeDraft, setResumeDraft] = useState(() => ({
    phone: myResume?.phone ?? '',
    email: myResume?.email ?? '',
    intro: myResume?.intro ?? '',
    awards: myResume?.awards ?? '',
    selfEval: myResume?.selfEval ?? '',
  }))
  const [savingResume, setSavingResume] = useState(false)

  const mentorOptions = labs.map((lab) => ({
    label: lab.name,
    options: selectableMentors
      .filter((m) => m.labId === lab.id)
      .map((m) => ({ label: `${m.name} · ${m.direction}`, value: m.id })),
  })).filter((group) => group.options.length > 0)

  const submit = async () => {
    if (selected.length === 0) return message.warning('请至少选择 1 个导师意向')
    setSubmitting(true)
    try {
      if (await fileIntentions(selected, { intra, cross })) message.success('意向已提交，请等待所选导师面试评分')
    } finally { setSubmitting(false) }
  }

  const labName = (id: string) => labs.find((l) => l.id === id)?.name ?? id
  const mentorName = (id: string) => mentors.find((m) => m.id === id)?.name ?? id

  const provisional = myApps.filter((a) => a.status === 'provisional')
  const confirmed = myApps.find((a) => a.status === 'confirmed')
  const canFile = phase === 'round' && !confirmed && !paused

  const doConfirm = async (appId: string) => {
    if (await confirmAdmission(appId)) message.success('已确认录取，其余拟录取意向已释放')
  }

  const appColumns = [
    { title: '轮次', dataIndex: 'round', render: (v: number) => `第 ${v} 轮` },
    { title: '实训室', dataIndex: 'labId', render: (v: string) => labName(v) },
    { title: '导师', dataIndex: 'mentorId', render: (v: string) => mentorName(v) },
    { title: '面试总分', dataIndex: 'total', render: (v: number, r: Application) => (r.scores ? v : '—') },
    { title: '状态', dataIndex: 'status', render: (v: Application['status']) => <StatusTag status={v} /> },
    { title: '录取方式', dataIndex: 'method', render: (v: Application['method']) => <MethodTag method={v} /> },
  ]

  const catalogColumns = [
    { title: '实训室', dataIndex: 'labId', render: (v: string) => labName(v) },
    { title: '导师', dataIndex: 'name' },
    { title: '研究方向', dataIndex: 'direction' },
    { title: '名额', dataIndex: 'capacity' },
    {
      title: '我的报名数',
      render: (_: unknown, r: Mentor) => applications.filter((a) => a.mentorId === r.id).length,
    },
    {
      title: '操作',
      render: (_: unknown, r: Mentor) => <Button size="small" onClick={() => setProfile(r)}>查看简介</Button>,
    },
  ]

  const fillTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {confirmed ? (
        <Alert
          type="success"
          showIcon
          message="你已确认录取，无需再填报"
          description={`去向：${labName(confirmed.labId)} · ${mentorName(confirmed.mentorId)}。如需查看请前往「我的状态」。`}
        />
      ) : phase !== 'round' ? (
        <Alert type="warning" showIcon message="当前阶段不再接受意向填报" description="统筹调剂与公示由管理员统一推进，请前往「我的状态」查看最终去向。" />
      ) : paused ? (
        <Alert type="warning" showIcon message="管理员已暂停填报" description="暂停期间无法提交或修改意向，已填报的数据予以保留。恢复后可继续填报。" />
      ) : (
        <Alert
          type="info"
          showIcon
          message={round === 1 ? '志愿填报说明' : `第 ${round} 轮补录填报`}
          description={
            round === 1
              ? '只能选择已注册的导师（最多 3 位）。提交后，所选导师才能看到你的报名；调剂阶段会按你勾选的范围向其他导师开放。'
              : '上一轮未录取，可在本轮重新填报仍有名额的导师意向（最多 3 个），提交后由管理员结算本轮。'
          }
        />
      )}
      <Card title={`填报导师意向 · ${currentStudent.name}（${currentStudent.studentNo}）· 第 ${round} 轮`} extra={<Button onClick={refresh}>刷新导师列表</Button>}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {selectableMentors.length === 0 && <Alert type="info" showIcon message="暂无已注册导师" description="请等待导师完成注册，再刷新列表填报志愿。预置导师资料不作为可选志愿。" />}
          <div>
            <Typography.Text strong>平行意向（最多 3 个，不分先后）</Typography.Text>
            <Select
              mode="multiple"
              maxCount={3}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择最多 3 位已注册导师"
              notFoundContent="暂无已注册导师"
              value={selected}
              options={mentorOptions}
              onChange={(v) => setSelected(v)}
              optionFilterProp="label"
              disabled={!canFile || selectableMentors.length === 0}
            />
            <Typography.Text type="secondary">已选 {selected.length} / 3</Typography.Text>
          </div>
          <Space size="large">
            <Space>
              <Switch checked={intra} onChange={setIntra} disabled={!canFile} />
              <span>服从实训室内部调剂</span>
            </Space>
            <Space>
              <Switch checked={cross} onChange={setCross} disabled={!canFile} />
              <span>服从全院跨实训室调剂</span>
            </Space>
          </Space>
          <Button type="primary" onClick={submit} loading={submitting} disabled={!canFile || selectableMentors.length === 0}>
            提交 / 修改意向
          </Button>
        </Space>
      </Card>
    </Space>
  )

  const statusTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {confirmed && (
        <Alert
          type="success"
          showIcon
          message="录取已确认"
          description={
            <Space>
              你的去向：{labName(confirmed.labId)} · {mentorName(confirmed.mentorId)}
              <MethodTag method={confirmed.method} />
            </Space>
          }
        />
      )}
      {!confirmed && provisional.length > 0 && (
        <Card title="录取确认">
          {provisional.length === 1 ? (
            <Space direction="vertical">
              <Typography.Text>
                你收到 1 个拟录取：{labName(provisional[0].labId)} · {mentorName(provisional[0].mentorId)}（规则上单个意向自动确认，这里点一下即生效）
              </Typography.Text>
              <Button type="primary" onClick={() => doConfirm(provisional[0].id)}>
                确认录取
              </Button>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text>你收到 {provisional.length} 个拟录取，请选择唯一去向：</Typography.Text>
              <Radio.Group value={offer} onChange={(e) => setOffer(e.target.value)}>
                <Space direction="vertical">
                  {provisional.map((a) => (
                    <Radio key={a.id} value={a.id}>
                      {labName(a.labId)} · {mentorName(a.mentorId)}（总分 {a.total}）
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
              <Button type="primary" disabled={!offer} onClick={() => offer && doConfirm(offer)}>
                确认所选去向
              </Button>
            </Space>
          )}
        </Card>
      )}
      <Card title="我的志愿与录取状态">
        {myApps.length === 0 ? (
          <Empty description="还没有填报志愿，去「意向填报」提交吧" />
        ) : (
          <Table rowKey="id" columns={appColumns} dataSource={myApps} pagination={false} />
        )}
      </Card>
    </Space>
  )

  const catalogTab = (
    <Card title="已注册导师一览">
      <Table rowKey="id" columns={catalogColumns} dataSource={selectableMentors} locale={{ emptyText: '暂无已注册导师' }} pagination={{ pageSize: 10 }} />
    </Card>
  )

  const myObjections = objections.filter((o) => o.studentId === currentStudent.id)
  const submitObjection = async () => {
    if (!reason.trim()) return message.warning('请填写异议理由')
    if (await fileObjection(reason.trim())) {
      setReason('')
      message.success('异议已提交，学院将在 24 小时内处理')
    }
  }
  const objectionColumns = [
    { title: '异议理由', dataIndex: 'reason' },
    { title: '提交时间', dataIndex: 'time' },
    { title: '状态', dataIndex: 'status', render: (v: Objection['status']) => <ObjectionTag status={v} /> },
    { title: '学院回复', dataIndex: 'reply', render: (v: string) => v || '—' },
  ]
  const objectionTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {phase !== 'published' ? (
        <Alert type="warning" showIcon message="异议申诉仅在公示期开放" description="管理员公示录取结果后，可在此提交异议。" />
      ) : (
        <Card title="提交异议（公示期内，学院 24 小时处理）">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input.TextArea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说明异议理由，例如面试评分复核、录取去向疑问等"
            />
            <Button type="primary" onClick={submitObjection}>
              提交异议
            </Button>
          </Space>
        </Card>
      )}
      <Card title="我的异议记录">
        {myObjections.length === 0 ? (
          <Empty description="暂无异议记录" />
        ) : (
          <Table rowKey="id" columns={objectionColumns} dataSource={myObjections} pagination={false} />
        )}
      </Card>
    </Space>
  )

  const submitResume = async () => {
    if (savingResume) return
    if (!resumeDraft.intro.trim()) return message.warning('请填写个人简介')
    if (!resumeDraft.selfEval.trim()) return message.warning('请填写自我评价')
    setSavingResume(true)
    try {
      if (await saveResume({
        phone: resumeDraft.phone.trim(),
        email: resumeDraft.email.trim(),
        intro: resumeDraft.intro.trim(),
        awards: resumeDraft.awards.trim(),
        selfEval: resumeDraft.selfEval.trim(),
      })) message.success('简历已保存，你报名的导师可以查看')
    } finally { setSavingResume(false) }
  }

  const resumeTab = (
    <Card
      title="我的简历"
      extra={myResume ? <Typography.Text type="secondary">上次更新：{new Date(myResume.updatedAt).toLocaleString('zh-CN', { hour12: false })}</Typography.Text> : null}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="简历用于导师面试参考：提交报名后，你所选的导师可以查看；调剂阶段，符合你调剂意愿的导师也能看到。可随时修改。" />
        <Form layout="vertical">
          <Typography.Title level={5}>基本信息</Typography.Title>
          <Descriptions
            column={3}
            size="small"
            bordered
            style={{ marginBottom: 16 }}
            items={[
              { key: 'name', label: '姓名', children: currentStudent.name },
              { key: 'no', label: '学号', children: currentStudent.studentNo },
              { key: 'class', label: '班级', children: currentStudent.className },
            ]}
          />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="联系电话（选填）">
                <Input
                  maxLength={20}
                  placeholder="如：13800000000"
                  value={resumeDraft.phone}
                  onChange={(e) => setResumeDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮箱（选填）">
                <Input
                  maxLength={100}
                  placeholder="如：student@example.com"
                  value={resumeDraft.email}
                  onChange={(e) => setResumeDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="个人简介" required>
            <Input.TextArea
              rows={4}
              maxLength={2000}
              showCount
              placeholder="介绍你的专业背景、技能特长、项目或实践经历等"
              value={resumeDraft.intro}
              onChange={(e) => setResumeDraft((d) => ({ ...d, intro: e.target.value }))}
            />
          </Form.Item>
          <Form.Item label="获奖情况（选填）">
            <Input.TextArea
              rows={4}
              maxLength={2000}
              showCount
              placeholder="如：2025 年校级程序设计竞赛二等奖；没有可留空"
              value={resumeDraft.awards}
              onChange={(e) => setResumeDraft((d) => ({ ...d, awards: e.target.value }))}
            />
          </Form.Item>
          <Form.Item label="自我评价" required>
            <Input.TextArea
              rows={4}
              maxLength={2000}
              showCount
              placeholder="评价自己的学习态度、协作能力、优缺点与进组后的规划"
              value={resumeDraft.selfEval}
              onChange={(e) => setResumeDraft((d) => ({ ...d, selfEval: e.target.value }))}
            />
          </Form.Item>
          <Button type="primary" onClick={submitResume} loading={savingResume}>
            {myResume ? '保存修改' : '提交简历'}
          </Button>
        </Form>
      </Space>
    </Card>
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type={confirmed ? 'success' : 'info'}
        showIcon
        message={`当前进度：第 ${round} 轮 · ${phase === 'round' ? '分轮录取 / 补录' : phase === 'adjustment' ? '统筹调剂' : '结果公示'} · ${confirmed ? '你已录取' : '你尚未录取'}`}
      />
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="可选实训室" value={new Set(selectableMentors.map((m) => m.labId)).size} suffix="个" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="可选导师" value={selectableMentors.length} suffix="位" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="本轮已填意向" value={myRoundApps.length} suffix="/ 3" />
          </Card>
        </Col>
      </Row>
      <Tabs
        defaultActiveKey="fill"
        items={[
          { key: 'fill', label: '意向填报', children: fillTab },
          { key: 'resume', label: '我的简历', children: resumeTab },
          { key: 'status', label: '我的状态', children: statusTab },
          { key: 'catalog', label: '实训室一览', children: catalogTab },
          { key: 'objection', label: '异议申诉', children: objectionTab },
        ]}
      />
      <Drawer
        title={profile ? `导师简介 · ${profile.name}` : '导师简介'}
        open={!!profile}
        onClose={() => setProfile(null)}
        width={480}
      >
        {profile && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'lab', label: '所属实训室', children: labName(profile.labId) },
                { key: 'direction', label: '研究方向', children: profile.direction },
                { key: 'capacity', label: '招生名额', children: `${profile.capacity} 人` },
              ]}
            />
            <div>
              <Typography.Title level={5}>导师简介</Typography.Title>
              {profile.bio ? (
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{profile.bio}</Typography.Paragraph>
              ) : (
                <Empty description="这位导师还没有填写简介" />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </Space>
  )
}