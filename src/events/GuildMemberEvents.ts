import { GuildMember, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotEvent } from '../core/EventHandler';
import { ConfigManager } from '../core/ConfigManager';
import { EMBED_COLORS } from '../config';
import { Emojis } from '../constants/emojis';

const WELCOME_GIF = 'https://cdn.discordapp.com/attachments/1525134686710534199/1525147172147036200/233b35a28289a15473f5acb298a34aa4.gif';

const VARIABLES_MAP: Record<string, (member: GuildMember) => string> = {
  '{member}': (m) => m.toString(),
  '{user}': (m) => `<@${m.id}>`,
  '{username}': (m) => m.user.username,
  '{server}': (m) => m.guild.name,
  '{memberCount}': (m) => String(m.guild.memberCount),
  '{avatar}': (m) => m.user.displayAvatarURL(),
  '{joinedAt}': (m) => `<t:${Math.floor((m.joinedTimestamp || Date.now()) / 1000)}:R>`,
  '{boostCount}': (m) => String(m.guild.premiumSubscriptionCount || 0),
};

function replaceVars(text: string, member: GuildMember): string {
  if (!text) return '';
  let r = text;
  for (const [k, fn] of Object.entries(VARIABLES_MAP)) {
    r = r.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), fn(member));
  }
  return r;
}

function buildWelcomeEmbed(guildConfig: any, member: GuildMember): EmbedBuilder {
  const title = guildConfig.welcomeEmbedTitle || `${Emojis.welcome} Chào mừng đến với {server}!`;
  const description = guildConfig.welcomeMessage || `${Emojis.hypershiny} Chào mừng {member} đến với **{server}**! Rất vui được chào đón bạn. ${Emojis.arrowr} Hãy khám phá cộng đồng Roblox nhé!`;
  const color: any = guildConfig.welcomeEmbedColor || EMBED_COLORS.primary;

  const e = new EmbedBuilder().setColor(color as any);
  const rTitle = replaceVars(title, member);
  const rDesc = replaceVars(description, member);
  if (rTitle) e.setTitle(rTitle);
  if (rDesc) e.setDescription(rDesc);
  if (!rTitle && !rDesc) e.setDescription('\u200B');

  e.setThumbnail(member.user.displayAvatarURL({ size: 1024 }));
  e.setImage(WELCOME_GIF);
  e.setTimestamp();

  if (guildConfig.welcomeEmbedFooterText) {
    e.setFooter({ text: replaceVars(guildConfig.welcomeEmbedFooterText, member), iconURL: guildConfig.welcomeEmbedFooterIcon || undefined });
  } else {
    e.setFooter({ text: member.guild.name, iconURL: WELCOME_GIF });
  }

  if (guildConfig.welcomeEmbedAuthorName) {
    e.setAuthor({ name: replaceVars(guildConfig.welcomeEmbedAuthorName, member), iconURL: guildConfig.welcomeEmbedAuthorIcon || undefined });
  }

  return e;
}

function buildButtonRows(guildConfig: any): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  try {
    const raw = JSON.parse(guildConfig.welcomeButtons || '[]') as any[];
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

export const guildMemberAddEvent: BotEvent = {
  name: 'guildMemberAdd',
  execute: async (member: GuildMember) => {
    const configManager = ConfigManager.getInstance();
    const guildConfig = await configManager.getGuildConfig(member.guild.id);

    if (!guildConfig.welcomeEnabled || !guildConfig.welcomeChannel) return;

    const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel) as TextChannel;
    if (!channel) return;

    const welcomeEmbed = buildWelcomeEmbed(guildConfig, member);
    const buttonRows = buildButtonRows(guildConfig);

    const silent = guildConfig.welcomeSilent === true;
    const allowedMentions = guildConfig.welcomeAllowedMentions !== false;
    const deleteDelay = guildConfig.welcomeDeleteDelay || 0;

    const sendOpts: any = {};
    if (!silent) {
      sendOpts.content = `${Emojis.welcome} Chào mừng ${member} đến với server!`;
      sendOpts.embeds = [welcomeEmbed];
    }
    if (buttonRows.length > 0) sendOpts.components = buttonRows;
    if (!allowedMentions) sendOpts.allowedMentions = { parse: [] };

    const msg = await channel.send(sendOpts);

    if (deleteDelay > 0) {
      setTimeout(async () => {
        try { await msg.delete(); } catch {}
      }, deleteDelay * 1000);
    }
  }
};
