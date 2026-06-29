export type NotificationChannel = 'EMAIL' | 'SMS' | 'WEBHOOK';

export type NotificationStatus = 'PENDING' | 'QUEUED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface NotificationProps {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  idempotencyKey: string;
  status: NotificationStatus;
  createdAt: Date;
}

export class Notification {
  private readonly props: NotificationProps;

  private constructor(props: NotificationProps) {
    this.props = props;
  }

  // Factory method — o único jeito de criar uma Notification válida
  static create(params: Omit<NotificationProps, 'id' | 'status' | 'createdAt'>): Notification {
    if (!params.recipient || params.recipient.trim() === '') {
      throw new Error('O destinatário é obrigatório');
    }
    if (!params.body || params.body.trim() === '') {
      throw new Error('O corpo da mensagem é obrigatório');
    }
    if (params.channel === 'EMAIL' && !params.subject) {
      throw new Error('O assunto é obrigatório para notificações por e-mail');
    }

    return new Notification({
      ...params,
      id: crypto.randomUUID(),
      status: 'PENDING',
      createdAt: new Date(),
    });
  }

  // Reconstitui uma entidade que já existe no banco
  static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  // Métodos de domínio — a entidade sabe o que pode fazer consigo mesma
  markAsQueued(): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(
        `Não é possível enfileirar uma notificação com status "${this.props.status}"`,
      );
    }
    this.props.status = 'QUEUED';
  }

  markAsDelivered(): void {
    if (this.props.status !== 'QUEUED') {
      throw new Error(`Não é possível entregar uma notificação com status "${this.props.status}"`);
    }
    this.props.status = 'DELIVERED';
  }

  markAsFailed(): void {
    this.props.status = 'FAILED';
  }

  cancel(): void {
    if (this.props.status === 'DELIVERED') {
      throw new Error('Não é possível cancelar uma notificação já entregue');
    }
    this.props.status = 'CANCELLED';
  }

  // Getters — acesso somente leitura
  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get channel(): NotificationChannel {
    return this.props.channel;
  }
  get recipient(): string {
    return this.props.recipient;
  }
  get subject(): string | undefined {
    return this.props.subject;
  }
  get body(): string {
    return this.props.body;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get status(): NotificationStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
