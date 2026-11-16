export type Scores = { attitude: number; logic: number; programming: number; time: number }
export type App = {
  id: string
  studentId: string
  mentorId: string
  labId: string
  scores: Scores | null
  total: number
  status: string
  round: number
  method?: string | null
}
export type Lab = { id: string; name: string; direction: string; quota: number }
export type Mentor = { id: string; name: string; direction: string; capacity: number; labId: string }
export type Student = { id: string; name: string; studentNo: string; className: string; intra: boolean; cross: boolean }
export type Prefs = { intra: boolean; cross: boolean }

export const DEMO_STUDENT = 's0'
export const totalOf = (s: Scores) => s.attitude + s.logic + s.programming + s.time

export const randScores = (): Scores => ({
  attitude: 12 + Math.floor(Math.random() * 14),
  logic: 10 + Math.floor(Math.random() * 16),
  programming: 8 + Math.floor(Math.random() * 18),
  time: 10 + Math.floor(Math.random() * 16),
})

export function compare(a: App, b: App, students: Student[]) {
  if (b.total !== a.total) return b.total - a.total
  const s = a.scores, t = b.scores
  if (s && t) {
    if (t.logic !== s.logic) return t.logic - s.logic
    if (t.programming !== s.programming) return t.programming - s.programming
    if (t.attitude !== s.attitude) return t.attitude - s.attitude
    if (t.time !== s.time) return t.time - s.time
  }
  const sa = students.find((x) => x.id === a.studentId)?.studentNo ?? ''
  const sb = students.find((x) => x.id === b.studentId)?.studentNo ?? ''
  return sa < sb ? -1 : 1
}

const confirmedOf = (apps: App[]) => apps.filter((a) => a.status === 'confirmed')
const placedSet = (apps: App[]) => new Set(confirmedOf(apps).map((a) => a.studentId))

export function generateForLab(apps: App[], labId: string, round: number, labs: Lab[], mentors: Mentor[], students: Student[], mentorId?: string): App[] {
  const quota = labs.find((l) => l.id === labId)!.quota
  const confirmed = confirmedOf(apps)
  const mentorUsed: Record<string, number> = {}
  confirmed.forEach((a) => (mentorUsed[a.mentorId] = (mentorUsed[a.mentorId] || 0) + 1))
  let labCount = confirmed.filter((a) => a.labId === labId).length
  if (mentorId) labCount += apps.filter((a) => a.labId === labId && a.mentorId !== mentorId && a.status === 'provisional').length
  const eligible = new Set(mentors.map((m) => m.id))
  const placed = placedSet(apps)
  const rankable = apps.filter(
    (a) => eligible.has(a.mentorId) && (!mentorId || a.mentorId === mentorId) && !placed.has(a.studentId)
      && a.labId === labId && a.round === round && a.scores && ['scored', 'provisional', 'waitlist', 'rejected'].includes(a.status),
  )
  const sorted = [...rankable].sort((a, b) => compare(a, b, students))
  const perMentor = { ...mentorUsed }
  const next = new Map<string, string>()
  sorted.forEach((a) => {
    const cap = mentors.find((m) => m.id === a.mentorId)!.capacity
    if ((perMentor[a.mentorId] || 0) < cap && labCount < quota) {
      next.set(a.id, 'provisional')
      perMentor[a.mentorId] = (perMentor[a.mentorId] || 0) + 1
      labCount++
    }
  })
  const waitBand = Math.ceil(quota * 0.5)
  let w = 0
  sorted.forEach((a) => {
    if (next.has(a.id)) return
    if (w < waitBand) { next.set(a.id, 'waitlist'); w++ } else next.set(a.id, 'rejected')
  })
  return apps.map((a) => (next.has(a.id) ? { ...a, status: next.get(a.id)! } : a))
}

export const generateAll = (apps: App[], round: number, labs: Lab[], mentors: Mentor[], students: Student[]) =>
  labs.reduce((acc, l) => generateForLab(acc, l.id, round, labs, mentors, students), apps)

export function autoConfirmSeeded(apps: App[], round: number, students: Student[]): App[] {
  let out = apps
  students.filter((s) => /^s\d+$/.test(s.id) && s.id !== DEMO_STUDENT).forEach((s) => {
    if (out.some((a) => a.studentId === s.id && a.status === 'confirmed')) return
    const provs = out.filter((a) => a.studentId === s.id && a.round === round && a.status === 'provisional')
    if (!provs.length) return
    const best = [...provs].sort((a, b) => compare(a, b, students))[0]
    out = out.map((a) => {
      if (a.id === best.id) return { ...a, status: 'confirmed', method: 'normal' }
      if (a.studentId === s.id && a.round === round && a.status === 'provisional') return { ...a, status: 'abandoned' }
      return a
    })
  })
  return out
}

