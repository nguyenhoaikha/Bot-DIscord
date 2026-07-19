import { ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, MessagePayload, JSONEncodable, Message } from 'discord.js';

type Interaction = ChatInputCommandInteraction;

export class ResponseManager {
  private interaction: Interaction;
  private steps: string[] = [];
  private completed = new Set<number>();
  private currentStep = 0;

  constructor(interaction: Interaction) {
    this.interaction = interaction;
  }

  setSteps(steps: string[]): this {
    this.steps = steps;
    return this;
  }

  markComplete(index: number): this {
    this.completed.add(index);
    return this;
  }

  setCurrentStep(index: number): this {
    this.currentStep = index;
    return this;
  }

  private progressBar(current: number, total: number, length = 10): string {
    const filled = Math.round((current / total) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private buildProgressEmbed(title: string, description?: string): EmbedBuilder {
    const icon = (i: number) => this.completed.has(i) ? '✅' : i === this.currentStep ? '⏳' : '⬜';
    const progressLines = this.steps.length > 0
      ? this.steps.map((s, i) => `${icon(i)} ${s}`).join('\n')
      : '';

    const percent = this.steps.length > 0
      ? Math.round((this.completed.size / this.steps.length) * 100)
      : 0;

    const bar = this.steps.length > 0
      ? `\n\n\`[${this.progressBar(this.completed.size, this.steps.length)}] ${percent}%\``
      : '';

    return new EmbedBuilder()
      .setColor('#6366F1')
      .setTitle(title || '🚀 Setup Wizard')
      .setDescription([
        description || '',
        bar,
        '',
        progressLines
      ].filter(Boolean).join('\n'))
      .setFooter({ text: 'All-in-One Bot' })
      .setTimestamp();
  }

  async init(title?: string, description?: string): Promise<this> {
    if (this.interaction.deferred || this.interaction.replied) {
      await this.interaction.editReply({
        embeds: [this.buildProgressEmbed(title || '🚀 Setup Wizard', description || '⏳ Initializing...')],
        components: []
      });
    } else {
      await this.interaction.reply({
        embeds: [this.buildProgressEmbed(title || '🚀 Setup Wizard', description || '⏳ Initializing...')],
        ephemeral: true
      });
    }
    return this;
  }

  async update(title?: string, description?: string): Promise<this> {
    const embed = this.buildProgressEmbed(title || '🚀 Setup Wizard', description);
    if (this.interaction.deferred || this.interaction.replied) {
      await this.interaction.editReply({ embeds: [embed], components: [] });
    } else {
      await this.interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return this;
  }

  async complete(stepIndex: number, title?: string, description?: string): Promise<this> {
    this.markComplete(stepIndex);
    if (stepIndex + 1 < this.steps.length) {
      this.setCurrentStep(stepIndex + 1);
    }
    await this.update(title, description);
    return this;
  }

  async error(errorText: string): Promise<this> {
    const embed = new EmbedBuilder()
      .setColor('#EF4444')
      .setTitle('❌ Setup Failed')
      .setDescription(errorText)
      .setFooter({ text: 'All-in-One Bot' })
      .setTimestamp();

    try {
      if (this.interaction.deferred || this.interaction.replied) {
        await this.interaction.editReply({ embeds: [embed], components: [] });
      } else {
        await this.interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch { }
    return this;
  }

  async done(embed: EmbedBuilder): Promise<this> {
    try {
      if (this.interaction.deferred || this.interaction.replied) {
        await this.interaction.editReply({ embeds: [embed], components: [] });
      } else {
        await this.interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch { }
    return this;
  }

  static async defer(interaction: Interaction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  }

  static async send(interaction: Interaction, options: string | MessagePayload | InteractionReplyOptions): Promise<Message | void> {
    try {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(options as any) as unknown as Message;
      }
      return await interaction.reply({ ...(options as any), ephemeral: true }) as unknown as Message;
    } catch {
      try {
        return await interaction.followUp({ ...(options as any), ephemeral: true }) as unknown as Message;
      } catch { }
    }
  }
}