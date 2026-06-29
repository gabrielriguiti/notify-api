import { Notification } from '../../domain/entities/Notification';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository';
import type { INotificationSender } from '../../domain/interfaces/INotificationSender';
import type { NotificationChannel } from '../../domain/entities/Notification';

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
  alreadyExists: boolean;
}

// Erro tipado para idempotência — permite tratar esse caso separadamente no controller
export class NotificationAlreadyExistsError extends Error {
  constructor(public readonly notificationId: string) {
    super('Já existe uma notificação para esta chave de idempotência');
    this.name = 'NotificationAlreadyExistsError';
  }
}

export class SendNotificationUseCase {
  constructor(
    private readonly repository: INotificationRepository,
    private readonly senders: Map<NotificationChannel, INotificationSender>,
  ) {}

  async execute(input: SendNotificationInput): Promise<SendNotificationOutput> {
    // 1. Verificar idempotência — se já existe, retornar sem processar
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      throw new NotificationAlreadyExistsError(existing.id);
    }

    // 2. Criar a entidade (validações acontecem aqui dentro)
    const notification = Notification.create({
      tenantId: input.tenantId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
    });

    // 3. Persistir como PENDING antes de qualquer envio
    await this.repository.save(notification);

    // 4. Buscar o sender correto para o canal
    const sender = this.senders.get(input.channel);
    if (!sender) {
      throw new Error(`Nenhum remetente registrado para o canal: ${input.channel}`);
    }

    // 5. Tentar enviar
    notification.markAsQueued();
    const result = await sender.send(notification);

    // 6. Atualizar status baseado no resultado
    if (result.success) {
      notification.markAsDelivered();
    } else {
      notification.markAsFailed();
    }

    await this.repository.updateStatus(notification);

    return {
      id: notification.id,
      status: notification.status,
      channel: notification.channel,
      recipient: notification.recipient,
      createdAt: notification.createdAt,
      alreadyExists: false,
    };
  }
}
