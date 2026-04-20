export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
export const PHONE_REGEX = /^\+7\d{10}$/;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 100;
export const COOKIE_NAMES = {
  CLIENT_REFRESH_TOKEN: "client_refresh_token",
  STAFF_REFRESH_TOKEN: "staff_refresh_token",
  SESSION_ID: "session_id",
} as const;
