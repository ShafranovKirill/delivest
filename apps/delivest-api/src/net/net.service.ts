import { Injectable, Logger } from '@nestjs/common';
import { BranchService } from './branch/branch.service.js';

@Injectable()
export class NetService {
  private readonly logger = new Logger(NetService.name);
  constructor(private readonly branchServise: BranchService) {}
}
