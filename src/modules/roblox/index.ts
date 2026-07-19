import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { EMBED_COLORS } from '../../config';

export class RobloxModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Roblox Hub',
    description: 'Roblox integration - users, games, groups, trading',
    version: '1.0.0',
    enabled: true,
    commands: ['roblox'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('roblox')
        .setDescription('Roblox commands')
        .addSubcommand(sub =>
          sub.setName('user')
            .setDescription('Get Roblox user info')
            .addStringOption(opt => opt.setName('username').setDescription('Roblox username').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('game')
            .setDescription('Get Roblox game info')
            .addStringOption(opt => opt.setName('id').setDescription('Game/Universe ID').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('group')
            .setDescription('Get Roblox group info')
            .addStringOption(opt => opt.setName('id').setDescription('Group ID').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('avatar')
            .setDescription('Get Roblox user avatar')
            .addStringOption(opt => opt.setName('username').setDescription('Roblox username').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('badges')
            .setDescription('Get Roblox user badges')
            .addStringOption(opt => opt.setName('username').setDescription('Roblox username').setRequired(true))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        switch (sub) {
          case 'user': await this.getUser(interaction); break;
          case 'game': await this.getGame(interaction); break;
          case 'group': await this.getGroup(interaction); break;
          case 'avatar': await this.getAvatar(interaction); break;
          case 'badges': await this.getBadges(interaction); break;
        }
      }
    });
  }

  private async getUser(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const username = interaction.options.getString('username', true);
    const api = (this.client as PawRBClient).api;
    const search = await api.robloxSearchUser(username);
    if (!search?.data?.length) {
      await interaction.editReply({ content: 'User not found.' });
      return;
    }
    const user = search.data[0];
    const presence = await api.robloxFetchPresence([user.id]);

    const embed = new EmbedBuilder()
      .setTitle(`${user.displayName || user.name}`)
      .setURL(`https://www.roblox.com/users/${user.id}/profile`)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.id}&width=420&height=420&format=png`)
      .addFields(
        { name: 'Username', value: user.name, inline: true },
        { name: 'User ID', value: String(user.id), inline: true },
        { name: 'Status', value: presence?.userPresences?.[0]?.userPresenceType === 2 ? '🟢 Online' : '🔴 Offline', inline: true }
      )
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Roblox Hub' });
    await interaction.editReply({ embeds: [embed] });
  }

  private async getGame(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const id = parseInt(interaction.options.getString('id', true));
    const api = (this.client as PawRBClient).api;
    const game = await api.robloxFetchGame(id);
    if (!game) {
      await interaction.editReply({ content: 'Game not found.' });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle(game.name || 'Unknown Game')
      .setDescription(game.description || 'No description')
      .addFields(
        { name: 'ID', value: String(id), inline: true },
        { name: 'Creator', value: game.creator?.name || 'Unknown', inline: true }
      )
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Roblox Hub' });
    await interaction.editReply({ embeds: [embed] });
  }

  private async getGroup(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const id = parseInt(interaction.options.getString('id', true));
    const api = (this.client as PawRBClient).api;
    const group = await api.robloxFetchGroup(id);
    if (!group) {
      await interaction.editReply({ content: 'Group not found.' });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle(group.name || 'Unknown Group')
      .setDescription(group.description || 'No description')
      .addFields(
        { name: 'ID', value: String(id), inline: true },
        { name: 'Members', value: String(group.memberCount || 0), inline: true },
        { name: 'Owner', value: group.owner?.username || 'Unknown', inline: true }
      )
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Roblox Hub' });
    await interaction.editReply({ embeds: [embed] });
  }

  private async getAvatar(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const username = interaction.options.getString('username', true);
    const api = (this.client as PawRBClient).api;
    const search = await api.robloxSearchUser(username);
    if (!search?.data?.length) {
      await interaction.editReply({ content: 'User not found.' });
      return;
    }
    const user = search.data[0];
    const embed = new EmbedBuilder()
      .setTitle(`${user.name}'s Avatar`)
      .setImage(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.id}&width=720&height=720&format=png`)
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Roblox Hub' });
    await interaction.editReply({ embeds: [embed] });
  }

  private async getBadges(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const username = interaction.options.getString('username', true);
    const api = (this.client as PawRBClient).api;
    const search = await api.robloxSearchUser(username);
    if (!search?.data?.length) {
      await interaction.editReply({ content: 'User not found.' });
      return;
    }
    const user = search.data[0];
    const badges = await api.robloxFetchBadges(user.id);
    const badgeList = badges?.data?.slice(0, 20).map((b: any) => `• ${b.name}`).join('\n') || 'No badges';
    const embed = new EmbedBuilder()
      .setTitle(`${user.name}'s Badges`)
      .setDescription(badgeList)
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Roblox Hub' });
    await interaction.editReply({ embeds: [embed] });
  }
}
