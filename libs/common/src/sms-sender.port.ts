export interface IAuthCodeSender {
  send(phone: string, code: string): Promise<void>;
}