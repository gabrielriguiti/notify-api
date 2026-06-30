import axios, { AxiosError } from 'axios';
import type { INotificationSender, SendResult } from '../../domain/interfaces/INotificationSender';
import type { Notification } from '../../domain/entities/Notification';

const TIMEOUT_MS = 5000;

export class WebhookSender implements INotificationSender {
  async send(notification: Notification): Promise<SendResult> {
    try {
      const response = await axios.post(
        notification.recipient, // para webhook, "recipient" é a URL de destino
        {
          id: notification.id,
          subject: notification.subject,
          body: notification.body,
          sentAt: new Date().toISOString(),
        },
        {
          timeout: TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      return {
        success: true,
        externalId: String(response.status),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): SendResult {
    if (!(error instanceof AxiosError)) {
      return { success: false, error: 'Unknown error during webhook delivery' };
    }

    // Timeout — sem resposta nenhuma do servidor. Sempre vale tentar de novo.
    if (error.code === 'ECONNABORTED') {
      throw new Error(`Webhook timeout after ${TIMEOUT_MS}ms — retrying`);
    }

    const status = error.response?.status;

    // 4xx: o cliente configurou a URL errado ou o payload está malformado.
    // Tentar de novo não resolve — é erro permanente, não falha transitória.
    if (status && status >= 400 && status < 500) {
      return {
        success: false,
        retryable: false,
        error: `Webhook rejected with status ${status} — not retrying`,
      };
    }

    // 5xx ou erro de rede (servidor fora do ar, DNS falhou, conexão recusada):
    // provavelmente transitório. Lança erro para o BullMQ tentar de novo.
    throw new Error(`Webhook delivery failed (${status ?? error.code}) — retrying`);
  }
}
