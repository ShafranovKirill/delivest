import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service.js';

@Module({
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}