import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

export class ModerationModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Moderation',
    description: 'Complete moderation system with warn, mute, kick, ban, timeout, purge',
    version: '1.0.0',
    enabled: true,
    commands: ['warn', 'mute', 'timeout', 'kick', 'ban', 'softban', 'unban', 'purge', 'slowmode', 'lock', 'unlock', 'nickname', 'warnings'],
    events: [],
    dependencies: ['Core']
  };

  private async ensureModPermissions(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need Moderate Members permission.', ephemeral: true });
      return false;
    }
    return true;
  }

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Warning reason').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.warn(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('mute').setDescription('Mute a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Mute reason').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 10m, 1h, 1d)').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.mute(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('timeout').setDescription('Timeout a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 10m, 1h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.timeoutUser(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Kick reason').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.kick(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(true))
        .addStringOption(opt => opt.setName('delete_messages').setDescription('Delete message history').addChoices({ name: 'None', value: '0' }, { name: '1 day', value: '86400' }, { name: '7 days', value: '604800' })),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.ban(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('softban').setDescription('Softban a user (ban + immediate unban)')
        .addUserOption(opt => opt.setName('user').setDescription('User to softban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.softban(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
        .addStringOption(opt => opt.setName('user_id').setDescription('User ID').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.unban(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('purge').setDescription('Purge messages')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.purge(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('slowmode').setDescription('Set slowmode')
        .addIntegerOption(opt => opt.setName('seconds').setDescription('Slowmode in seconds').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.slowmode(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('lock').setDescription('Lock a channel'),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.lock(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel'),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.unlock(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('nickname').setDescription('Change user nickname')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt => opt.setName('nickname').setDescription('New nickname').setRequired(true)),
      execute: async (interaction) => { if (await this.ensureModPermissions(interaction)) await this.nickname(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('warnings').setDescription('Check user warnings')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true)),
      execute: async (interaction) => { await this.checkWarnings(interaction); }
    });
  }

  private async warn(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const db = Database.getInstance();
    await db.models.Warning.create({
      userId: user.id,
      guildId: interaction.guild.id,
      moderatorId: interaction.user.id,
      reason
    });
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Warning')
      .setDescription(`${user} has been warned`)
      .addFields({ name: 'Reason', value: reason }, { name: 'Moderator', value: interaction.user.username })
      .setColor(EMBED_COLORS.warning)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await user.send({ embeds: [new EmbedBuilder().setTitle('⚠️ Warning').setDescription(`You were warned in ${interaction.guild.name}`).addFields({ name: 'Reason', value: reason }).setColor(EMBED_COLORS.warning)] }).catch(() => {});
  }

  private async mute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const duration = interaction.options.getString('duration', true);
    const member = await interaction.guild.members.fetch(user.id);
    const mutedRole = interaction.guild.roles.cache.find(r => r.name.includes('Muted'));
    if (mutedRole) {
      await member.roles.add(mutedRole);
      const embed = new EmbedBuilder()
        .setTitle('🔇 Muted')
        .setDescription(`${user} has been muted`)
        .addFields({ name: 'Reason', value: reason }, { name: 'Duration', value: duration })
        .setColor(EMBED_COLORS.warning).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({ content: '❌ No Muted role found. Create a role with "Muted" in its name.', ephemeral: true });
    }
  }

  private async timeoutUser(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const duration = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id);
    const ms = require('ms');
    await member.timeout(ms(duration), reason);
    const embed = new EmbedBuilder()
      .setTitle('⏰ Timeout')
      .setDescription(`${user} has been timed out for ${duration}`)
      .addFields({ name: 'Reason', value: reason })
      .setColor(EMBED_COLORS.warning).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async kick(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id);
    await member.kick(reason);
    const embed = new EmbedBuilder()
      .setTitle('👢 Kick')
      .setDescription(`${user} has been kicked`)
      .addFields({ name: 'Reason', value: reason })
      .setColor(EMBED_COLORS.error).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async ban(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const deleteMsg = interaction.options.getString('delete_messages') || '0';
    await interaction.guild.members.ban(user, { reason, deleteMessageSeconds: parseInt(deleteMsg) });
    const embed = new EmbedBuilder()
      .setTitle('🔨 Ban')
      .setDescription(`${user} has been banned`)
      .addFields({ name: 'Reason', value: reason })
      .setColor(EMBED_COLORS.error).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async softban(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await interaction.guild.members.ban(user, { reason, deleteMessageSeconds: 86400 });
    await interaction.guild.members.unban(user, 'Softban complete');
    const embed = new EmbedBuilder()
      .setTitle('🔄 Softban')
      .setDescription(`${user} has been softbanned`)
      .addFields({ name: 'Reason', value: reason })
      .setColor(EMBED_COLORS.warning).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async unban(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const userId = interaction.options.getString('user_id', true);
    await interaction.guild.members.unban(userId);
    await interaction.reply({ content: `✅ Unbanned user <@${userId}>`, ephemeral: true });
  }

  private async purge(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel?.isTextBased()) return;
    const channel = interaction.channel as import('discord.js').TextChannel;
    const amount = interaction.options.getInteger('amount', true);
    const messages = await channel.bulkDelete(amount, true);
    const reply = await interaction.reply({ content: `🧹 Deleted ${messages.size} messages.`, ephemeral: true });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  }

  private async slowmode(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased()) return;
    const channel = interaction.channel as import('discord.js').TextChannel;
    const seconds = interaction.options.getInteger('seconds', true);
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `🐢 Slowmode set to ${seconds} seconds.`, ephemeral: true });
  }

  private async lock(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const channel = interaction.channel as import('discord.js').TextChannel;
    await channel.permissionOverwrites.create(interaction.guild.id, { SendMessages: false });
    await interaction.reply({ content: '🔒 Channel locked.', ephemeral: true });
  }

  private async unlock(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const channel = interaction.channel as import('discord.js').TextChannel;
    await channel.permissionOverwrites.create(interaction.guild.id, { SendMessages: true });
    await interaction.reply({ content: '🔓 Channel unlocked.', ephemeral: true });
  }

  private async nickname(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const nickname = interaction.options.getString('nickname', true);
    const member = await interaction.guild.members.fetch(user.id);
    await member.setNickname(nickname);
    await interaction.reply({ content: `✅ Nickname changed for ${user.username}`, ephemeral: true });
  }

  private async checkWarnings(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.options.getUser('user', true);
    const db = Database.getInstance();
    const warnings = await db.models.Warning.findAll({ where: { userId: user.id, guildId: interaction.guild.id, active: true } });
    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${user.username}`)
      .setDescription(warnings.length ? warnings.map((w: any, i: number) => `**${i + 1}.** ${w.reason} - <@${w.moderatorId}>`).join('\n') : 'No warnings')
      .setColor(warnings.length ? EMBED_COLORS.warning : EMBED_COLORS.success);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
