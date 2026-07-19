import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

const XP_MIN = 25;
const XP_MAX = 35;
const COOLDOWN_MS = 60_000;
const XP_LEVEL_FACTOR = 100;

export class LevelsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Hệ thống cấp độ',
    description: 'Hệ thống cấp độ với theo dõi XP, thẻ xếp hạng và bảng xếp hạng',
    version: '1.0.0',
    enabled: true,
    commands: ['level', 'leaderboard', 'setlevel', 'setxp'],
    events: ['messageCreate'],
    dependencies: ['Core']
  };

  private cooldowns: Map<string, Map<string, number>> = new Map();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Xem thứ hạng và XP của bạn')
        .addUserOption(opt => opt.setName('user').setDescription('Người dùng cần kiểm tra').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.showLevel(interaction);
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Xem bảng xếp hạng máy chủ')
        .addIntegerOption(opt => opt.setName('page').setDescription('Số trang').setRequired(false).setMinValue(1)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.showLeaderboard(interaction);
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setlevel')
        .setDescription('Đặt cấp độ người dùng (Chỉ Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('user').setDescription('Người dùng').setRequired(true))
        .addIntegerOption(opt => opt.setName('level').setDescription('Cấp độ mới').setRequired(true).setMinValue(0)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.setLevel(interaction);
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setxp')
        .setDescription('Đặt XP người dùng (Chỉ Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('user').setDescription('Người dùng').setRequired(true))
        .addIntegerOption(opt => opt.setName('xp').setDescription('Số XP mới').setRequired(true).setMinValue(0)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.setXp(interaction);
      }
    });

    pawClient.events.register({
      name: 'messageCreate',
      execute: async (message: Message) => {
        await this.handleMessage(message);
      }
    });
  }

  private getCooldownKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  private isOnCooldown(guildId: string, userId: string): boolean {
    const guildCooldowns = this.cooldowns.get(guildId);
    if (!guildCooldowns) return false;
    const lastMessage = guildCooldowns.get(userId);
    if (!lastMessage) return false;
    return Date.now() - lastMessage < COOLDOWN_MS;
  }

  private setCooldown(guildId: string, userId: string): void {
    if (!this.cooldowns.has(guildId)) {
      this.cooldowns.set(guildId, new Map());
    }
    this.cooldowns.get(guildId)!.set(userId, Date.now());
  }

  private calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / XP_LEVEL_FACTOR));
  }

  private calculateXpForLevel(level: number): number {
    return level * level * XP_LEVEL_FACTOR;
  }

  private createProgressBar(current: number, max: number, length: number = 10): string {
    if (max <= 0) return '░'.repeat(length);
    const filled = Math.min(Math.floor((current / max) * length), length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const { guild, author } = message;

    if (this.isOnCooldown(guild.id, author.id)) return;
    this.setCooldown(guild.id, author.id);

    try {
      const db = Database.getInstance();
      const xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

      const [record] = await db.models.Level.findOrCreate({
        where: { userId: author.id, guildId: guild.id },
        defaults: { userId: author.id, guildId: guild.id, xp: 0, level: 0, weeklyXp: 0, monthlyXp: 0, voiceMinutes: 0 }
      });

      const newXp = record.get('xp') as number + xpGain;
      const newLevel = this.calculateLevel(newXp);
      const oldLevel = record.get('level') as number;

      await db.models.Level.update(
        { xp: newXp, level: newLevel },
        { where: { userId: author.id, guildId: guild.id } }
      );

      if (newLevel > oldLevel) {
        this.logger.info(this.manifest.name, `${author.tag} leveled up to ${newLevel} in ${guild.name}`);
      }
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to award XP', error as Error);
    }
  }

  private async getUserRecord(guildId: string, userId: string): Promise<any> {
    const db = Database.getInstance();
    const [record] = await db.models.Level.findOrCreate({
      where: { userId, guildId },
      defaults: { userId, guildId, xp: 0, level: 0, weeklyXp: 0, monthlyXp: 0, voiceMinutes: 0 }
    });
    return record;
  }

  private async showLevel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Không thể tìm thấy thành viên đó.', ephemeral: true });
      return;
    }

    try {
      const record = await this.getUserRecord(interaction.guild.id, targetUser.id);
      const xp = record.get('xp') as number;
      const level = record.get('level') as number;
      const currentLevelXp = this.calculateXpForLevel(level);
      const nextLevelXp = this.calculateXpForLevel(level + 1);
      const xpInLevel = xp - currentLevelXp;
      const xpNeeded = nextLevelXp - currentLevelXp;
      const progressBar = this.createProgressBar(xpInLevel, xpNeeded);

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.primary)
        .setAuthor({
          name: member.user.username,
          iconURL: member.user.displayAvatarURL({ size: 128 })
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription(`**Cấp ${level}**`)
        .addFields(
          { name: 'XP', value: `${xp.toLocaleString()} / ${nextLevelXp.toLocaleString()}`, inline: false },
          { name: 'Tiến trình', value: `\`${progressBar}\` ${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, inline: false }
        )
        .setFooter({ text: 'Hệ thống cấp độ' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show level', error as Error);
      await interaction.reply({ content: 'Đã xảy ra lỗi khi lấy dữ liệu cấp độ.', ephemeral: true });
    }
  }

  private async showLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    try {
      const db = Database.getInstance();
      const { count, rows } = await db.models.Level.findAndCountAll({
        where: { guildId: interaction.guild.id },
        order: [['level', 'DESC'], ['xp', 'DESC']],
        limit: pageSize,
        offset
      });

      if (rows.length === 0) {
        await interaction.reply({ content: 'Không có dữ liệu bảng xếp hạng.', ephemeral: true });
        return;
      }

      const totalPages = Math.ceil(count / pageSize);
      const descriptionLines: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rank = offset + i + 1;
        const userId = row.get('userId') as string;
        const level = row.get('level') as number;
        const xp = row.get('xp') as number;
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const username = member?.user.username || 'Unknown User';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        descriptionLines.push(`${medal} **${username}** — Cấp ${level} (${xp.toLocaleString()} XP)`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Bảng xếp hạng máy chủ')
        .setDescription(descriptionLines.join('\n'))
        .setColor(EMBED_COLORS.primary)
        .setFooter({ text: `Trang ${page}/${totalPages} — Hệ thống cấp độ` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show leaderboard', error as Error);
      await interaction.reply({ content: 'Đã xảy ra lỗi khi lấy bảng xếp hạng.', ephemeral: true });
    }
  }

  private async setLevel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const newLevel = interaction.options.getInteger('level', true);

    try {
      const db = Database.getInstance();
      const [record] = await db.models.Level.findOrCreate({
        where: { userId: targetUser.id, guildId: interaction.guild.id },
        defaults: { userId: targetUser.id, guildId: interaction.guild.id, xp: 0, level: 0, weeklyXp: 0, monthlyXp: 0, voiceMinutes: 0 }
      });

      const currentXp = record.get('xp') as number;
      const newXp = newLevel * newLevel * XP_LEVEL_FACTOR;

      await db.models.Level.update(
        { level: newLevel, xp: newXp >= currentXp ? newXp : currentXp },
        { where: { userId: targetUser.id, guildId: interaction.guild.id } }
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Đã cập nhật cấp độ')
        .setDescription(`**${targetUser.username}** hiện đang ở cấp **${newLevel}**`)
        .setColor(EMBED_COLORS.success)
        .setFooter({ text: 'Hệ thống cấp độ' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to set level', error as Error);
      await interaction.reply({ content: 'Đã xảy ra lỗi khi đặt cấp độ.', ephemeral: true });
    }
  }

  private async setXp(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const newXp = interaction.options.getInteger('xp', true);

    try {
      const db = Database.getInstance();
      const [record] = await db.models.Level.findOrCreate({
        where: { userId: targetUser.id, guildId: interaction.guild.id },
        defaults: { userId: targetUser.id, guildId: interaction.guild.id, xp: 0, level: 0, weeklyXp: 0, monthlyXp: 0, voiceMinutes: 0 }
      });

      const recalculatedLevel = this.calculateLevel(newXp);
      const currentXp = record.get('xp') as number;

      await db.models.Level.update(
        { xp: newXp, level: recalculatedLevel },
        { where: { userId: targetUser.id, guildId: interaction.guild.id } }
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Đã cập nhật XP')
        .setDescription(`**${targetUser.username}** hiện có **${newXp.toLocaleString()}** XP (Cấp ${recalculatedLevel})`)
        .setColor(EMBED_COLORS.success)
        .setFooter({ text: 'Hệ thống cấp độ' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to set XP', error as Error);
      await interaction.reply({ content: 'Đã xảy ra lỗi khi đặt XP.', ephemeral: true });
    }
  }
}
