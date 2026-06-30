import { Redis } from 'ioredis';

// maxRetriesPerRequest: null é exigido pelo BullMQ para conexões usadas em workers/queues
export const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
