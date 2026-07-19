import { Client, SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonInteraction, ModalSubmitInteraction, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest, TicketType } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { ConfigManager } from '../../core/ConfigManager';
import * as embed from '../../utils/embedBuilder';

const activeCreations = new Set<string>();

export class TicketsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Tickets',
    description: 'Hệ thống ticket hỗ trợ',
    version: '1.0.0',
    enabled: true,
    commands: ['ticket', 'ticketpanel'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Quản lý ticket')
        .addSubcommand(sub => sub.setName('close').setDescription('Đóng ticket hiện tại'))
        .addSubcommand(sub => sub.setName('claim').setDescription('Nhận xử lý ticket'))
        .addSubcommand(sub => sub.setName('rename').setDescription('Đổi tên ticket').addStringOption(opt => opt.setName('name').setDescription('Tên mới').setRequired(true)))
        .addSubcommand(sub => sub.setName('add').setDescription('Thêm người vào ticket').addUserOption(opt => opt.setName('user').setDescription('Người dùng').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Xóa người khỏi ticket').addUserOption(opt => opt.setName('user').setDescription('Người dùng').setRequired(true))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        switch (sub) {
          case 'close': await this.closeTicket(interaction); break;
          case 'claim': await this.claimTicket(interaction); break;
          case 'rename': await this.renameTicket(interaction); break;
          case 'add': await this.addUser(interaction); break;
          case 'remove': await this.removeUser(interaction); break;
        }
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Tạo bảng ticket')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh đặt bảng ticket').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.createTicketPanel(interaction);
      }
    });

    pawClient.components.registerButton('ticket_create', async (interaction) => {
      await this.handleCreateTicket(interaction);
    });
    pawClient.components.registerButton('ticket_close', async (interaction) => {
      await this.closeTicket(interaction);
    });
    pawClient.components.registerButton('ticket_claim', async (interaction) => {
      await this.claimTicket(interaction);
    });
    pawClient.components.registerModal('ticket_create_modal', async (interaction) => {
      await this.createTicket(interaction);
    });
  }

  private async createTicketPanel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel', true);

    const panelEmbed = embed.info(
      '🎫 Trung tâm Hỗ trợ',
      'Chào mừng bạn đến với hệ thống hỗ trợ.\n\n' +
      '**📋 Hướng dẫn trước khi tạo ticket:**\n' +
      '• Vui lòng chuẩn bị thông tin liên quan\n' +
      '• Mô tả chi tiết và rõ ràng vấn đề bạn đang gặp\n\n' +
      '**📌 Quy trình xử lý:**\n' +
      '• Ticket sẽ được tạo ở kênh riêng tư\n' +
      '• Staff sẽ phản hồi trong thời gian sớm nhất\n' +
      '• Vui lòng không tạo nhiều ticket cho cùng một vấn đề'
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('🎫 Tạo Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    if (channel instanceof TextChannel) {
      await channel.send({ embeds: [panelEmbed], components: [row] });
    }

    await interaction.reply({ content: '✅ Bảng ticket đã được tạo!', ephemeral: true });
  }

  private async handleCreateTicket(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', ephemeral: true });
      return;
    }

    const userId = interaction.user.id;
    if (activeCreations.has(userId)) {
      await interaction.reply({ content: 'Bạn đang có một ticket đang được tạo. Vui lòng đợi.', ephemeral: true });
      return;
    }

    activeCreations.add(userId);
    try {
      const existing = interaction.guild.channels.cache.find(
        ch => ch.name.startsWith('ticket-') &&
          ch.type === ChannelType.GuildText &&
          ch.permissionOverwrites.cache.has(userId)
      );
      if (existing) {
        activeCreations.delete(userId);
        await interaction.reply({ content: `Bạn đã có ticket đang mở: ${existing}`, ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
      const categoryId = config.ticketCategory;
      const category = categoryId
        ? interaction.guild.channels.cache.get(categoryId)
        : interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.includes('SUPPORT')
          );

      if (!category || category.type !== ChannelType.GuildCategory) {
        activeCreations.delete(userId);
        await interaction.editReply({ content: '❌ Chưa thiết lập danh mục ticket. Hãy chạy `/setup wizard` trước.' });
        return;
      }

      const sanitizedName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
      const channel = await interaction.guild.channels.create({
        name: `ticket-${sanitizedName}-${Date.now().toString(36)}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          ...(config.ticketSupportRole ? [{
            id: config.ticketSupportRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }] : []),
        ],
        topic: `Tạo bởi ${interaction.user.tag} | Mở lúc: ${new Date().toISOString()}`,
      });

      const welcomeEmbed = embed.base({
        title: '🎫 Ticket Hỗ trợ',
        description: `Chào bạn ${interaction.user},\n\nCảm ơn bạn đã liên hệ hỗ trợ. Staff sẽ sớm phản hồi.`,
        color: 0x6366F1,
        fields: [
          { name: '📝 Thông tin cần cung cấp', value: '• Mô tả chi tiết vấn đề\n• Mã đơn hàng hoặc thông tin liên quan\n• Đính kèm ảnh chụp màn hình nếu có', inline: false },
          { name: '⏱ Thời gian xử lý', value: 'Phản hồi đầu tiên trong **4-8 giờ làm việc**.', inline: false },
          { name: '🔧 Thao tác', value: '**🔒 Đóng Ticket** — Khi vấn đề đã được giải quyết\n**🙋 Nhận Ticket** — Dành cho Staff nhận xử lý', inline: false },
        ],
        footerText: interaction.guild.name,
      });

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Đóng Ticket').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('🙋 Nhận Ticket').setStyle(ButtonStyle.Secondary),
      );

      await channel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [actionRow] });
      await interaction.editReply({ content: `✅ Ticket đã được tạo: ${channel}` });

      await this.logToChannel(interaction.guild, config.logChannel, {
        color: 0x6366F1,
        title: '🎫 Ticket mới',
        fields: [
          { name: 'Người dùng', value: interaction.user.toString(), inline: true },
          { name: 'Kênh', value: channel.toString(), inline: true },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        ],
      });

    } catch (error) {
      this.logger.error('Tickets', 'Create error', error as Error);
      try {
        await interaction.editReply({ content: '❌ Không thể tạo ticket. Vui lòng thử lại.' });
      } catch { }
    } finally {
      activeCreations.delete(userId);
    }
  }

  private async openTicketModal(interaction: import('discord.js').StringSelectMenuInteraction): Promise<void> {
    const type = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId('ticket_create_modal')
      .setTitle('Tạo Ticket')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('ticket_type').setLabel('Loại ticket').setStyle(TextInputStyle.Short).setValue(type).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('ticket_subject').setLabel('Tiêu đề').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('ticket_description').setLabel('Mô tả').setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }

  private async createTicket(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const db = Database.getInstance();
    const type = interaction.fields.getTextInputValue('ticket_type') as TicketType;
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description');

    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
    const categoryId = config.ticketCategory;
    const category = categoryId
      ? interaction.guild.channels.cache.get(categoryId)
      : interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('SUPPORT'));

    if (!category || category.type !== ChannelType.GuildCategory) {
      await interaction.editReply({ content: '❌ Không tìm thấy danh mục ticket. Hãy chạy `/setup wizard` trước.' });
      return;
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: ['ViewChannel'] },
        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ...(config.ticketSupportRole ? [{
          id: config.ticketSupportRole,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] as const
        }] : []),
      ],
      topic: `Tạo bởi ${interaction.user.tag} | Loại: ${type}`,
    });

    await db.models.Ticket.create({
      guildId: interaction.guild.id,
      channelId: channel.id,
      creatorId: interaction.user.id,
      type,
      status: 'open',
      subject,
      priority: 'medium'
    });

    const ticketEmbed = embed.base({
      title: `🎫 Ticket: ${type}`,
      description: [
        `**Người tạo:** ${interaction.user.toString()}`,
        `**Loại:** ${type}`,
        `**Trạng thái:** 🟢 Đang mở`,
        '',
        `**Tiêu đề:** ${subject}`,
        `**Mô tả:** ${description}`,
      ].join('\n'),
      fields: [
        { name: '🔧 Thao tác', value: '**🔒 Đóng Ticket** — Khi vấn đề đã được giải quyết\n**🙋 Nhận Ticket** — Dành cho Staff', inline: false },
      ],
      footerText: interaction.guild.name,
    });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Đóng').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('🙋 Nhận').setStyle(ButtonStyle.Primary)
      );

    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });
    await interaction.editReply({ content: `✅ Ticket đã được tạo: ${channel}` });
  }

  private async closeTicket(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', ephemeral: true }).catch(() => { });
      return;
    }
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Đây không phải kênh ticket hợp lệ.', ephemeral: true }).catch(() => { });
      return;
    }
    const channel = interaction.channel as TextChannel;
    if (!channel.name.startsWith('ticket-')) {
      await interaction.reply({ content: 'Đây không phải kênh ticket.', ephemeral: true });
      return;
    }

    const member = interaction.member as any;
    if (member && !member.permissions?.has(PermissionFlagsBits.Administrator) && !member.permissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ Bạn không có quyền đóng ticket này.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: '🔒 Đang đóng ticket và lưu transcript...', ephemeral: true });

    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      const transcriptLines = sorted.map(msg =>
        `[${msg.createdAt?.toISOString()}] ${msg.author?.tag || 'Unknown'}: ${msg.content || '[Embed/Attachment]'}`
      );
      const transcript = transcriptLines.join('\n') || 'Không có tin nhắn nào.';

      const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
      const db = Database.getInstance();

      const ticketRecord = await db.models.Ticket.findOne({ where: { channelId: channel.id, guildId: interaction.guild.id } });
      if (ticketRecord) {
        await ticketRecord.update({ status: 'closed' });
      }

      const ticketUser = (ticketRecord?.get('creatorId') as string) || 'Unknown';
      const ticketType = (ticketRecord?.get('type') as string) || 'Unknown';
      const claimerId = ticketRecord?.get('claimerId') as string | null;

      const closeEmbed = embed.base({
        title: '🔒 Ticket Đã Đóng',
        description: [
          `**Kênh:** #${channel.name}`,
          `**Người tạo:** <@${ticketUser}>`,
          `**Loại:** ${ticketType}`,
          `**Người đóng:** ${interaction.user.tag}`,
          claimerId ? `**Người nhận:** <@${claimerId}>` : null,
          `**Số tin nhắn:** ${sorted.size}`,
        ].filter(Boolean).join('\n'),
        color: 0xEF4444,
        footerText: interaction.guild.name,
      });

      const transcriptFile = new AttachmentBuilder(
        Buffer.from(transcript, 'utf-8'),
        { name: `transcript-${channel.name}-${Date.now()}.txt` }
      );

      await this.logToChannel(interaction.guild, config.logChannel, {
        color: 0xEF4444,
        title: '🔒 Ticket đã đóng',
        fields: [
          { name: 'Người dùng', value: `<@${ticketUser}>`, inline: true },
          { name: 'Kênh', value: channel.toString(), inline: true },
          { name: 'Người đóng', value: interaction.user.tag, inline: true },
          { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        ],
      }, [transcriptFile]);

    } catch (err) {
      this.logger.error('Tickets', 'Failed to save transcript', err as Error);
    }

    setTimeout(() => {
      channel.delete().catch(() => { });
    }, 3000);
  }

  private async claimTicket(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong kênh ticket.', ephemeral: true });
      return;
    }
    const channel = interaction.channel as TextChannel;
    if (!channel.name.startsWith('ticket-')) {
      await interaction.reply({ content: 'Đây không phải kênh ticket.', ephemeral: true });
      return;
    }

    const member = interaction.member as any;
    const isStaff = member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
      member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isStaff) {
      await interaction.reply({ content: '❌ Chỉ Staff mới có thể nhận ticket.', ephemeral: true });
      return;
    }

    const topic = channel.topic || '';
    if (topic.includes('Claimed by')) {
      await interaction.reply({ content: '❌ Ticket này đã được nhận bởi người khác.', ephemeral: true });
      return;
    }

    await channel.setTopic(`${topic} | Claimed by ${interaction.user.tag}`);

    const db = Database.getInstance();
    const ticketRecord = await db.models.Ticket.findOne({ where: { channelId: channel.id, guildId: interaction.guild.id } });
    if (ticketRecord) {
      await ticketRecord.update({ claimerId: interaction.user.id });
    }

    const claimEmbed = embed.base({
      title: '🙋 Ticket Đã Được Nhận',
      description: `**Người nhận:** ${interaction.user.tag}\n**Trạng thái:** 🔵 Đang xử lý`,
      color: 0x22C55E,
      footerText: interaction.guild.name,
    });

    await channel.send({ embeds: [claimEmbed] });
    await interaction.reply({ content: `✅ Bạn đã nhận ticket này.`, ephemeral: true });

    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
    await this.logToChannel(interaction.guild, config.logChannel, {
      color: 0x22C55E,
      title: '🙋 Ticket đã được nhận',
      fields: [
        { name: 'Staff', value: interaction.user.toString(), inline: true },
        { name: 'Kênh', value: channel.toString(), inline: true },
        { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
      ],
    });
  }

  private async renameTicket(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong kênh ticket.', ephemeral: true });
      return;
    }
    const name = interaction.options.getString('name', true);
    await interaction.channel.setName(`ticket-${name}`);
    await interaction.reply({ content: `✅ Ticket đã được đổi tên: ${name}`, ephemeral: true });
  }

  private async addUser(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong kênh ticket.', ephemeral: true });
      return;
    }
    const user = interaction.options.getUser('user', true);
    await interaction.channel.permissionOverwrites.create(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.reply({ content: `✅ Đã thêm ${user.username} vào ticket.`, ephemeral: true });
  }

  private async removeUser(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong kênh ticket.', ephemeral: true });
      return;
    }
    const user = interaction.options.getUser('user', true);
    await interaction.channel.permissionOverwrites.delete(user.id);
    await interaction.reply({ content: `✅ Đã xóa ${user.username} khỏi ticket.`, ephemeral: true });
  }

  private async logToChannel(guild: import('discord.js').Guild, channelId: string | undefined, embedData: { color?: number; title?: string; fields?: { name: string; value: string; inline?: boolean }[] }, files?: import('discord.js').AttachmentBuilder[]): Promise<void> {
    if (!channelId) return;
    try {
      const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!channel) return;
      const logEmbed = new DiscordEmbedBuilder()
        .setColor(embedData.color || 0x6366F1)
        .setTitle(embedData.title || 'Ticket Log')
        .addFields(embedData.fields || [])
        .setTimestamp();
      const opts: any = { embeds: [logEmbed] };
      if (files) opts.files = files;
      await channel.send(opts);
    } catch (error) {
      this.logger.error('Tickets', 'Log error', error as Error);
    }
  }
}
