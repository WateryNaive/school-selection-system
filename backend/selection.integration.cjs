require('dotenv/config')
require('ts-node/register')
require('reflect-metadata')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')
const { NestFactory } = require('@nestjs/core')
const { hashPassword } = require('./src/auth.util')

const schema = `test_visibility_${randomBytes(6).toString('hex')}`
const originalUrl = process.env.DATABASE_URL
const url = new URL(originalUrl)
url.searchParams.set('schema', schema)
process.env.DATABASE_URL = url.toString()
process.env.ADMIN_PASSWORD = 'isolated-test-admin'
const owner = new PrismaClient({ datasources: { db: { url: originalUrl } } })
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } })
let app
let checks = 0
const check = (value, label) => { assert.ok(value, label); checks++ }

async function cleanup() {
  if (app) await app.close()
  await db.$disconnect()
  await owner.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
  await owner.$disconnect()
}

async function main() {
  await owner.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: process.env, stdio: 'pipe' })
  const { AppModule } = require('./src/app.module')
  app = await NestFactory.create(AppModule, { logger: false })
  if (process.env.KEEP_TEST_SERVER) app.getHttpAdapter().getInstance().post('/__test/finish', (_req, res) => {
    res.json({ ok: true })
    cleanup().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
  })
  await app.listen(process.env.KEEP_TEST_SERVER ? 3001 : 0, '127.0.0.1')
  const base = await app.getUrl()
  async function request(path, token, body, expected = body === undefined ? 200 : 201) {
    const r = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await r.json()
    assert.equal(r.status, expected, `${path}: ${JSON.stringify(data)}`)
    checks++
    return data
  }
  const login = (role, account, password) => request('auth/login', null, { role, account, password })
  async function register(role, name, labId) {
    const r = await request('auth/register', null, { role, name, labId, className: '验证2601' })
    return login(role, r.account, r.initialPassword)
  }
  await db.lab.createMany({ data: [
    { id: 'lab1', name: '视觉验证室', direction: '视觉方向', quota: 60 },
    { id: 'lab2', name: '语言验证室', direction: '语言方向', quota: 60 },
  ] })
  await db.sessionState.create({ data: { id: 1 } })
  await db.mentor.create({ data: { id: 'seed-mentor', name: '未注册导师', account: '20262001', password: hashPassword('262001'), labId: 'lab1', direction: '预置方向', capacity: 12 } })
  const guest = await request('bootstrap?studentId=s0&role=admin')
  check(!guest.students.length && !guest.mentors.length && !guest.applications.length && !guest.notices.length && !Object.keys(guest.resumes).length, 'guest has no private records or unregistered choices')
  await request('auth/login', null, { role: 'mentor', account: '20262001', password: '262001' }, 403)
  for (const route of ['intentions', 'score', 'interview-notices', 'mentor/bio', 'mentor/profile', 'admin/mentor-profile', 'evaluation', 'resume', 'generate', 'confirm', 'settle', 'next-round', 'adjust', 'allocate', 'publish', 'notices/read', 'notices/read-all', 'objections', 'objections/resolve']) await request(route, null, {}, 401)
  const a = await register('mentor', '导师甲', 'lab1')
  const b = await register('mentor', '导师乙', 'lab1')
  const c = await register('mentor', '导师丙', 'lab2')
  const admin = await login('admin', 'admin', process.env.ADMIN_PASSWORD)
  const own = await register('student', '自己的学生')
  const no = await register('student', '不服从学生')
  const intra = await register('student', '室内学生')
  const cross = await register('student', '跨室学生')
  const otherLab = await register('student', '其他室内学生')
  const placed = await register('student', '已录取学生')
  const file = (s, ids, intra = false, cross = false) => request('intentions', s.token, { studentId: 'forged', mentorIds: ids, prefs: { intra, cross } })
  await request('intentions', own.token, { mentorIds: ['seed-mentor'], prefs: { intra: false, cross: false } }, 400)
  await request('intentions', own.token, { mentorIds: [a.userId, a.userId], prefs: { intra: false, cross: false } }, 400)
  await file(own, [a.userId, b.userId])
  await file(no, [b.userId])
  await file(intra, [b.userId], true)
  await file(cross, [c.userId], false, true)
  await file(otherLab, [c.userId], true)
  await file(placed, [b.userId], false, true)
  await db.application.updateMany({ where: { studentId: placed.userId }, data: { status: 'confirmed', method: 'normal' } })
  await db.objection.create({ data: { id: 'secret-objection', studentId: no.userId, reason: 'private reason', status: 'pending', time: 'now' } })
  const secretNotice = await db.notice.create({ data: { id: 'secret-notice', to: no.userId, title: 'private', body: 'private', time: 'now' } })
  const mine = await request(`bootstrap?studentId=${no.userId}&mentorId=${b.userId}&role=admin`, a.token)
  check(mine.students.length === 1 && mine.students[0].id === own.userId, 'normal mentor sees only own student')
  check(mine.applications.length === 1 && mine.applications[0].mentorId === a.userId, 'other application of same student hidden')
  check(!mine.adjustmentCandidates.length && !mine.objections.length && !mine.notices.length, 'no other private collections')
  check(Object.keys(mine.prefs).join() === own.userId && mine.currentStudent === null, 'preferences and current student scoped')
  check(!JSON.stringify(mine).includes('password'), 'no password hashes')
  const aid = mine.applications[0].id
  const score = { attitude: 20, logic: 21, programming: 22, time: 23 }
  await request('score', b.token, { appId: aid, scores: score }, 403)
  await request('score', own.token, { appId: aid, scores: score }, 403)
  await request('score', a.token, { appId: aid, scores: { ...score, time: 26 } }, 400)
  const scored = await request('score', a.token, { appId: aid, scores: score })
  check(scored.applications.length === 1 && scored.students.length === 1, 'score response scoped')
  const batch = await register('student', '批量学生')
  await file(batch, [a.userId])
  const batchAid = (await db.application.findFirst({ where: { studentId: batch.userId, mentorId: a.userId } })).id
  const bAid = (await db.application.findFirst({ where: { studentId: own.userId, mentorId: b.userId } })).id
  const interview = (appIds, extra = {}) => ({ appIds, interviewTime: '2026-11-13T09:00', location: '求实楼 302', note: '请携带作品集', ...extra })
  await request('interview-notices', own.token, interview([aid]), 403)
  await request('interview-notices', admin.token, interview([aid]), 403)
  await request('interview-notices', b.token, interview([aid]), 403)
  await request('interview-notices', a.token, interview([bAid]), 403)
  for (const body of [
    { ...interview([aid]), appIds: [] },
    interview([aid, aid]),
    { ...interview([aid]), interviewTime: 'not-a-date' },
    { ...interview([aid]), location: '   ' },
    { ...interview([aid]), note: 'x'.repeat(501) },
    { appIds: [aid], location: '求实楼 302' },
    { appIds: [aid], interviewTime: '2026-11-13T09:00' },
  ]) await request('interview-notices', a.token, body, 400)
  const noticesBefore = await db.notice.count()
  await request('interview-notices', a.token, interview([aid, bAid]), 403)
  check(await db.notice.count() === noticesBefore, 'mixed recipients create no partial notices')
  const appsBeforeInterview = await db.application.findMany({ orderBy: { id: 'asc' } })
  const sentOne = await request('interview-notices', a.token, interview([aid]))
  check(sentOne.applications.length === 2 && sentOne.students.length === 2 && !sentOne.notices.length, 'interview send response scoped')
  const oneNotice = await db.notice.findFirst({ where: { to: own.userId, title: { startsWith: '面试通知' } } })
  check(oneNotice && !oneNotice.read && oneNotice.body.includes('求实楼 302') && oneNotice.body.includes('请携带作品集') && oneNotice.body.includes('09:00'), 'interview notice delivered unread')
  const inbox = await request('bootstrap', own.token)
  check(inbox.notices.some((n) => n.id === oneNotice.id && !n.read), 'student sees interview notice')
  await request('notices/read', no.token, { id: oneNotice.id }, 403)
  await request('notices/read', own.token, { id: oneNotice.id })
  check((await db.notice.findUnique({ where: { id: oneNotice.id } })).read, 'student can mark interview notice read')
  const sentBatch = await request('interview-notices', a.token, interview([aid, batchAid], { note: '' }))
  check(sentBatch.applications.length === 2 && sentBatch.students.length === 2 && !sentBatch.notices.length, 'batch interview response scoped')
  const batchNotice = await db.notice.findFirst({ where: { to: batch.userId, title: { startsWith: '面试通知' } } })
  check(batchNotice && !batchNotice.read && batchNotice.body.includes('求实楼 302'), 'batch recipient receives interview notice')
  check((await db.notice.count({ where: { to: own.userId, title: { startsWith: '面试通知' } } })) === 2, 'each send creates recipient-specific notices')
  assert.deepEqual(await db.application.findMany({ orderBy: { id: 'asc' } }), appsBeforeInterview)
  checks++
  await request('mentor/bio', own.token, { bio: 'x' }, 403)
  await request('mentor/bio', admin.token, { bio: 'x' }, 403)
  await request('mentor/bio', a.token, { bio: 'x'.repeat(1001) }, 400)
  await request('mentor/bio', a.token, { bio: 123 }, 400)
  await request('mentor/bio', a.token, {}, 400)
  const bioText = '  研究方向：目标检测。\n欢迎有 Python 基础的同学。  '
  const withBio = await request('mentor/bio', a.token, { bio: bioText })
  check(withBio.mentors.find((m) => m.id === a.userId).bio === bioText.trim(), 'mentor bio saved trimmed and returned in bootstrap')
  const studentView = await request('bootstrap', own.token)
  check(studentView.mentors.find((m) => m.id === a.userId).bio === bioText.trim(), 'student sees registered mentor bio')
  await request('mentor/bio', b.token, { bio: '乙的简介' })
  const bView = await request('bootstrap', b.token)
  check(bView.mentors.find((m) => m.id === b.userId).bio === '乙的简介', 'mentor updates only own bio')
  check(bView.mentors.find((m) => m.id === a.userId).bio === bioText.trim(), 'updating one mentor bio leaves others untouched')
  await request('mentor/bio', a.token, { bio: '' })
  check((await request('bootstrap', a.token)).mentors.find((m) => m.id === a.userId).bio === '', 'mentor can clear bio')
  await request('evaluation', own.token, { appId: aid, evaluation: 'x' }, 403)
  await request('evaluation', admin.token, { appId: aid, evaluation: 'x' }, 403)
  await request('evaluation', b.token, { appId: aid, evaluation: 'x' }, 403)
  await request('evaluation', a.token, { appId: aid, evaluation: 'x'.repeat(2001) }, 400)
  await request('evaluation', a.token, { appId: aid, evaluation: 123 }, 400)
  const evalText = '  优点：编程扎实。\n缺点：项目经验少。  '
  const withEval = await request('evaluation', a.token, { appId: aid, evaluation: evalText })
  check(withEval.applications.find((x) => x.id === aid).evaluation === evalText.trim(), 'mentor evaluation saved trimmed and returned')
  check((await request('bootstrap', own.token)).applications.find((x) => x.id === aid).evaluation === '', 'student cannot see interview evaluation')
  check((await request('bootstrap', admin.token)).applications.find((x) => x.id === aid).evaluation === evalText.trim(), 'admin sees interview evaluation')
  await request('evaluation', a.token, { appId: aid, evaluation: '' })
  check((await request('bootstrap', a.token)).applications.find((x) => x.id === aid).evaluation === '', 'mentor can clear evaluation')
  await request('resume', a.token, { intro: 'x', selfEval: 'y' }, 403)
  await request('resume', admin.token, { intro: 'x', selfEval: 'y' }, 403)
  for (const body of [
    { selfEval: 'x' },
    { intro: '   ', selfEval: 'x' },
    { intro: 'x'.repeat(2001), selfEval: 'x' },
    { intro: 123, selfEval: 'x' },
    { intro: 'x' },
    { intro: 'x', selfEval: '   ' },
    { intro: 'x', selfEval: 'x'.repeat(2001) },
    { intro: 'x', selfEval: 'x', awards: 'x'.repeat(2001) },
    { intro: 'x', selfEval: 'x', awards: 123 },
    { intro: 'x', selfEval: 'x', phone: 'abc' },
    { intro: 'x', selfEval: 'x', phone: '1'.repeat(21) },
    { intro: 'x', selfEval: 'x', email: 'not-an-email' },
    { intro: 'x', selfEval: 'x', email: `${'x'.repeat(95)}@b.com` },
  ]) await request('resume', own.token, body, 400)
  const resumeData = { phone: ' 13800000000 ', email: ' own@example.com ', intro: '  专业背景：软件工程。\n熟悉 Python。  ', awards: '  校级竞赛二等奖  ', selfEval: '  学习认真，协作能力强。  ' }
  const withResume = await request('resume', own.token, resumeData)
  const savedResume = withResume.resumes[own.userId]
  check(savedResume && savedResume.intro === resumeData.intro.trim() && savedResume.selfEval === resumeData.selfEval.trim() && savedResume.phone === '13800000000' && savedResume.email === 'own@example.com' && savedResume.awards === resumeData.awards.trim(), 'resume saved trimmed and returned to owner')
  check(Object.keys(withResume.resumes).join() === own.userId, 'student sees only own resume')
  check(!(await request('bootstrap', no.token)).resumes[own.userId], 'other student cannot see resume')
  check((await request('bootstrap', a.token)).resumes[own.userId]?.intro === resumeData.intro.trim(), 'applicant mentor sees resume')
  check(!(await request('bootstrap', c.token)).resumes[own.userId], 'non-applicant mentor cannot see resume')
  check((await request('bootstrap', admin.token)).resumes[own.userId]?.intro === resumeData.intro.trim(), 'admin sees all resumes')
  await request('resume', intra.token, { intro: '室内学生简介', selfEval: '室内学生自评' })
  await request('resume', cross.token, { intro: '跨室学生简介', selfEval: '跨室学生自评' })
  await request('resume', no.token, { intro: '不服从学生简介', selfEval: '不服从学生自评' })
  const minimal = await request('resume', batch.token, { intro: '批量学生简介', selfEval: '批量学生自评' })
  check(minimal.resumes[batch.userId].phone === '' && minimal.resumes[batch.userId].email === '' && minimal.resumes[batch.userId].awards === '', 'optional resume fields default empty')
  check(await db.resume.count() === 5, 'one resume row per student')
  const updatedResume = await request('resume', own.token, { ...resumeData, intro: '  更新后的简介。  ' })
  check(updatedResume.resumes[own.userId].intro === '更新后的简介。', 'resume update overwrites content')
  check(await db.resume.count() === 5, 'resume update does not duplicate rows')
  check((await request('bootstrap', a.token)).resumes[own.userId].intro === '更新后的简介。', 'mentor sees updated resume')
  await request('mentor/profile', own.token, { labId: 'lab1', direction: 'x' }, 403)
  await request('mentor/profile', admin.token, { labId: 'lab1', direction: 'x' }, 403)
  await request('mentor/profile', a.token, { labId: 'no-such-lab', direction: 'x' }, 400)
  await request('mentor/profile', a.token, { labId: 'lab1', direction: '   ' }, 400)
  await request('mentor/profile', a.token, { labId: 'lab1', direction: 'x'.repeat(101) }, 400)
  await request('mentor/profile', a.token, { labId: 'lab1', direction: 123 }, 400)
  await request('mentor/profile', a.token, { labId: 'lab1' }, 400)
  await request('mentor/profile', a.token, { labId: 'lab2', direction: '新方向' }, 400)
  const profA = await request('mentor/profile', a.token, { labId: 'lab1', direction: '  目标检测与跟踪  ' })
  check(profA.mentors.find((m) => m.id === a.userId).direction === '目标检测与跟踪', 'mentor direction saved trimmed')
  check(profA.mentors.find((m) => m.id === a.userId).labId === 'lab1', 'mentor lab locked once applications exist')
  check((await request('bootstrap', own.token)).mentors.find((m) => m.id === a.userId).direction === '目标检测与跟踪', 'student sees updated mentor direction')
  const d = await register('mentor', '导师丁', 'lab1')
  const profD = await request('mentor/profile', d.token, { labId: 'lab2', direction: '边缘计算' })
  check(profD.mentors.find((m) => m.id === d.userId).labId === 'lab2', 'mentor without applications can switch lab')
  check(profD.mentors.find((m) => m.id === d.userId).direction === '边缘计算', 'switched-lab mentor direction saved')
  await request('score', a.token, { appId: batchAid, scores: score })
  const generated = await request('generate', a.token, { labId: 'lab2', mentorId: b.userId })
  check(generated.applications[0].status === 'provisional', 'mentor generation uses authenticated identity')
  await request('interview-notices', a.token, interview([aid]), 403)
  check((await db.application.findFirst({ where: { studentId: own.userId, mentorId: b.userId } })).status === 'submitted', 'generation leaves other mentor untouched')
  await request('confirm', no.token, { appId: aid, studentId: own.userId }, 403)
  await request('notices/read', own.token, { id: secretNotice.id }, 403)
  const read = await request('notices/read-all', own.token, {})
  check(read.students.length === 1 && read.applications.every((x) => x.studentId === own.userId), 'student mutation responses scoped')
  check(!(await db.notice.findUnique({ where: { id: secretNotice.id } })).read, 'mark-all cannot touch another student notice')
  for (const route of ['settle', 'next-round', 'adjust', 'allocate', 'publish', 'objections/resolve']) await request(route, a.token, {}, 403)
  await request('adjust', admin.token, {})
  await request('interview-notices', a.token, interview([batchAid]), 400)
  const poolA = await request('bootstrap', a.token)
  assert.deepEqual(poolA.adjustmentCandidates.map((s) => s.id).sort(), [intra.userId, cross.userId].sort())
  checks++
  const poolC = await request('bootstrap', c.token)
  check(!poolC.students.some((s) => s.id === intra.userId || s.id === no.userId || s.id === placed.userId), 'intra-only, no-consent, placed do not leak across labs')
  check(poolA.resumes[intra.userId]?.intro === '室内学生简介' && poolA.resumes[cross.userId]?.intro === '跨室学生简介', 'adjustment pool exposes candidate resumes')
  check(!poolA.resumes[no.userId] && !poolA.resumes[placed.userId], 'no-consent and placed resumes stay hidden from pool')
  check(poolC.resumes[cross.userId]?.intro === '跨室学生简介' && !poolC.resumes[intra.userId], 'cross-lab mentor sees only cross-consent candidate resume')
  check(poolA.applications.every((x) => x.mentorId === a.userId) && !poolA.objections.length, 'pool does not expose other application histories or objections')
  await request('score', a.token, { appId: aid, scores: score }, 400)
  await request('generate', a.token, {}, 400)
  await request('intentions', own.token, { mentorIds: [a.userId], prefs: { intra: true, cross: true } }, 400)
  await request('allocate', admin.token, {})
  const confirmed = await db.application.findMany({ where: { status: 'confirmed' } })
  check(confirmed.every((x) => x.mentorId !== 'seed-mentor'), 'allocation uses registered mentors only')
  check(!confirmed.some((x) => x.studentId === no.userId || x.studentId === own.userId), 'no consent means no automatic allocation')
  const assignedIntra = confirmed.find((x) => x.studentId === intra.userId)
  check(assignedIntra && assignedIntra.labId === 'lab1', 'intra allocation remains in selected lab')
  check((await request('bootstrap', a.token)).adjustmentCandidates.length === 0, 'placed candidates leave pool')
  await request('publish', admin.token, {})
  check(!(await request('bootstrap', a.token)).adjustmentCandidates.length, 'published phase closes candidate pool')
  await request('evaluation', a.token, { appId: aid, evaluation: 'late' }, 400)
  const publicData = await request('public-results')
  check(publicData.applications.every((x) => x.status === 'confirmed' && x.scores === null) && !publicData.objections.length && !Object.keys(publicData.prefs).length && !Object.keys(publicData.resumes).length, 'public result excludes private data')
  check(!(await request('bootstrap')).students.length, 'anonymous bootstrap remains private after publication')
  await request('admin/mentor-profile', a.token, { mentorId: a.userId, labId: 'lab1', direction: 'x' }, 403)
  await request('admin/mentor-profile', own.token, { mentorId: a.userId, labId: 'lab1', direction: 'x' }, 403)
  await request('admin/mentor-profile', admin.token, { mentorId: 'no-such-mentor', labId: 'lab1', direction: 'x' }, 400)
  await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'no-lab', direction: 'x' }, 400)
  await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'lab1', direction: '   ' }, 400)
  await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'lab1', direction: 'x'.repeat(101) }, 400)
  await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'lab1', direction: 123 }, 400)
  const adminDir = await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'lab1', direction: '  管理员改方向  ' })
  check(adminDir.mentors.find((m) => m.id === a.userId).direction === '管理员改方向', 'admin updates mentor direction trimmed')
  const aAppsBefore = await db.application.findMany({ where: { mentorId: a.userId } })
  check(aAppsBefore.length > 0 && aAppsBefore.every((x) => x.labId === 'lab1'), 'mentor a applications start in lab1')
  const adminLab = await request('admin/mentor-profile', admin.token, { mentorId: a.userId, labId: 'lab2', direction: '管理员改方向' })
  check(adminLab.mentors.find((m) => m.id === a.userId).labId === 'lab2', 'admin switches mentor lab despite applications')
  const aAppsAfter = await db.application.findMany({ where: { mentorId: a.userId } })
  check(aAppsAfter.length === aAppsBefore.length && aAppsAfter.every((x) => x.labId === 'lab2'), 'admin lab switch migrates all mentor applications')
  await login('mentor', a.account, a.account.slice(-6))
  await request('bootstrap', a.token, undefined, 401)
  console.log(`INTEGRATION_OK ${checks} checks; isolated schema ${schema}`)

  if (process.env.KEEP_TEST_SERVER) {
    await db.$transaction([
      db.resume.deleteMany(), db.application.deleteMany(), db.objection.deleteMany(), db.notice.deleteMany(), db.session.deleteMany(),
      db.student.deleteMany(), db.mentor.deleteMany({ where: { id: { not: 'seed-mentor' } } }),
      db.sessionState.update({ where: { id: 1 }, data: { phase: 'round', round: 1 } }),
    ])
    await db.student.create({ data: { id: 's0', name: '浏览器验证学生', studentNo: '20260001', className: '验证2601', password: hashPassword('260001') } })
    console.log(`BROWSER_TEST_READY ${base}; admin=isolated-test-admin; schema=${schema}`)
  } else await cleanup()
}

main().catch(async (e) => {
  console.error(e)
  await cleanup().catch(console.error)
  process.exitCode = 1
})
