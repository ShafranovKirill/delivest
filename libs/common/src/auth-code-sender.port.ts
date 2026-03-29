export interface IAuthCodeSender {
  send(authCodeId: string): Promise<void>;
}
