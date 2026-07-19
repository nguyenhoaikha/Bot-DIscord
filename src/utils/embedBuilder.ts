import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../config';

export const Branding = {
  footer: '',
  iconURL: null as string | null,
};

export function base(options: {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  author?: { name: string; iconURL?: string; url?: string };
  image?: string;
  thumbnail?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footerText?: string;
  footerIcon?: string;
  timestamp?: boolean;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(options.color ?? EMBED_COLORS.primary)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.url) embed.setURL(options.url);
  if (options.author) embed.setAuthor(options.author);
  if (options.image) embed.setImage(options.image);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.fields) embed.addFields(options.fields);

  embed.setFooter({
    text: options.footerText ?? Branding.footer,
    iconURL: options.footerIcon ?? Branding.iconURL ?? undefined,
  });

  return embed;
}

export function info(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return base({ color: EMBED_COLORS.primary, title, description, fields });
}

export function success(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return base({ color: EMBED_COLORS.success, title, description, fields });
}

export function error(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return base({ color: EMBED_COLORS.error, title, description, fields });
}

export function warning(title: string, description?: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return base({ color: EMBED_COLORS.warning, title, description, fields });
}
