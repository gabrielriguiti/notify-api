import { Worker, type Job } from 'bullmq';
import { redisConnection } from './connection';
import type { NotificationJobData } from './notification.queue';
import { PrismaNotificationRepository } from '../database/PrismaNotificationRepository';
import { MockEmailSender } from '../senders/MockEmailSender';
import { MockSmsSender } from '../senders/MockSmsSender';
import { MockWebhookSender } from '../senders/MockWebhookSender';
import type { INotificationSender } from '../../domain/interfaces/INotificationSender';
import type { NotificationChannel } from '../../domain/entities/Notification';

const repository = new PrismaNotificationRepository();

const senders = new Map<NotificationChannel, INotificationSender>([
  ['EMAIL', new MockEmailSender()],
  ['SMS', new MockSmsSender()],
  ['WEBHOOK', new MockWebhookSender()],
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

    console.log(
      `[Worker] Processando notificação ${notification.id} (tentativa ${job.attemptsMade + 1})`,
    );

    // Só marca como QUEUED se ainda estiver PENDING — em um retry, o status
    // já pode estar QUEUED de uma tentativa anterior que falhou no envio.
    if (notification.status === 'PENDING') {
      notification.markAsQueued();
      await repository.updateStatus(notification);
    }

    const result = await sender.send(notification);

    if (!result.success) {
      // Lançar erro aqui faz o BullMQ acionar o retry automaticamente
      throw new Error(result.error ?? 'Send failed');
    }

    notification.markAsDelivered();
    await repository.updateStatus(notification);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5, // processa até 5 jobs em paralelo
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
