import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import 'antd/dist/reset.css'
import './index.css'
import './effects'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0891b2',
          colorInfo: '#0891b2',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          colorTextLightSolid: '#ffffff',
          colorBgBase: '#ffffff',
          colorBgLayout: '#f3f6fb',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: '#d8e2ef',
          colorBorderSecondary: '#e8eef6',
          colorText: '#1f2d3d',
          colorTextSecondary: '#5b6b82',
          borderRadius: 10,
          controlHeight: 36,
          fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
        },
        components: {
          Button: {
            primaryShadow: '0 2px 10px rgba(8,145,178,.25)',
            defaultShadow: 'none',
            dangerShadow: '0 2px 10px rgba(220,38,38,.2)',
          },
          Table: {
            headerBg: '#f0f5fb',
            headerColor: '#41506b',
            rowHoverBg: 'rgba(8,145,178,.06)',
            borderColor: '#e8eef6',
          },
          Tabs: {
            inkBarColor: '#0891b2',
            itemSelectedColor: '#0891b2',
            itemHoverColor: '#0ea5e9',
          },
          Segmented: {
            itemSelectedBg: '#e0f2fe',
            itemSelectedColor: '#0369a1',
          },
          Statistic: {
            colorTextDescription: '#64748b',
          },
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
)