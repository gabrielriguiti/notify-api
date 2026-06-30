import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@notify/database';

// Estendendo o tipo do Fastify para carregar o tenantId autenticado
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.status(401).send({ error: 'Missing x-api-key header' });
  }

  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey, active: true },
  });

  if (!key) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  // Anexa o tenantId à requisição — disponível nos handlers seguintes
  request.tenantId = key.tenantId;
}
