import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { Actor } from './auth.service'
import {
  App, Prefs, Scores, totalOf,
  generateForLab, generateAll, autoConfirmSeeded, fillWaitlists, refileSeeded, adjust,
} from './algo'

const stamp = () => new Date().toLocaleString('zh-CN', { hour12: false })
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

@Injectable()
export class SelectionService {
  constructor(private prisma: PrismaService) {}

  private async ctx() {
    const [labs, mentors, students, apps, state] = await Promise.all([
      this.prisma.lab.findMany(),
      this.prisma.mentor.findMany(),
      this.prisma.student.findMany(),
      this.prisma.application.findMany(),
      this.prisma.sessionState.findUnique({ where: { id: 1 } }),
    ])
    const applications: App[] = apps.map((a) => ({
      id: a.id, studentId: a.studentId, mentorId: a.mentorId, labId: a.labId,
      scores: (a.scores as Scores | null) ?? null, total: a.total, status: a.status, round: a.round, method: a.method ?? null,
    }))
    const prefs: Record<string, Prefs> = {}
    students.forEach((s) => (prefs[s.id] = { intra: s.intra, cross: s.cross }))
    const evaluations: Record<string, string> = {}
    apps.forEach((a) => (evaluations[a.id] = a.evaluation))
    return { labs, mentors, students, applications, prefs, evaluations, round: state?.round ?? 1, phase: state?.phase ?? 'round' }
  }

