export interface FindBranchRequest {
  id: string;
}

export interface CreateBranchRequest {
  name: string;
  alias: string;
}

export interface BranchResponce {
  id: string;
  name: string;
  alias: string;
  description?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;
