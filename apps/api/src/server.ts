import Fastify from 'fastify';
import { notificationsRoute } from './http/routes/notifications.route';
import './infrastructure/queue/notification.worker';

const start = async () => {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(notificationsRoute);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 API rodando em http://localhost:${port}`);
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
