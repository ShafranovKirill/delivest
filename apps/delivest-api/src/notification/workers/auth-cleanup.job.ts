import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthStatus } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AuthCleanupJob {
  private readonly logger = new Logger(AuthCleanupJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    this.logger.log('AuthCleanupJob() | Starting background cleanup...');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const expiredUpdate = await this.prisma.authMessage.updateMany({
        where: {
          status: AuthStatus.PENDING,
          expiresAt: { lt: new Date() },
        },
        data: { status: AuthStatus.EXPIRED },
      });

      const deleted = await this.prisma.authMessage.deleteMany({
        where: {
          status: { in: [AuthStatus.EXPIRED, AuthStatus.FAILED] },
          createdAt: { lt: oneDayAgo },
        },
      });

      this.logger.log(
        `AuthCleanupJob() | Finished. Marked expired: ${expiredUpdate.count}, Deleted: ${deleted.count}`,
      );
    } catch (error) {
      this.logger.error(
        `AuthCleanupJob() | Failed: ${(error as Error).message}`,
      );
    }
  }
}
