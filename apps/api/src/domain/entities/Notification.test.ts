import { Notification } from './Notification';

describe('Notification entity', () => {
  const validProps = {
    tenantId: 'tenant-1',
    channel: 'EMAIL' as const,
    recipient: 'user@example.com',
    subject: 'Welcome',
    body: 'Hello!',
    idempotencyKey: 'key-123',
  };

  describe('create()', () => {
    it('cria uma notificação com status PENDING', () => {
      const n = Notification.create(validProps);
      expect(n.status).toBe('PENDING');
      expect(n.id).toBeDefined();
      expect(n.createdAt).toBeInstanceOf(Date);
    });

    it('lança erro se recipient estiver vazio', () => {
      expect(() => Notification.create({ ...validProps, recipient: '' })).toThrow(
        'O destinatário é obrigatório',
      );
    });

    it('lança erro se body estiver vazio', () => {
      expect(() => Notification.create({ ...validProps, body: '' })).toThrow(
        'O corpo da mensagem é obrigatório',
      );
    });

    it('lança erro se EMAIL não tiver subject', () => {
      expect(() => Notification.create({ ...validProps, subject: undefined })).toThrow(
        'O assunto é obrigatório para notificações por e-mail',
      );
    });

    it('aceita SMS sem subject', () => {
      expect(() =>
        Notification.create({ ...validProps, channel: 'SMS', subject: undefined }),
      ).not.toThrow();
    });
  });

  describe('transições de status', () => {
    it('PENDING → QUEUED → DELIVERED é o caminho feliz', () => {
      const n = Notification.create(validProps);
      n.markAsQueued();
      expect(n.status).toBe('QUEUED');
      n.markAsDelivered();
      expect(n.status).toBe('DELIVERED');
    });

    it('não pode enfileirar uma notificação que não está PENDING', () => {
      const n = Notification.create(validProps);
      n.markAsQueued();
      expect(() => n.markAsQueued()).toThrow(
        'Não é possível enfileirar uma notificação com status "QUEUED"',
      );
    });

    it('não pode cancelar uma notificação já entregue', () => {
      const n = Notification.create(validProps);
      n.markAsQueued();
      n.markAsDelivered();
      expect(() => n.cancel()).toThrow('Não é possível cancelar uma notificação já entregue');
    });
  });
});
