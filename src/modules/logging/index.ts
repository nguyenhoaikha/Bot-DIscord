import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { ConfigManager } from '../../core/ConfigManager';
import { EMBED_COLORS } from '../../config';
import { EventHandler, BotEvent } from '../../core/EventHandler';

export class LoggingModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Logging',
    description: 'Ghi nhật ký hoạt động máy chủ cho tin nhắn, thành viên, kiểm duyệt, kênh',
    version: '1.0.0',
    enabled: true,
    commands: ['setlog'],
    events: ['messageDelete', 'messageUpdate', 'guildMemberAdd', 'guildMemberRemove', 'guildBanAdd', 'guildBanRemove'],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Đặt kênh ghi nhật ký')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh nhật ký').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.guild) {
          await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
          return;
        }
        const channel = interaction.options.getChannel('channel', true);
        await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, { logChannel: channel.id } as any);
        await interaction.reply({ content: `✅ Đã đặt kênh nhật ký thành ${channel}`, ephemeral: true });
      }
    });

    const eventHandler = EventHandler.getInstance();

    eventHandler.register({
      name: 'messageDelete',
      execute: async (message: any) => {
        if (message.author?.bot || !message.guild) return;
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Tin nhắn đã xóa')
          .setDescription(`**Tác giả:** ${message.author.tag}\n**Kênh:** ${message.channel}\n**Nội dung:** ${message.content || 'Embed/Tệp đính kèm'}`)
          .setColor(EMBED_COLORS.error)
          .setTimestamp();
        await this.sendLog(message.guild.id, embed);
      }
    } as BotEvent);

    eventHandler.register({
      name: 'messageUpdate',
      execute: async (oldMessage: any, newMessage: any) => {
        if (oldMessage.author?.bot || !oldMessage.guild || oldMessage.content === newMessage.content) return;
        const embed = new EmbedBuilder()
          .setTitle('✏️ Tin nhắn đã sửa')
          .setDescription(`**Tác giả:** ${oldMessage.author.tag}\n**Kênh:** ${oldMessage.channel}\n**Trước:** ${oldMessage.content}\n**Sau:** ${newMessage.content}`)
          .setColor(EMBED_COLORS.warning)
          .setTimestamp();
        await this.sendLog(oldMessage.guild.id, embed);
      }
    } as BotEvent);

    eventHandler.register({
      name: 'guildBanAdd',
      execute: async (ban: any) => {
        const embed = new EmbedBuilder()
          .setTitle('🔨 Thành viên bị cấm')
          .setDescription(`**Người dùng:** ${ban.user.tag}\n**Lý do:** ${ban.reason || 'Không có lý do'}`)
          .setColor(EMBED_COLORS.error)
          .setTimestamp();
        await this.sendLog(ban.guild.id, embed);
      }
    } as BotEvent);

    eventHandler.register({
      name: 'guildBanRemove',
      execute: async (ban: any) => {
        const embed = new EmbedBuilder()
          .setTitle('🔓 Thành viên đã được gỡ cấm')
          .setDescription(`**Người dùng:** ${ban.user.tag}\n**Lý do:** ${ban.reason || 'Không có lý do'}`)
          .setColor(EMBED_COLORS.success)
          .setTimestamp();
        await this.sendLog(ban.guild.id, embed);
      }
    } as BotEvent);

    eventHandler.register({
      name: 'guildMemberAdd',
      execute: async (member: any) => {
        if (member.user.bot) return;
        const embed = new EmbedBuilder()
          .setTitle('👋 Thành viên mới')
          .setDescription(`**Tên:** ${member.user.tag}\n**ID:** ${member.id}\n**Tạo tài khoản:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
          .setColor(EMBED_COLORS.success)
          .setTimestamp();
        await this.sendLog(member.guild.id, embed);
      }
    } as BotEvent);

    eventHandler.register({
      name: 'guildMemberRemove',
      execute: async (member: any) => {
        if (member.user.bot) return;
        const embed = new EmbedBuilder()
          .setTitle('👋 Thành viên rời đi')
          .setDescription(`**Tên:** ${member.user.tag}\n**ID:** ${member.id}\n**Ngày tham gia:** ${member.joinedAt ? `<t:${Math.floor(member.joinedAt / 1000)}:R>` : 'Không rõ'}`)
          .setColor(EMBED_COLORS.warning)
          .setTimestamp();
        await this.sendLog(member.guild.id, embed);
      }
    } as BotEvent);
  }

  async sendLog(guildId: string, embed: EmbedBuilder): Promise<void> {
    const config = await ConfigManager.getInstance().getGuildConfig(guildId);
    if (!config.logChannel) return;
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(config.logChannel) as any;
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}
