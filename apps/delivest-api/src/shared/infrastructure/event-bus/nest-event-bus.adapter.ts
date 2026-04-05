import { IEventBus } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NestEventBusAdapter implements IEventBus {
  private readonly logger = new Logger(NestEventBusAdapter.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish<T>(eventName: string, payload: T): Promise<void> {
    this.logger.debug(`Publishing event: ${eventName}`);

    const results = await this.eventEmitter.emitAsync(eventName, payload);
    this.validateResults(results, eventName);
  }

  private validateResults(results: any[], eventName: string): void {
    if (!results?.length) return;

    const firstError = results.find((res) => res instanceof Error);

    if (firstError) {
      this.logger.warn(`Error detected in listener for "${eventName}"`);
      throw firstError;
    }
  }
}
