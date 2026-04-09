import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BranchService } from './branch.service.js';
import { ReadBranchDto } from './dto/read-branch.dto.js';
import { FindBranchDto } from './dto/find-branch.dto.js';

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

  @Get(':id')
  @ApiOperation({ summary: 'Получить один филиал по айди' })
  @ApiOkResponse({ type: ReadBranchDto })
  @ApiNotFoundResponse({ description: 'Филиал не найден' })
  async getBranch(@Param() dto: FindBranchDto) {
    return this.branchService.findOne(dto.id);
  }
}
