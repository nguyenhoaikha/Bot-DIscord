import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';
import { Scheduler } from '../../core/Scheduler';

const TRIVIA_QUESTIONS = [
  { question: 'Thủ đô của Pháp là gì?', options: ['Luân Đôn', 'Paris', 'Berlin', 'Madrid'], answer: 1 },
  { question: 'Hành tinh nào được gọi là Sao Đỏ?', options: ['Sao Kim', 'Sao Mộc', 'Sao Hỏa', 'Sao Thổ'], answer: 2 },
  { question: 'Loài động vật có vú lớn nhất là gì?', options: ['Voi', 'Cá voi xanh', 'Hươu cao cổ', 'Cá mập trắng'], answer: 1 },
  { question: 'Chiến tranh thế giới thứ hai kết thúc năm nào?', options: ['1943', '1944', '1945', '1946'], answer: 2 },
  { question: 'Ký hiệu hóa học của vàng là gì?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2 },
  { question: 'Ngọn núi cao nhất thế giới là gì?', options: ['K2', 'Everest', 'Kangchenjunga', 'Lhotse'], answer: 1 },
  { question: 'Ngôn ngữ được nói nhiều nhất thế giới là gì?', options: ['Tiếng Anh', 'Tiếng Trung', 'Tiếng Tây Ban Nha', 'Tiếng Hindi'], answer: 1 },
  { question: 'Đại dương lớn nhất là gì?', options: ['Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương', 'Thái Bình Dương'], answer: 3 },
  { question: 'Quốc gia nhỏ nhất thế giới là gì?', options: ['Monaco', 'Vatican', 'San Marino', 'Liechtenstein'], answer: 1 },
  { question: 'Nguyên tố nào cần cho sự cháy?', options: ['Nitơ', 'Hydro', 'Oxy', 'Cacbon'], answer: 2 }
];

const WORD_LIST = [
  'apple', 'elephant', 'tiger', 'rabbit', 'turtle', 'eagle', 'orange', 'ember', 'river', 'raven',
  'nest', 'tower', 'robot', 'truck', 'koala', 'anvil', 'lion', 'noble', 'eager', 'raven',
  'nebula', 'angel', 'lemon', 'north', 'house', 'east', 'tango', 'ocean', 'night', 'tulip'
];

export class CommunityModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Community',
    description: 'Tính năng tương tác cộng đồng bao gồm bình chọn, quà tặng, câu đố, đếm số và chuỗi từ',
    version: '1.0.0',
    enabled: true,
    commands: ['poll', 'giveaway', 'quiz', 'counting', 'wordchain'],
    events: [],
    dependencies: ['Core']
  };

  private countingGames: Map<string, { channelId: string; lastNumber: number; lastUserId: string }> = new Map();
  private wordChains: Map<string, { lastLetter: string; usedWords: Set<string> }> = new Map();

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Tạo bình chọn')
        .addStringOption(opt => opt.setName('question').setDescription('Câu hỏi').setRequired(true))
        .addStringOption(opt => opt.setName('option1').setDescription('Lựa chọn 1').setRequired(true))
        .addStringOption(opt => opt.setName('option2').setDescription('Lựa chọn 2').setRequired(true))
        .addStringOption(opt => opt.setName('option3').setDescription('Lựa chọn 3').setRequired(false))
        .addStringOption(opt => opt.setName('option4').setDescription('Lựa chọn 4').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.createPoll(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Bắt đầu quà tặng')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt => opt.setName('prize').setDescription('Phần thưởng').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Số người thắng').setRequired(true).setMinValue(1).setMaxValue(10))
        .addStringOption(opt => opt.setName('duration').setDescription('Thời gian (ví dụ: 1h, 1d, 7d)').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.startGiveaway(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Trả lời câu hỏi đố vui ngẫu nhiên'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.startQuiz(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('counting')
        .setDescription('Bắt đầu hoặc xem trạng thái trò chơi đếm số')
        .addIntegerOption(opt => opt.setName('number').setDescription('Số bạn đoán').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.handleCounting(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('wordchain')
        .setDescription('Chơi trò chơi chuỗi từ')
        .addStringOption(opt => opt.setName('word').setDescription('Từ của bạn').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.handleWordChain(interaction); }
    });

    // Schedule giveaway auto-draw every 30 seconds
    const scheduler = Scheduler.getInstance();
    scheduler.addTask('giveaway_draw', '*/30 * * * * *', async () => {
      await this.checkExpiredGiveaways();
    });
  }

  private async checkExpiredGiveaways(): Promise<void> {
    try {
      const db = Database.getInstance();
      const expired = await db.models.Giveaway.findAll({
        where: {
          ended: false,
          endsAt: { [require('sequelize').Op.lte]: new Date() }
        }
      });

      for (const giveaway of expired) {
        try {
          const guild = this.client.guilds.cache.get(giveaway.get('guildId') as string);
          if (!guild) continue;

          const channel = guild.channels.cache.get(giveaway.get('channelId') as string) as TextChannel;
          if (!channel?.isTextBased()) continue;

          const message = await channel.messages.fetch(giveaway.get('messageId') as string).catch(() => null);
          if (!message) continue;

          const reaction = message.reactions.cache.get('🎉');
          let participants: string[] = [];
          if (reaction) {
            const users = await reaction.users.fetch();
            participants = users.filter(u => !u.bot).map(u => u.id);
          }

          const winnerCount = (giveaway.get('winners') as number) || 1;
          const winners: string[] = [];

          if (participants.length > 0) {
            const shuffled = participants.sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(winnerCount, shuffled.length); i++) {
              winners.push(shuffled[i]);
            }
          }

          await giveaway.update({ ended: true });

          const resultEmbed = new EmbedBuilder()
            .setTitle('🎉 Quà tặng đã kết thúc!')
            .setDescription([
              `**Giải thưởng:** ${giveaway.get('prize')}`,
              '',
              winners.length > 0
                ? `**Người thắng:** ${winners.map(id => `<@${id}>`).join(', ')}`
                : '**Không có người tham gia.**',
              '',
              `**Tổng số người tham gia:** ${participants.length}`
            ].join('\n'))
            .setColor(EMBED_COLORS.success)
            .setTimestamp();

          await channel.send({ embeds: [resultEmbed] });
          await message.edit({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('giveaway_ended')
                  .setLabel('Đã kết thúc')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🎉')
                  .setDisabled(true)
              )
            ]
          });
        } catch {}
      }
    } catch {}
  }

  private async createPoll(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased()) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong kênh văn bản.', ephemeral: true });
      return;
    }

    const question = interaction.options.getString('question', true);
    const options = [
      interaction.options.getString('option1', true),
      interaction.options.getString('option2', true),
      interaction.options.getString('option3'),
      interaction.options.getString('option4')
    ].filter((o): o is string => o !== null);

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    const embed = new EmbedBuilder()
      .setTitle('📊 ' + question)
      .setDescription(options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n\n'))
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: `Bình chọn bởi ${interaction.user.username}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await message.react(emojis[i]);
    }
  }

  private async startGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel?.isTextBased()) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong kênh văn bản của máy chủ.', ephemeral: true });
      return;
    }

    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners', true);
    const duration = interaction.options.getString('duration', true);

    const durationMs = this.parseDuration(duration);
    if (!durationMs) {
      await interaction.reply({ content: 'Thời gian không hợp lệ. Sử dụng định dạng như 1h, 1d, 7d.', ephemeral: true });
      return;
    }

    const endsAt = new Date(Date.now() + durationMs);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Quà tặng')
      .setDescription(`**Giải thưởng:** ${prize}\n**Người thắng:** ${winners}\n**Kết thúc:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n**Tổ chức bởi:** ${interaction.user.username}\n\nReact 🎉 để tham gia!`)
      .setColor(EMBED_COLORS.success)
      .setTimestamp(endsAt);

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('🎉');

    const db = Database.getInstance();
    await db.models.Giveaway.create({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: message.id,
      prize,
      winners,
      endsAt,
      ended: false,
      hostedBy: interaction.user.id
    });
  }

  private async startQuiz(interaction: ChatInputCommandInteraction): Promise<void> {
    const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    const emojis = ['🇦', '🇧', '🇨', '🇩'];

    const embed = new EmbedBuilder()
      .setTitle('🧠 Câu đố vui')
      .setDescription(`**${q.question}**\n\n${q.options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n')}`)
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Bạn có 30 giây để trả lời!' });

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < q.options.length; i++) {
      await message.react(emojis[i]);
    }

    const filter = (reaction: any, user: any) => emojis.includes(reaction.emoji.name) && user.id === interaction.user.id;
    const collector = message.createReactionCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (reaction: any) => {
      const selectedIndex = emojis.indexOf(reaction.emoji.name);
      const correct = selectedIndex === q.answer;

      const resultEmbed = new EmbedBuilder()
        .setTitle(correct ? '✅ Đúng!' : '❌ Sai!')
        .setDescription(`**${q.question}**\nCâu trả lời đúng: **${q.options[q.answer]}**`)
        .setColor(correct ? EMBED_COLORS.success : EMBED_COLORS.error)
        .setTimestamp();

      await interaction.followUp({ embeds: [resultEmbed] });
    });

    collector.on('end', async (collected: any) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ Hết giờ!')
          .setDescription(`**${q.question}**\nCâu trả lời đúng: **${q.options[q.answer]}**`)
          .setColor(EMBED_COLORS.warning);
        await interaction.followUp({ embeds: [timeoutEmbed] });
      }
    });
  }

  private async handleCounting(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const gameKey = interaction.guild.id;
    const number = interaction.options.getInteger('number');

    if (number === null) {
      const game = this.countingGames.get(gameKey);
      if (!game) {
        await interaction.reply({ content: 'Không có trò chơi đếm số nào đang hoạt động. Dùng `/counting number:1` để bắt đầu!', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Số hiện tại: **${game.lastNumber}** trong <#${game.channelId}>`, ephemeral: true });
      return;
    }

    const channelId = interaction.channelId;
    const game = this.countingGames.get(gameKey);

    if (!game) {
      if (number !== 1) {
        await interaction.reply({ content: 'Để bắt đầu trò chơi đếm số, bạn phải bắt đầu với số 1.', ephemeral: true });
        return;
      }
      this.countingGames.set(gameKey, { channelId, lastNumber: 1, lastUserId: interaction.user.id });
      const embed = new EmbedBuilder()
        .setTitle('🔢 Trò chơi đếm số đã bắt đầu!')
        .setDescription(`Số tiếp theo: **2**\nHãy nói số tiếp theo bằng cách dùng \`/counting number:2\``)
        .setColor(EMBED_COLORS.success);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (game.channelId !== channelId) {
      await interaction.reply({ content: `Trò chơi đếm số đang hoạt động trong <#${game.channelId}>. Hãy dùng kênh đó.`, ephemeral: true });
      return;
    }

    if (interaction.user.id === game.lastUserId) {
      await interaction.reply({ content: 'Bạn không thể đếm hai lần liên tiếp!', ephemeral: true });
      return;
    }

    const expected = game.lastNumber + 1;
    if (number !== expected) {
      const embed = new EmbedBuilder()
        .setTitle('💥 Kết thúc!')
        .setDescription(`${interaction.user.username} đã sai! Cần **${expected}**, nhập **${number}**.\nTrò chơi đã khởi động lại! Bắt đầu lại với **1**.`)
        .setColor(EMBED_COLORS.error);
      this.countingGames.delete(gameKey);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    game.lastNumber = number;
    game.lastUserId = interaction.user.id;

    const embed = new EmbedBuilder()
      .setDescription(`**${number}** ✅`)
      .setColor(EMBED_COLORS.success);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleWordChain(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
      return;
    }

    const gameKey = interaction.guild.id;
    const word = interaction.options.getString('word', true).toLowerCase().trim();

    if (!/^[a-z]{2,}$/.test(word)) {
      await interaction.reply({ content: 'Vui lòng cung cấp một từ hợp lệ (chỉ chữ cái, ít nhất 2 ký tự).', ephemeral: true });
      return;
    }

    if (!this.wordChains.has(gameKey)) {
      this.wordChains.set(gameKey, { lastLetter: word.charAt(word.length - 1), usedWords: new Set([word]) });
      const embed = new EmbedBuilder()
        .setTitle('🔤 Chuỗi từ đã bắt đầu!')
        .setDescription(`Từ bắt đầu: **${word}**\nTừ tiếp theo phải bắt đầu bằng **${word.charAt(word.length - 1).toUpperCase()}**`)
        .setColor(EMBED_COLORS.success);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const game = this.wordChains.get(gameKey)!;

    if (word.charAt(0) !== game.lastLetter) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Từ không hợp lệ!')
        .setDescription(`Từ phải bắt đầu bằng **${game.lastLetter.toUpperCase()}**, nhưng từ của bạn bắt đầu bằng **${word.charAt(0).toUpperCase()}**`)
        .setColor(EMBED_COLORS.error);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (game.usedWords.has(word)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Đã được sử dụng!')
        .setDescription(`**${word}** đã được sử dụng trong chuỗi này!`)
        .setColor(EMBED_COLORS.warning);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    game.usedWords.add(word);
    game.lastLetter = word.charAt(word.length - 1);

    const embed = new EmbedBuilder()
      .setTitle('✅ Từ hợp lệ!')
      .setDescription(`**${word}**\nĐộ dài chuỗi: **${game.usedWords.size}** từ\nTừ tiếp theo phải bắt đầu bằng **${game.lastLetter.toUpperCase()}**`)
      .setColor(EMBED_COLORS.success);
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
