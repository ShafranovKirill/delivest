interface UCallerSuccess {
  status: true;
  ucaller_id: number;
  phone: string;
  code: string;
  client?: string;
  unique_request_id?: string;
  exists: boolean;
}

 export interface UCallerError {
  status: false; 
  error: string;
  code: number; 
}

export type UCallerResponse = UCallerSuccess | UCallerError;

export interface UCallerInitCallRequest {
  phone: number;
  code?: string;
  client?: string;
  unique?: string;
  voice?: boolean;
  mix?: boolean;
}

