import { Worker, type Job } from 'bullmq';
import { redisConnection } from './connection';
import type { NotificationJobData } from './notification.queue';
import { PrismaNotificationRepository } from '../database/PrismaNotificationRepository';
import { ResendEmailSender } from '../senders/ResendEmailSender';
import { MockSmsSender } from '../senders/MockSmsSender';
import type { INotificationSender } from '../../domain/interfaces/INotificationSender';
import type { NotificationChannel } from '../../domain/entities/Notification';
import { WebhookSender } from '../senders/WebhookSender';

const repository = new PrismaNotificationRepository();

const senders = new Map<NotificationChannel, INotificationSender>([
  ['EMAIL', new ResendEmailSender(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!)],
  ['SMS', new MockSmsSender()],
  ['WEBHOOK', new WebhookSender()],
]);

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    const notification = await repository.findById(job.data.notificationId);

    if (!notification) {
      throw new Error(`Notification ${job.data.notificationId} not found`);
    }

    const sender = senders.get(notification.channel);
    if (!sender) {
      throw new Error(`No sender for channel ${notification.channel}`);
    }

    const attempt = job.attemptsMade + 1;

    console.log(`[Worker] Processando notificação ${notification.id} (tentativa ${attempt})`);

    if (notification.status === 'PENDING') {
      notification.markAsQueued();
      await repository.updateStatus(notification, attempt);
    }

    const result = await sender.send(notification);

    if (!result.success) {
      if (result.retryable === false) {
        notification.markAsFailed();
        await repository.updateStatus(notification, attempt, result.error);
        return result;
      }

      // Grava a falha desta tentativa específica antes de relançar,
      // mesmo que o status final continue QUEUED (vai tentar de novo).
      await repository.updateStatus(notification, attempt, result.error);
      throw new Error(result.error ?? 'Send failed');
    }

    notification.markAsDelivered();
    await repository.updateStatus(notification, attempt);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

notificationWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} concluído com sucesso`);
});

notificationWorker.on('failed', (job, error) => {
  console.error(
    `[Worker] Job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${error.message}`,
  );
});
