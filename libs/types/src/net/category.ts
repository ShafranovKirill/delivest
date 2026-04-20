export interface FindCategoryRequest {
  id: string;
}

export interface FindCategoryByBranchRequest {
  branchId: string;
}

export interface CreateCategoryRequest {
  name: string;
  order: number;
  branchId: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  order: number;
  branchId: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest> & {
  categoryId: string;
};
