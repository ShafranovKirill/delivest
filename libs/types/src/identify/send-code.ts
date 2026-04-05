export interface ZvonokSuccessResponse {
  status: "ok";
  data: {
    balance: string;
    call_id: number;
    created: string;
    phone: string;
    pincode: string;
  };
}

export interface ZvonokErrorResponse {
  status: "error";
  data: string | Record<string, any>;
}

export type ZvonokResponse = ZvonokSuccessResponse | ZvonokErrorResponse;

export interface ZvonokTellCodeParams {
  public_key: string;
  campaign_id: string;
  phone: string;
  pincode: string;
}
