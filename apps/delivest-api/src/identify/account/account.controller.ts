import { Controller, Logger } from '@nestjs/common';
import { AccountService } from './account.service.js';

@Controller('account')
export class AccountController {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly service: AccountService) {}
}
