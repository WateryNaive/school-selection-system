export type Role = 'student' | 'mentor' | 'admin' | 'public'

export interface Session {
  token: string
  role: 'student' | 'mentor' | 'admin'
  userId: string
  account: string
  name: string
  pwdInitial: boolean
}

export type Auth = Session | { role: 'public' }

export interface Mentor {
  id: string
  name: string
  account?: string
  direction: string
  capacity: number
  labId: string
  registered: boolean
  bio: string
}

export interface Lab {
  id: string
  name: string
  direction: string
  quota: number
}

export interface Student {
  id: string
  name: string
  studentNo: string
  className: string
}

export interface Scores {
  attitude: number // 学习态度
  logic: number // 逻辑思维
  programming: number // 编程基础
  time: number // 时间投入
}

export type AppStatus =
  | 'submitted' // 已提交待面试
  | 'scored' // 已评分待生成名单
  | 'provisional' // 拟录取
  | 'waitlist' // 递补
  | 'rejected' // 未通过
  | 'confirmed' // 已确认录取
  | 'abandoned' // 已放弃

export type AdmissionMethod = 'normal' | 'waitlist' | 'intra' | 'cross' | 'manual'

export type Phase = 'round' | 'adjustment' | 'published'

export interface Application {
  id: string
  studentId: string
  mentorId: string
  labId: string
  scores: Scores | null
  total: number
  status: AppStatus
  round: number
  method?: AdmissionMethod
  evaluation?: string
}

export interface Prefs {
  intra: boolean // 服从实训室内部调剂
  cross: boolean // 服从全院跨实训室调剂
}

export interface Resume {
  phone: string
  email: string
  intro: string
  awards: string
  selfEval: string
  updatedAt: string
}

export interface Notice {
  id: string
  to: string // studentId 或 'all'
  title: string
  body: string
  time: string
  read: boolean
}

export type ObjectionStatus = 'pending' | 'resolved' | 'rejected'

export interface Objection {
  id: string
  studentId: string
  reason: string
  status: ObjectionStatus
  reply: string
  time: string
}

export const totalOf = (s: Scores) => s.attitude + s.logic + s.programming + s.time