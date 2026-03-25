import { Module } from '@nestjs/common';
import { IdentityService } from './identify.service.js';
import { ClientModule } from './client/client.module.js';

@Module({
  imports: [ClientModule],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
