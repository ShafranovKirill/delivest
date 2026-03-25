import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { NetModule } from './net/net.module.js';
import { IdentityModule } from './identify/identify.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    PrismaModule,
    NetModule,
    IdentityModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
