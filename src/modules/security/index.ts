import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

export class SecurityModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Security',
    description: 'Server security system with lockdown, emergency mode, and security scoring',
    version: '1.0.0',
    enabled: true,
    commands: ['security', 'lockdown', 'emergency'],
    events: [],
    dependencies: ['Core']
  };

  private emergencyMode: Set<string> = new Set();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('security')
        .setDescription('Show server security score and audit results')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showSecurity(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock or unlock all channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => opt.setName('action').setDescription('Lockdown action').setRequired(true).addChoices({ name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' })),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.lockdown(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('emergency')
        .setDescription('Enable emergency mode (lockdown + ping admins)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.emergency(interaction); }
    });
  }

  private async showSecurity(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guild = await interaction.guild.fetch();
      const members = await guild.members.fetch();
      const channels = guild.channels.cache;

      const totalChecks = 7;
      let passedChecks = 0;
      const results: string[] = [];

      if (guild.verificationLevel !== 0) {
        passedChecks++;
        results.push('✅ Verification level is set');
      } else {
        results.push('❌ Verification level is too low');
      }

      const adminBots = members.filter(m => m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
      if (adminBots.size <= 2) {
        passedChecks++;
        results.push(`✅ ${adminBots.size} bot(s) with Admin (reasonable)`);
      } else {
        results.push(`⚠️ ${adminBots.size} bots have Admin permissions`);
      }

      if (guild.mfaLevel === 1) {
        passedChecks++;
        results.push('✅ 2FA required for moderation');
      } else {
        results.push('❌ 2FA not required for moderation');
      }

      if (guild.explicitContentFilter !== 0) {
        passedChecks++;
        results.push('✅ Content filter is enabled');
      } else {
        results.push('❌ Content filter is disabled');
      }

      const hasLogChannel = channels.find(c => c.name.includes('log') || c.name.includes('audit'));
      if (hasLogChannel) {
        passedChecks++;
        results.push('✅ Logging channel found');
      } else {
        results.push('⚠️ No logging channel detected');
      }

      const everyonePerms = guild.roles.everyone.permissions;
      if (!everyonePerms.has(PermissionFlagsBits.Administrator)) {
        passedChecks++;
        results.push('✅ @everyone does not have Admin');
      } else {
        results.push('❌ @everyone has Admin!');
      }

      const securityScore = Math.round((passedChecks / totalChecks) * 100);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Security Audit')
        .setColor(securityScore >= 80 ? EMBED_COLORS.success : securityScore >= 50 ? EMBED_COLORS.warning : EMBED_COLORS.error)
        .addFields(
          { name: 'Security Score', value: `**${securityScore}%** (${passedChecks}/${totalChecks} checks passed)`, inline: false },
          { name: 'Results', value: results.join('\n'), inline: false }
        )
        .setFooter({ text: guild.name })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('security_refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary)
      );

      const message = await interaction.editReply({ embeds: [embed], components: [row] });

      const pawClient = this.client as PawRBClient;
      pawClient.components.registerButton('security_refresh', async (btnInteraction: any) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          await btnInteraction.reply({ content: 'Only the command user can refresh.', ephemeral: true });
          return;
        }
        await btnInteraction.update({ embeds: [embed] });
      });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show security', error as Error);
      await interaction.editReply({ content: 'Failed to perform security audit.' });
    }
  }

  private async lockdown(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action', true);
    const enableLockdown = action === 'enable';

    await interaction.deferReply({ ephemeral: true });

    try {
      const channels = interaction.guild.channels.cache;
      let locked = 0;
      let failed = 0;

      for (const [, channel] of channels) {
        const canManage = 'permissionOverwrites' in channel && !channel.isThread();
        if (canManage) {
          try {
            await channel.permissionOverwrites.create(interaction.guild.id, {
              SendMessages: !enableLockdown,
              Speak: !enableLockdown,
              Connect: enableLockdown ? false : undefined
            });
            locked++;
          } catch {
            failed++;
          }
        }
      }

      if (enableLockdown) {
        this.emergencyMode.add(interaction.guild.id);
      } else {
        this.emergencyMode.delete(interaction.guild.id);
      }

      const embed = new EmbedBuilder()
        .setTitle(enableLockdown ? '🔒 Lockdown Enabled' : '🔓 Lockdown Disabled')
        .setDescription(`Affected ${locked} channels${failed > 0 ? ` (${failed} failed)` : ''}`)
        .setColor(enableLockdown ? EMBED_COLORS.error : EMBED_COLORS.success)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      if (enableLockdown) {
        const notifyEmbed = new EmbedBuilder()
          .setTitle('🚨 Server Lockdown')
          .setDescription('🔒 This server is now in lockdown mode. All channels have been locked.')
          .setColor(EMBED_COLORS.error);
        const systemChannel = interaction.guild.systemChannel;
        if (systemChannel) {
          await systemChannel.send({ embeds: [notifyEmbed] }).catch(() => { });
        }
      }
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to toggle lockdown', error as Error);
      await interaction.editReply({ content: 'Failed to toggle lockdown.' });
    }
  }

  private async emergency(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channels = interaction.guild.channels.cache;
      let locked = 0;

      for (const [, channel] of channels) {
        const canManage = 'permissionOverwrites' in channel && !channel.isThread();
        if (canManage) {
          try {
            await channel.permissionOverwrites.create(interaction.guild.id, {
              SendMessages: false,
              Speak: false,
              Connect: false
            });
            locked++;
          } catch { }
        }
      }

      this.emergencyMode.add(interaction.guild.id);

      const adminRole = interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));
      const adminMention = adminRole ? adminRole.toString() : '@everyone';

      const embed = new EmbedBuilder()
        .setTitle('🚨 EMERGENCY MODE ACTIVATED')
        .setDescription(`🔒 All channels locked\n📢 ${adminMention} please investigate.\n\nServer: ${interaction.guild.name}\nInitiated by: ${interaction.user.tag}`)
        .setColor(EMBED_COLORS.error)
        .setTimestamp();

      const systemChannel = interaction.guild.systemChannel;
      if (systemChannel) {
        await systemChannel.send({ content: adminMention, embeds: [embed] });
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Emergency Mode Active')
        .setDescription(`All ${locked} channels locked.\nAdmins have been notified.`)
        .setColor(EMBED_COLORS.warning);

      await interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to activate emergency mode', error as Error);
      await interaction.editReply({ content: 'Failed to activate emergency mode.' });
    }
  }
}
