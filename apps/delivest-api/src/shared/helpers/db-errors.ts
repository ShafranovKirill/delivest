import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaErrorCode } from '@delivest/common';

export interface PrismaErrorMeta extends Record<string, any> {
  modelName?: string;
  target?: string[];
  code?: string;
  message?: string;
}

export function isPrismaError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isConstraintError(error: unknown): boolean {
  if (!isPrismaError(error)) return false;

  const { code } = error;

  return [
    PrismaErrorCode.UNIQUE_VIOLATION,
    PrismaErrorCode.FOREIGN_KEY_VIOLATION,
    PrismaErrorCode.NOT_NULL_VIOLATION,
    PrismaErrorCode.REQUIRED_RELATION_VIOLATION,
  ].includes(code as any);
}

export function getInternalErrorCode(error: unknown): string | undefined {
  if (!isPrismaError(error)) return undefined;
  return error.code;
}

export function getPrismaModelName(error: unknown): string | undefined {
  if (!isPrismaError(error)) return undefined;
  return (error.meta as PrismaErrorMeta | undefined)?.modelName;
}
