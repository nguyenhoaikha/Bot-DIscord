import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, ChannelType, Role, GuildChannel, Message, PermissionFlagsBits } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS, FOOTER_TEXT } from '../../config';
import { EventHandler, BotEvent } from '../../core/EventHandler';

export class RolesModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Role Management',
    description: 'Reaction roles, button roles, dropdown roles, color roles, temporary roles',
    version: '1.0.0',
    enabled: true,
    commands: ['rolepanel', 'reactionrole', 'buttonrole', 'droprole', 'temprole', 'giverole', 'removerole'],
    events: ['messageReactionAdd', 'messageReactionRemove'],
    dependencies: ['Core']
  };

  private tempRoleTimers: Map<string, NodeJS.Timeout> = new Map();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('rolepanel').setDescription('Create role selection panel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createRolePanel(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('giverole').setDescription('Give a role to a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
        const user = interaction.options.getUser('user', true);
        const role = interaction.options.getRole('role', true) as Role;
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(role.id);
        await interaction.reply({ content: `✅ Đã thêm role ${role.name} cho ${user.username}`, ephemeral: true });
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('removerole').setDescription('Remove a role from a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
        const user = interaction.options.getUser('user', true);
        const role = interaction.options.getRole('role', true) as Role;
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.remove(role.id);
        await interaction.reply({ content: `✅ Đã xóa role ${role.name} khỏi ${user.username}`, ephemeral: true });
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('reactionrole').setDescription('Create a reaction role message')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji for reaction').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createReactionRole(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('buttonrole').setDescription('Create a button role panel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Button label').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Button emoji').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createButtonRole(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('droprole').setDescription('Create a dropdown role panel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(opt => opt.setName('role1').setDescription('Role option 1').setRequired(true))
        .addRoleOption(opt => opt.setName('role2').setDescription('Role option 2').setRequired(false))
        .addRoleOption(opt => opt.setName('role3').setDescription('Role option 3').setRequired(false))
        .addRoleOption(opt => opt.setName('role4').setDescription('Role option 4').setRequired(false))
        .addRoleOption(opt => opt.setName('role5').setDescription('Role option 5').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createDropdownRole(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('temprole').setDescription('Assign a temporary role to a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createTemporaryRole(interaction); }
    });

    pawClient.components.registerSelectMenu('role_assign', async (interaction) => {
      if (!interaction.guild || !interaction.member) return;
      const member = interaction.member as any;
      const selectedRoles = interaction.values;
      await member.roles.set(selectedRoles);
      await interaction.reply({ content: '✅ Roles updated!', ephemeral: true });
    });

    pawClient.components.registerButton('btn_role_assign', async (interaction) => {
      if (!interaction.guild || !interaction.member) return;
      const member = interaction.member as any;
      const roleId = interaction.customId.replace('btn_role_assign_', '');
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.reply({ content: '✅ Role đã được gỡ bỏ.', ephemeral: true });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({ content: '✅ Role đã được thêm.', ephemeral: true });
      }
    });

    // Register reaction role events
    const eventHandler = EventHandler.getInstance();
    eventHandler.register({
      name: 'messageReactionAdd',
      execute: async (reaction: any, user: any) => {
        if (user.bot || !reaction.message.guild) return;
        const db = Database.getInstance();
        const rr = await db.models.ReactionRole.findOne({
          where: { channelId: reaction.message.channel.id, messageId: reaction.message.id, emoji: reaction.emoji.name || reaction.emoji.id }
        });
        if (rr) {
          const member = await reaction.message.guild.members.fetch(user.id);
          if (member) await member.roles.add(rr.get('roleId') as string);
        }
      }
    } as BotEvent);

    eventHandler.register({
      name: 'messageReactionRemove',
      execute: async (reaction: any, user: any) => {
        if (user.bot || !reaction.message.guild) return;
        const db = Database.getInstance();
        const rr = await db.models.ReactionRole.findOne({
          where: { channelId: reaction.message.channel.id, messageId: reaction.message.id, emoji: reaction.emoji.name || reaction.emoji.id }
        });
        if (rr) {
          const member = await reaction.message.guild.members.fetch(user.id);
          if (member) await member.roles.remove(rr.get('roleId') as string);
        }
      }
    } as BotEvent);
  }

  private async createRolePanel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
    const channel = interaction.options.getChannel('channel', true);
    const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild?.id).sort((a, b) => b.position - a.position).first(25);

    if (!roles.length) {
      await interaction.reply({ content: 'Không có role nào khả dụng.', ephemeral: true });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('role_assign')
      .setPlaceholder('Chọn role để gán')
      .setMinValues(1)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id))
      );

    const embed = new EmbedBuilder()
      .setTitle('🎭 Chọn Role')
      .setDescription('Chọn role của bạn từ menu bên dưới.')
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Role Selection System' });

    if (channel instanceof TextChannel) {
      await channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)]
      });
    }
    await interaction.reply({ content: '✅ Role panel đã được tạo!', ephemeral: true });
  }

  private async createReactionRole(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true) as Role;
    const emoji = interaction.options.getString('emoji', true);

    if (!(channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Kênh không hợp lệ.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎯 Reaction Role')
      .setDescription(`React với ${emoji} để nhận role **${role.name}**`)
      .setColor(EMBED_COLORS.primary);

    const msg = await channel.send({ embeds: [embed] });
    await msg.react(emoji);

    const db = Database.getInstance();
    await db.models.ReactionRole.create({
      guildId: interaction.guild.id,
      channelId: channel.id,
      messageId: msg.id,
      roleId: role.id,
      emoji,
      type: 'reaction'
    });

    await interaction.reply({ content: `✅ Reaction role đã được tạo tại ${channel}`, ephemeral: true });
  }

  private async createButtonRole(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true) as Role;
    const label = interaction.options.getString('label', true);
    const emoji = interaction.options.getString('emoji');

    if (!(channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Kênh không hợp lệ.', ephemeral: true });
      return;
    }

    const btn = new ButtonBuilder()
      .setCustomId(`btn_role_assign_${role.id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);
    if (emoji) btn.setEmoji(emoji);

    const embed = new EmbedBuilder()
      .setTitle('🔘 Button Role')
      .setDescription(`Nhấn nút bên dưới để nhận/gỡ role **${role.name}**`)
      .setColor(EMBED_COLORS.primary);

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)]
    });

    await interaction.reply({ content: `✅ Button role đã được tạo tại ${channel}`, ephemeral: true });
  }

  private async createDropdownRole(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
    const channel = interaction.options.getChannel('channel', true);
    const roleIds = [1, 2, 3, 4, 5].map(i => interaction.options.getRole(`role${i}`)).filter((r): r is Role => r !== null);

    if (!(channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Kênh không hợp lệ.', ephemeral: true });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('role_assign')
      .setPlaceholder('Chọn một role')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        roleIds.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id))
      );

    const embed = new EmbedBuilder()
      .setTitle('📋 Dropdown Role')
      .setDescription('Chọn role từ menu bên dưới.')
      .setColor(EMBED_COLORS.primary);

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)]
    });

    await interaction.reply({ content: `✅ Dropdown role đã được tạo tại ${channel}`, ephemeral: true });
  }

  private async createTemporaryRole(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) { await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true }); return; }
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true) as Role;
    const durationStr = interaction.options.getString('duration', true);

    const match = durationStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      await interaction.reply({ content: 'Thời gian không hợp lệ. Sử dụng định dạng như 10m, 1h, 1d.', ephemeral: true });
      return;
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const durationMs = value * (multipliers[unit] || 0);

    const member = await interaction.guild.members.fetch(user.id);
    await member.roles.add(role.id);

    const timerKey = `${interaction.guild.id}_${user.id}_${role.id}`;
    const existing = this.tempRoleTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        const m = await interaction.guild!.members.fetch(user.id).catch(() => null);
        if (m) await m.roles.remove(role.id);
      } catch {}
      this.tempRoleTimers.delete(timerKey);
    }, durationMs);

    this.tempRoleTimers.set(timerKey, timer);

    await interaction.reply({
      content: `✅ Đã gán role **${role.name}** cho ${user.username} trong **${durationStr}**.`,
      ephemeral: true
    });
  }
}
