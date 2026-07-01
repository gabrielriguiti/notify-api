import { SendNotificationUseCase, NotificationAlreadyExistsError } from './SendNotificationUseCase';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository';
import { Notification } from '../../domain/entities/Notification';
import { ITemplateRepository } from '../../domain/interfaces/ITemplateRepository';

// Fakes em memória — sem banco, sem rede
function makeRepository(existing?: Notification): INotificationRepository {
  const store = new Map<string, Notification>();
  if (existing) store.set(existing.idempotencyKey, existing);

  return {
    async save(n): Promise<void> {
      store.set(n.idempotencyKey, n);
    },
    async findByIdempotencyKey(key): Promise<Notification | null> {
      return store.get(key) ?? null;
    },
    async findById(id): Promise<Notification | null> {
      for (const n of store.values()) if (n.id === id) return n;
      return null;
    },
    async updateStatus(n): Promise<void> {
      store.set(n.idempotencyKey, n);
    },
  };
}

function makeTemplateRepository(): ITemplateRepository {
  return {
    async findByName() {
      return null;
    },
    async save(t) {
      return { id: 'tpl-1', ...t };
    },
  };
}

describe('SendNotificationUseCase', () => {
  const input = {
    tenantId: 'tenant-1',
    channel: 'EMAIL' as const,
    recipient: 'user@example.com',
    subject: 'Welcome',
    body: 'Hello!',
    idempotencyKey: 'unique-key-1',
  };

  it('envia com sucesso e retorna status DELIVERED', async () => {
    const useCase = new SendNotificationUseCase(makeRepository(), makeTemplateRepository());

    const result = await useCase.execute(input);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('EMAIL');
  });

  it('marca como FAILED quando o sender falha', async () => {
    const useCase = new SendNotificationUseCase(makeRepository(), makeTemplateRepository());

    const result = await useCase.execute(input);
    expect(result.status).toBe('FAILED');
  });

  it('lança NotificationAlreadyExistsError na segunda chamada com a mesma key', async () => {
    const useCase = new SendNotificationUseCase(makeRepository(), makeTemplateRepository());

    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toThrow(NotificationAlreadyExistsError);
  });

  it('lança erro se não houver sender para o canal', async () => {
    const useCase = new SendNotificationUseCase(makeRepository(), makeTemplateRepository());
    await expect(useCase.execute(input)).rejects.toThrow(
      'Nenhum remetente registrado para o canal: EMAIL',
    );
  });
});
