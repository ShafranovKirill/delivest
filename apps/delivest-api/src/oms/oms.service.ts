import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OmsService {
  private readonly logger = new Logger(OmsService.name);
  constructor() {}
}
