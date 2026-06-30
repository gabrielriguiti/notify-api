import type { Notification } from '../entities/Notification';

export interface INotificationRepository {
  save(notification: Notification): Promise<void>;
  findByIdempotencyKey(key: string): Promise<Notification | null>;
  findById(id: string): Promise<Notification | null>;
  updateStatus(notification: Notification, attempt: number, error?: string): Promise<void>;
}
