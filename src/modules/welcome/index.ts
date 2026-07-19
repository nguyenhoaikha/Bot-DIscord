import { Client, EmbedBuilder as DiscordEmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, Message, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { ConfigManager } from '../../core/ConfigManager';
import { EMBED_COLORS } from '../../config';
import { Emojis } from '../../constants/emojis';
import * as embed from '../../utils/embedBuilder';

const WELCOME_GIF = 'https://cdn.discordapp.com/attachments/1525134686710534199/1525147172147036200/233b35a28289a15473f5acb298a34aa4.gif';

const VARIABLES_MAP: Record<string, (m: any) => string> = {
  '{member}': (m) => m.toString(),
  '{user}': (m) => `<@${m.user.id}>`,
  '{username}': (m) => m.user.username,
  '{server}': (m) => m.guild?.name || '',
  '{memberCount}': (m) => String(m.guild?.memberCount || ''),
  '{avatar}': (m) => m.user.displayAvatarURL(),
};

function replaceVars(text: string, member: any): string {
  if (!text) return '';
  let r = text;
  for (const [k, fn] of Object.entries(VARIABLES_MAP)) {
    r = r.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), fn(member));
  }
  return r;
}

function buildWelcomeEmbed(member: any, config: any): EmbedBuilder {
  const title = config.welcomeEmbedTitle || `${Emojis.welcome} Chào mừng đến với ${member.guild?.name || 'server'}!`;
  const description = config.welcomeMessage || `${Emojis.hypershiny} Chào mừng {member} đến với **{server}**! Rất vui được chào đón bạn. ${Emojis.arrowr} Hãy khám phá cộng đồng Roblox nhé!`;
  const color: any = config.welcomeEmbedColor || EMBED_COLORS.primary;

  const e = new DiscordEmbedBuilder().setColor(color as any);
  const rTitle = replaceVars(title, member);
  const rDesc = replaceVars(description, member);
  if (rTitle) e.setTitle(rTitle);
  if (rDesc) e.setDescription(rDesc);
  if (!rTitle && !rDesc) e.setDescription('\u200B');

  e.setThumbnail(member.user.displayAvatarURL({ size: 1024 }));
  e.setImage(WELCOME_GIF);
  e.setTimestamp();

  const footer = config.welcomeEmbedFooterText || member.guild?.name || '';
  e.setFooter({ text: replaceVars(footer, member), iconURL: config.welcomeEmbedFooterIcon || WELCOME_GIF });

  if (config.welcomeEmbedAuthorName) e.setAuthor({ name: replaceVars(config.welcomeEmbedAuthorName, member), iconURL: config.welcomeEmbedAuthorIcon || undefined });

  return e;
}

function buildButtonRows(config: any): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  try {
    const raw = JSON.parse(config.welcomeButtons || '[]') as any[];
    if (raw.length === 0) return rows;
    let row = new ActionRowBuilder<ButtonBuilder>();
    let count = 0;
    for (const b of raw) {
      if (b.style === 'LINK') {
        const btn = new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.url || 'https://discord.com');
        if (b.emoji) btn.setEmoji(b.emoji);
        row.addComponents(btn);
      } else {
        const btn = new ButtonBuilder().setCustomId(`wb_${b.id}`).setLabel(b.label).setStyle(ButtonStyle[b.style as keyof typeof ButtonStyle] as any).setDisabled(b.disabled);
        if (b.emoji) btn.setEmoji(b.emoji);
        row.addComponents(btn);
      }
      count++;
      if (count >= 5) { rows.push(row); row = new ActionRowBuilder<ButtonBuilder>(); count = 0; }
    }
    if (count > 0) rows.push(row);
  } catch { }
  return rows;
}

export function buildWelcomeEmbedForMember(member: any, config: any): DiscordEmbedBuilder {
  return buildWelcomeEmbed(member, config);
}

export function buildWelcomeButtonRows(config: any): ActionRowBuilder<ButtonBuilder>[] {
  return buildButtonRows(config);
}

