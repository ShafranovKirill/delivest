import { Module } from '@nestjs/common';
import { ClientService } from './client.service.js';
import { ClientController } from './client.controller.js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { AdminClientController } from './admin-client.controller.js';

@Module({
  imports: [],
  controllers: [ClientController, AdminClientController],
  providers: [ClientService, ConfigService, PrismaService, JwtService],
  exports: [ClientService],
})
export class ClientModule {}
