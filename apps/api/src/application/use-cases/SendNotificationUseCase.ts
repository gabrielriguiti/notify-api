import { Notification } from '../../domain/entities/Notification.js';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository.js';
import type { NotificationChannel } from '../../domain/entities/Notification.js';

export interface SendNotificationInput {
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  idempotencyKey: string;
}

export interface SendNotificationOutput {
  id: string;
  status: string;
  channel: string;
  recipient: string;
  createdAt: Date;
}

export class NotificationAlreadyExistsError extends Error {
  constructor(public readonly notificationId: string) {
    super('Notification already exists for this idempotency key');
    this.name = 'NotificationAlreadyExistsError';
  }
}

// Responsabilidade única agora: validar, checar idempotência e persistir como PENDING.
// O envio em si é responsabilidade do worker — ver Dia 4-5.
export class SendNotificationUseCase {
  constructor(private readonly repository: INotificationRepository) {}

  async execute(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      throw new NotificationAlreadyExistsError(existing.id);
    }

    const notification = Notification.create({
      tenantId: input.tenantId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
    });

    await this.repository.save(notification);

    return {
      id: notification.id,
      status: notification.status,
      channel: notification.channel,
      recipient: notification.recipient,
      createdAt: notification.createdAt,
    };
  }
}
