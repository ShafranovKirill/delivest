import { instanceToPlain } from 'class-transformer';
import { Prisma } from '../../generated/prisma/client.js';

export function toPrismaJson<T>(data: T): Prisma.InputJsonValue {
  return instanceToPlain(data, {
    excludeExtraneousValues: false,
  }) as Prisma.InputJsonValue;
}
