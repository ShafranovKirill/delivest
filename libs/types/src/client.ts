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
  password?: string;
}

export interface LoginClientRequest {
  phone: string;
  password: string;
}

export interface ClientResponse {
  id: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
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
