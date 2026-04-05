export interface RefreshClientTokenPayload {
  sub: string;
  phone: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export type AccessClientTokenPayload = RefreshClientTokenPayload;

export interface CreateClientRequest {
  phone: string;
  name?: string;
}

export interface UpdateClientRequest {
  name?: string;
}

export interface GetClientRequest {
  id: string;
}

export interface LoginClientRequest {
  phone: string;
  code: string;
}

export interface ClientResponse {
  id: string;
  phone: string;
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface FindByPhoneRequest {
  phone: string;
}

export interface TokenClientResponse {
  accessToken: string;
}
