import { prisma } from '@notify/database';
import { Notification } from '../../domain/entities/Notification';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository';

export class PrismaNotificationRepository implements INotificationRepository {
  async save(notification: Notification): Promise<void> {
    await prisma.notification.create({
      data: {
        id: notification.id,
        tenantId: notification.tenantId,
        channel: notification.channel,
        recipient: notification.recipient,
        subject: notification.subject,
        body: notification.body,
        idempotencyKey: notification.idempotencyKey,
        status: notification.status,
        createdAt: notification.createdAt,
      },
    });
  }

  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({
      where: { idempotencyKey: key },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async updateStatus(notification: Notification, attempt: number, error?: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: notification.status },
    });

    await prisma.notificationLog.create({
      data: {
        notificationId: notification.id,
        attempt,
        status: notification.status,
        error: error ?? null,
      },
    });
  }

  // Mapper: converte a linha crua do banco na entidade de domínio
  private toDomain(row: {
    id: string;
    tenantId: string;
    channel: string;
    recipient: string;
    subject: string | null;
    body: string;
    idempotencyKey: string;
    status: string;
    createdAt: Date;
  }): Notification {
    return Notification.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      channel: row.channel as Notification['channel'],
      recipient: row.recipient,
      subject: row.subject ?? undefined,
      body: row.body,
      idempotencyKey: row.idempotencyKey,
      status: row.status as Notification['status'],
      createdAt: row.createdAt,
    });
  }
}
