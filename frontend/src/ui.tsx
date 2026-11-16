import { Tag } from 'antd'
import { AppStatus, AdmissionMethod, ObjectionStatus } from './types'

export const statusMeta: Record<AppStatus, { text: string; color: string }> = {
  submitted: { text: '待面试', color: 'default' },
  scored: { text: '已评分·待生成名单', color: 'processing' },
  provisional: { text: '拟录取', color: 'success' },
  waitlist: { text: '递补', color: 'warning' },
  rejected: { text: '未通过', color: 'error' },
  confirmed: { text: '已确认录取', color: 'green' },
  abandoned: { text: '已放弃', color: 'default' },
}

export function StatusTag({ status }: { status: AppStatus }) {
  const m = statusMeta[status]
  return <Tag color={m.color}>{m.text}</Tag>
}

export const methodMeta: Record<AdmissionMethod, { text: string; color: string }> = {
  normal: { text: '正常录取', color: 'green' },
  waitlist: { text: '顺位递补', color: 'orange' },
  intra: { text: '室内调剂', color: 'cyan' },
  cross: { text: '跨室调剂', color: 'geekblue' },
  manual: { text: '约谈安置', color: 'purple' },
}

export function MethodTag({ method }: { method?: AdmissionMethod }) {
  if (!method) return <span>—</span>
  const m = methodMeta[method]
  return <Tag color={m.color}>{m.text}</Tag>
}

export const objectionMeta: Record<ObjectionStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'orange' },
  resolved: { text: '已受理', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

export function ObjectionTag({ status }: { status: ObjectionStatus }) {
  const m = objectionMeta[status]
  return <Tag color={m.color}>{m.text}</Tag>
}