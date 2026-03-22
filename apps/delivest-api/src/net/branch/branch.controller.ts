import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BranchService } from './branch.service.js';
import { GetBranchDto } from './dto/get-branch.dto.js';
import { ReadBranchDto } from './dto/read-branch.dto.js';

@ApiTags('Branches (Филиалы)')
@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все филиалы' })
  @ApiOkResponse({
    type: [ReadBranchDto],
    description: 'Массив всех доступных филиалов',
  })
  async findAllBranch() {
    return this.branchService.findAll();
  }

  @Get('one')
  @ApiOperation({ summary: 'Получить один филиал по айди' })
  @ApiOkResponse({ type: ReadBranchDto })
  @ApiNotFoundResponse({ description: 'Филиал не найден' })
  async getBranch(@Query() dto: GetBranchDto) {
    return this.branchService.findOne(dto);
  }

  @Get('details')
  @ApiOperation({
    summary: 'Получить информицию по филиалу',
  })
  @ApiOkResponse({ type: ReadBranchDto })
  async getBranchDetails(@Query() dto: GetBranchDto) {
    return this.branchService.getBranchDetails(dto);
  }
}