  async bootstrap(actor: Actor | null = null, publicResults = false) {
    const c = await this.ctx()
    const [allNotices, allObjections] = await Promise.all([
      this.prisma.notice.findMany({ orderBy: { time: 'desc' } }),
      this.prisma.objection.findMany({ orderBy: { time: 'desc' } }),
    ])
    const admin = actor?.role === 'admin'
    const student = actor?.role === 'student'
    const mentor = actor?.role === 'mentor' ? c.mentors.find((m) => m.id === actor.userId && m.registered) : undefined
    const publicList = !actor && publicResults && c.phase === 'published'
    const originalApps = c.applications.filter((a) => !a.method || a.method === 'normal' || a.method === 'waitlist')
    const placed = new Set(c.applications.filter((a) => a.status === 'confirmed').map((a) => a.studentId))
    const ownApplicants = new Set(originalApps.filter((a) => a.mentorId === mentor?.id).map((a) => a.studentId))
    const adjustmentCandidates = mentor && c.phase === 'adjustment'
      ? c.students.filter((s) => !placed.has(s.id) && !ownApplicants.has(s.id) && (
        s.cross || (s.intra && originalApps.some((a) => a.studentId === s.id && a.labId === mentor.labId))
      )).map((s) => ({
        id: s.id, name: s.name, studentNo: s.studentNo, className: s.className,
        prefs: c.prefs[s.id], total: Math.max(0, ...originalApps.filter((a) => a.studentId === s.id && a.scores).map((a) => a.total)),
      }))
      : []
    const applications = c.applications.filter((a) =>
      admin || (student && a.studentId === actor.userId) || (mentor && a.mentorId === mentor.id) || (publicList && a.status === 'confirmed'),
    ).map((a) => {
      const base = publicList ? { ...a, scores: null, total: 0 } : a
      const canSeeEvaluation = admin || (mentor && a.mentorId === mentor.id)
      return { ...base, evaluation: canSeeEvaluation ? (c.evaluations[a.id] ?? '') : '' }
    })
    const visibleStudents = new Set(applications.map((a) => a.studentId))
    if (student) visibleStudents.add(actor.userId)
    adjustmentCandidates.forEach((s) => visibleStudents.add(s.id))
    const students = c.students.filter((s) => admin || visibleStudents.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, studentNo: s.studentNo, className: s.className }))
    const allResumes = await this.prisma.resume.findMany()
    const resumes = Object.fromEntries(allResumes
      .filter((r) => !!actor && (admin || visibleStudents.has(r.studentId)))
      .map((r) => [r.studentId, { phone: r.phone, email: r.email, intro: r.intro, awards: r.awards, selfEval: r.selfEval, updatedAt: r.updatedAt }]))
    const referencedMentors = new Set(applications.map((a) => a.mentorId))
    const mentors = c.mentors.filter((m) => admin || m.registered || referencedMentors.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, direction: m.direction, capacity: m.capacity, labId: m.labId, account: m.account, registered: m.registered, bio: m.bio }))
    const prefs = actor ? Object.fromEntries(students.map((s) => [s.id, c.prefs[s.id]])) : {}
    return {
      labs: c.labs, mentors, students, adjustmentCandidates,
      currentStudent: student ? students.find((s) => s.id === actor.userId) ?? null : null,
      applications, prefs, resumes, round: c.round, phase: c.phase,
      notices: allNotices.filter((n) => admin || (student && (n.to === actor.userId || n.to === 'all'))),
      objections: allObjections.filter((o) => admin || (student && o.studentId === actor.userId)),
    }
  }

  private async syncApps(next: App[], current: App[]) {
    const curMap = new Map(current.map((a) => [a.id, a]))
    const nextIds = new Set(next.map((a) => a.id))
    const creates = next.filter((a) => !curMap.has(a.id))
    const deletes = current.filter((a) => !nextIds.has(a.id))
    const updates = next.filter((a) => {
      const c = curMap.get(a.id)
      return c && (c.status !== a.status || (c.method ?? null) !== (a.method ?? null) || c.total !== a.total || JSON.stringify(c.scores) !== JSON.stringify(a.scores))
    })
    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (deletes.length) {
      ops.push(this.prisma.application.deleteMany({ where: { id: { in: deletes.map((a) => a.id) } } }))
    }
    if (creates.length) {
      ops.push(this.prisma.application.createMany({
        data: creates.map((a) => ({
          id: a.id, studentId: a.studentId, mentorId: a.mentorId, labId: a.labId,
          scores: a.scores ? (a.scores as unknown as Prisma.InputJsonValue) : Prisma.DbNull, total: a.total, status: a.status, round: a.round, method: a.method ?? null,
        })),
      }))
    }
    for (const a of updates) {
      ops.push(this.prisma.application.update({
        where: { id: a.id },
        data: { status: a.status, method: a.method ?? null, total: a.total, scores: a.scores ? (a.scores as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
      }))
    }
    if (ops.length) await this.prisma.$transaction(ops)
  }

  private async notify(to: string, title: string, body: string) {
    await this.prisma.notice.create({ data: { id: uid('n'), to, title, body, time: stamp(), read: false } })
  }

  private async setState(data: { round?: number; phase?: string }) {
    await this.prisma.sessionState.update({ where: { id: 1 }, data })
  }

  async fileIntentions(studentId: string, mentorIds: string[], prefs: Prefs) {
    const c = await this.ctx()
    if (c.phase !== 'round' || c.applications.some((a) => a.studentId === studentId && a.status === 'confirmed')) throw new BadRequestException('当前不能填报意向')
    if (!Array.isArray(mentorIds) || mentorIds.length < 1 || mentorIds.length > 3 || new Set(mentorIds).size !== mentorIds.length) throw new BadRequestException('请选择 1 至 3 位不同的已注册导师')
    if (!prefs || typeof prefs.intra !== 'boolean' || typeof prefs.cross !== 'boolean') throw new BadRequestException('请选择调剂意愿')
    if (mentorIds.some((id) => !c.mentors.some((m) => m.id === id && m.registered))) throw new BadRequestException('只能填报已注册的导师，请刷新导师列表')
    const others = c.applications.filter((a) => !(a.studentId === studentId && a.round === c.round && a.status !== 'confirmed'))
    const added: App[] = mentorIds.map((mid) => {
      const m = c.mentors.find((x) => x.id === mid)!
      return { id: `app-${studentId}-${mid}-r${c.round}`, studentId, mentorId: mid, labId: m.labId, scores: null, total: 0, status: 'submitted', round: c.round }
    })
    await this.syncApps([...others, ...added], c.applications)
    await this.prisma.student.update({ where: { id: studentId }, data: { intra: prefs.intra, cross: prefs.cross } })
    await this.notify(studentId, '意向已提交', `第 ${c.round} 轮已提交 ${mentorIds.length} 个导师意向，等待面试评分。`)
  }

  async score(mentorId: string, appId: string, scores: Scores) {
    const c = await this.ctx()
    const app = c.applications.find((a) => a.id === appId && a.mentorId === mentorId)
    if (!app) throw new ForbiddenException('只能评分报给自己的学生')
    if (c.phase !== 'round' || app.round !== c.round || !['submitted', 'scored'].includes(app.status)) throw new BadRequestException('当前报名不可评分')
    if (!scores || !['attitude', 'logic', 'programming', 'time'].every((key) => {
      const value = scores[key as keyof Scores]
      return Number.isInteger(value) && value >= 0 && value <= 25
    })) throw new BadRequestException('各项分数须为 0 至 25 的整数')
    await this.syncApps(c.applications.map((a) => a.id === appId ? { ...a, scores, total: totalOf(scores), status: 'scored' } : a), c.applications)
    await this.notify(app.studentId, '面试评分已更新', `面试总分 ${totalOf(scores)}，等待导师生成名单。`)
  }

  async sendInterviewNotices(mentorId: string, appIds: string[], interviewTime: string, location: string, note = '') {
    const c = await this.ctx()
    if (c.phase !== 'round') throw new BadRequestException('当前阶段不能发送面试通知')
    const mentor = c.mentors.find((m) => m.id === mentorId && m.registered)
    if (!mentor) throw new ForbiddenException('请先完成导师注册')
    if (!Array.isArray(appIds) || appIds.length < 1 || new Set(appIds).size !== appIds.length) throw new BadRequestException('请选择需要通知的学生')
    if (typeof interviewTime !== 'string' || !interviewTime.trim() || interviewTime.length > 40 || !Number.isFinite(Date.parse(interviewTime))) throw new BadRequestException('请选择有效的面试时间')
    if (typeof location !== 'string' || !location.trim() || location.trim().length > 100) throw new BadRequestException('请填写面试地点（100 字以内）')
    if (typeof note !== 'string' || note.length > 500) throw new BadRequestException('补充说明不能超过 500 字')
    const targets: App[] = []
    for (const id of appIds) {
      const app = c.applications.find((a) => a.id === id && a.mentorId === mentorId && a.round === c.round && (a.status === 'submitted' || a.status === 'scored'))
      if (!app) throw new ForbiddenException('只能通知本轮报给自己且待面试的学生')
      targets.push(app)
    }
    const lab = c.labs.find((l) => l.id === mentor.labId)
    const when = new Date(interviewTime).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    const body = [
      `${mentor.name}（${lab?.name ?? '实训室'}）邀请你参加面试。`,
      `面试时间：${when}`,
      `面试地点：${location.trim()}`,
      ...(note.trim() ? [`说明：${note.trim()}`] : []),
    ].join('\n')
    await this.prisma.notice.createMany({
      data: targets.map((a) => ({ id: uid('n'), to: a.studentId, title: `面试通知 · ${mentor.name}`, body, time: stamp(), read: false })),
    })
  }

  async updateBio(mentorId: string, bio: string) {
    const mentor = await this.prisma.mentor.findFirst({ where: { id: mentorId, registered: true } })
    if (!mentor) throw new ForbiddenException('请先完成导师注册')
    if (typeof bio !== 'string' || bio.length > 1000) throw new BadRequestException('简介须为 1000 字以内的文本')
    await this.prisma.mentor.update({ where: { id: mentorId }, data: { bio: bio.trim() } })
  }

  async updateProfile(mentorId: string, labId: string, direction: string) {
    const c = await this.ctx()
    const mentor = c.mentors.find((m) => m.id === mentorId && m.registered)
    if (!mentor) throw new ForbiddenException('请先完成导师注册')
    if (typeof direction !== 'string' || !direction.trim() || direction.trim().length > 100) throw new BadRequestException('研究方向须为 100 字以内的非空文本')
    if (!c.labs.some((l) => l.id === labId)) throw new BadRequestException('请选择有效的实训室')
    if (labId !== mentor.labId && c.applications.some((a) => a.mentorId === mentorId)) throw new BadRequestException('已有学生报名，不能更换实训室；研究方向仍可修改，如需换室请联系教务管理员')
    await this.prisma.mentor.update({ where: { id: mentorId }, data: { labId, direction: direction.trim() } })
  }

  async adminUpdateMentorProfile(mentorId: string, labId: string, direction: string) {
    const c = await this.ctx()
    const mentor = c.mentors.find((m) => m.id === mentorId)
    if (!mentor) throw new BadRequestException('导师不存在')
    if (typeof direction !== 'string' || !direction.trim() || direction.trim().length > 100) throw new BadRequestException('研究方向须为 100 字以内的非空文本')
    if (!c.labs.some((l) => l.id === labId)) throw new BadRequestException('请选择有效的实训室')
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.mentor.update({ where: { id: mentorId }, data: { labId, direction: direction.trim() } }),
    ]
    if (labId !== mentor.labId) ops.push(this.prisma.application.updateMany({ where: { mentorId }, data: { labId } }))
    await this.prisma.$transaction(ops)
  }

  async saveResume(studentId: string, data: { phone?: unknown; email?: unknown; intro?: unknown; awards?: unknown; selfEval?: unknown }) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) throw new ForbiddenException('学生不存在')
    const text = (v: unknown, label: string, max: number, required: boolean) => {
      if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new BadRequestException(`${label}须为 ${max} 字以内的${required ? '非空' : ''}文本`)
      return v.trim()
    }
    const phone = text(data.phone ?? '', '联系电话', 20, false)
    if (phone && !/^[0-9+\-\s]{5,20}$/.test(phone)) throw new BadRequestException('联系电话格式不正确')
    const email = text(data.email ?? '', '邮箱', 100, false)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('邮箱格式不正确')
    const intro = text(data.intro, '个人简介', 2000, true)
    const awards = text(data.awards ?? '', '获奖情况', 2000, false)
    const selfEval = text(data.selfEval, '自我评价', 2000, true)
    const fields = { phone, email, intro, awards, selfEval }
    await this.prisma.resume.upsert({
      where: { studentId },
      create: { id: uid('res'), studentId, ...fields },
      update: fields,
    })
  }

  async updateEvaluation(mentorId: string, appId: string, evaluation: string) {
    const c = await this.ctx()
    const app = c.applications.find((a) => a.id === appId && a.mentorId === mentorId)
    if (!app) throw new ForbiddenException('只能评价报给自己的学生')
    if (c.phase !== 'round' || app.round !== c.round || !['submitted', 'scored'].includes(app.status)) throw new BadRequestException('当前报名不可填写面试评价')
    if (typeof evaluation !== 'string' || evaluation.length > 2000) throw new BadRequestException('面试评价须为 2000 字以内的文本')
    await this.prisma.application.update({ where: { id: appId }, data: { evaluation: evaluation.trim() } })
  }

  async generate(mentorId: string) {
    const c = await this.ctx()
    if (c.phase !== 'round') throw new BadRequestException('当前阶段不能生成拟录取名单')
    const mentor = c.mentors.find((m) => m.id === mentorId && m.registered)
    if (!mentor) throw new ForbiddenException('请先完成导师注册')
    const next = generateForLab(c.applications, mentor.labId, c.round, c.labs, c.mentors.filter((m) => m.registered), c.students, mentorId)
    await this.syncApps(next, c.applications)
    const recipients = new Set(next.filter((a) => a.mentorId === mentorId && a.round === c.round).map((a) => a.studentId))
    for (const id of recipients) await this.notify(id, '拟录取名单已生成', `${mentor.name}第 ${c.round} 轮名单已生成，请查看我的状态。`)
  }

  async confirm(studentId: string, appId: string) {
    const c = await this.ctx()
    const app = c.applications.find((a) => a.id === appId && a.studentId === studentId)
    if (!app) throw new ForbiddenException('只能确认自己的录取意向')
    if (c.phase !== 'round' || app.round !== c.round || app.status !== 'provisional'
      || !c.mentors.some((m) => m.id === app.mentorId && m.registered)
      || c.applications.some((a) => a.studentId === studentId && a.status === 'confirmed')) throw new BadRequestException('当前意向不可确认')
    const next = c.applications.map((a) => {
      if (a.studentId !== studentId) return a
      if (a.id === appId) return { ...a, status: 'confirmed', method: 'normal' }
      if (a.status === 'provisional') return { ...a, status: 'abandoned' }
      return a
    })
    await this.syncApps(next, c.applications)
    await this.notify(studentId, '录取已确认', '已确认唯一去向，其余拟录取意向已释放。')
  }

  async settle() {
    const c = await this.ctx()
    if (c.phase !== 'round') throw new BadRequestException('当前阶段不能结算轮次')
    const mentors = c.mentors.filter((m) => m.registered)
    const active = new Set(mentors.map((m) => m.id))
    const generated = generateAll(c.applications, c.round, c.labs, mentors, c.students)
    const confirmed = autoConfirmSeeded(generated.filter((a) => active.has(a.mentorId) || a.status === 'confirmed'), c.round, c.students)
    const confirmedMap = new Map(confirmed.map((a) => [a.id, a]))
    const next = fillWaitlists(generated.map((a) => confirmedMap.get(a.id) ?? a), c.round, c.labs, mentors, c.students)
    await this.syncApps(next, c.applications)
    await this.notify('all', `第 ${c.round} 轮结算完成`, '自动确认与顺位递补已完成，未录取学生请关注后续补录。')
  }

  async nextRound() {
    const c = await this.ctx()
    if (c.phase !== 'round' || c.round >= 3) throw new BadRequestException('不能继续开启补录轮次')
    const newRound = c.round + 1
    const next = refileSeeded(c.applications, newRound, c.mentors.filter((m) => m.registered), c.students)
    await this.syncApps(next, c.applications)
    await this.setState({ round: newRound })
    await this.notify('all', `第 ${newRound} 轮补录开启`, '未录取学生可重新填报仍有名额的导师意向。')
  }

  async openAdjustment() {
    const c = await this.ctx()
    if (c.phase !== 'round') throw new BadRequestException('当前不能开启调剂')
    await this.setState({ phase: 'adjustment' })
    await this.notify('all', '统筹调剂已开启', '导师可按学生的室内、跨室调剂意愿查看调剂候选学生，后续由学院统一分配。')
  }

  async runAdjustment() {
    const c = await this.ctx()
    if (c.phase !== 'adjustment') throw new BadRequestException('请先进入统筹调剂阶段')
    const next = adjust(c.applications, c.prefs, c.round, c.labs, c.mentors.filter((m) => m.registered), c.students)
    await this.syncApps(next, c.applications)
    await this.notify('all', '统筹调剂分配完成', '已按室内、跨室调剂意愿分配至已注册导师；未服从调剂或暂无名额的学生保留待学院沟通。')
  }

  async publish() {
    const c = await this.ctx()
    if (c.phase !== 'adjustment') throw new BadRequestException('请先完成调剂阶段再公示')
    await this.setState({ phase: 'published' })
    await this.notify('all', '录取结果公示', '公示期 3 天，如有异议请在学生视图「异议申诉」提交。')
  }

  async readNotice(studentId: string, id: string) {
    const notice = await this.prisma.notice.findFirst({ where: { id, to: { in: [studentId, 'all'] } } })
    if (!notice) throw new ForbiddenException('无权访问该通知')
    await this.prisma.notice.update({ where: { id }, data: { read: true } })
  }

  async readAllNotices(studentId: string) {
    await this.prisma.notice.updateMany({ where: { to: { in: [studentId, 'all'] } }, data: { read: true } })
  }

  async fileObjection(studentId: string, reason: string) {
    const c = await this.ctx()
    if (c.phase !== 'published' || typeof reason !== 'string' || !reason.trim()) throw new BadRequestException('请在公示期填写异议理由')
    await this.prisma.objection.create({ data: { id: uid('obj'), studentId, reason: reason.trim(), status: 'pending', reply: '', time: stamp() } })
    await this.notify(studentId, '异议已提交', '学院将在公示期内 24 小时处理，请耐心等待回复。')
  }

  async resolveObjection(id: string, status: string, reply: string) {
    if (!['resolved', 'rejected'].includes(status) || typeof reply !== 'string') throw new BadRequestException('异议处理信息不正确')
    const o = await this.prisma.objection.update({ where: { id }, data: { status, reply } })
    await this.notify(o.studentId, status === 'resolved' ? '异议已受理' : '异议已驳回', reply || (status === 'resolved' ? '已受理并复核。' : '经复核不予采纳。'))
  }
}