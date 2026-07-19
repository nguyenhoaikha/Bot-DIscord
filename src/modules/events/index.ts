import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, GuildScheduledEvent, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, PermissionFlagsBits } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

export class EventsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Events',
    description: 'Quản lý sự kiện và đếm ngược trên Discord',
    version: '1.0.0',
    enabled: true,
    commands: ['event'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Quản lý sự kiện máy chủ')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand(sub => sub
          .setName('create')
          .setDescription('Tạo sự kiện theo lịch')
          .addStringOption(opt => opt.setName('name').setDescription('Tên sự kiện').setRequired(true))
          .addStringOption(opt => opt.setName('time').setDescription('Thời gian bắt đầu (ISO date hoặc "tomorrow 3pm")').setRequired(true))
          .addStringOption(opt => opt.setName('location').setDescription('Kênh thoại hoặc địa điểm bên ngoài').setRequired(true))
          .addStringOption(opt => opt.setName('description').setDescription('Mô tả sự kiện').setRequired(false)))
        .addSubcommand(sub => sub
          .setName('list')
          .setDescription('Danh sách tất cả sự kiện theo lịch'))
        .addSubcommand(sub => sub
          .setName('delete')
          .setDescription('Xóa sự kiện theo lịch')
          .addStringOption(opt => opt.setName('event_id').setDescription('ID sự kiện cần xóa').setRequired(true)))
        .addSubcommand(sub => sub
          .setName('countdown')
          .setDescription('Hiển thị đếm ngược đến sự kiện')
          .addStringOption(opt => opt.setName('event_id').setDescription('ID sự kiện').setRequired(true))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') await this.createEvent(interaction);
        else if (sub === 'list') await this.listEvents(interaction);
        else if (sub === 'delete') await this.deleteEvent(interaction);
        else if (sub === 'countdown') await this.showCountdown(interaction);
      }
    });
  }

  private async createEvent(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description') || '';
    const timeStr = interaction.options.getString('time', true);
    const location = interaction.options.getString('location', true);

    let startTime: Date;
    const parsed = Date.parse(timeStr);
    if (!isNaN(parsed)) {
      startTime = new Date(parsed);
    } else {
      const match = timeStr.toLowerCase().match(/^tomorrow\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (match) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const meridian = match[3];
        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;
        tomorrow.setHours(hours, minutes, 0, 0);
        startTime = tomorrow;
      } else {
        await interaction.reply({ content: 'Định dạng thời gian không hợp lệ. Sử dụng ISO date (2024-12-25T15:00:00Z) hoặc "tomorrow 3pm".', ephemeral: true });
        return;
      }
    }

    if (startTime.getTime() <= Date.now()) {
      await interaction.reply({ content: 'Thời gian sự kiện phải ở tương lai.', ephemeral: true });
      return;
    }

    try {
      const channel = interaction.guild.channels.cache.find(c => (c.name === location || c.id === location) && ('bitrate' in c || 'rtcRegion' in c)) as any;
      const event = await interaction.guild.scheduledEvents.create({
        name,
        description,
        scheduledStartTime: startTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: channel ? GuildScheduledEventEntityType.Voice : GuildScheduledEventEntityType.External,
        entityMetadata: channel ? undefined : { location },
        channel: channel || undefined,
        reason: `Created by ${interaction.user.username}`
      });

      const db = Database.getInstance();
      await db.models.ScheduledEvent.create({
        guildId: interaction.guild.id,
        name,
        description,
        date: startTime,
        type: 'discord'
      });

      const embed = new EmbedBuilder()
        .setTitle('📅 Đã tạo sự kiện')
        .setDescription(`**${name}**\n${description ? description + '\n' : ''}Bắt đầu: <t:${Math.floor(startTime.getTime() / 1000)}:F>\nĐịa điểm: ${location}`)
        .setColor(EMBED_COLORS.success)
        .setFooter({ text: `ID sự kiện: ${event.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to create event', error as Error);
      await interaction.reply({ content: 'Không thể tạo sự kiện. Kiểm tra quyền hạn.', ephemeral: true });
    }
  }

  private async listEvents(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    try {
      const events = await interaction.guild.scheduledEvents.fetch();

      if (events.size === 0) {
        await interaction.reply({ content: 'Không có sự kiện nào theo lịch.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Sự kiện máy chủ')
        .setColor(EMBED_COLORS.primary);

      const lines = events.map((e: GuildScheduledEvent) =>
        `**${e.name}** — ${e.scheduledStartTimestamp ? `<t:${Math.floor(e.scheduledStartTimestamp / 1000)}:R>` : 'Không xác định'}\nID: \`${e.id}\` | Trạng thái: ${e.status}`
      );
      embed.setDescription(Array.from(lines).join('\n\n'));

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to list events', error as Error);
      await interaction.reply({ content: 'Không thể lấy danh sách sự kiện.', ephemeral: true });
    }
  }

  private async deleteEvent(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const eventId = interaction.options.getString('event_id', true);

    try {
      const event = await interaction.guild.scheduledEvents.fetch(eventId);
      await event.delete();
      await interaction.reply({ content: `✅ Sự kiện **${event.name}** đã xóa.`, ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to delete event', error as Error);
      await interaction.reply({ content: 'Không thể xóa sự kiện. Kiểm tra ID và quyền hạn.', ephemeral: true });
    }
  }

  private async showCountdown(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const eventId = interaction.options.getString('event_id', true);

    try {
      const event = await interaction.guild.scheduledEvents.fetch(eventId);
      const startTime = event.scheduledStartTimestamp;
      if (!startTime) {
        await interaction.reply({ content: 'Sự kiện không có thời gian bắt đầu.', ephemeral: true });
        return;
      }
      const now = Date.now();

      if (startTime <= now) {
        await interaction.reply({ content: `**${event.name}** đã bắt đầu!`, ephemeral: true });
        return;
      }

      const diff = startTime - now;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`⏰ Đếm ngược: ${event.name}`)
        .setDescription(`**${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây** cho đến sự kiện!`)
        .addFields({ name: 'Thời gian bắt đầu', value: `<t:${Math.floor(startTime / 1000)}:F>` })
        .setColor(EMBED_COLORS.info)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show countdown', error as Error);
      await interaction.reply({ content: 'Không thể lấy đếm ngược sự kiện.', ephemeral: true });
    }
  }
}
