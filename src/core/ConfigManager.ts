import { Guild } from 'discord.js';
import { Database } from './Database';
import { GuildSettings, Language, ThemeType } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class ConfigManager {
  private static instance: ConfigManager;
  private cache: Map<string, GuildSettings> = new Map();

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async getGuildConfig(guildId: string): Promise<GuildSettings> {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    const db = Database.getInstance();
    const settings = await db.getGuildSettings(guildId);
    this.cache.set(guildId, settings as any);
    return settings as any;
  }

  async updateGuildConfig(guildId: string, updates: Partial<GuildSettings>): Promise<void> {
    const db = Database.getInstance();
    await db.updateGuildSettings(guildId, updates);

    if (this.cache.has(guildId)) {
      const current = this.cache.get(guildId)!;
      this.cache.set(guildId, { ...current, ...updates });
    }
  }

  async setLanguage(guildId: string, language: Language): Promise<void> {
    await this.updateGuildConfig(guildId, { language } as any);
    logger.info('ConfigManager', `Set language for guild ${guildId} to ${language}`);
  }

  async setTheme(guildId: string, theme: ThemeType): Promise<void> {
    await this.updateGuildConfig(guildId, { theme } as any);
    logger.info('ConfigManager', `Set theme for guild ${guildId} to ${theme}`);
  }

  async toggleModule(guildId: string, moduleName: string, enabled: boolean): Promise<void> {
    const config = await this.getGuildConfig(guildId);
    const modules = config.modules || {};
    modules[moduleName] = enabled;
    await this.updateGuildConfig(guildId, { modules } as any);
    logger.info('ConfigManager', `${enabled ? 'Enabled' : 'Disabled'} module ${moduleName} for guild ${guildId}`);
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }
}
