import { Guild, ChannelType } from 'discord.js';
import { ThemeType, Themes, ThemeConfig } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class ThemeManager {
  private static instance: ThemeManager;
  private currentThemes: Map<string, ThemeConfig> = new Map();

  private constructor() {}

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  getTheme(themeName: ThemeType): ThemeConfig {
    return Themes[themeName] || Themes.modern;
  }

  setGuildTheme(guildId: string, theme: ThemeType): void {
    this.currentThemes.set(guildId, this.getTheme(theme));
    logger.info('ThemeManager', `Set theme for guild ${guildId} to ${theme}`);
  }

  getGuildTheme(guildId: string): ThemeConfig {
    return this.currentThemes.get(guildId) || Themes.modern;
  }

  async applyTheme(guild: Guild, theme: ThemeType): Promise<void> {
    const themeConfig = this.getTheme(theme);
    this.setGuildTheme(guild.id, theme);

    try {
      const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
      for (const [, category] of categories) {
        const baseName = category.name.replace(/^╭・/, '');
        await category.setName(`╭・${themeConfig.categoryEmoji} ${baseName}`);
      }
      const textChannels = guild.channels.cache.filter(c => c.isTextBased() && c.parentId);
      for (const [, channel] of textChannels) {
        try {
          const newName = channel.name.replace(/^[^a-zA-Z]+/, '');
          if (newName !== channel.name) {
            await channel.setName(`${themeConfig.channelStyle}${newName}`);
          }
        } catch {}
      }
      logger.info('ThemeManager', `Applied theme ${theme} to guild ${guild.name}`);
    } catch (error) {
      logger.error('ThemeManager', `Failed to apply theme`, error as Error);
    }
  }
}
