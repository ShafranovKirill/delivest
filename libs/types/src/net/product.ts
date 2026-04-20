export interface FindProductRequest {
  id: string;
}

export interface FindProductsByBranchRequest {
  branchId: string;
}

export interface FindProductsByCategoryRequest {
  categoryId: string;
}

export interface FindProductsByNameRequest {
  branchId: string;
  name: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  price: number;
  branchId: string;
  categoryId?: string;
  description?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  branchId: string;
  categoryId?: string;
  description?: string;
}

export type UpdateProductRequest = Partial<CreateProductRequest> & {
  productId: string;
};
