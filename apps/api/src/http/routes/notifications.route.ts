import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  SendNotificationUseCase,
  NotificationAlreadyExistsError,
} from '../../application/use-cases/SendNotificationUseCase';
import { PrismaNotificationRepository } from '../../infrastructure/database/PrismaNotificationRepository';
import { notificationQueue } from '../../infrastructure/queue/notification.queue';
import { PrismaTemplateRepository } from '../../infrastructure/database/PrismaTemplateRepository';

const bodySchema = z
  .object({
    channel: z.enum(['EMAIL', 'SMS', 'WEBHOOK']),
    recipient: z.string().min(1),
    idempotencyKey: z.string().min(1),

    // Opção 1: texto direto (como antes)
    subject: z.string().optional(),
    body: z.string().optional(),

    // Opção 2: template com variáveis
    templateName: z.string().optional(),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .refine((data) => data.body || data.templateName, {
    message: 'Either body or templateName must be provided',
  });

// Composition root local — onde as dependências concretas são montadas
const repository = new PrismaNotificationRepository();
const templateRepository = new PrismaTemplateRepository();
const useCase = new SendNotificationUseCase(repository, templateRepository);

export async function notificationsRoute(app: FastifyInstance): Promise<void> {
  app.post('/notifications', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    try {
      // Cria o registro PENDING e valida via use case
      const result = await useCase.execute({
        tenantId: request.tenantId!,
        ...parsed.data,
      });

      // Enfileira o job — o worker vai processar de forma assíncrona
      await notificationQueue.add('send', { notificationId: result.id });

      return reply.status(202).send({
        id: result.id,
        status: 'QUEUED',
        channel: result.channel,
        recipient: result.recipient,
        createdAt: result.createdAt,
      });
    } catch (error) {
      if (error instanceof NotificationAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
          notificationId: error.notificationId,
        });
      }
      throw error;
    }
  });
}
