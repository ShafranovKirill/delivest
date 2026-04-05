import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service.js';
import { OutboxProcessor } from './outbox.processor.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}
