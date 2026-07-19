import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest, ThemeType } from '../../types';
import { PawRBClient } from '../../core/Client';
import { ThemeManager } from '../../core/ThemeManager';
import { ConfigManager } from '../../core/ConfigManager';
import { EMBED_COLORS } from '../../config';

export class ThemeModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Theme Engine',
    description: 'Visual themes that change category style, channel style, embed style, button style, and color palette',
    version: '1.0.0',
    enabled: true,
    commands: ['theme'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('theme')
        .setDescription('Change server theme')
        .addSubcommand(sub => sub.setName('set').setDescription('Apply a theme')
          .addStringOption(opt => opt.setName('theme').setDescription('Choose a theme').setRequired(true)
            .addChoices(
              { name: '📌 Modern', value: 'modern' },
              { name: '⬜ Minimal', value: 'minimal' },
              { name: '🪟 Glass', value: 'glass' },
              { name: '⚡ Cyber', value: 'cyber' },
              { name: '👑 Luxury', value: 'luxury' },
              { name: '🔴 Roblox', value: 'roblox' },
              { name: '💜 Neon', value: 'neon' },
              { name: '🌙 Dark', value: 'dark' },
              { name: '☀️ Light', value: 'light' }
            )))
        .addSubcommand(sub => sub.setName('list').setDescription('List available themes'))
        .addSubcommand(sub => sub.setName('current').setDescription('Show current theme')),
      execute: async (interaction: ChatInputCommandInteraction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === 'set') await this.setTheme(interaction);
        else if (sub === 'list') await this.listThemes(interaction);
        else if (sub === 'current') await this.currentTheme(interaction);
      }
    });
  }

  private async setTheme(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const themeName = interaction.options.getString('theme', true) as ThemeType;
    await ThemeManager.getInstance().applyTheme(interaction.guild, themeName);
    await ConfigManager.getInstance().setTheme(interaction.guild.id, themeName);

    const embed = new EmbedBuilder()
      .setTitle('🎨 Theme Applied')
      .setDescription(`Server theme has been changed to **${themeName}**`)
      .setColor(EMBED_COLORS.success)
      .setFooter({ text: 'Theme Engine' });
    await interaction.reply({ embeds: [embed] });
  }

  private async listThemes(interaction: ChatInputCommandInteraction): Promise<void> {
    const themes = [
      '📌 Modern - Clean and professional',
      '⬜ Minimal - Simple and elegant',
      '🪟 Glass - Frosted glass style',
      '⚡ Cyber - Cyberpunk green',
      '👑 Luxury - Gold and premium',
      '🔴 Roblox - Roblox inspired',
      '💜 Neon - Neon vibrant',
      '🌙 Dark - Dark mode',
      '☀️ Light - Light mode'
    ];
    const embed = new EmbedBuilder()
      .setTitle('🎨 Available Themes')
      .setDescription(themes.join('\n'))
      .setColor(EMBED_COLORS.primary)
      .setFooter({ text: 'Use /theme set to apply a theme' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async currentTheme(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const config = await ConfigManager.getInstance().getGuildConfig(interaction.guild.id);
    const embed = new EmbedBuilder()
      .setTitle('🎨 Current Theme')
      .setDescription(`Current theme: **${config.theme}**`)
      .setColor(EMBED_COLORS.info)
      .setFooter({ text: 'Theme Engine' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
