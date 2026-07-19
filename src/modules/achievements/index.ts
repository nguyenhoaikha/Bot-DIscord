import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest, Achievement as AchievementType } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';
import { EventHandler, BotEvent } from '../../core/EventHandler';

const ACHIEVEMENT_DEFINITIONS: AchievementType[] = [
  { id: 'first_message', name: 'First Message', description: 'Gửi tin nhắn đầu tiên', icon: '💬', criteria: { type: 'messages', value: 1 } },
  { id: '100_messages', name: 'Chatter', description: 'Gửi 100 tin nhắn', icon: '🗣️', criteria: { type: 'messages', value: 100 } },
  { id: '1000_messages', name: 'Chat Master', description: 'Gửi 1,000 tin nhắn', icon: '👑', criteria: { type: 'messages', value: 1000 } },
  { id: 'first_voice', name: 'Voice Explorer', description: 'Tham gia kênh voice lần đầu', icon: '🎙️', criteria: { type: 'voice_join', value: 1 } },
  { id: 'booster', name: 'Server Booster', description: 'Boost server', icon: '🚀', criteria: { type: 'boost', value: 1 } },
  { id: 'early_member', name: 'Early Member', description: 'Tham gia trong tuần đầu tiên', icon: '🌟', criteria: { type: 'join_order', value: 100 } },
  { id: 'bug_hunter', name: 'Bug Hunter', description: 'Báo cáo lỗi', icon: '🐛', criteria: { type: 'bug_report', value: 1 } },
  { id: 'active_30_days', name: 'Dedicated', description: 'Hoạt động 30 ngày', icon: '🔥', criteria: { type: 'active_days', value: 30 } },
];

export class AchievementsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Achievements',
    description: 'Achievement tracking system with unlockable achievements',
    version: '1.0.0',
    enabled: true,
    commands: ['achievements'],
    events: ['messageCreate', 'voiceStateUpdate', 'guildMemberUpdate'],
    dependencies: ['Core']
  };

  private messageCounts: Map<string, Map<string, number>> = new Map();
  private voiceJoins: Set<string> = new Set();
  private activeDays: Map<string, Set<string>> = new Map();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('Xem thành tích')
        .addSubcommand(sub => sub
          .setName('list')
          .setDescription('Danh sách tất cả thành tích'))
        .addSubcommand(sub => sub
          .setName('view')
          .setDescription('Xem thành tích đã mở khóa')
          .addUserOption(opt => opt.setName('user').setDescription('Người dùng cần kiểm tra').setRequired(false))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'list') await this.listAchievements(interaction);
        else if (sub === 'view') await this.viewAchievements(interaction);
      }
    });

    const eventHandler = EventHandler.getInstance();

    eventHandler.register({
      name: 'messageCreate',
      execute: async (message: any) => {
        if (message.author?.bot || !message.guild) return;
        const key = `${message.guild.id}_${message.author.id}`;
        if (!this.messageCounts.has(key)) this.messageCounts.set(key, new Map());
        const counts = this.messageCounts.get(key)!;
        const today = new Date().toISOString().slice(0, 10);
        counts.set(today, (counts.get(today) || 0) + 1);

        const db = Database.getInstance();
        const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

        for (const def of ACHIEVEMENT_DEFINITIONS) {
          if (def.criteria.type !== 'messages') continue;
          if (total < (def.criteria.value as number)) continue;
          await this.unlockAchievement(db, message.guild.id, message.author.id, def.id);
        }
      }
    } as BotEvent);

    eventHandler.register({
      name: 'voiceStateUpdate',
      execute: async (oldState: any, newState: any) => {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot || !newState.guild) return;
        const key = `${newState.guild.id}_${member.id}`;

        if (newState.channelId && !oldState.channelId) {
          if (this.voiceJoins.has(key)) return;
          this.voiceJoins.add(key);

          const db = Database.getInstance();
          await this.unlockAchievement(db, newState.guild.id, member.id, 'first_voice');
        }
      }
    } as BotEvent);

    eventHandler.register({
      name: 'guildMemberUpdate',
      execute: async (oldMember: any, newMember: any) => {
        if (newMember.user.bot || !newMember.guild) return;

        if (!oldMember.premiumSince && newMember.premiumSince) {
          const db = Database.getInstance();
          await this.unlockAchievement(db, newMember.guild.id, newMember.id, 'booster');
        }
      }
    } as BotEvent);
  }

  private async unlockAchievement(db: Database, guildId: string, userId: string, achievementId: string): Promise<void> {
    try {
      const existing = await db.models.Achievement.findOne({
        where: { userId, guildId, achievementId }
      });
      if (existing) return;

      await db.models.Achievement.create({
        userId,
        guildId,
        achievementId,
        unlockedAt: new Date()
      });

      const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
      if (def) {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              await member.send({ embeds: [
                new EmbedBuilder()
                  .setTitle('🏆 Thành tích mới!')
                  .setDescription(`Bạn đã mở khóa: ${def.icon} **${def.name}**\n${def.description}`)
                  .setColor(EMBED_COLORS.success)
                  .setTimestamp()
              ] }).catch(() => {});
            }
          }
        } catch {}
      }
    } catch {}
  }

  private async listAchievements(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Danh sách thành tích')
      .setColor(EMBED_COLORS.primary)
      .setDescription(ACHIEVEMENT_DEFINITIONS.map(a =>
        `${a.icon} **${a.name}** — ${a.description}\nYêu cầu: ${a.criteria.type.replace(/_/g, ' ')} (${a.criteria.value})\n`
      ).join('\n'))
      .setFooter({ text: 'Dùng /achievements view để xem tiến trình' });

    await interaction.reply({ embeds: [embed] });
  }

  private async viewAchievements(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const db = Database.getInstance();
      const unlocked = await db.models.Achievement.findAll({
        where: { userId: targetUser.id, guildId: interaction.guild.id }
      });

      const unlockedIds = new Set(unlocked.map((u: any) => u.get('achievementId') as string));

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Thành tích: ${targetUser.username}`)
        .setColor(EMBED_COLORS.primary)
        .setTimestamp();

      const unlockedLines: string[] = [];
      const lockedLines: string[] = [];

      for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (unlockedIds.has(def.id)) {
          const entry = unlocked.find((u: any) => u.get('achievementId') === def.id);
          const unlockedAt = entry ? new Date(entry.get('unlockedAt') as string) : new Date();
          unlockedLines.push(`${def.icon} **${def.name}** — Mở khóa <t:${Math.floor(unlockedAt.getTime() / 1000)}:R>`);
        } else {
          lockedLines.push(`${def.icon} **${def.name}** — *Khóa*`);
        }
      }

      let description = '';
      if (unlockedLines.length > 0) {
        description += '### ✅ Đã mở khóa\n' + unlockedLines.join('\n') + '\n\n';
      }
      if (lockedLines.length > 0) {
        description += '### 🔒 Chưa mở khóa\n' + lockedLines.join('\n');
      }
      if (!description) description = 'Không tìm thấy thành tích nào.';

      embed.setDescription(description);
      embed.setFooter({ text: `${unlockedLines.length}/${ACHIEVEMENT_DEFINITIONS.length} đã mở khóa` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to view achievements', error as Error);
      await interaction.reply({ content: 'Không thể tải thành tích.', ephemeral: true });
    }
  }
}
