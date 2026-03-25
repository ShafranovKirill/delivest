import { Module } from '@nestjs/common';
import { ClientService } from './client.service.js';
import { ClientController } from './client.controller.js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  controllers: [ClientController],
  providers: [ClientService, ConfigService, PrismaService, JwtService],
  exports: [ClientService],
})
export class ClientModule {}
