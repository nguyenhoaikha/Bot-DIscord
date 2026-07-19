import { Language } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

interface LocaleStrings {
  [key: string]: string | LocaleStrings;
}

export class Localization {
  private static instance: Localization;
  private locales: Map<Language, LocaleStrings> = new Map();
  private fallback: Language = 'en';

  private constructor() {}

  static getInstance(): Localization {
    if (!Localization.instance) {
      Localization.instance = new Localization();
    }
    return Localization.instance;
  }

  loadLocale(language: Language, strings: LocaleStrings): void {
    this.locales.set(language, strings);
    logger.info('Localization', `Loaded locale: ${language}`);
  }

  get(key: string, language: Language = 'en', ...args: any[]): string {
    const locale = this.locales.get(language) || this.locales.get(this.fallback);
    if (!locale) return key;

    const value = this.resolveKey(locale, key);
    if (!value) return key;

    let result = value;
    args.forEach((arg, index) => {
      result = result.replace(`{${index}}`, String(arg));
    });

    return result;
  }

  private resolveKey(obj: LocaleStrings, key: string): string | undefined {
    const keys = key.split('.');
    let current: any = obj;
    for (const k of keys) {
      if (current[k] === undefined) return undefined;
      current = current[k];
    }
    return typeof current === 'string' ? current : undefined;
  }
}
