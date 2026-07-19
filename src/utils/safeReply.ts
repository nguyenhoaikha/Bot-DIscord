import { EmbedBuilder, MessagePayload, InteractionReplyOptions, Message } from 'discord.js';

function isEmptyPayload(payload: any): boolean {
  if (!payload) return true;
  if (typeof payload === 'string' && !payload.trim()) return true;
  if (payload instanceof MessagePayload) return false;
  if (payload.content !== undefined && !payload.content?.toString().trim() && !payload.embeds?.length && !payload.files?.length && !payload.components?.length) return true;
  return false;
}

function fallbackEmbed(text?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#6366F1')
    .setDescription(text || '✅ Hoàn tất.')
    .setTimestamp();
}

function makeSafe(payload: any): any {
  if (isEmptyPayload(payload)) {
    return { embeds: [fallbackEmbed()], components: [], ephemeral: true };
  }
  if (typeof payload === 'string') {
    return { content: payload, ephemeral: true };
  }
  if (payload instanceof MessagePayload) return payload;
  if (!payload.embeds?.length && !payload.content?.toString().trim() && !payload.files?.length && !payload.components?.length) {
    return { ...payload, embeds: [fallbackEmbed()], content: payload.content || null };
  }
  return { ...payload, ephemeral: payload.ephemeral ?? true };
}

export async function safeReply(interaction: any, options: string | MessagePayload | InteractionReplyOptions): Promise<Message | void> {
  try {
    if (interaction.replied || interaction.deferred) return;
    const safe = makeSafe(options);
    return await interaction.reply(safe) as unknown as Message;
  } catch { }
}

export async function safeEditReply(interaction: any, options: string | MessagePayload | InteractionReplyOptions): Promise<Message | void> {
  try {
    if (!interaction.replied && !interaction.deferred) {
      return await safeReply(interaction, options);
    }
    const safe = makeSafe(options);
    return await interaction.editReply(safe) as unknown as Message;
  } catch { }
}

export async function safeFollowUp(interaction: any, options: string | MessagePayload | InteractionReplyOptions): Promise<Message | void> {
  try {
    const safe = makeSafe(options);
    return await interaction.followUp(safe) as unknown as Message;
  } catch { }
}

export async function safeDefer(interaction: any, ephemeral = true): Promise<void> {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral });
    }
  } catch { }
}

export async function safeError(interaction: any, text: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor('#EF4444')
    .setTitle('❌ Lỗi')
    .setDescription(text)
    .setTimestamp();
  await safeEditReply(interaction, { embeds: [embed], components: [] });
}

export async function safeSuccess(interaction: any, text: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor('#22C55E')
    .setTitle('✅ Thành công')
    .setDescription(text)
    .setTimestamp();
  await safeEditReply(interaction, { embeds: [embed], components: [] });
}