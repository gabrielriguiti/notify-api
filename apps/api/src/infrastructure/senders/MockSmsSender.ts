import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

export class MockSmsSender implements INotificationSender {
  async send(notification: Notification): Promise<SendResult> {
    console.log(`[MockSmsSender] SMS para ${notification.recipient}: ${notification.body}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { success: true, externalId: `mock-sms-${crypto.randomUUID()}` };
  }
}
