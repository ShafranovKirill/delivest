export interface GetCategoryRequest {
  id: string;
}

export interface GetCategoryByBranchRequest {
  branchId: string;
}

export interface CategoryResponce {
  id: string;
  name: string;
  order: number;
}
