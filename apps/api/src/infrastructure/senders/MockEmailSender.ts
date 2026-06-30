import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

export class MockEmailSender implements INotificationSender {
  async send(notification: Notification): Promise<SendResult> {
    console.log(`[MockEmailSender] Enviando email para ${notification.recipient}`);
    console.log(`  Assunto: ${notification.subject}`);
    console.log(`  Corpo: ${notification.body}`);

    // Simula latência de rede
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      success: true,
      externalId: `mock-${crypto.randomUUID()}`,
    };
  }
}
