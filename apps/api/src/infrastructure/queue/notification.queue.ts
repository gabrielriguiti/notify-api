import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export interface NotificationJobData {
  notificationId: string;
}

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, depois 4s, depois 8s
    },
    removeOnComplete: { age: 3600 }, // limpa jobs concluídos após 1h
    removeOnFail: { age: 24 * 3600 }, // mantém falhas por 24h pra debug
  },
});
