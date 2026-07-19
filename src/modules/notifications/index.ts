import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';
import { EventHandler, BotEvent } from '../../core/EventHandler';

export class NotificationsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Notifications',
    description: 'Channel and user notification following system',
    version: '1.0.0',
    enabled: true,
    commands: ['notify'],
    events: ['messageCreate'],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('notify')
        .setDescription('Manage your notification subscriptions')
        .addSubcommand(sub => sub
          .setName('follow')
          .setDescription('Follow a channel to get notified of new messages')
          .addChannelOption(opt => opt.setName('channel').setDescription('Channel to follow').setRequired(true)))
        .addSubcommand(sub => sub
          .setName('list')
          .setDescription('List your notification subscriptions'))
        .addSubcommand(sub => sub
          .setName('remove')
          .setDescription('Remove a notification subscription')
          .addStringOption(opt => opt.setName('subscription_id').setDescription('Subscription ID to remove').setRequired(true))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'follow') await this.follow(interaction);
        else if (sub === 'list') await this.listNotifications(interaction);
        else if (sub === 'remove') await this.removeNotification(interaction);
      }
    });

    // Register messageCreate event for notification delivery
    const eventHandler = EventHandler.getInstance();
    eventHandler.register({
      name: 'messageCreate',
      execute: async (message: any) => {
        if (message.author?.bot || !message.guild) return;
        const db = Database.getInstance();
        const modelName = `Notifications_${message.guild.id.replace(/-/g, '_')}`;
        if (!db.models[modelName]) return;

        const subs = await db.models[modelName].findAll({
          where: { guildId: message.guild.id, channelId: message.channel.id }
        });

        for (const sub of subs) {
          try {
            const user = await message.client.users.fetch(sub.get('userId') as string);
            if (user) {
              const embed = new EmbedBuilder()
                .setTitle('🔔 Có tin nhắn mới')
                .setDescription([
                  `**Kênh:** <#${message.channel.id}>`,
                  `**Tác giả:** ${message.author.tag}`,
                  `**Server:** ${message.guild.name}`,
                  '',
                  message.content ? `> ${message.content.slice(0, 500)}` : '*[Embed/Tệp đính kèm]*'
                ].join('\n'))
                .setColor(EMBED_COLORS.primary)
                .setTimestamp()
                .setURL(message.url);

              await user.send({ embeds: [embed] });
            }
          } catch {}
        }
      }
    } as BotEvent);
  }

  private async follow(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true) as TextChannel;

    if (!channel.isTextBased()) {
      await interaction.reply({ content: 'Bạn chỉ có thể theo dõi kênh văn bản.', ephemeral: true });
      return;
    }

    const db = Database.getInstance();
    const modelName = `Notifications_${interaction.guild.id.replace(/-/g, '_')}`;

    if (!db.models[modelName]) {
      const { DataTypes } = require('sequelize');
      db.models[modelName] = db.sequelize.define(modelName, {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId: DataTypes.STRING,
        guildId: DataTypes.STRING,
        channelId: DataTypes.STRING,
        channelName: DataTypes.STRING
      });
      await db.models[modelName].sync();
    }

    const existing = await db.models[modelName].findOne({
      where: { userId: interaction.user.id, guildId: interaction.guild.id, channelId: channel.id }
    });

    if (existing) {
      await interaction.reply({ content: `Bạn đã theo dõi <#${channel.id}> rồi.`, ephemeral: true });
      return;
    }

    await db.models[modelName].create({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: channel.id,
      channelName: channel.name
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Đang theo dõi')
      .setDescription(`Bạn sẽ nhận được thông báo khi có tin nhắn mới trong <#${channel.id}>`)
      .setColor(EMBED_COLORS.success);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async listNotifications(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
      return;
    }

    const db = Database.getInstance();
    const modelName = `Notifications_${interaction.guild.id.replace(/-/g, '_')}`;

    if (!db.models[modelName]) {
      await interaction.reply({ content: 'Bạn không có theo dõi kênh nào.', ephemeral: true });
      return;
    }

    const subs = await db.models[modelName].findAll({
      where: { userId: interaction.user.id, guildId: interaction.guild.id }
    });

    if (subs.length === 0) {
      await interaction.reply({ content: 'Bạn không theo dõi kênh nào.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔔 Theo dõi của bạn')
      .setColor(EMBED_COLORS.primary)
      .setDescription(subs.map((s: any, i: number) =>
        `**${i + 1}.** <#${s.get('channelId')}> — ID: \`${s.get('id')}\``
      ).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async removeNotification(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
      return;
    }

    const subId = interaction.options.getString('subscription_id', true);

    const db = Database.getInstance();
    const modelName = `Notifications_${interaction.guild.id.replace(/-/g, '_')}`;

    if (!db.models[modelName]) {
      await interaction.reply({ content: 'Không tìm thấy theo dõi nào.', ephemeral: true });
      return;
    }

    const deleted = await db.models[modelName].destroy({
      where: { id: subId, userId: interaction.user.id, guildId: interaction.guild.id }
    });

    if (deleted) {
      await interaction.reply({ content: '✅ Đã hủy theo dõi.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Không tìm thấy theo dõi hoặc bạn không có quyền xóa.', ephemeral: true });
    }
  }
}
