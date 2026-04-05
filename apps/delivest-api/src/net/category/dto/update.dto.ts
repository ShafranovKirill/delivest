import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create.dto.js';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
