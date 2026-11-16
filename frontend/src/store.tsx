import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { Spin, Button, Result, App as AntdApp } from 'antd'
import { Application, Auth, Phase, Prefs, Resume, Scores, Notice, Objection, ObjectionStatus, Lab, Mentor, Student } from './types'

type AdjustmentCandidate = Student & { prefs: Prefs; total: number }

type Bootstrap = {
  labs: Lab[]
  mentors: Mentor[]
  students: Student[]
  currentStudent: Student | null
  applications: Application[]
  adjustmentCandidates: AdjustmentCandidate[]
  prefs: Record<string, Prefs>
  resumes: Record<string, Resume>
  round: number
  phase: Phase
  notices: Notice[]
  objections: Objection[]
}

interface Store extends Bootstrap {
  currentMentor: Mentor | null
  refresh: () => void
  fileIntentions: (mentorIds: string[], prefs: Prefs) => Promise<boolean>
  scoreApplication: (appId: string, scores: Scores) => Promise<boolean>
  sendInterviewNotice: (appIds: string[], notice: { interviewTime: string; location: string; note: string }) => Promise<boolean>
  updateMentorBio: (bio: string) => Promise<boolean>
  updateMentorProfile: (labId: string, direction: string) => Promise<boolean>
  adminUpdateMentorProfile: (mentorId: string, labId: string, direction: string) => Promise<boolean>
  saveEvaluation: (appId: string, evaluation: string) => Promise<boolean>
  saveResume: (data: { phone: string; email: string; intro: string; awards: string; selfEval: string }) => Promise<boolean>
  generateLists: () => Promise<boolean>
  confirmAdmission: (appId: string) => Promise<boolean>
  settleRound: () => Promise<boolean>
  startNextRound: () => Promise<boolean>
  runAdjustment: () => Promise<boolean>
  allocateAdjustment: () => Promise<boolean>
  publish: () => Promise<boolean>
  markRead: (id: string) => Promise<boolean>
  markAllRead: () => Promise<boolean>
  fileObjection: (reason: string) => Promise<boolean>
  resolveObjection: (id: string, status: ObjectionStatus, reply: string) => Promise<boolean>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}

export async function api<T = Bootstrap>(path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${path} → HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join('；') : String(j.message)
    } catch {}
    throw Object.assign(new Error(msg), { status: res.status })
  }
  return res.json()
}

export function StoreProvider({ auth, onSessionExpired, children }: { auth: Auth | null; onSessionExpired: () => void; children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { message } = AntdApp.useApp()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const alive = useRef(true)
  const revision = useRef(0)
  const token = auth && 'token' in auth ? auth.token : undefined
  const path = auth?.role === 'public' ? 'public-results' : 'bootstrap'
  const expired = useRef(onSessionExpired)
  expired.current = onSessionExpired

  const load = useCallback(() => {
    const version = ++revision.current
    api(path, undefined, token).then((next) => {
      if (alive.current && version === revision.current) { setData(next); setError(null) }
    }).catch((e) => {
      if (!alive.current || version !== revision.current) return
      if (e.status === 401 || e.status === 403) expired.current()
      else setError(e.message)
    })
  }, [path, token])

  useEffect(() => {
    alive.current = true
    load()
    window.addEventListener('focus', load)
    const timer = window.setInterval(load, 15000)
    return () => { alive.current = false; ++revision.current; window.removeEventListener('focus', load); window.clearInterval(timer) }
  }, [load])

  const run = useCallback((route: string, body?: unknown): Promise<boolean> => {
    const operation = queue.current.then(async () => {
      if (!alive.current) return false
      ++revision.current
      try {
        const next = await api(route, body, token)
        if (!alive.current) return false
        ++revision.current
        setData(next)
        setError(null)
        return true
      } catch (e) {
        if (!alive.current) return false
        if ((e as { status?: number }).status === 401) expired.current()
        else message.error((e as Error).message)
        return false
      }
    })
    queue.current = operation
    return operation
  }, [token, message])

  if (error && !data) {
    return <Result status="warning" title="暂时无法连接后端" subTitle={error} extra={<Button type="primary" onClick={load}>重试连接</Button>} />
  }
  if (!data) {
    return <div style={{ padding: 96, textAlign: 'center' }}><Spin size="large" /><div style={{ marginTop: 16, color: '#888' }}>正在连接选报后端…</div></div>
  }

  const value: Store = {
    ...data,
    currentMentor: data.mentors.find((m) => auth?.role === 'mentor' && m.id === auth.userId) ?? null,
    refresh: load,
    fileIntentions: (mentorIds, prefs) => run('intentions', { mentorIds, prefs }),
    scoreApplication: (appId, scores) => run('score', { appId, scores }),
    sendInterviewNotice: (appIds, notice) => run('interview-notices', { appIds, ...notice }),
    updateMentorBio: (bio) => run('mentor/bio', { bio }),
    updateMentorProfile: (labId, direction) => run('mentor/profile', { labId, direction }),
    adminUpdateMentorProfile: (mentorId, labId, direction) => run('admin/mentor-profile', { mentorId, labId, direction }),
    saveEvaluation: (appId, evaluation) => run('evaluation', { appId, evaluation }),
    saveResume: (data) => run('resume', data),
    generateLists: () => run('generate', {}),
    confirmAdmission: (appId) => run('confirm', { appId }),
    settleRound: () => run('settle', {}),
    startNextRound: () => run('next-round', {}),
    runAdjustment: () => run('adjust', {}),
    allocateAdjustment: () => run('allocate', {}),
    publish: () => run('publish', {}),
    markRead: (id) => run('notices/read', { id }),
    markAllRead: () => run('notices/read-all', {}),
    fileObjection: (reason) => run('objections', { reason }),
    resolveObjection: (id, status, reply) => run('objections/resolve', { id, status, reply }),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
