import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { Permission } from '../../../../generated/prisma/enums.js';
import { UnauthorizedException } from '../../../shared/exception/domain_exception/domain-exception.js';

@Injectable()
export class AclGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();

    const staff = req.staff;

    const requiredPermission = this.reflector.get<Permission>(
      PERMISSION_KEY,
      ctx.getHandler(),
    );

    if (!requiredPermission) return true;

    if (!staff || !staff.permissions) {
      throw new UnauthorizedException('Staff context or permissions not found');
    }

    // 3. Используем опциональную цепочку ?. для безопасности
    if (staff.permissions.includes(Permission.ADMIN)) {
      return true;
    }

    if (!staff.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Missing permission');
    }

    return true;
  }
}