export class WelcomeModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Welcome',
    description: 'Hệ thống chào mừng thành viên mới',
    version: '1.0.0',
    enabled: true,
    commands: ['welcome', 'setwelcome'],
    events: ['guildMemberAdd'],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Quản lý tin nhắn chào mừng')
        .addSubcommand(sub => sub.setName('test').setDescription('Xem trước nội dung chào mừng hiện tại'))
        .addSubcommand(sub => sub.setName('status').setDescription('Xem trạng thái hệ thống chào mừng'))
        .addSubcommand(sub =>
          sub.setName('set').setDescription('Thay đổi nội dung chào mừng')
            .addStringOption(opt => opt.setName('tieu_de').setDescription('Tiêu đề embed').setRequired(false))
            .addStringOption(opt => opt.setName('noi_dung').setDescription('Nội dung embed (dùng {member}, {server}, {username})').setRequired(false))
            .addStringOption(opt => opt.setName('banner').setDescription('URL ảnh banner').setRequired(false))
            .addStringOption(opt => opt.setName('mau_sac').setDescription('Màu sắc (VD: #6366F1 hoặc xanh, đỏ, tím)').setRequired(false))
        )
        .addSubcommand(sub => sub.setName('reset').setDescription('Khôi phục nội dung chào mừng mặc định'))
        .addSubcommand(sub =>
          sub.setName('setrole').setDescription('Cài đặt role tự động cấp cho thành viên mới')
            .addRoleOption(opt => opt.setName('role').setDescription('Role sẽ tự động cấp').setRequired(true))
        ),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        switch (sub) {
          case 'test': await this.testWelcome(interaction); break;
          case 'status': await this.showStatus(interaction); break;
          case 'set': await this.setWelcome(interaction); break;
          case 'reset': await this.resetWelcome(interaction); break;
          case 'setrole': await this.setAutoRole(interaction); break;
        }
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Cấu hình kênh chào mừng')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh chào mừng').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.configureChannel(interaction);
      }
    });
  }

  private async testWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
    const welcomeEmbed = buildWelcomeEmbed(interaction.member, config);
    const rows = buildButtonRows(config);

    const opts: any = { embeds: [welcomeEmbed] };
    if (rows.length > 0) opts.components = rows;
    await interaction.editReply(opts);

    await interaction.followUp({
      content: '💡 **Đây là bản xem trước.** Khi có người thực sự join, nội dung sẽ giống hệt như trên.',
      ephemeral: true
    }).catch(() => { });
  }

  private async showStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
    const statusEmbed = embed.base({
      title: `${Emojis.loading} Trạng thái hệ thống chào mừng`,
      fields: [
        { name: `${Emojis.pinkverified} Đã bật`, value: config.welcomeEnabled ? `${Emojis.hypershiny} BẬT` : `${Emojis.Letter_X} TẮT`, inline: true },
        { name: `${Emojis.arrowr} Kênh`, value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Chưa đặt', inline: true },
        { name: `${Emojis.hypershiny} Tin nhắn`, value: config.welcomeMessage ? 'Tùy chỉnh' : 'Mặc định', inline: true },
        { name: `${Emojis.alert} Auto role`, value: config.memberRole ? `<@&${config.memberRole}>` : 'Chưa đặt', inline: true },
      ],
      color: EMBED_COLORS.info,
    });
    await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
  }

  private async setWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const tieuDe = interaction.options.getString('tieu_de');
    const noiDung = interaction.options.getString('noi_dung');
    const banner = interaction.options.getString('banner');
    const mauSac = interaction.options.getString('mau_sac');

    const updates: Record<string, any> = {};
    if (tieuDe) updates.welcomeEmbedTitle = tieuDe;
    if (noiDung) updates.welcomeMessage = noiDung;
    if (banner) updates.welcomeEmbedImage = banner;
    if (mauSac) {
      const colorMap: Record<string, string> = {
        'xanh': '#6366F1', 'đỏ': '#EF4444', 'tím': '#8B5CF6',
        'hồng': '#EC4899', 'cam': '#F97316', 'vàng': '#EAB308',
        'lục': '#22C55E', 'xám': '#6B7280', 'đen': '#111827',
        'trắng': '#FFFFFF',
      };
      updates.welcomeEmbedColor = colorMap[mauSac.toLowerCase()] || mauSac;
    }

    await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, updates);

    const changed = Object.entries(updates).map(([key, val]) => ({
      name: key,
      value: String(val).substring(0, 100),
      inline: true,
    }));

    await interaction.reply({
      embeds: [embed.success('✅ Đã cập nhật', 'Nội dung chào mừng đã được cập nhật!', changed)],
      ephemeral: true,
    });
  }

  private async resetWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, {
      welcomeEmbedTitle: '',
      welcomeMessage: '',
      welcomeEmbedColor: undefined,
      welcomeEmbedImage: undefined,
      welcomeEmbedFooterText: '',
      welcomeEmbedFooterIcon: '',
      welcomeEmbedAuthorName: '',
      welcomeEmbedAuthorIcon: '',
      welcomeEmbedThumbnail: '',
      welcomeButtons: '[]',
    });
    await interaction.reply({
      embeds: [embed.success('↩ Đã khôi phục', 'Nội dung chào mừng đã được khôi phục về mặc định.')],
      ephemeral: true,
    });
  }

  private async setAutoRole(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const role = interaction.options.getRole('role', true);
    await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, { memberRole: role.id });
    await interaction.reply({
      embeds: [embed.success('✅ Đã cài đặt', `Role **${role.name}** sẽ tự động được cấp cho thành viên mới.`, [
        { name: 'Role', value: role.toString(), inline: true },
        { name: 'ID', value: `\`${role.id}\``, inline: true },
      ])],
      ephemeral: true,
    });
  }

  private async configureChannel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const channel = interaction.options.getChannel('channel', true);
    await ConfigManager.getInstance().updateGuildConfig(interaction.guild.id, {
      welcomeChannel: channel.id,
      welcomeEnabled: true,
    });
    await interaction.reply({
      embeds: [embed.success('✅ Đã cấu hình', `Kênh chào mừng đã được đặt tại <#${channel.id}>.`, [
        { name: `${Emojis.arrowr} Kênh`, value: `<#${channel.id}>`, inline: true },
        { name: `${Emojis.pinkverified} Trạng thái`, value: `${Emojis.hypershiny} Đã bật`, inline: true },
      ])],
      ephemeral: true,
    });
  }
}
