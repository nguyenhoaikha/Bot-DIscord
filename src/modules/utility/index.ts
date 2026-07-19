import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

interface AFKEntry {
  userId: string;
  guildId: string;
  reason: string;
  since: number;
}

export class UtilityModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Utility',
    description: 'Server utilities including server info, user info, AFK system, calculator, and more',
    version: '1.0.0',
    enabled: true,
    commands: ['serverinfo', 'userinfo', 'avatar', 'banner', 'roleinfo', 'emojiinfo', 'poll', 'reminder', 'calculator', 'afk', 'translate'],
    events: ['messageCreate'],
    dependencies: ['Core']
  };

  private afkUsers: Map<string, AFKEntry> = new Map();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show detailed server information'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showServerInfo(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Show user information')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showUserInfo(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Show user avatar')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false))
        .addStringOption(opt => opt.setName('size').setDescription('Image size').addChoices({ name: '128', value: '128' }, { name: '256', value: '256' }, { name: '512', value: '512' }, { name: '1024', value: '1024' }, { name: '2048', value: '2048' }).setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showAvatar(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Show user banner')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showBanner(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Show role information')
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showRoleInfo(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('emojiinfo')
        .setDescription('Show emoji information')
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji name or the emoji itself').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showEmojiInfo(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a quick yes/no poll')
        .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createQuickPoll(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('reminder')
        .setDescription('Set a reminder')
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 10m, 1h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Reminder message').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.setReminder(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('calculator')
        .setDescription('Perform a calculation')
        .addStringOption(opt => opt.setName('expression').setDescription('Math expression (e.g., 2+2, 10*5)').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.calculate(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status')
        .addStringOption(opt => opt.setName('reason').setDescription('AFK reason').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.setAFK(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text (basic mock translation)')
        .addStringOption(opt => opt.setName('text').setDescription('Text to translate').setRequired(true))
        .addStringOption(opt => opt.setName('target_lang').setDescription('Target language code (e.g., vi, ja, ko)').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.translate(interaction); }
    });

    pawClient.events.register({
      name: 'messageCreate',
      execute: async (message: any) => {
        if (message.author?.bot || !message.guild) return;
        await this.handleAFKCheck(message);
      }
    });
  }

  private async showServerInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const guild = await interaction.guild.fetch();
    const members = await guild.members.fetch();
    const channels = guild.channels.cache;
    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setColor(EMBED_COLORS.primary)
      .addFields(
        { name: '📋 ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: owner.user.tag, inline: true },
        { name: '🌍 Region', value: 'Discord Standard', inline: true },
        { name: '👥 Members', value: `${members.size} (${members.filter(m => !m.user.bot).size} humans, ${members.filter(m => m.user.bot).size} bots)`, inline: true },
        { name: '💬 Channels', value: `${channels.filter(c => c.isTextBased()).size} text, ${channels.filter(c => c.isVoiceBased()).size} voice`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Boosts', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  private async showUserInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Could not find that member.', ephemeral: true });
      return;
    }

    const roles = member.roles.cache.filter(r => r.id !== interaction.guild!.id).sort((a, b) => b.position - a.position);

    const embed = new EmbedBuilder()
      .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(member.displayHexColor || EMBED_COLORS.primary)
      .addFields(
        { name: '📋 ID', value: targetUser.id, inline: true },
        { name: '📛 Nickname', value: member.nickname || 'None', inline: true },
        { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: '📅 Joined Server', value: `<t:${Math.floor((member.joinedAt?.getTime() || 0) / 1000)}:R>`, inline: true },
        { name: '📅 Joined Discord', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        { name: `🎭 Roles (${roles.size})`, value: roles.size > 0 ? roles.map(r => r.toString()).slice(0, 10).join(', ') : 'None', inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  private async showAvatar(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const size = parseInt(interaction.options.getString('size') || '1024') as 128 | 256 | 512 | 1024 | 2048;

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Avatar`)
      .setImage(targetUser.displayAvatarURL({ size }))
      .setColor(EMBED_COLORS.primary);

    await interaction.reply({ embeds: [embed] });
  }

  private async showBanner(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const user = await targetUser.fetch();

    if (!user.banner) {
      await interaction.reply({ content: `${targetUser.username} does not have a banner.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Banner`)
      .setImage(user.bannerURL({ size: 1024 }) || null)
      .setColor(EMBED_COLORS.primary);

    await interaction.reply({ embeds: [embed] });
  }

  private async showRoleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('role', true) as any;

    const embed = new EmbedBuilder()
      .setTitle(`🎭 Role: ${role.name}`)
      .setColor(role.color || EMBED_COLORS.primary)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor || role.color?.toString(16) || 'None', inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Members', value: `${role.members?.size ?? 0}`, inline: true },
        { name: 'Permissions', value: (typeof role.permissions === 'object' && role.permissions.toArray ? role.permissions.toArray() : []).slice(0, 15).join(', ') || 'None', inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  private async showEmojiInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    const emojiInput = interaction.options.getString('emoji', true);
    const emojiMatch = emojiInput.match(/<?(a)?:?(\w+):(\d+)>/);

    if (!emojiMatch) {
      await interaction.reply({ content: 'Please provide a custom emoji from this server.', ephemeral: true });
      return;
    }

    const isAnimated = emojiMatch[1] === 'a';
    const emojiName = emojiMatch[2];
    const emojiId = emojiMatch[3];
    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;

    const embed = new EmbedBuilder()
      .setTitle(`😃 Emoji: ${emojiName}`)
      .setThumbnail(emojiUrl)
      .addFields(
        { name: 'ID', value: emojiId, inline: true },
        { name: 'Name', value: emojiName, inline: true },
        { name: 'Animated', value: isAnimated ? 'Yes' : 'No', inline: true }
      )
      .setImage(emojiUrl)
      .setColor(EMBED_COLORS.primary);

    await interaction.reply({ embeds: [embed] });
  }

  private async createQuickPoll(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased()) {
      await interaction.reply({ content: 'This command can only be used in a text channel.', ephemeral: true });
      return;
    }

    const question = interaction.options.getString('question', true);

    const embed = new EmbedBuilder()
      .setTitle('📊 Quick Poll')
      .setDescription(question)
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: `Poll by ${interaction.user.username}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('✅');
    await message.react('❌');
  }

  private async setReminder(interaction: ChatInputCommandInteraction): Promise<void> {
    const duration = interaction.options.getString('duration', true);
    const message = interaction.options.getString('message', true);

    const ms = this.parseDuration(duration);
    if (!ms || ms > 86400000 * 7) {
      await interaction.reply({ content: 'Invalid duration. Use format like 10m, 1h, 1d (max 7 days).', ephemeral: true });
      return;
    }

    const endTime = Date.now() + ms;

    const embed = new EmbedBuilder()
      .setTitle('⏰ Reminder Set')
      .setDescription(`I will remind you about **${message}** <t:${Math.floor(endTime / 1000)}:R>`)
      .setColor(EMBED_COLORS.success);

    await interaction.reply({ embeds: [embed] });

    setTimeout(async () => {
      try {
        const reminderEmbed = new EmbedBuilder()
          .setTitle('⏰ Reminder')
          .setDescription(message)
          .setColor(EMBED_COLORS.info);
        await interaction.user.send({ embeds: [reminderEmbed] });
      } catch {
        if (interaction.channel && 'send' in interaction.channel) {
          await (interaction.channel as any).send({ content: `${interaction.user}, reminder: **${message}**` });
        }
      }
    }, ms);
  }

  private async calculate(interaction: ChatInputCommandInteraction): Promise<void> {
    const expression = interaction.options.getString('expression', true);

    const sanitized = expression.replace(/[^0-9+\-*/.()^% ]/g, '');
    if (!sanitized) {
      await interaction.reply({ content: 'Invalid expression.', ephemeral: true });
      return;
    }

    try {
      const result = Function(`'use strict'; return (${sanitized})`)();

      if (typeof result !== 'number' || !isFinite(result)) {
        await interaction.reply({ content: 'Invalid calculation result.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🧮 Calculator')
        .addFields(
          { name: 'Expression', value: `\`${sanitized}\``, inline: false },
          { name: 'Result', value: `**${result}**`, inline: false }
        )
        .setColor(EMBED_COLORS.primary);

      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({ content: 'Invalid mathematical expression.', ephemeral: true });
    }
  }

  private async setAFK(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') || 'AFK';

    this.afkUsers.set(`${interaction.guild.id}:${interaction.user.id}`, {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      reason,
      since: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('💤 AFK Set')
      .setDescription(`You are now AFK: **${reason}**\nI will remove your AFK when you send a message.`)
      .setColor(EMBED_COLORS.info);

    await interaction.reply({ embeds: [embed] });
  }

  private async handleAFKCheck(message: any): Promise<void> {
    if (!message.guild) return;

    const key = `${message.guild.id}:${message.author.id}`;

    if (this.afkUsers.has(key)) {
      this.afkUsers.delete(key);
      const embed = new EmbedBuilder()
        .setTitle('👋 Welcome Back!')
        .setDescription('Your AFK status has been removed.')
        .setColor(EMBED_COLORS.success);
      await message.channel.send({ content: `${message.author}`, embeds: [embed] });
      return;
    }

    for (const [mentionKey, entry] of this.afkUsers) {
      if (entry.guildId !== message.guild.id) continue;
      if (message.mentions.users.has(entry.userId)) {
        const timeAgo = Math.floor((Date.now() - entry.since) / 60000);
        const embed = new EmbedBuilder()
          .setTitle('💤 AFK')
          .setDescription(`**<@${entry.userId}>** is AFK: **${entry.reason}** (${timeAgo}m ago)`)
          .setColor(EMBED_COLORS.warning);
        await message.channel.send({ embeds: [embed] });
        break;
      }
    }
  }

  private async translate(interaction: ChatInputCommandInteraction): Promise<void> {
    const text = interaction.options.getString('text', true);

    const embed = new EmbedBuilder()
      .setTitle('🌐 Translation (Mock)')
      .setDescription(`Original: **${text}**\n\n> Note: This is a basic version. Full translation requires an API key.`)
      .addFields(
        { name: 'Detected Language', value: 'English (auto-detected)', inline: true },
        { name: 'Result', value: `[${text}]`, inline: true }
      )
      .setColor(EMBED_COLORS.info)
      .setFooter({ text: 'Utility System' });

    await interaction.reply({ embeds: [embed] });
  }

  private parseDuration(duration: string): number | null {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 0);
  }
}
