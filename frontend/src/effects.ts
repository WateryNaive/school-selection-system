const RIPPLE_SELECTOR = '.ant-btn, .ant-tabs-tab, .ant-segmented-item, .ant-pagination-item, .ant-list-item'

document.addEventListener('pointerdown', (e) => {
  const target = e.target as HTMLElement | null
  const host = target?.closest?.(RIPPLE_SELECTOR) as HTMLElement | null
  if (!host) return
  if (host.matches(':disabled, .ant-btn-disabled, .ant-tabs-tab-disabled, .ant-segmented-item-disabled')) return
  const rect = host.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2
  const ripple = document.createElement('span')
  ripple.className = 'xb-ripple'
  ripple.style.width = `${size}px`
  ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  host.appendChild(ripple)
  ripple.addEventListener('animationend', () => ripple.remove())
})