import { useState } from 'react'
import { Alert, App as AntApp, Form, Input, Modal } from 'antd'
import { api } from './store'

export default function ChangePassword({
  open,
  initial,
  token,
  onClose,
  onChanged,
}: {
  open: boolean
  initial: boolean
  token: string
  onClose: () => void
  onChanged: () => void
}) {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<{ oldPassword: string; newPassword: string; confirm: string }>()
  const [busy, setBusy] = useState(false)

  const close = () => {
    form.resetFields()
    onClose()
  }
  const submit = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      await api('auth/change-password', { token, oldPassword: v.oldPassword, newPassword: v.newPassword })
      message.success('密码已修改，下次登录请使用新密码')
      form.resetFields()
      onChanged()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={close}
      onOk={submit}
      okText="确认修改"
      cancelText={initial ? '暂不修改' : '取消'}
      confirmLoading={busy}
      destroyOnHidden
    >
      {initial && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="你正在使用初始密码（账号后六位）"
          description="建议修改为个人密码；也可以点「暂不修改」，之后随时在顶栏修改。"
        />
      )}
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '新密码至少 6 位' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, v) {
                return !v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('两次输入的新密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}