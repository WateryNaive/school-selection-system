import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  const port = Number(process.env.PORT) || 3000
  await app.listen(port)
  console.log(`NEST_READY http://localhost:${port}/api`)
}

bootstrap().catch((e) => {
  console.error('NEST_START_FAIL', e)
  process.exit(1)
})