import type { Notification } from '../entities/Notification';

export interface SendResult {
  success: boolean;
  externalId?: string; // ID retornado pelo provider (ex: messageId do SES)
  error?: string;
}

export interface INotificationSender {
  send(notification: Notification): Promise<SendResult>;
}
