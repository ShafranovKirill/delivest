import { Body, Controller, Post } from '@nestjs/common';
import { BranchService } from './branch.service.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  async createBranch(@Body() dto: CreateBranchDto) {
    return this.branchService.create(dto);
  }
}
