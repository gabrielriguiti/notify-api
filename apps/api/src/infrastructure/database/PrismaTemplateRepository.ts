import { prisma } from '@notify/database';
import type {
  ITemplateRepository,
  NotificationTemplateData,
} from '../../domain/interfaces/ITemplateRepository';

export class PrismaTemplateRepository implements ITemplateRepository {
  async findByName(tenantId: string, name: string): Promise<NotificationTemplateData | null> {
    const row = await prisma.notificationTemplate.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      channel: row.channel,
      subject: row.subject ?? undefined,
      body: row.body,
    };
  }

  async save(template: Omit<NotificationTemplateData, 'id'>): Promise<NotificationTemplateData> {
    const row = await prisma.notificationTemplate.create({
      data: {
        tenantId: template.tenantId,
        name: template.name,
        channel: template.channel as 'EMAIL' | 'SMS' | 'WEBHOOK',
        subject: template.subject,
        body: template.body,
      },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      channel: row.channel,
      subject: row.subject ?? undefined,
      body: row.body,
    };
  }
}
