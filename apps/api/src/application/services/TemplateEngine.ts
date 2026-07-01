import Handlebars from 'handlebars';

export interface TemplateContext {
  [key: string]: string | number | boolean | undefined;
}

export class TemplateEngine {
  compile(template: string, context: TemplateContext): string {
    try {
      const compiled = Handlebars.compile(template, { noEscape: true });
      return compiled(context);
    } catch (error) {
      throw new Error(
        `Template compilation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  validate(template: string): boolean {
    try {
      Handlebars.precompile(template);
      return true;
    } catch {
      return false;
    }
  }
}
