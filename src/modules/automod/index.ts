import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

interface InfractionRecord {
  userId: string;
  guildId: string;
  count: number;
  lastOffense: number;
}

interface MessageCacheEntry {
  content: string;
  authorId: string;
  channelId: string;
  mentions: number;
  timestamp: number;
}

const SPAM_WINDOW = 10_000;
const SPAM_THRESHOLD = 5;
const MENTION_SPAM_THRESHOLD = 5;
const GHOST_PING_WINDOW = 10_000;
const SCAM_PATTERNS = [
  /steamcommunity\.com\/gift\//i,
  /free\s*steam\s*gift/i,
  /nitro\s*-\s*gift/i,
  /discord\.gift\/\w+/i,
  /free\s*discord\s*nitro/i,
  /claim\s*your\s*prize/i,
  /you.ve\s*won/i,
  /click\s*here\s*to\s*claim/i,
  /gift\s*-\s*steam/i,
  /dlscord/i,
  /discord\.nitro/i,
  /free\s*robux/i,
  /robux\s*generator/i,
  /free\s*\/\s*vbucks/i,
];

export class AutoModModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Smart Auto Moderation',
    description: 'Advanced automatic moderation with spam, mention, invite, scam, and ghost ping detection',
    version: '1.0.0',
    enabled: true,
    commands: ['automod'],
    events: ['messageCreate', 'messageDelete'],
    dependencies: ['Core', 'Moderation']
  };

  private messageCache: Map<string, MessageCacheEntry[]> = new Map();
  private recentMessages: Map<string, string[]> = new Map();
  private infractions: Map<string, InfractionRecord> = new Map();
  private ghostPingCache: Map<string, MessageCacheEntry> = new Map();
  private whitelist: Set<string> = new Set();

  private getInfractionKey(userId: string, guildId: string): string {
    return `${guildId}:${userId}`;
  }

  private async isAutoModEnabled(guildId: string): Promise<boolean> {
    const db = Database.getInstance();
    const settings = await db.getGuildSettings(guildId);
    return settings.autoModEnabled === true;
  }

  private isWhitelisted(userId: string, channelId: string): boolean {
    return this.whitelist.has(userId) || this.whitelist.has(channelId);
  }

  private isModOrAdmin(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.ModerateMembers) || member.permissions.has(PermissionFlagsBits.Administrator);
  }

  private async recordInfraction(userId: string, guildId: string, reason: string, client: Client): Promise<void> {
    const key = this.getInfractionKey(userId, guildId);
    const record = this.infractions.get(key) || { userId, guildId, count: 0, lastOffense: 0 };
    record.count++;
    record.lastOffense = Date.now();
    this.infractions.set(key, record);

    const db = Database.getInstance();
    await db.models.Warning.create({
      userId,
      guildId,
      moderatorId: client.user!.id,
      reason: `[AutoMod] ${reason}`
    });

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (record.count >= 3) {
      await member.kick(`AutoMod: Repeated violations - ${reason}`);
      this.logger.info(this.manifest.name, `Kicked ${userId} in ${guildId}: ${reason}`);
    } else if (record.count >= 2) {
      const mutedRole = guild.roles.cache.find(r => r.name.includes('Muted'));
      if (mutedRole) {
        await member.roles.add(mutedRole).catch(() => {});
        this.logger.info(this.manifest.name, `Muted ${userId} in ${guildId}: ${reason}`);
      }
    }
  }

  private detectSpam(message: Message): boolean {
    if (!message.author || !message.guild) return false;
    const guildId = message.guild.id;
    const authorId = message.author.id;
    const key = `${guildId}:${authorId}`;

    const now = Date.now();
    const timestamps = this.messageCache.get(key) || [];
    const recent = timestamps.filter(t => now - t.timestamp < SPAM_WINDOW);
    recent.push({ content: message.content, authorId, channelId: message.channel.id, mentions: message.mentions.users.size, timestamp: now });
    this.messageCache.set(key, recent);

    if (recent.length >= SPAM_THRESHOLD) {
      const contents = recent.map(r => r.content);
      const duplicateCount = contents.filter(c => c === message.content).length;
      return duplicateCount >= SPAM_THRESHOLD;
    }
    return false;
  }

  private detectMentionSpam(message: Message): boolean {
    if (!message.guild) return false;
    const totalMentions = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    return totalMentions > MENTION_SPAM_THRESHOLD;
  }

  private detectInviteLink(message: Message): boolean {
    if (!message.guild) return false;
    const invitePattern = /(?:discord\.(?:gg|com\/invite|app\.com\/invite|io|me|li|gift)|disboard\.org)\/\S+/i;
    return invitePattern.test(message.content);
  }

  private detectScamLink(message: Message): boolean {
    if (!message.guild) return false;
    return SCAM_PATTERNS.some(pattern => pattern.test(message.content));
  }

  private trackGhostPing(message: Message): void {
    if (!message.guild || !message.author) return;
    const mentions = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    if (mentions > 0) {
      const key = `${message.guild.id}:${message.channel.id}:${message.id}`;
      this.ghostPingCache.set(key, {
        content: message.content,
        authorId: message.author.id,
        channelId: message.channel.id,
        mentions,
        timestamp: Date.now()
      });
      setTimeout(() => this.ghostPingCache.delete(key), GHOST_PING_WINDOW);
    }
  }

  private async handleMessageCreate(message: Message, client: Client): Promise<void> {
    if (message.author?.bot || !message.guild) return;

    const enabled = await this.isAutoModEnabled(message.guild.id);
    if (!enabled) return;

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member || this.isModOrAdmin(member)) return;
    if (this.isWhitelisted(message.author.id, message.channel.id)) return;

    if (this.detectSpam(message)) {
      await message.delete().catch(() => {});
      await this.recordInfraction(message.author.id, message.guild.id, 'Spam detection', client);
      const embed = new EmbedBuilder()
        .setTitle('AutoMod: Phát hiện Spam')
        .setDescription(`<@${message.author.id}> sent the same message more than ${SPAM_THRESHOLD} times in ${SPAM_WINDOW / 1000}s`)
        .setColor(EMBED_COLORS.error)
        .setTimestamp();
      const logChannel = await this.getLogChannel(message.guild.id);
      if (logChannel) await logChannel.send({ embeds: [embed] });
      return;
    }

    if (this.detectMentionSpam(message)) {
      await message.delete().catch(() => {});
      await this.recordInfraction(message.author.id, message.guild.id, 'Mention spam', client);
      const embed = new EmbedBuilder()
        .setTitle('AutoMod: Phát hiện Spam đề cập')
        .setDescription(`<@${message.author.id}> sent a message with over ${MENTION_SPAM_THRESHOLD} mentions`)
        .setColor(EMBED_COLORS.warning)
        .setTimestamp();
      const logChannel = await this.getLogChannel(message.guild.id);
      if (logChannel) await logChannel.send({ embeds: [embed] });
      return;
    }

    if (this.detectInviteLink(message)) {
      await message.delete().catch(() => {});
      await this.recordInfraction(message.author.id, message.guild.id, 'Invite link', client);
      const embed = new EmbedBuilder()
        .setTitle('AutoMod: Phát hiện Link mời')
        .setDescription(`<@${message.author.id}> posted a Discord invite link`)
        .setColor(EMBED_COLORS.warning)
        .setTimestamp();
      const logChannel = await this.getLogChannel(message.guild.id);
      if (logChannel) await logChannel.send({ embeds: [embed] });
      return;
    }

    if (this.detectScamLink(message)) {
      await message.delete().catch(() => {});
      await this.recordInfraction(message.author.id, message.guild.id, 'Scam link', client);
      const embed = new EmbedBuilder()
        .setTitle('AutoMod: Phát hiện Link lừa đảo')
        .setDescription(`<@${message.author.id}> posted a suspected scam link`)
        .setColor(EMBED_COLORS.error)
        .setTimestamp();
      const logChannel = await this.getLogChannel(message.guild.id);
      if (logChannel) await logChannel.send({ embeds: [embed] });
      return;
    }

    this.trackGhostPing(message);
  }

  private async handleMessageDelete(message: Message, client: Client): Promise<void> {
    if (!message.guild || message.author?.bot) return;

    const enabled = await this.isAutoModEnabled(message.guild.id);
    if (!enabled) return;

    const key = `${message.guild.id}:${message.channel.id}:${message.id}`;
    const cached = this.ghostPingCache.get(key);
    if (!cached) return;

    const now = Date.now();
    if (now - cached.timestamp > GHOST_PING_WINDOW) {
      this.ghostPingCache.delete(key);
      return;
    }

    const member = await message.guild.members.fetch(cached.authorId).catch(() => null);
    if (!member || this.isModOrAdmin(member)) return;

    this.ghostPingCache.delete(key);
    const embed = new EmbedBuilder()
        .setTitle('AutoMod: Phát hiện Ghost Ping')
      .setDescription(`<@${cached.authorId}> deleted a message that mentioned ${cached.mentions} user(s)`)
      .addFields(
        { name: 'Channel', value: `<#${cached.channelId}>`, inline: true },
        { name: 'Content', value: cached.content.slice(0, 1024) || '*(no content)*' }
      )
      .setColor(EMBED_COLORS.warning)
      .setTimestamp();

    const logChannel = await this.getLogChannel(message.guild.id);
    if (logChannel) await logChannel.send({ embeds: [embed] });
    await this.recordInfraction(cached.authorId, message.guild.id, 'Ghost ping', client);
  }

  private async getLogChannel(guildId: string) {
    const db = Database.getInstance();
    const settings = await db.getGuildSettings(guildId);
    if (!settings.logChannel) return null;
    const guild = await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const channel = guild.channels.cache.get(settings.logChannel);
    return channel?.isTextBased() ? channel : null;
  }

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Quản lý cài đặt AutoMod')
        .addSubcommand(sub => sub.setName('status').setDescription('Kiểm tra trạng thái AutoMod'))
        .addSubcommand(sub => sub.setName('toggle').setDescription('Bật hoặc tắt AutoMod').addBooleanOption(opt => opt.setName('enabled').setDescription('Bật hoặc tắt').setRequired(true)))
        .addSubcommand(sub => sub.setName('whitelist').setDescription('Thêm hoặc xóa mục whitelist').addStringOption(opt => opt.setName('action').setDescription('Thêm hoặc xóa').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })).addStringOption(opt => opt.setName('id').setDescription('ID Người dùng hoặc ID Kênh').setRequired(true))),
      execute: async (interaction) => {
        if (!interaction.guild) {
          await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
          return;
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: '❌ Bạn cần quyền Quản trị viên.', ephemeral: true });
          return;
        }
        await this.handleAutoModCommand(interaction);
      }
    });

    pawClient.events.register({
      name: 'messageCreate',
      execute: async (message: Message) => {
        await this.handleMessageCreate(message, client);
      }
    });

    pawClient.events.register({
      name: 'messageDelete',
      execute: async (message: Message) => {
        await this.handleMessageDelete(message, client);
      }
    });
  }

  private async handleAutoModCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const db = Database.getInstance();
    const guildId = interaction.guild!.id;

    switch (subcommand) {
      case 'status': {
        const settings = await db.getGuildSettings(guildId);
        const embed = new EmbedBuilder()
          .setTitle('Trạng thái AutoMod')
          .setDescription(`AutoMod is currently **${settings.autoModEnabled ? 'Enabled' : 'Disabled'}**`)
          .addFields(
            { name: 'Whitelisted Entries', value: this.whitelist.size > 0 ? [...this.whitelist].join('\n') : 'None', inline: true },
            { name: 'Active Infractions', value: String([...this.infractions.values()].filter(i => i.guildId === guildId).length), inline: true }
          )
          .setColor(settings.autoModEnabled ? EMBED_COLORS.success : EMBED_COLORS.error)
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'toggle': {
        const enabled = interaction.options.getBoolean('enabled', true);
        await db.updateGuildSettings(guildId, { autoModEnabled: enabled });
        const embed = new EmbedBuilder()
          .setTitle('Đã chuyển đổi AutoMod')
          .setDescription(`AutoMod has been **${enabled ? 'Enabled' : 'Disabled'}**`)
          .setColor(enabled ? EMBED_COLORS.success : EMBED_COLORS.error)
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'whitelist': {
        const action = interaction.options.getString('action', true);
        const id = interaction.options.getString('id', true);
        if (action === 'add') {
          this.whitelist.add(id);
          await interaction.reply({ content: `✅ Added \`${id}\` to AutoMod whitelist.`, ephemeral: true });
        } else {
          this.whitelist.delete(id);
          await interaction.reply({ content: `✅ Removed \`${id}\` from AutoMod whitelist.`, ephemeral: true });
        }
        break;
      }
    }
  }
}
