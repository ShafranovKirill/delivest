import { Global, Module } from '@nestjs/common';
import { NestEventBusAdapter } from './infrastructure/event-bus/nest-event-bus.adapter.js';

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: 'IEventBus',
      useClass: NestEventBusAdapter,
    },
  ],
  exports: ['IEventBus'],
})
export class SharedModule {}