export function fillWaitlists(apps: App[], round: number, labs: Lab[], mentors: Mentor[], students: Student[]): App[] {
  let out = apps
  labs.forEach((lab) => {
    let confirmedLab = out.filter((a) => a.labId === lab.id && a.status === 'confirmed').length
    const mentorUsed: Record<string, number> = {}
    confirmedOf(out).forEach((a) => (mentorUsed[a.mentorId] = (mentorUsed[a.mentorId] || 0) + 1))
    const placed = placedSet(out)
    const waits = out
      .filter((a) => mentors.some((m) => m.id === a.mentorId) && a.labId === lab.id && a.round === round && a.status === 'waitlist' && !placed.has(a.studentId))
      .sort((a, b) => compare(a, b, students))
    for (const a of waits) {
      if (confirmedLab >= lab.quota) break
      if (placed.has(a.studentId)) continue
      const cap = mentors.find((m) => m.id === a.mentorId)!.capacity
      if ((mentorUsed[a.mentorId] || 0) >= cap) continue
      out = out.map((x) => (x.id === a.id ? { ...x, status: 'confirmed', method: 'waitlist' } : x))
      confirmedLab++
      mentorUsed[a.mentorId] = (mentorUsed[a.mentorId] || 0) + 1
      placed.add(a.studentId)
    }
  })
  return out
}

export function refileSeeded(apps: App[], newRound: number, mentors: Mentor[], students: Student[]): App[] {
  const placed = placedSet(apps)
  const mentorUsed: Record<string, number> = {}
  confirmedOf(apps).forEach((a) => (mentorUsed[a.mentorId] = (mentorUsed[a.mentorId] || 0) + 1))
  const avail = mentors.filter((m) => (mentorUsed[m.id] || 0) < m.capacity)
  const added: App[] = []
  students.filter((s) => /^s\d+$/.test(s.id) && s.id !== DEMO_STUDENT && !placed.has(s.id)).forEach((s) => {
    const pool = [...avail]
    const picks: string[] = []
    while (picks.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length)
      picks.push(pool.splice(i, 1)[0].id)
    }
    picks.forEach((mid) => {
      const m = mentors.find((x) => x.id === mid)!
      const sc = randScores()
      added.push({ id: `app-${s.id}-${mid}-r${newRound}`, studentId: s.id, mentorId: mid, labId: m.labId, scores: sc, total: totalOf(sc), status: 'scored', round: newRound })
    })
  })
  return [...apps, ...added]
}

export function adjust(apps: App[], prefs: Record<string, Prefs>, round: number, labs: Lab[], mentors: Mentor[], students: Student[]): App[] {
  let out = [...apps]
  const seatMentor: Record<string, number> = {}
  const seatLab: Record<string, number> = {}
  mentors.forEach((m) => (seatMentor[m.id] = m.capacity))
  labs.forEach((l) => (seatLab[l.id] = l.quota))
  confirmedOf(out).forEach((a) => { seatMentor[a.mentorId]--; seatLab[a.labId]-- })
  const placed = placedSet(out)
  const bestTotal = (sid: string) => {
    const ts = out.filter((a) => a.studentId === sid && a.scores).map((a) => a.total)
    return ts.length ? Math.max(...ts) : 0
  }
  const candidateLabs = (sid: string) => new Set(out.filter((a) => a.studentId === sid).map((a) => a.labId))
  const prefOf = (sid: string) => prefs[sid] || { intra: false, cross: false }
  const place = (sid: string, method: string, restrict: Set<string> | null) => {
    const m = mentors.find((x) => seatMentor[x.id] > 0 && seatLab[x.labId] > 0 && (!restrict || restrict.has(x.labId)))
    if (!m) return false
    out.push({ id: `adj-${sid}-${m.id}`, studentId: sid, mentorId: m.id, labId: m.labId, scores: null, total: bestTotal(sid), status: 'confirmed', round, method })
    seatMentor[m.id]--; seatLab[m.labId]--; placed.add(sid)
    return true
  }
  const unplaced = students.filter((s) => !placed.has(s.id)).sort((a, b) => bestTotal(b.id) - bestTotal(a.id))
  unplaced.forEach((s) => { if (!placed.has(s.id) && prefOf(s.id).intra) place(s.id, 'intra', candidateLabs(s.id)) })
  unplaced.forEach((s) => { if (!placed.has(s.id) && prefOf(s.id).cross) place(s.id, 'cross', null) })
  return out
}