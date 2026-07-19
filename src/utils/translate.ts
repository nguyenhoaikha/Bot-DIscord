import { Localization } from '../core/Localization';
import { ConfigManager } from '../core/ConfigManager';
import { Language } from '../types';

const locale = Localization.getInstance();

export async function t(guildId: string, key: string, ...args: any[]): Promise<string> {
  try {
    const config = await ConfigManager.getInstance().getGuildConfig(guildId);
    return locale.get(key, (config.language || 'en') as Language, ...args);
  } catch {
    return locale.get(key, 'en', ...args);
  }
}

export function tSync(key: string, language: Language = 'en', ...args: any[]): string {
  return locale.get(key, language, ...args);
}
