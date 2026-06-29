import { SendNotificationUseCase, NotificationAlreadyExistsError } from './SendNotificationUseCase';
import type { INotificationRepository } from '../../domain/interfaces/INotificationRepository';
import type { INotificationSender } from '../../domain/interfaces/INotificationSender';
import { Notification } from '../../domain/entities/Notification';

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

function makeSender(success: boolean): INotificationSender {
  return {
    async send(): Promise<{ success: boolean; error?: string }> {
      return { success, error: success ? undefined : 'Provider timeout' };
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
    const useCase = new SendNotificationUseCase(
      makeRepository(),
      new Map([['EMAIL', makeSender(true)]]),
    );

    const result = await useCase.execute(input);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('EMAIL');
    expect(result.alreadyExists).toBe(false);
  });

  it('marca como FAILED quando o sender falha', async () => {
    const useCase = new SendNotificationUseCase(
      makeRepository(),
      new Map([['EMAIL', makeSender(false)]]),
    );

    const result = await useCase.execute(input);
    expect(result.status).toBe('FAILED');
  });

  it('lança NotificationAlreadyExistsError na segunda chamada com a mesma key', async () => {
    const repo = makeRepository();
    const useCase = new SendNotificationUseCase(repo, new Map([['EMAIL', makeSender(true)]]));

    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toThrow(NotificationAlreadyExistsError);
  });

  it('lança erro se não houver sender para o canal', async () => {
    const useCase = new SendNotificationUseCase(
      makeRepository(),
      new Map(), // nenhum sender registrado
    );

    await expect(useCase.execute(input)).rejects.toThrow(
      'Nenhum remetente registrado para o canal: EMAIL',
    );
  });
});
