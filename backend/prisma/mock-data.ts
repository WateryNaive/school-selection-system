import { Lab, Mentor, Student, App, Prefs, Scores, totalOf } from '../src/algo'

// 简单可复现的伪随机，保证每次刷新数据一致
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}
const rng = makeRng(20261109)
const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐']
const GIVEN = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚', '浩然', '子涵', '欣怡', '宇轩', '梓萱', '思远', '嘉琪', '一鸣', '雨桐']
const personName = (i: number) => SURNAMES[i % SURNAMES.length] + GIVEN[(i * 7) % GIVEN.length]

const LAB_DEFS = [
  { name: '智能视觉实训室', direction: '计算机视觉 / 图像识别' },
  { name: '自然语言处理实训室', direction: 'NLP / 大模型应用' },
  { name: '智能机器人实训室', direction: '机器人 / 嵌入式控制' },
  { name: '大数据与挖掘实训室', direction: '数据分析 / 数据挖掘' },
  { name: '网络安全实训室', direction: '系统安全 / 渗透测试' },
  { name: '物联网实训室', direction: 'IoT / 传感网络' },
  { name: '智能软件工程实训室', direction: 'AI+PBL / 全栈工程' },
]
const MENTOR_DIRECTIONS = ['深度学习', '强化学习', '多模态大模型', '边缘计算', '推荐系统', '知识图谱', '自动驾驶', '语音识别', '联邦学习', '图神经网络', '目标检测', '生成式AI', '时序预测', '机器人SLAM', '数据挖掘']

export const labs: Lab[] = LAB_DEFS.map((d, i) => ({
  id: `lab${i + 1}`,
  name: d.name,
  direction: d.direction,
  quota: 60,
}))

export const mentors: Mentor[] = []
labs.forEach((lab, li) => {
  for (let mi = 0; mi < 5; mi++) {
    const idx = li * 5 + mi
    mentors.push({
      id: `${lab.id}-m${mi + 1}`,
      name: personName(idx + 3) + ' 老师',
      direction: MENTOR_DIRECTIONS[idx % MENTOR_DIRECTIONS.length],
      capacity: 12,
      labId: lab.id,
    })
  }
})

export const currentStudent: Student = {
  id: 's0',
  name: '张同学',
  studentNo: '20260001',
  className: '计算机2601',
  intra: false,
  cross: false,
}

const CLASS_NAMES = ['计算机2601', '计算机2602', '软件2601', '软件2602', '人工智能2601', '数据2601']
export const students: Student[] = [currentStudent]
for (let i = 1; i <= 300; i++) {
  students.push({
    id: `s${i}`,
    name: personName(i),
    studentNo: `2026${String(1000 + i)}`,
    className: CLASS_NAMES[i % CLASS_NAMES.length],
    intra: false,
    cross: false,
  })
}

const randScores = (): Scores => ({
  attitude: randInt(12, 25),
  logic: randInt(10, 25),
  programming: randInt(8, 25),
  time: randInt(10, 25),
})

export const seedApplications: App[] = []
export const seedPrefs: Record<string, Prefs> = {}
for (let i = 1; i <= 300; i++) {
  const sid = `s${i}`
  const chosen = new Set<string>()
  while (chosen.size < 3) chosen.add(mentors[randInt(0, mentors.length - 1)].id)
  chosen.forEach((mid) => {
    const m = mentors.find((x) => x.id === mid)!
    const sc = randScores()
    seedApplications.push({
      id: `app-${sid}-${mid}`,
      studentId: sid,
      mentorId: mid,
      labId: m.labId,
      scores: sc,
      total: totalOf(sc),
      status: 'scored',
      round: 1,
    })
  })
  seedPrefs[sid] = { intra: rng() > 0.3, cross: rng() > 0.5 }
}