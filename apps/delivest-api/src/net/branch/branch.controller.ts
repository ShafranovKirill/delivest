import { Controller, Get, Query } from '@nestjs/common';
import { BranchService } from './branch.service.js';
import { GetBranchDto } from './dto/get-branch.dto.js';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  async findAllBranch() {
    return this.branchService.findAll();
  }

  @Get('branch')
  async getBranch(@Query() dto: GetBranchDto) {
    return this.branchService.findOne(dto);
  }

  @Get('details')
  async getBranchDetails(@Query() dto: GetBranchDto) {
    return this.branchService.getBranchDetails(dto);
  }
}
