import { Resend } from 'resend';
import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

export class ResendEmailSender implements INotificationSender {
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(notification: Notification): Promise<SendResult> {
    const { data, error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: notification.recipient,
      subject: notification.subject ?? '(sem assunto)',
      text: notification.body,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      externalId: data?.id,
    };
  }
}
