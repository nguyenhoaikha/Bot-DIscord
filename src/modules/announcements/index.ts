import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

export class AnnouncementsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Announcements',
    description: 'Announcement system with embed builder and scheduling',
    version: '1.0.0',
    enabled: true,
    commands: ['announce', 'embedbuilder', 'announcements'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Gửi thông báo đến một kênh')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh để gửi đến').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Tiêu đề thông báo').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung thông báo').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('Màu embed').addChoices({ name: 'Primary', value: 'primary' }, { name: 'Success', value: 'success' }, { name: 'Warning', value: 'warning' }, { name: 'Error', value: 'error' }).setRequired(false))
        .addStringOption(opt => opt.setName('ping').setDescription('Vai trò hoặc @everyone để ping').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.sendAnnouncement(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('embedbuilder')
        .setDescription('Mở trình tạo embed tương tác')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.openEmbedBuilder(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('announcements')
        .setDescription('Danh sách thông báo đã lên lịch')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.listAnnouncements(interaction); }
    });
  }

  private async sendAnnouncement(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const title = interaction.options.getString('title', true);
    const message = interaction.options.getString('message', true);
    const color = interaction.options.getString('color') || 'primary';
    const ping = interaction.options.getString('ping');

    const colorMap: Record<string, number> = { primary: EMBED_COLORS.primary, success: EMBED_COLORS.success, warning: EMBED_COLORS.warning, error: EMBED_COLORS.error };
    const embedColor = colorMap[color] || EMBED_COLORS.primary;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(message)
      .setColor(embedColor)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    const content = ping ? `${ping}` : undefined;

    try {
      await channel.send({ content, embeds: [embed] });
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Đã gửi thông báo')
        .setDescription(`Sent to ${channel}`)
        .setColor(EMBED_COLORS.success);
      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to send announcement', error as Error);
      await interaction.reply({ content: 'Không thể gửi thông báo. Hãy kiểm tra quyền kênh.', ephemeral: true });
    }
  }

  private async openEmbedBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_builder_modal')
      .setTitle('Trình tạo Embed');

    const titleInput = new TextInputBuilder()
      .setCustomId('embed_title')
      .setLabel('Tiêu đề Embed')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('embed_description')
      .setLabel('Mô tả Embed')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
      .setCustomId('embed_color')
      .setLabel('Màu Embed (hex, vd: #5865F2)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    const footerInput = new TextInputBuilder()
      .setCustomId('embed_footer')
      .setLabel('Văn bản Footer')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);

    const channelInput = new TextInputBuilder()
      .setCustomId('embed_channel')
      .setLabel('ID Kênh để gửi đến')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput);
    const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput);
    const row5 = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);

    modal.addComponents(row1, row2, row3, row4, row5);

    await interaction.showModal(modal);

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerModal('embed_builder_modal', async (modalInteraction: any) => {
      const title = modalInteraction.fields.getTextInputValue('embed_title');
      const description = modalInteraction.fields.getTextInputValue('embed_description');
      const color = modalInteraction.fields.getTextInputValue('embed_color') || '#5865F2';
      const footer = modalInteraction.fields.getTextInputValue('embed_footer');
      const channelId = modalInteraction.fields.getTextInputValue('embed_channel');

      const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel;
      if (!channel) {
        await modalInteraction.reply({ content: 'ID kênh không hợp lệ.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(parseInt(color.replace('#', ''), 16) || EMBED_COLORS.primary);

      if (footer) embed.setFooter({ text: footer });

      try {
        await channel.send({ embeds: [embed] });
        await modalInteraction.reply({ content: `✅ Embed sent to ${channel}`, ephemeral: true });
      } catch {
        await modalInteraction.reply({ content: 'Không thể gửi embed. Hãy kiểm tra quyền.', ephemeral: true });
      }
    });
  }

  private async listAnnouncements(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const db = Database.getInstance();
    const announcements = await db.models.Giveaway.findAll({
      where: { guildId: interaction.guild.id, ended: false },
      order: [['endsAt', 'ASC']]
    });

    if (announcements.length === 0) {
      await interaction.reply({ content: 'Không có thông báo nào đã lên lịch.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 Thông báo đã lên lịch')
      .setColor(EMBED_COLORS.primary);

    const lines = announcements.map((a: any, i: number) =>
      `**${i + 1}.** ${a.prize} — Ends <t:${Math.floor(new Date(a.endsAt).getTime() / 1000)}:R>`
    );
    embed.setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
