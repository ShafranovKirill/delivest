export interface GetProductRequest {
  id: string;
}

export interface FindProductsRequest {
  branchId: string;
  name: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  order: number;
}
