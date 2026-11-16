import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// database/ 目录没有 node_modules，从 backend 的依赖里加载 embedded-postgres
const { default: EmbeddedPostgres } = await import(
  new URL('../backend/node_modules/embedded-postgres/dist/index.js', import.meta.url)
)

// PG 在 Windows 上无法处理非 ASCII 数据目录路径，固定放到用户目录下
const dataDir = path.join(os.homedir(), '.xuanbao', 'pgdata')
fs.mkdirSync(path.dirname(dataDir), { recursive: true })

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'xuanbao_dev_2026',
  port: 5432,
  persistent: true,
  createPostgresUser: false,
  // 中文 Windows 下 initdb 导入系统排序规则会混入 GBK 字节，UTF8 校验必失败；
  // 用 SQL_ASCII 建集群，应用库再单独建成 UTF8
  initdbFlags: ['--no-locale', '--encoding=SQL_ASCII'],
  onLog: (msg) => console.log('[pg]', msg),
  onError: (err) => console.error('[pg]', err),
})

try {
  // 已有集群（存在 PG_VERSION）时跳过 initdb，否则 initdb 会因目录非空报错
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    await pg.initialise()
  }
  await pg.start()

  const client = pg.getPgClient('postgres')
  await client.connect()
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'xuanbao'")
  if (exists.rowCount === 0) {
    await client.query("CREATE DATABASE xuanbao WITH ENCODING 'UTF8' TEMPLATE template0")
    console.log('[pg] created database xuanbao (UTF8)')
  }
  await client.end()

  console.log('EMBEDDED_PG_READY port=5432 db=xuanbao')
  setInterval(() => {}, 1 << 30)
} catch (e) {
  console.error('DB_START_FAIL', e)
  process.exit(1)
}