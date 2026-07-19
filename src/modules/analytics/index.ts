import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PresenceStatus } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

export class AnalyticsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Analytics',
    description: 'Server analytics with member counts, online stats, and growth tracking',
    version: '1.0.0',
    enabled: true,
    commands: ['analytics', 'membercount', 'growth'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('analytics')
        .setDescription('Xem phân tích và thống kê máy chủ')
        .addStringOption(opt => opt.setName('type').setDescription('Loại phân tích').addChoices({ name: 'Server', value: 'server' }, { name: 'Activity', value: 'activity' }).setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showAnalytics(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Xem chi tiết số lượng thành viên'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showMemberCount(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('growth')
        .setDescription('Xem tăng trưởng máy chủ theo thời gian'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showGrowth(interaction); }
    });
  }

  private async showAnalytics(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guild = await interaction.guild.fetch();
      const members = await guild.members.fetch();
      const channels = guild.channels.cache;

      const totalMembers = members.size;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;
      const online = members.filter(m => m.presence?.status === 'online').size;
      const idle = members.filter(m => m.presence?.status === 'idle').size;
      const dnd = members.filter(m => m.presence?.status === 'dnd').size;
      const offline = members.filter(m => !m.presence || m.presence.status === 'offline').size;

      const textChannels = channels.filter(c => c.isTextBased()).size;
      const voiceChannels = channels.filter(c => c.isVoiceBased()).size;
      const categories = channels.filter(c => c.type === 4).size;

      const boosts = guild.premiumSubscriptionCount || 0;
      const boostLevel = guild.premiumTier;

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name} — Server Analytics`)
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .setColor(EMBED_COLORS.primary)
        .addFields(
          { name: '👥 Members', value: `Total: **${totalMembers}**\nHumans: ${humans}\nBots: ${bots}`, inline: true },
          { name: '🟢 Online Status', value: `Online: ${online}\nIdle: ${idle}\nDND: ${dnd}\nOffline: ${offline}`, inline: true },
          { name: '💬 Channels', value: `Text: ${textChannels}\nVoice: ${voiceChannels}\nCategories: ${categories}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '🚀 Boosts', value: `Level ${boostLevel} (${boosts} boosts)`, inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: guild.id })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show analytics', error as Error);
      await interaction.editReply({ content: 'Không thể tải phân tích máy chủ.' });
    }
  }

  private async showMemberCount(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    try {
      const members = await interaction.guild.members.fetch();
      const total = members.size;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;

      const embed = new EmbedBuilder()
        .setTitle('👥 Số lượng thành viên')
        .setColor(EMBED_COLORS.info)
        .addFields(
          { name: 'Total Members', value: `${total}`, inline: true },
          { name: 'Humans', value: `${humans}`, inline: true },
          { name: 'Bots', value: `${bots}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show member count', error as Error);
      await interaction.reply({ content: 'Không thể tải số lượng thành viên.', ephemeral: true });
    }
  }

  private async showGrowth(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    try {
      const db = Database.getInstance();
      const modelName = `Analytics_${interaction.guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        const { DataTypes } = require('sequelize');
        db.models[modelName] = db.sequelize.define(modelName, {
          id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
          guildId: DataTypes.STRING,
          date: DataTypes.DATEONLY,
          memberCount: DataTypes.INTEGER,
          onlineCount: DataTypes.INTEGER
        });
        await db.models[modelName].sync();
      }

      const members = await interaction.guild.members.fetch();
      const memberCount = members.size;
      const onlineCount = members.filter(m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;

      await db.models[modelName].create({
        guildId: interaction.guild.id,
        date: new Date().toISOString().split('T')[0],
        memberCount,
        onlineCount
      });

      const snapshots = await db.models[modelName].findAll({
        where: { guildId: interaction.guild.id },
        order: [['date', 'DESC']],
        limit: 30
      });

      if (snapshots.length <= 1) {
        const embed = new EmbedBuilder()
          .setTitle('📈 Tăng trưởng máy chủ')
          .setDescription(`Current members: **${memberCount}**\nCome back tomorrow to see growth trends!`)
          .setColor(EMBED_COLORS.info)
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const first = snapshots[snapshots.length - 1];
      const last = snapshots[0];
      const firstCount = first.get('memberCount') as number;
      const lastCount = last.get('memberCount') as number;
      const change = lastCount - firstCount;
      const changeSign = change >= 0 ? '+' : '';

      const embed = new EmbedBuilder()
        .setTitle('📈 Tăng trưởng máy chủ (30 ngày qua)')
        .setColor(EMBED_COLORS.primary)
        .addFields(
          { name: 'Current Members', value: `${memberCount}`, inline: true },
          { name: '30 Days Ago', value: `${firstCount}`, inline: true },
          { name: 'Change', value: `${changeSign}${change}`, inline: true },
          { name: 'Snapshots', value: `${snapshots.length} days recorded`, inline: true }
        );

      const barCount = Math.min(snapshots.length, 14);
      const recentSnapshots = snapshots.slice(0, barCount).reverse();
      const maxCount = Math.max(...recentSnapshots.map((s: any) => s.get('memberCount') as number));
      const barStr = recentSnapshots.map((s: any) => {
        const count = s.get('memberCount') as number;
        const barLen = Math.max(1, Math.round((count / maxCount) * 10));
        return `\`${'█'.repeat(barLen)}${'░'.repeat(10 - barLen)}\` ${count}`;
      }).join('\n');

      embed.setDescription(`\`\`\`Member Count Trend:\`\`\`\n${barStr}`);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show growth', error as Error);
      await interaction.reply({ content: 'Không thể tải dữ liệu tăng trưởng.', ephemeral: true });
    }
  }
}
