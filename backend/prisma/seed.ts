import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { labs, mentors, students, seedApplications, seedPrefs } from './mock-data'
import { hashPassword, initialPasswordOf } from '../src/auth.util'

const prisma = new PrismaClient()

async function main() {
  // FK-safe wipe so the seed is idempotent
  await prisma.application.deleteMany()
  await prisma.objection.deleteMany()
  await prisma.notice.deleteMany()
  await prisma.session.deleteMany()
  await prisma.mentor.deleteMany()
  await prisma.lab.deleteMany()
  await prisma.student.deleteMany()
  await prisma.sessionState.deleteMany()

  await prisma.lab.createMany({ data: labs.map((l) => ({ id: l.id, name: l.name, direction: l.direction, quota: l.quota })) })
  await prisma.mentor.createMany({
    data: mentors.map((m, i) => {
      const account = `2026${2001 + i}`
      return {
        id: m.id, name: m.name, direction: m.direction, capacity: m.capacity, labId: m.labId,
        account, password: hashPassword(initialPasswordOf(account)), pwdInitial: true, registered: false,
      }
    }),
  })
  await prisma.student.createMany({
    data: students.map((s) => {
      const p = seedPrefs[s.id] ?? { intra: false, cross: false }
      return {
        id: s.id, name: s.name, studentNo: s.studentNo, className: s.className, intra: p.intra, cross: p.cross,
        password: hashPassword(initialPasswordOf(s.studentNo)), pwdInitial: true,
      }
    }),
  })
  await prisma.application.createMany({
    data: seedApplications.map((a) => ({
      id: a.id, studentId: a.studentId, mentorId: a.mentorId, labId: a.labId,
      scores: a.scores ? (a.scores as unknown as Prisma.InputJsonValue) : Prisma.DbNull, total: a.total, status: a.status, round: a.round, method: a.method ?? null,
    })),
  })
  await prisma.sessionState.create({ data: { id: 1, round: 1, phase: 'round' } })
  await prisma.notice.create({
    data: { id: 'n-welcome', to: 'all', title: '欢迎进入选报系统', body: '本轮意向填报已开放，请在学生视图提交导师意向。', time: new Date().toLocaleString('zh-CN', { hour12: false }), read: false },
  })

  const counts = {
    labs: await prisma.lab.count(),
    mentors: await prisma.mentor.count(),
    students: await prisma.student.count(),
    applications: await prisma.application.count(),
  }
  console.log('SEED_OK', JSON.stringify(counts))
}

main()
  .catch((e) => {
    console.error('SEED_FAIL', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })