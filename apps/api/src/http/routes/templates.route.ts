import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { PrismaTemplateRepository } from '../../infrastructure/database/PrismaTemplateRepository';
import { TemplateEngine } from '../../application/services/TemplateEngine';

const createSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'WEBHOOK']),
  subject: z.string().optional(),
  body: z.string().min(1),
});

const templateRepository = new PrismaTemplateRepository();
const engine = new TemplateEngine();

export async function templatesRoute(app: FastifyInstance): Promise<void> {
  app.post('/templates', { preHandler: authMiddleware }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { name, channel, subject, body } = parsed.data;

    // Valida a sintaxe do template antes de salvar
    if (!engine.validate(body)) {
      return reply.status(400).send({ error: 'Invalid template syntax in body' });
    }
    if (subject && !engine.validate(subject)) {
      return reply.status(400).send({ error: 'Invalid template syntax in subject' });
    }

    const template = await templateRepository.save({
      tenantId: request.tenantId!,
      name,
      channel,
      subject,
      body,
    });

    return reply.status(201).send(template);
  });
}
