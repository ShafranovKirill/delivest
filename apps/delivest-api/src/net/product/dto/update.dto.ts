import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create.dto.js';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
