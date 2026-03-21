import { Module } from '@nestjs/common';
import { NetService } from './net.service';

@Module({
  imports: [],
  providers: [NetService],
  exports: [],
})
export class NetModule {}
