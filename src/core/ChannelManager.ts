import { Guild, ChannelType, CategoryChannel, TextChannel, VoiceChannel, OverwriteResolvable } from 'discord.js';
import { DefaultChannels, ChannelPerm } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class ChannelManager {
  private static instance: ChannelManager;

  private constructor() {}

  static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager();
    }
    return ChannelManager.instance;
  }

  private resolvePerms(guild: Guild, perms?: ChannelPerm[]): OverwriteResolvable[] {
    if (!perms) return [];
    return perms.map(p => ({
      id: p.id === '@everyone' ? guild.roles.everyone.id : p.id,
      allow: p.allow || 0n,
      deny: p.deny || 0n
    }));
  }

  async createDefaultChannels(guild: Guild, roleMap: Map<string, string>): Promise<Map<string, string>> {
    const channelMap = new Map<string, string>();
    for (const section of DefaultChannels) {
      try {
        const category = await guild.channels.create({
          name: `╭・${section.category}`,
          type: ChannelType.GuildCategory,
          permissionOverwrites: this.resolvePerms(guild, section.categoryPerms),
          reason: 'Server Setup'
        });
        channelMap.set(section.category, category.id);

        for (const channelDef of section.channels) {
          try {
            if (channelDef.type === ChannelType.GuildText) {
              const channel = await guild.channels.create({
                name: channelDef.name,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: channelDef.topic || '',
                permissionOverwrites: this.resolvePerms(guild, channelDef.perms),
                reason: 'Server Setup'
              });
              channelMap.set(channelDef.name, channel.id);
              const plainName = channelDef.name.replace(/^[^a-zA-Z]+/, '');
              if (plainName !== channelDef.name) channelMap.set(plainName, channel.id);
            } else if (channelDef.type === ChannelType.GuildVoice) {
              const channel = await guild.channels.create({
                name: channelDef.name,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: this.resolvePerms(guild, channelDef.perms),
                reason: 'Server Setup'
              });
              channelMap.set(channelDef.name, channel.id);
              const plainName = channelDef.name.replace(/^[^a-zA-Z]+/, '');
              if (plainName !== channelDef.name) channelMap.set(plainName, channel.id);
            }
          } catch (error) {
            logger.error('ChannelManager', `Failed to create channel ${channelDef.name}`, error as Error);
          }
        }
      } catch (error) {
        logger.error('ChannelManager', `Failed to create category ${section.category}`, error as Error);
      }
    }

    return channelMap;
  }

  async createCategory(guild: Guild, name: string, permissionOverwrites?: OverwriteResolvable[]): Promise<string | null> {
    try {
      const category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        permissionOverwrites,
        reason: 'Channel Management'
      });
      return category.id;
    } catch (error) {
      logger.error('ChannelManager', `Failed to create category ${name}`, error as Error);
      return null;
    }
  }

  async createTextChannel(guild: Guild, name: string, parent?: string, topic?: string): Promise<string | null> {
    try {
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parent || undefined,
        topic: topic || '',
        reason: 'Channel Management'
      });
      return channel.id;
    } catch (error) {
      logger.error('ChannelManager', `Failed to create channel ${name}`, error as Error);
      return null;
    }
  }

  async createVoiceChannel(guild: Guild, name: string, parent?: string): Promise<string | null> {
    try {
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: parent || undefined,
        reason: 'Channel Management'
      });
      return channel.id;
    } catch (error) {
      logger.error('ChannelManager', `Failed to create voice channel ${name}`, error as Error);
      return null;
    }
  }
}