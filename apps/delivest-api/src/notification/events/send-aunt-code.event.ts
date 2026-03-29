export class SendAuthCodeEvent {
  constructor(
    public readonly id: string,

    public readonly number: string,

    public readonly code: string,
  ) {}
}
