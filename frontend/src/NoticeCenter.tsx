import { useState } from 'react'
import { Badge, Button, Drawer, Tabs, List, Tag, Typography, Space, Empty } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useStore } from './store'

export default function NoticeCenter() {
  const { notices, currentStudent, students, markRead, markAllRead, refresh } = useStore()
  const [open, setOpen] = useState(false)

  const my = notices.filter((n) => n.to === currentStudent?.id || n.to === 'all')
  const unread = my.filter((n) => !n.read).length
  const recipient = (to: string) => (to === 'all' ? '全体学生' : students.find((s) => s.id === to)?.name ?? to)

  const inboxList = (
    <List
      dataSource={my}
      locale={{ emptyText: <Empty description="暂无通知" /> }}
      renderItem={(n) => (
        <List.Item onClick={() => markRead(n.id)} style={{ cursor: 'pointer', opacity: n.read ? 0.55 : 1 }}>
          <List.Item.Meta
            title={
              <Space>
                {!n.read && <Badge status="processing" />}
                <Typography.Text strong={!n.read}>{n.title}</Typography.Text>
              </Space>
            }
            description={
              <>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
                <Typography.Text type="secondary">{n.time}</Typography.Text>
              </>
            }
          />
        </List.Item>
      )}
    />
  )

  const dingList = (
    <List
      dataSource={notices}
      locale={{ emptyText: <Empty description="暂无推送" /> }}
      renderItem={(n) => (
        <List.Item>
          <List.Item.Meta
            title={
              <Space>
                <Tag color="blue">钉钉 · 已推送</Tag>
                <Typography.Text>{n.title}</Typography.Text>
              </Space>
            }
            description={
              <>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
                <Typography.Text type="secondary">接收：{recipient(n.to)} · {n.time}</Typography.Text>
              </>
            }
          />
        </List.Item>
      )}
    />
  )

  return (
    <>
      <Badge count={unread} size="small">
        <Button
          type="text"
          aria-label="通知中心"
          icon={<BellOutlined style={{ color: '#5b6b82', fontSize: 18 }} />}
          onClick={() => { setOpen(true); refresh() }}
        />
      </Badge>
      <Drawer
        title="通知中心"
        open={open}
        onClose={() => setOpen(false)}
        width={440}
        extra={<Button size="small" onClick={markAllRead}>全部已读</Button>}
      >
        <Tabs
          items={[
            { key: 'inbox', label: `我的站内信${unread ? ` (${unread})` : ''}`, children: inboxList },
            { key: 'ding', label: '钉钉推送记录', children: dingList },
          ]}
        />
      </Drawer>
    </>
  )
}