import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

interface FAQEntry {
  id: string;
  guildId: string;
  question: string;
  answer: string;
}

const AI_RESPONSES: Record<string, string> = {
  hello: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?',
  hi: 'Chào bạn! Cứ thoải mái hỏi tôi bất cứ điều gì.',
  help: 'Tôi có thể giúp về FAQ, trả lời chat và tóm tắt tin nhắn. Dùng `/ai ask` để trò chuyện với tôi!',
  'how are you': 'Tôi rất tốt, cảm ơn bạn đã hỏi!',
  'what is pawrb': 'Tôi là bot Discord đa năng dành cho máy chủ Roblox với các tính năng như kiểm duyệt, cấp độ, kinh tế, ticket, v.v.!',
  'what can you do': 'Tôi có thể trả lời câu hỏi, cung cấp phản hồi FAQ và tóm tắt tin nhắn. Hãy dùng `/ai ask`, `/ai faq`, hoặc `/ai summary`.',
  bye: 'Tạm biệt! Chúc bạn một ngày tốt lành!',
  thanks: 'Không có gì! Hãy cho tôi biết nếu bạn cần bất cứ điều gì khác.',
  good: 'Thật tuyệt vời!',
  sorry: 'Đừng lo! Ai cũng có lúc mắc sai lầm.',
  ping: 'Pong! 🏓',
};

