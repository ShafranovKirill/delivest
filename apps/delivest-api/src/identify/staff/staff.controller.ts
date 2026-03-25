import { Controller, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service.js';

@ApiTags('Staff (Работники)')
@Controller('client')
export class StaffController {
  private readonly logger = new Logger(StaffController.name);

  constructor(private readonly service: StaffService) {}
}
