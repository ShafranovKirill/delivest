import { Injectable } from '@nestjs/common';
import { ForbiddenException } from '../../shared/exceptions/domain_exception/domain-exception.js';
import { AccessStaffTokenPayload } from '@delivest/types';

@Injectable()
export class BranchAbilityService {
  applyBranchPolicy<T>(
    staffTokenPaylod: AccessStaffTokenPayload,
    requestedIds?: string | string[],
  ): T {
    if (staffTokenPaylod.permissions.includes('ADMIN')) {
      return {} as T;
    }

    const staffBranchIds = staffTokenPaylod.branchIds ?? [];
    if (staffBranchIds.length === 0) {
      throw new ForbiddenException('Вы не привязаны ни к одному филиалу');
    }

    let authorizedIds: string[];

    if (
      !requestedIds ||
      (Array.isArray(requestedIds) && requestedIds.length === 0)
    ) {
      authorizedIds = staffBranchIds;
    } else {
      const requested = Array.isArray(requestedIds)
        ? requestedIds
        : [requestedIds];
      authorizedIds = requested.filter((id) => staffBranchIds.includes(id));
    }

    if (authorizedIds.length === 0) {
      throw new ForbiddenException('У вас нет доступа к выбранным филиалам');
    }

    return {
      branchId: { in: authorizedIds },
    } as unknown as T;
  }

  hasAccess(
    staffTokenPaylod: AccessStaffTokenPayload,
    branchId: string,
  ): boolean {
    if (staffTokenPaylod.permissions.includes('ADMIN')) {
      return true;
    }
    if (!branchId) return false;
    return staffTokenPaylod.branchIds?.includes(branchId) ?? false;
  }
}
