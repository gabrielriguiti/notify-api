import { Notification } from '../../domain/entities/Notification';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository';
import type { ITemplateRepository } from '../../domain/interfaces/ITemplateRepository';
import type { NotificationChannel } from '../../domain/entities/Notification';
import { TemplateEngine } from '../services/TemplateEngine';

export interface SendNotificationInput {
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body?: string;
  templateName?: string;
  variables?: Record<string, string | number | boolean>;
  idempotencyKey: string;
}

export class NotificationAlreadyExistsError extends Error {
  constructor(public readonly notificationId: string) {
    super('Notification already exists for this idempotency key');
    this.name = 'NotificationAlreadyExistsError';
  }
}

// Responsabilidade única agora: validar, checar idempotência e persistir como PENDING.
// O envio em si é responsabilidade do worker
export class SendNotificationUseCase {
  private readonly templateEngine = new TemplateEngine();

  constructor(
    private readonly repository: INotificationRepository,
    private readonly templateRepository: ITemplateRepository,
  ) {}

  async execute(input: SendNotificationInput) {
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      throw new NotificationAlreadyExistsError(existing.id);
    }

    let subject = input.subject;
    let body = input.body ?? '';

    // Resolve o template se informado
    if (input.templateName) {
      const template = await this.templateRepository.findByName(input.tenantId, input.templateName);

      if (!template) {
        throw new Error(`Template "${input.templateName}" not found`);
      }

      const ctx = input.variables ?? {};
      body = this.templateEngine.compile(template.body, ctx);

      if (template.subject) {
        subject = this.templateEngine.compile(template.subject, ctx);
      }
    }

    const notification = Notification.create({
      tenantId: input.tenantId,
      channel: input.channel,
      recipient: input.recipient,
      subject,
      body,
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
