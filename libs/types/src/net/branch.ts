export interface GetBranchRequest {
  id: string;
}

export interface BranchResponce {
  id: string;
  name: string;
  alias: string;
}

export interface BranchDetailsResponce {
  id: string;
  description?: string;
  address?: string;
}
