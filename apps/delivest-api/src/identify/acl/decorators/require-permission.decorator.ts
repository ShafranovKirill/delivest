import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../../../generated/prisma/enums.js';

export const PERMISSION_KEY = 'requirePermission';

export const RequirePermission = (perm: Permission) =>
  SetMetadata(PERMISSION_KEY, perm);
