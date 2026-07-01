export interface NotificationTemplateData {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
}

export interface ITemplateRepository {
  findByName(tenantId: string, name: string): Promise<NotificationTemplateData | null>;
  save(template: Omit<NotificationTemplateData, 'id'>): Promise<NotificationTemplateData>;
}
