import type { Notification } from '../entities/Notification';

export interface SendResult {
  success: boolean;
  externalId?: string; // ID retornado pelo provider (ex: messageId do SES)
  error?: string;
  retryable?: boolean; // só relevante quando success é false. Default: true.
}

export interface INotificationSender {
  send(notification: Notification): Promise<SendResult>;
}
