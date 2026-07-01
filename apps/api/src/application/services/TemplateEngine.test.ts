import { TemplateEngine } from './TemplateEngine';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  it('substitui variáveis simples', () => {
    const result = engine.compile('Olá, {{name}}! Seu pedido #{{orderId}} foi confirmado.', {
      name: 'Gabriel',
      orderId: 42,
    });
    expect(result).toBe('Olá, Gabriel! Seu pedido #42 foi confirmado.');
  });

  it('ignora variáveis ausentes sem quebrar', () => {
    const result = engine.compile('Olá, {{name}}!', {});
    expect(result).toBe('Olá, !');
  });

  it('suporta condicionais com {{#if}}', () => {
    const result = engine.compile(
      '{{#if premium}}Bem-vindo, assinante premium!{{else}}Bem-vindo!{{/if}}',
      { premium: true },
    );
    expect(result).toBe('Bem-vindo, assinante premium!');
  });

  it('valida template sintáticamente correto', () => {
    expect(engine.validate('Olá, {{name}}!')).toBe(true);
  });

  it('invalida template com sintaxe errada', () => {
    expect(engine.validate('{{#if}}')).toBe(false);
  });

  it('lança erro descritivo quando template é inválido', () => {
    expect(() => engine.compile('{{#each}}quebrado', {})).toThrow('Template compilation failed');
  });
});
