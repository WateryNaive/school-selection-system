import { BadRequestException, ForbiddenException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { hashPassword, initialPasswordOf, newToken, verifyPassword } from './auth.util'

const YEAR = '2026'
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export type AuthRole = 'student' | 'mentor' | 'admin'
export type Actor = { role: AuthRole; userId: string }

export interface RegisterBody {
  role: 'student' | 'mentor'
  name: string
  className?: string
  labId?: string
  direction?: string
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly adminPassword = process.env.ADMIN_PASSWORD || newToken().slice(0, 16)
  private readonly adminHash = hashPassword(this.adminPassword)

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (!process.env.ADMIN_PASSWORD) console.log(`本机管理员账号：admin；本次启动口令：${this.adminPassword}`)
  }

  private async nextAccount(role: 'student' | 'mentor') {
    const nums =
      role === 'student'
        ? (await this.prisma.student.findMany({ select: { studentNo: true } })).map((s) => Number(s.studentNo))
        : (await this.prisma.mentor.findMany({ select: { account: true } })).map((m) => Number(m.account))
    const max = nums.reduce((a, b) => Math.max(a, b), Number(`${YEAR}0000`))
    return String(max + 1)
  }

  async register(b: RegisterBody) {
    const name = b.name?.trim()
    if (!name) throw new BadRequestException('请填写姓名')
    if (b.role !== 'student' && b.role !== 'mentor') throw new BadRequestException('身份只能是学生或导师')
    const account = await this.nextAccount(b.role)
    const initialPassword = initialPasswordOf(account)
    if (b.role === 'student') {
      await this.prisma.student.create({
        data: {
          id: uid('s'), name, studentNo: account,
          className: b.className?.trim() || '未分班',
          password: hashPassword(initialPassword), pwdInitial: true,
        },
      })
    } else {
      const lab = await this.prisma.lab.findUnique({ where: { id: b.labId ?? '' } })
      if (!lab) throw new BadRequestException('请选择所在实训室')
      await this.prisma.mentor.create({
        data: {
          id: uid('m'), name: `${name.replace(/老师$/, '').trim()} 老师`, account,
          direction: b.direction?.trim() || lab.direction, capacity: 16, labId: lab.id,
          password: hashPassword(initialPassword), pwdInitial: true, registered: true,
        },
      })
    }
    return { role: b.role, account, initialPassword }
  }

  async login(b: { role: AuthRole; account: string; password: string }) {
    if (!['student', 'mentor', 'admin'].includes(b.role)) throw new BadRequestException('身份不正确')
    const account = b.account?.trim() ?? ''
    if (b.role === 'admin') {
      if (account !== 'admin' || !verifyPassword(b.password ?? '', this.adminHash)) throw new UnauthorizedException('账号或密码错误')
      await this.prisma.session.deleteMany({ where: { userId: 'admin', role: 'admin' } })
      const token = newToken()
      await this.prisma.session.create({ data: { token, role: 'admin', userId: 'admin', account } })
      return { token, role: 'admin' as const, userId: 'admin', account, name: '教务管理员', pwdInitial: false }
    }
    const user =
      b.role === 'student'
        ? await this.prisma.student.findUnique({ where: { studentNo: account } })
        : await this.prisma.mentor.findUnique({ where: { account } })
    if (!user || !verifyPassword(b.password ?? '', user.password)) throw new UnauthorizedException('账号或密码错误')
    if ('registered' in user && !user.registered) throw new ForbiddenException('该导师尚未注册，请先在注册页完成注册')
    await this.prisma.session.deleteMany({ where: { userId: user.id } })
    const token = newToken()
    await this.prisma.session.create({ data: { token, role: b.role, userId: user.id, account } })
    return { token, role: b.role, userId: user.id, account, name: user.name, pwdInitial: user.pwdInitial }
  }

  async me(token: string) {
    if (!token) throw new UnauthorizedException('请先登录')
    const s = await this.prisma.session.findUnique({ where: { token } })
    if (!s) throw new UnauthorizedException('会话已失效，请重新登录')
    if (s.role === 'admin' && s.userId === 'admin') {
      return { token, role: 'admin' as const, userId: s.userId, account: s.account, name: '教务管理员', pwdInitial: false }
    }
    if (s.role !== 'student' && s.role !== 'mentor') throw new UnauthorizedException('会话身份不正确')
    const user =
      s.role === 'student'
        ? await this.prisma.student.findUnique({ where: { id: s.userId } })
        : await this.prisma.mentor.findUnique({ where: { id: s.userId } })
    if (!user) throw new UnauthorizedException('账号不存在')
    if ('registered' in user && !user.registered) throw new ForbiddenException('请先完成导师注册')
    return { token: s.token, role: s.role as 'student' | 'mentor', userId: s.userId, account: s.account, name: user.name, pwdInitial: user.pwdInitial }
  }

  async actor(authorization?: string, roles?: AuthRole[]): Promise<Actor | null> {
    if (!authorization && !roles) return null
    const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    if (!token) throw new UnauthorizedException('请先登录')
    const s = await this.me(token)
    if (roles && !roles.includes(s.role)) throw new ForbiddenException('当前身份无权执行此操作')
    return { role: s.role, userId: s.userId }
  }

  async logout(token: string) {
    if (token) await this.prisma.session.deleteMany({ where: { token } })
    return { ok: true }
  }

  async changePassword(b: { token: string; oldPassword: string; newPassword: string }) {
    const s = await this.me(b.token)
    if (s.role === 'admin') throw new ForbiddenException('管理员口令由服务端管理')
    const newPassword = b.newPassword ?? ''
    if (newPassword.length < 6) throw new BadRequestException('新密码至少 6 位')
    if (s.role === 'student') {
      const u = await this.prisma.student.findUnique({ where: { id: s.userId } })
      if (!u || !verifyPassword(b.oldPassword ?? '', u.password)) throw new UnauthorizedException('原密码错误')
      await this.prisma.student.update({ where: { id: u.id }, data: { password: hashPassword(newPassword), pwdInitial: false } })
    } else {
      const u = await this.prisma.mentor.findUnique({ where: { id: s.userId } })
      if (!u || !verifyPassword(b.oldPassword ?? '', u.password)) throw new UnauthorizedException('原密码错误')
      await this.prisma.mentor.update({ where: { id: u.id }, data: { password: hashPassword(newPassword), pwdInitial: false } })
    }
    return { ok: true, pwdInitial: false }
  }
}
