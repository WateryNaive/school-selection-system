import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { PrismaService } from './prisma.service'
import { SelectionService } from './selection.service'
import { AuthService } from './auth.service'

@Module({
  controllers: [AppController],
  providers: [PrismaService, SelectionService, AuthService],
})
export class AppModule {}