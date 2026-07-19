import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { ConfigManager } from '../../core/ConfigManager';
import { EMBED_COLORS } from '../../config';
import * as embed from '../../utils/embedBuilder';

export class VerificationModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Verification',
    description: 'Hệ thống xác minh bằng nút bấm',
    version: '1.0.0',
    enabled: true,
    commands: ['verify', 'setupverify'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setupverify')
        .setDescription('Thiết lập hệ thống xác minh')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh xác minh').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role sẽ được cấp sau khi xác minh').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.setupVerification(interaction);
      }
    });

    pawClient.components.registerButton('verify_user', async (interaction) => {
      await this.handleVerification(interaction);
    });
  }

  private async setupVerification(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);

    await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, {
      verifyChannel: channel.id,
      verifiedRole: role.id,
      verificationEnabled: true
    } as any);

    const verifyEmbed = embed.info(
      '🔐 Xác minh',
      'Nhấn nút bên dưới để xác minh bản thân và nhận quyền truy cập server!'
    );

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_user')
          .setLabel('Xác minh')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

    if (channel instanceof TextChannel) {
      await channel.send({ embeds: [verifyEmbed], components: [row] });
    }

    await interaction.reply({ content: '✅ Hệ thống xác minh đã được thiết lập!', ephemeral: true });
  }

  private async handleVerification(interaction: any): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', ephemeral: true }).catch(() => {});
      return;
    }
    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);

    const verifiedRoleId = config.verifiedRole;
    if (!verifiedRoleId) {
      await interaction.reply({ content: '❌ Chưa cấu hình role xác minh. Hãy liên hệ admin.', ephemeral: true });
      return;
    }

    const role = interaction.guild.roles.cache.get(verifiedRoleId);
    if (!role) {
      await interaction.reply({ content: '❌ Không tìm thấy role xác minh. Hãy liên hệ admin.', ephemeral: true });
      return;
    }

    if (!interaction.member) {
      await interaction.reply({ content: '❌ Không thể xác định tư cách thành viên.', ephemeral: true });
      return;
    }

    if (interaction.member.roles.cache.has(verifiedRoleId)) {
      await interaction.reply({ content: '✅ Bạn đã được xác minh trước đó rồi!', ephemeral: true });
      return;
    }

    await interaction.member.roles.add(role);
    await interaction.reply({
      embeds: [embed.success('✅ Xác minh thành công!', 'Bạn đã được xác minh và có quyền truy cập server!')],
      ephemeral: true
    });
  }
}
