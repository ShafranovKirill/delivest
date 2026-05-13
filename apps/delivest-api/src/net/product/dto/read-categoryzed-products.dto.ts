import { CategorizedProducts, ProductResponse } from '@delivest/types';
import { ReadCategoryDto } from '../../category/dto/read.dto.js';

export class ReadCategoryzedProductsDto
  extends ReadCategoryDto
  implements CategorizedProducts
{
  products: ProductResponse[];
}
