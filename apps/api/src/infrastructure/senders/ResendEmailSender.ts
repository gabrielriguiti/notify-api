import { Resend } from 'resend';
import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

// Erros do Resend que indicam problema definitivo no payload/configuração —
// tentar de novo não resolve.
const NON_RETRYABLE_ERROR_NAMES = new Set([
  'validation_error',
  'missing_required_field',
  'invalid_parameter',
  'invalid_from_address',
  'invalid_to_address',
]);

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
      const retryable = !NON_RETRYABLE_ERROR_NAMES.has(error.name);

      return {
        success: false,
        retryable,
        error: `${error.name}: ${error.message}`,
      };
    }

    return {
      success: true,
      externalId: data?.id,
    };
  }
}
