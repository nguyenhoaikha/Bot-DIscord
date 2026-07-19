import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

interface MemberHistoryEntry {
  date: string;
  total: number;
  joined: number;
  left: number;
}

export class MembersModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Members',
    description: 'Member management with invite tracking, birthdays, and history',
    version: '1.0.0',
    enabled: true,
    commands: ['invites', 'birthday', 'membercount', 'memberhistory'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Check invite stats')
        .addSubcommand(sub => sub
          .setName('mine')
          .setDescription('Check your invite count'))
        .addSubcommand(sub => sub
          .setName('top')
          .setDescription('Show top inviters'))
        .addSubcommand(sub => sub
          .setName('user')
          .setDescription('Check a user\'s invite count')
          .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'mine') await this.myInvites(interaction);
        else if (sub === 'top') await this.topInviters(interaction);
        else if (sub === 'user') await this.userInvites(interaction);
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Manage birthdays')
        .addSubcommand(sub => sub
          .setName('set')
          .setDescription('Set your birthday')
          .addStringOption(opt => opt.setName('date').setDescription('Your birthday (DD/MM or DD/MM/YYYY)').setRequired(true)))
        .addSubcommand(sub => sub
          .setName('list')
          .setDescription('Show upcoming birthdays')),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'set') await this.setBirthday(interaction);
        else if (sub === 'list') await this.listBirthdays(interaction);
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Show member count'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.memberCount(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('memberhistory')
        .setDescription('Show member join/leave history for this month'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.memberHistory(interaction); }
    });
  }

  private async myInvites(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const invites = await interaction.guild.invites.fetch();
      const userInvites = invites.filter(i => i.inviter?.id === interaction.user.id);
      const totalUses = userInvites.reduce((sum, i) => sum + (i.uses || 0), 0);

      const embed = new EmbedBuilder()
        .setTitle('📨 Your Invites')
        .setDescription(`Total invites: **${totalUses}**`)
        .setColor(EMBED_COLORS.primary)
        .setTimestamp();

      if (userInvites.size > 0) {
        embed.addFields({ name: 'Invite Codes', value: userInvites.map(i => `\`${i.code}\` — ${i.uses} uses`).join('\n'), inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to get invites', error as Error);
      await interaction.reply({ content: 'Failed to fetch invites.', ephemeral: true });
    }
  }

  private async topInviters(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const invites = await interaction.guild.invites.fetch();
      const inviterMap = new Map<string, number>();

      for (const [, invite] of invites) {
        if (invite.inviter) {
          const current = inviterMap.get(invite.inviter.id) || 0;
          inviterMap.set(invite.inviter.id, current + (invite.uses || 0));
        }
      }

      const sorted = [...inviterMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

      if (sorted.length === 0) {
        await interaction.reply({ content: 'No invite data available.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📨 Top Inviters')
        .setColor(EMBED_COLORS.primary)
        .setDescription(sorted.map(([userId, count], i) =>
          `**${i + 1}.** <@${userId}> — **${count}** invites`
        ).join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to get top inviters', error as Error);
      await interaction.reply({ content: 'Failed to fetch invites.', ephemeral: true });
    }
  }

  private async userInvites(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);

    try {
      const invites = await interaction.guild.invites.fetch();
      const userInvites = invites.filter(i => i.inviter?.id === targetUser.id);
      const totalUses = userInvites.reduce((sum, i) => sum + (i.uses || 0), 0);

      const embed = new EmbedBuilder()
        .setTitle(`📨 Invites: ${targetUser.username}`)
        .setDescription(`Total invites: **${totalUses}**`)
        .setColor(EMBED_COLORS.primary)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to get user invites', error as Error);
      await interaction.reply({ content: 'Failed to fetch invites.', ephemeral: true });
    }
  }

  private async setBirthday(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const dateStr = interaction.options.getString('date', true);

    const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!dateMatch) {
      await interaction.reply({ content: 'Invalid date format. Use DD/MM (e.g., 25/12) or DD/MM/YYYY.', ephemeral: true });
      return;
    }

    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);

    if (day < 1 || day > 31 || month < 1 || month > 12) {
      await interaction.reply({ content: 'Invalid date. Day must be 1-31, month must be 1-12.', ephemeral: true });
      return;
    }

    const formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

    try {
      const db = Database.getInstance();
      await db.models.Birthday.upsert({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        date: `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timezone: 'UTC'
      });

      const embed = new EmbedBuilder()
        .setTitle('🎂 Birthday Set!')
        .setDescription(`Your birthday is set to **${formattedDate}**`)
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to set birthday', error as Error);
      await interaction.reply({ content: 'Failed to set birthday.', ephemeral: true });
    }
  }

  private async listBirthdays(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const db = Database.getInstance();
      const allBirthdays = await db.models.Birthday.findAll({
        where: { guildId: interaction.guild.id }
      });

      if (allBirthdays.length === 0) {
        await interaction.reply({ content: 'No birthdays set.', ephemeral: true });
        return;
      }

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();

      const birthdaysWithDates = allBirthdays.map((b: any) => {
        const dateStr = b.get('date') as string;
        const date = new Date(dateStr);
        return {
          userId: b.get('userId') as string,
          month: date.getMonth() + 1,
          day: date.getDate(),
          fullDate: date
        };
      });

      const upcoming = birthdaysWithDates
        .filter(b => b.month > currentMonth || (b.month === currentMonth && b.day >= currentDay))
        .sort((a, b) => a.month - b.month || a.day - b.day)
        .slice(0, 10);

      const past = birthdaysWithDates
        .filter(b => b.month < currentMonth || (b.month === currentMonth && b.day < currentDay))
        .sort((a, b) => a.month - b.month || a.day - b.day)
        .slice(0, 5);

      const embed = new EmbedBuilder()
        .setTitle('🎂 Birthdays')
        .setColor(EMBED_COLORS.primary);

      if (upcoming.length > 0) {
        embed.addFields({
          name: '📅 Upcoming Birthdays',
          value: upcoming.map(b => `<@${b.userId}> — ${String(b.day).padStart(2, '0')}/${String(b.month).padStart(2, '0')}`).join('\n'),
          inline: false
        });
      }

      if (past.length > 0) {
        embed.addFields({
          name: '📅 Past Birthdays (This Year)',
          value: past.map(b => `<@${b.userId}> — ${String(b.day).padStart(2, '0')}/${String(b.month).padStart(2, '0')}`).join('\n'),
          inline: false
        });
      }

      embed.setFooter({ text: `Total: ${allBirthdays.length} registered` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to list birthdays', error as Error);
      await interaction.reply({ content: 'Failed to list birthdays.', ephemeral: true });
    }
  }

  private async memberCount(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const members = await interaction.guild.members.fetch();
      const total = members.size;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;

      const embed = new EmbedBuilder()
        .setTitle('👥 Member Count')
        .setColor(EMBED_COLORS.info)
        .addFields(
          { name: 'Total', value: `${total}`, inline: true },
          { name: 'Humans', value: `${humans}`, inline: true },
          { name: 'Bots', value: `${bots}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to get member count', error as Error);
      await interaction.reply({ content: 'Failed to fetch member count.', ephemeral: true });
    }
  }

  private async memberHistory(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const auditLogs = await interaction.guild.fetchAuditLogs({
        limit: 50
      });

      const joinEntries = auditLogs.entries.filter(e =>
        e.action === 1 && e.createdAt >= firstOfMonth
      );
      const kickEntries = auditLogs.entries.filter(e =>
        (e.action === 20 || e.action === 22) && e.createdAt >= firstOfMonth
      );

      const members = await interaction.guild.members.fetch();
      const joinedThisMonth = members.filter(m => m.joinedAt && m.joinedAt >= firstOfMonth);

      const embed = new EmbedBuilder()
        .setTitle('📊 Member History')
        .setDescription(`Statistics for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`)
        .setColor(EMBED_COLORS.primary)
        .addFields(
          { name: 'Current Members', value: `${members.size}`, inline: true },
          { name: 'Joined This Month', value: `${joinedThisMonth.size}`, inline: true },
          { name: 'Left/Kicked', value: `${kickEntries.size}`, inline: true },
          { name: 'Net Growth', value: `${joinedThisMonth.size - kickEntries.size >= 0 ? '+' : ''}${joinedThisMonth.size - kickEntries.size}`, inline: true }
        )
        .setFooter({ text: `Tracking since ${firstOfMonth.toLocaleDateString()}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to get member history', error as Error);
      await interaction.reply({ content: 'Failed to fetch member history.', ephemeral: true });
    }
  }
}
