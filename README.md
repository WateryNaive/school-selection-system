# 实训室进组选报系统

8 阶段流程：集中宣讲 → 开放日 → 意向填报 → 导师初选面试 → 拟录取确认 → 分轮补录 → 统筹调剂 → 结果公示入组。

前端 React + AntD，后端 NestJS + Prisma，数据库为内嵌 PostgreSQL（真实落库，非内存假数据）。

## 目录结构

```
选报系统/
├─ frontend/   前端（Vite + React + TS + AntD）
│  ├─ src/         页面与状态（views/ 学生/导师/管理员/公示，LoginView 登录页）
│  └─ vite.config.ts   /api 代理到后端 :3000
├─ backend/    后端（NestJS + Prisma）
│  ├─ src/         控制器 / 服务 / 录取算法 algo.ts
│  └─ prisma/      schema、迁移、seed 与演示数据
├─ database/   数据库启动脚本 db.mjs（内嵌 PostgreSQL）
├─ docs/       需求文档
└─ package.json  统一启动脚本
```

> 数据库实际数据目录在 `C:\Users\<你>\.xuanbao\pgdata`（Windows 要求纯英文路径，故不放在项目内）。
> `database/db.mjs` 负责初始化 / 启动该集群并创建 `xuanbao` 库。

## 启动（三个窗口，或用根脚本）

```bash
# 1 数据库（端口 5432）
npm run db
# 2 后端（端口 3000）
npm run dev:backend
# 3 前端（端口 5173）
npm run dev:frontend
```

打开 http://localhost:5173 ，登录页选身份进入；右上「切换身份」可换学生 / 导师 / 管理员 / 访客。

## 重置演示数据

```bash
npm run seed   # 清空并重新灌入 7 实训室 / 35 导师 / 301 学生 / 900 报名
```
