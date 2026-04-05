import { jest } from '@jest/globals';

jest.unstable_mockModule('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (target: any, key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  TransactionHost: class {
    get tx() {
      return {};
    }
  },
}));

const { Test } = await import('@nestjs/testing');
const { Logger } = await import('@nestjs/common');
const { NotificationService } = await import('./notification.service.js');
const { OutboxService } = await import('../outbox/outbox.service.js');
const { PrismaService } = await import('../prisma/prisma.service.js');
const { DelivestEvent } = await import('../shared/events/types.js');

describe('NotificationService', () => {
  let service: any;
  let outboxServiceMock: {
    save: jest.Mock<any>;
  };

  beforeEach(async () => {
    outboxServiceMock = {
      save: jest.fn<any>().mockImplementation(() => Promise.resolve()),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: OutboxService, useValue: outboxServiceMock },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get(NotificationService);

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  describe('publishAuthEvent', () => {
    const authCodeId = 'test-id';

    it('should successfully save auth event to outbox', async () => {
      outboxServiceMock.save.mockResolvedValue(undefined as any);

      await service.publishAuthEvent(authCodeId);

      expect(outboxServiceMock.save).toHaveBeenCalledWith(
        DelivestEvent.AUTH_CODE_REQUESTED,
        expect.objectContaining({ authCodeId }),
      );
    });

    it('should throw and log error if save fails', async () => {
      const error = new Error('DB Error');
      outboxServiceMock.save.mockRejectedValue(error as any);

      await expect(service.publishAuthEvent(authCodeId)).rejects.toThrow(error);
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
