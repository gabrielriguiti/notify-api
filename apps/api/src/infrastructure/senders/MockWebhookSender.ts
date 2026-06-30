import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

export class MockWebhookSender implements INotificationSender {
  async send(notification: Notification): Promise<SendResult> {
    console.log(`[MockWebhookSender] POST para ${notification.recipient}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true, externalId: `mock-webhook-${crypto.randomUUID()}` };
  }
}
