import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MediaService } from '../media.service.js';

@Injectable()
export class MediaCleanupJob {
  private readonly logger = new Logger(MediaCleanupJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOriginalsCleanup() {
    this.logger.log(
      'MediaCleanupJob() | Starting cleanup of temporary originals...',
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const oldOriginals = await this.prisma.mediaFile.findMany({
        where: {
          key: { startsWith: 'originals/' },
          createdAt: { lt: oneDayAgo },
        },
        select: { id: true, key: true },
      });

      if (oldOriginals.length === 0) {
        this.logger.log('MediaCleanupJob() | No old originals found.');
        return;
      }

      this.logger.log(
        `MediaCleanupJob() | Found ${oldOriginals.length} files to delete.`,
      );

      for (const file of oldOriginals) {
        try {
          await this.mediaService.deleteFile(file.id);
        } catch (err) {
          this.logger.error(
            `MediaCleanupJob() | Failed to delete file ${file.id} (key: ${file.key}): ${(err as Error).message}`,
          );
        }
      }

      this.logger.log('MediaCleanupJob() | Cleanup finished.');
    } catch (error) {
      this.logger.error(
        `MediaCleanupJob() | Global error: ${(error as Error).message}`,
      );
    }
  }
}
