import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, OverwriteType } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

interface BackupData {
  id: string;
  name: string;
  createdAt: string;
  roles: Array<{ name: string; color: number; permissions: string; mentionable: boolean; hoist: boolean }>;
  channels: Array<{ name: string; type: ChannelType; topic: string | null; position: number; parent: string | null; permissions: Array<{ id: string; type: OverwriteType; allow: string; deny: string }> }>;
  guildName: string;
  guildId: string;
}

export class BackupModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Backup',
    description: 'Hệ thống sao lưu và khôi phục máy chủ cho vai trò, kênh và quyền hạn',
    version: '1.0.0',
    enabled: true,
    commands: ['backup'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Quản lý sao lưu máy chủ')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
          .setName('create')
          .setDescription('Tạo bản sao lưu máy chủ này')
          .addStringOption(opt => opt.setName('name').setDescription('Tên bản sao lưu').setRequired(false)))
        .addSubcommand(sub => sub
          .setName('restore')
          .setDescription('Khôi phục bản sao lưu')
          .addStringOption(opt => opt.setName('backup_id').setDescription('ID bản sao lưu cần khôi phục').setRequired(true)))
        .addSubcommand(sub => sub
          .setName('list')
          .setDescription('Danh sách bản sao lưu có sẵn')),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') await this.createBackup(interaction);
        else if (sub === 'restore') await this.restoreBackup(interaction);
        else if (sub === 'list') await this.listBackups(interaction);
      }
    });
  }

  private async createBackup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const backupName = interaction.options.getString('name') || `Backup-${Date.now()}`;
    const guild = await interaction.guild.fetch();

    try {
      const roles = guild.roles.cache
        .filter(r => !r.managed && r.id !== guild.id)
        .map(r => ({
          name: r.name,
          color: r.color,
          permissions: r.permissions.bitfield.toString(),
          mentionable: r.mentionable,
          hoist: r.hoist
        }));

      const channels = guild.channels.cache
        .filter(c => c.type !== ChannelType.GuildCategory && !c.isThread())
        .map(c => ({
          name: c.name,
          type: c.type as any,
          topic: (c as any).topic || null,
          position: (c as any).position ?? 0,
          parent: c.parentId,
          permissions: 'permissionOverwrites' in c ? c.permissionOverwrites.cache.map((o: any) => ({
            id: o.id,
            type: o.type,
            allow: o.allow.bitfield.toString(),
            deny: o.deny.bitfield.toString()
          })) : []
        }));

      const backupData: BackupData = {
        id: `backup_${Date.now()}`,
        name: backupName,
        createdAt: new Date().toISOString(),
        roles,
        channels,
        guildName: guild.name,
        guildId: guild.id
      };

      const db = Database.getInstance();
      const modelName = `Backup_${guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        const { DataTypes } = require('sequelize');
        db.models[modelName] = db.sequelize.define(modelName, {
          backupId: { type: DataTypes.STRING, primaryKey: true },
          guildId: DataTypes.STRING,
          name: DataTypes.STRING,
          data: DataTypes.JSON
        });
        await db.models[modelName].sync();
      }

      await db.models[modelName].create({
        backupId: backupData.id,
        guildId: guild.id,
        name: backupName,
        data: backupData
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Đã tạo bản sao lưu')
        .setDescription(`**Tên:** ${backupName}\n**ID:** \`${backupData.id}\`\n**Vai trò:** ${roles.length}\n**Kênh:** ${channels.length}`)
        .setColor(EMBED_COLORS.success)
        .setFooter({ text: guild.name })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to create backup', error as Error);
      await interaction.editReply({ content: 'Không thể tạo bản sao lưu.' });
    }
  }

  private async restoreBackup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const backupId = interaction.options.getString('backup_id', true);

    try {
      const db = Database.getInstance();
      const modelName = `Backup_${interaction.guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        await interaction.editReply({ content: 'Không tìm thấy bản sao lưu nào cho máy chủ này.' });
        return;
      }

      const record = await db.models[modelName].findOne({ where: { backupId } });
      if (!record) {
        await interaction.editReply({ content: 'Không tìm thấy bản sao lưu.' });
        return;
      }

      const backupData = record.get('data') as BackupData;
      const guild = await interaction.guild.fetch();

      for (const roleData of backupData.roles) {
        try {
          const existing = guild.roles.cache.find(r => r.name === roleData.name);
          if (!existing) {
            await guild.roles.create({
              name: roleData.name,
              color: roleData.color,
              permissions: BigInt(roleData.permissions),
              mentionable: roleData.mentionable,
              hoist: roleData.hoist
            });
          }
        } catch { }
      }

      for (const channelData of backupData.channels) {
        try {
          const guildChannelType = channelData.type as any;
          if (guildChannelType === ChannelType.GuildCategory) {
            const existing = guild.channels.cache.find(c => c.name === channelData.name && c.type === ChannelType.GuildCategory);
            if (!existing) {
              await guild.channels.create({
                name: channelData.name,
                type: ChannelType.GuildCategory
              });
            }
          } else if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia as any].includes(guildChannelType)) {
            const existing = guild.channels.cache.find(c => c.name === channelData.name && c.type === guildChannelType);
            if (!existing) {
              await guild.channels.create({
                name: channelData.name,
                type: guildChannelType,
                topic: channelData.topic || undefined,
                parent: channelData.parent || undefined
              } as any);
            }
          }
        } catch { }
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Đã khôi phục bản sao lưu')
        .setDescription(`Bản sao lưu **${backupData.name}** đã được khôi phục.\nVai trò và kênh đã được tạo lại.`)
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to restore backup', error as Error);
        await interaction.editReply({ content: 'Không thể khôi phục bản sao lưu.' });
    }
  }

  private async listBackups(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    try {
      const db = Database.getInstance();
      const modelName = `Backup_${interaction.guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        await interaction.reply({ content: 'Không có bản sao lưu nào cho máy chủ này.', ephemeral: true });
        return;
      }

      const backups = await db.models[modelName].findAll({ order: [['createdAt', 'DESC']] });

      if (backups.length === 0) {
        await interaction.reply({ content: 'Không có bản sao lưu nào.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('💾 Danh sách bản sao lưu')
        .setColor(EMBED_COLORS.primary);

      const lines = backups.map((b: any, i: number) => {
        const data = b.get('data') as BackupData;
         return `**${i + 1}.** ${data.name} — \`${data.id}\`\n   Đã tạo: <t:${Math.floor(new Date(data.createdAt).getTime() / 1000)}:R>`;
      });

      embed.setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to list backups', error as Error);
      await interaction.reply({ content: 'Không thể liệt kê bản sao lưu.', ephemeral: true });
    }
  }
}