export class AIModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'AI',
    description: 'Basic AI chat system with FAQ management and message summarization',
    version: '1.0.0',
    enabled: true,
    commands: ['ai'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Lệnh AI chat')
        .addSubcommand(sub => sub
          .setName('ask')
          .setDescription('Hỏi AI một câu hỏi')
          .addStringOption(opt => opt.setName('question').setDescription('Câu hỏi của bạn').setRequired(true)))
        .addSubcommand(sub => sub
          .setName('faq')
          .setDescription('Quản lý mục FAQ')
          .addStringOption(opt => opt.setName('action').setDescription('Hành động').setRequired(true)
            .addChoices({ name: 'List', value: 'list' }, { name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
          .addStringOption(opt => opt.setName('question').setDescription('Câu hỏi FAQ (để thêm)').setRequired(false))
          .addStringOption(opt => opt.setName('answer').setDescription('Câu trả lời FAQ (để thêm)').setRequired(false))
          .addStringOption(opt => opt.setName('faq_id').setDescription('ID FAQ (để xóa)').setRequired(false)))
        .addSubcommand(sub => sub
          .setName('summary')
          .setDescription('Tóm tắt tin nhắn gần đây trong kênh')
          .addIntegerOption(opt => opt.setName('count').setDescription('Số lượng tin nhắn để tóm tắt').setRequired(false).setMinValue(5).setMaxValue(50))),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'ask') await this.ask(interaction);
        else if (sub === 'faq') await this.manageFAQ(interaction);
        else if (sub === 'summary') await this.summarize(interaction);
      }
    });
  }

  private async ask(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true).toLowerCase().trim();

    const exactMatch = AI_RESPONSES[question];
    if (exactMatch) {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Phản hồi AI')
        .setDescription(exactMatch)
        .setColor(EMBED_COLORS.info)
        .setFooter({ text: `Asked by ${interaction.user.username}` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const fuzzyMatch = Object.entries(AI_RESPONSES).find(([key]) => question.includes(key));
    if (fuzzyMatch) {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Phản hồi AI')
        .setDescription(fuzzyMatch[1])
        .setColor(EMBED_COLORS.info)
        .setFooter({ text: `Asked by ${interaction.user.username}` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const db = Database.getInstance();
    const faqs = await db.models.Achievement.findAll(); // using Achievement model to store FAQ queries
    const faqEntries = await this.getFAQEntries(interaction.guildId!);

    const faqMatch = faqEntries.find((f: FAQEntry) =>
      question.includes(f.question.toLowerCase()) || f.question.toLowerCase().includes(question)
    );

    if (faqMatch) {
      const embed = new EmbedBuilder()
        .setTitle('📖 Câu trả lời FAQ')
        .setDescription(faqMatch.answer)
        .setColor(EMBED_COLORS.info)
        .setFooter({ text: `Asked by ${interaction.user.username}` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const defaultEmbed = new EmbedBuilder()
      .setTitle('🤖 Phản hồi AI')
      .setDescription(`I'm not sure how to answer that. Try asking about: **${Object.keys(AI_RESPONSES).slice(0, 5).join(', ')}**\n\n> Note: Full AI capabilities require an API key. This is the basic response mode.`)
      .setColor(EMBED_COLORS.warning)
      .setFooter({ text: `Asked by ${interaction.user.username}` })
      .setTimestamp();
    await interaction.reply({ embeds: [defaultEmbed] });
  }

  private async manageFAQ(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action', true);

    if (action === 'list') {
      const entries = await this.getFAQEntries(interaction.guild.id);
      if (entries.length === 0) {
        await interaction.reply({ content: 'Chưa có mục FAQ nào.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📖 Danh sách FAQ')
        .setColor(EMBED_COLORS.primary)
        .setDescription(entries.map((e: FAQEntry, i: number) => `**${i + 1}.** \`${e.id}\` — **${e.question}**`).join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (action === 'add') {
      const question = interaction.options.getString('question', true);
      const answer = interaction.options.getString('answer', true);

      const db = Database.getInstance();
      const modelName = `FAQ_${interaction.guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        const { DataTypes } = require('sequelize');
        db.models[modelName] = db.sequelize.define(modelName, {
          id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
          guildId: DataTypes.STRING,
          question: DataTypes.STRING,
          answer: DataTypes.TEXT
        });
        await db.models[modelName].sync();
      }

      const entry = await db.models[modelName].create({ guildId: interaction.guild.id, question, answer });

      const embed = new EmbedBuilder()
        .setTitle('✅ Đã thêm FAQ')
        .setDescription(`**Q:** ${question}\n**A:** ${answer}\n**ID:** \`${entry.get('id')}\``)
        .setColor(EMBED_COLORS.success);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (action === 'remove') {
      const faqId = interaction.options.getString('faq_id', true);
      const db = Database.getInstance();
      const modelName = `FAQ_${interaction.guild.id.replace(/-/g, '_')}`;

      if (!db.models[modelName]) {
        await interaction.reply({ content: 'Chưa có mục FAQ nào.', ephemeral: true });
        return;
      }

      const deleted = await db.models[modelName].destroy({ where: { id: faqId } });
      if (deleted) {
        await interaction.reply({ content: '✅ Đã xóa mục FAQ.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Không tìm thấy mục FAQ.', ephemeral: true });
      }
    }
  }

  private async summarize(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased()) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong kênh văn bản.', ephemeral: true });
      return;
    }

    const count = interaction.options.getInteger('count') || 20;

    await interaction.deferReply();

    try {
      const messages = await interaction.channel.messages.fetch({ limit: count });
      const validMessages = messages.filter(m => !m.author.bot && m.content.length > 0);

      if (validMessages.size === 0) {
        await interaction.editReply({ content: 'Không có tin nhắn nào gần đây để tóm tắt.' });
        return;
      }

      const wordCounts = new Map<string, number>();
      let totalChars = 0;
      const users = new Set<string>();

      for (const [, msg] of validMessages) {
        const words = msg.content.toLowerCase().match(/\b\w+\b/g) || [];
        for (const word of words) {
          if (word.length > 2) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
          }
        }
        totalChars += msg.content.length;
        users.add(msg.author.username);
      }

      const topWords = [...wordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => `**${word}** (${count}x)`)
        .join(', ');

      const avgLength = validMessages.size > 0 ? Math.round(totalChars / validMessages.size) : 0;

      const embed = new EmbedBuilder()
        .setTitle('📊 Tóm tắt tin nhắn')
        .setDescription(`Summarized the last **${validMessages.size}** messages from **${users.size}** users.`)
        .setColor(EMBED_COLORS.info)
        .addFields(
          { name: 'Total Messages', value: `${validMessages.size}`, inline: true },
          { name: 'Unique Users', value: `${users.size}`, inline: true },
          { name: 'Avg Length', value: `${avgLength} chars`, inline: true },
          { name: 'Total Characters', value: `${totalChars}`, inline: true },
          { name: 'Top Words', value: topWords || 'None', inline: false }
        )
        .setFooter({ text: `Channel: ${(interaction.channel as any).name || 'Unknown'}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to summarize messages', error as Error);
      await interaction.editReply({ content: 'Không thể tóm tắt tin nhắn.' });
    }
  }

  private async getFAQEntries(guildId: string): Promise<FAQEntry[]> {
    const db = Database.getInstance();
    const modelName = `FAQ_${guildId.replace(/-/g, '_')}`;
    if (!db.models[modelName]) return [];
    const entries = await db.models[modelName].findAll({ where: { guildId } });
    return entries.map((e: any) => ({ id: e.get('id'), guildId: e.get('guildId'), question: e.get('question'), answer: e.get('answer') }));
  }
}
