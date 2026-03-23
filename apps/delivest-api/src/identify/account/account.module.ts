import { Module } from '@nestjs/common';
import { AccountService } from './account.service.js';

@Module({
  imports: [],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
