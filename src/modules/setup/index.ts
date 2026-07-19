import { Client, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, Guild, ChannelType } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest, ServerSetupData, Language, ThemeType, ServerType, DefaultChannels, DefaultRoles } from '../../types';
import { PawRBClient } from '../../core/Client';
import { EMBED_COLORS } from '../../config';
import { Emojis } from '../../constants/emojis';
import { t } from '../../utils/translate';
import { VoiceModule } from '../voice/index';
import { ModuleManager } from '../../core/ModuleManager';
import { CommunityManager } from '../../core/CommunityManager';
import { ResponseManager } from '../../utils/responseManager';

export class SetupModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Setup Wizard',
    description: 'Interactive server setup wizard',
    version: '1.0.0',
    enabled: true,
    commands: ['setup', 'language'],
    events: [],
    dependencies: ['Core']
  };

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Server setup commands')
        .addSubcommand(sub => sub
          .setName('wizard')
          .setDescription('Interactive 12-step setup wizard'))
        .addSubcommand(sub => sub
          .setName('default')
          .setDescription('Quick setup with default channels and roles'))
        .addSubcommand(sub => sub
          .setName('community')
          .setDescription('Configure all community features (AutoMod, Welcome Screen, Permissions, Safety)')),
      execute: async (interaction: ChatInputCommandInteraction) => {
        try {
          let sub: string | null = null;
          try { sub = interaction.options.getSubcommand(false); } catch { }
          if (sub === 'wizard') {
            await this.startSetup(interaction);
            return;
          }
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
          if (sub === 'community') {
            await this.communitySetup(interaction);
          } else {
            await this.defaultSetup(interaction);
          }
        } catch (e) {
          this.logger.error('Setup', 'Execute error', e as Error);
          try {
            if (interaction.deferred) await interaction.editReply({ content: '❌ Lỗi: vui lòng thử lại sau.' });
            else if (!interaction.replied) await interaction.reply({ content: '❌ Lỗi: vui lòng thử lại sau.', ephemeral: true });
          } catch {}
        }
      }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Change the bot language for this server'),
      execute: async (interaction: ChatInputCommandInteraction) => {
        await this.changeLanguage(interaction);
      }
    });
  }

  private async startSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const setupData: Partial<ServerSetupData> = {};
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚀 Setup Wizard')
          .setDescription('Welcome! Let\'s set up your server step by step.')
          .setColor(EMBED_COLORS.primary)
          .addFields({ name: 'Step 1/12', value: 'What is your server name?' })
      ],
      ephemeral: true
    });

    await this.askServerName(interaction, setupData);
  }

  private async askServerName(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('setup_name')
      .setTitle('Server Name')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('serverName')
            .setLabel('Enter your server name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('My Awesome Roblox Server')
            .setRequired(true)
        )
      );

    await interaction.followUp({ content: 'Click the button to enter server name:', components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('open_setup_name')
          .setLabel('Enter Server Name')
          .setStyle(ButtonStyle.Primary)
      )
    ], ephemeral: true });

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerButton('open_setup_name', async (btnInteraction) => {
      await btnInteraction.showModal(modal);
    });
    pawClient.components.registerModal('setup_name', async (modalInteraction) => {
      setupData.serverName = modalInteraction.fields.getTextInputValue('serverName');
      await modalInteraction.reply({ content: `Server name set to: **${setupData.serverName}**`, ephemeral: true });
      await this.askLanguage(interaction, setupData);
    });
  }

  private async askLanguage(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const select = new StringSelectMenuBuilder()
      .setCustomId('setup_language')
      .setPlaceholder('Choose a language')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('English').setValue('en').setEmoji('🇬🇧'),
        new StringSelectMenuOptionBuilder().setLabel('Tiếng Việt').setValue('vi').setEmoji('🇻🇳'),
        new StringSelectMenuOptionBuilder().setLabel('日本語').setValue('ja').setEmoji('🇯🇵'),
        new StringSelectMenuOptionBuilder().setLabel('한국어').setValue('ko').setEmoji('🇰🇷'),
        new StringSelectMenuOptionBuilder().setLabel('ไทย').setValue('th').setEmoji('🇹🇭'),
        new StringSelectMenuOptionBuilder().setLabel('Bahasa Indonesia').setValue('id').setEmoji('🇮🇩')
      );

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('Step 2/12 - Language')
          .setDescription('Choose the server language')
          .setColor(EMBED_COLORS.primary)
      ],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      ephemeral: true
    });

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerSelectMenu('setup_language', async (selectInteraction) => {
      setupData.language = selectInteraction.values[0] as Language;
      await selectInteraction.reply({ content: `Language set to: **${setupData.language}**`, ephemeral: true });
      await this.askTheme(interaction, setupData);
    });
  }

  private async askTheme(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const select = new StringSelectMenuBuilder()
      .setCustomId('setup_theme')
      .setPlaceholder('Choose a theme')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Modern').setValue('modern').setEmoji('📌'),
        new StringSelectMenuOptionBuilder().setLabel('Minimal').setValue('minimal').setEmoji('⬜'),
        new StringSelectMenuOptionBuilder().setLabel('Glass').setValue('glass').setEmoji('🪟'),
        new StringSelectMenuOptionBuilder().setLabel('Cyber').setValue('cyber').setEmoji('⚡'),
        new StringSelectMenuOptionBuilder().setLabel('Luxury').setValue('luxury').setEmoji('👑'),
        new StringSelectMenuOptionBuilder().setLabel('Roblox').setValue('roblox').setEmoji('🔴'),
        new StringSelectMenuOptionBuilder().setLabel('Neon').setValue('neon').setEmoji('💜'),
        new StringSelectMenuOptionBuilder().setLabel('Dark').setValue('dark').setEmoji('🌙'),
        new StringSelectMenuOptionBuilder().setLabel('Light').setValue('light').setEmoji('☀️')
      );

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('Step 3/12 - Theme')
          .setDescription('Choose your server theme')
          .setColor(EMBED_COLORS.primary)
      ],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      ephemeral: true
    });

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerSelectMenu('setup_theme', async (selectInteraction) => {
      setupData.theme = selectInteraction.values[0] as ThemeType;
      await selectInteraction.reply({ content: `Theme set to: **${setupData.theme}**`, ephemeral: true });
      await this.askServerType(interaction, setupData);
    });
  }

  private async askServerType(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const select = new StringSelectMenuBuilder()
      .setCustomId('setup_servertype')
      .setPlaceholder('Choose server type')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Gaming').setValue('gaming').setEmoji('🎮'),
        new StringSelectMenuOptionBuilder().setLabel('Community').setValue('community').setEmoji('👥'),
        new StringSelectMenuOptionBuilder().setLabel('Development').setValue('development').setEmoji('💻'),
        new StringSelectMenuOptionBuilder().setLabel('Trading').setValue('trading').setEmoji('💹'),
        new StringSelectMenuOptionBuilder().setLabel('Roleplay').setValue('roleplay').setEmoji('🎭'),
        new StringSelectMenuOptionBuilder().setLabel('Social').setValue('social').setEmoji('🌟')
      );

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('Step 4/12 - Server Type')
          .setDescription('Choose your server type')
          .setColor(EMBED_COLORS.primary)
      ],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      ephemeral: true
    });

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerSelectMenu('setup_servertype', async (selectInteraction) => {
      setupData.serverType = selectInteraction.values[0] as ServerType;
      await selectInteraction.reply({ content: `Server type set to: **${setupData.serverType}**`, ephemeral: true });
      await this.askRobloxGame(interaction, setupData);
    });
  }

  private async askRobloxGame(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('setup_robloxgame')
      .setTitle('Roblox Game')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('robloxGame')
            .setLabel('Enter Roblox game name/ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Adopt Me, Tower of Hell, or game ID')
            .setRequired(false)
        )
      );

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerButton('open_setup_robloxgame', async (btnInteraction) => {
      await btnInteraction.showModal(modal);
    });
    pawClient.components.registerModal('setup_robloxgame', async (modalInteraction) => {
      setupData.robloxGame = modalInteraction.fields.getTextInputValue('robloxGame') || 'None';
      await modalInteraction.reply({ content: `Roblox game set to: **${setupData.robloxGame}**`, ephemeral: true });
      await this.askToggles(interaction, setupData);
    });

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('Step 5/12 - Roblox Game')
          .setDescription('What Roblox game is your server for? (Optional)')
          .setColor(EMBED_COLORS.primary)
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('open_setup_robloxgame')
            .setLabel('Enter Game')
            .setStyle(ButtonStyle.Primary)
        )
      ],
      ephemeral: true
    });
  }

  private async askToggles(interaction: ChatInputCommandInteraction, setupData: Partial<ServerSetupData>): Promise<void> {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('setup_verify_on').setLabel('✅ Verification: ON').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_ticket_on').setLabel('✅ Tickets: ON').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_logging_on').setLabel('✅ Logging: ON').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_welcome_on').setLabel(`${Emojis.welcome} Welcome: ON`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_automod_on').setLabel('✅ AutoMod: ON').setStyle(ButtonStyle.Success)
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('setup_leveling_on').setLabel('⬆ Leveling: ON').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_economy_on').setLabel('💰 Economy: ON').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_finish').setLabel('🚀 Complete Setup').setStyle(ButtonStyle.Primary)
      );

    const row3 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('setup_verify_off').setLabel('❌ Verification: OFF').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_ticket_off').setLabel('❌ Tickets: OFF').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_logging_off').setLabel('❌ Logging: OFF').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_welcome_off').setLabel(`${Emojis.Letter_X} Welcome: OFF`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_automod_off').setLabel('❌ AutoMod: OFF').setStyle(ButtonStyle.Danger)
      );

    const row4 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('setup_leveling_off').setLabel('⬇ Leveling: OFF').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_economy_off').setLabel('💰 Economy: OFF').setStyle(ButtonStyle.Danger)
      );

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('Steps 6-12/12 - Features')
          .setDescription('Toggle features on/off, then click Complete Setup')
          .addFields(
            { name: '🔐 Verification', value: 'ON (default)', inline: true },
            { name: '🎫 Tickets', value: 'ON (default)', inline: true },
            { name: '📜 Logging', value: 'ON (default)', inline: true },
            { name: `${Emojis.welcome} Welcome`, value: 'ON (default)', inline: true },
            { name: '🚨 AutoMod', value: 'ON (default)', inline: true },
            { name: '⬆ Leveling', value: 'ON (default)', inline: true },
            { name: '💰 Economy', value: 'ON (default)', inline: true }
          )
          .setColor(EMBED_COLORS.primary)
      ],
      components: [row1, row2, row3, row4],
      ephemeral: true
    });

    const pawClient = this.client as PawRBClient;

    pawClient.components.registerButton('setup_verify_on', async (btnInteraction) => {
      setupData.verification = true;
      await btnInteraction.reply({ content: '✅ Verification enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_verify_off', async (btnInteraction) => {
      setupData.verification = false;
      await btnInteraction.reply({ content: '❌ Verification disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_ticket_on', async (btnInteraction) => {
      setupData.ticket = true;
      await btnInteraction.reply({ content: '✅ Tickets enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_ticket_off', async (btnInteraction) => {
      setupData.ticket = false;
      await btnInteraction.reply({ content: '❌ Tickets disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_logging_on', async (btnInteraction) => {
      setupData.logging = true;
      await btnInteraction.reply({ content: '✅ Logging enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_logging_off', async (btnInteraction) => {
      setupData.logging = false;
      await btnInteraction.reply({ content: '❌ Logging disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_welcome_on', async (btnInteraction) => {
      setupData.welcome = true;
      await btnInteraction.reply({ content: `${Emojis.pinkverified} Welcome enabled`, ephemeral: true });
    });
    pawClient.components.registerButton('setup_welcome_off', async (btnInteraction) => {
      setupData.welcome = false;
      await btnInteraction.reply({ content: `${Emojis.Letter_X} Welcome disabled`, ephemeral: true });
    });
    pawClient.components.registerButton('setup_automod_on', async (btnInteraction) => {
      setupData.automod = true;
      await btnInteraction.reply({ content: '✅ AutoMod enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_automod_off', async (btnInteraction) => {
      setupData.automod = false;
      await btnInteraction.reply({ content: '❌ AutoMod disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_leveling_on', async (btnInteraction) => {
      setupData.leveling = true;
      await btnInteraction.reply({ content: '⬆ Leveling enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_leveling_off', async (btnInteraction) => {
      setupData.leveling = false;
      await btnInteraction.reply({ content: '⬇ Leveling disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_economy_on', async (btnInteraction) => {
      setupData.economy = true;
      await btnInteraction.reply({ content: '💰 Economy enabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_economy_off', async (btnInteraction) => {
      setupData.economy = false;
      await btnInteraction.reply({ content: '💰 Economy disabled', ephemeral: true });
    });
    pawClient.components.registerButton('setup_finish', async (btnInteraction) => {
      await btnInteraction.deferReply({ ephemeral: true });
      try {
        await this.executeSetup(interaction, setupData as ServerSetupData, btnInteraction);
      } catch (e) {
        try { await btnInteraction.editReply({ content: '❌ Setup failed. Check bot permissions.' }); } catch {}
      }
    });
  }

  private async executeSetup(interaction: ChatInputCommandInteraction, data: ServerSetupData, btnInteraction: any): Promise<void> {
    const guild = interaction.guild!;
    const pawClient = this.client as PawRBClient;

    await this.safeEdit(btnInteraction, '🚀 Starting server setup... This may take a few moments.');

    try {
      const preserveChannelId = interaction.channel?.id || btnInteraction.channel?.id;
      await this.resetServer(guild, preserveChannelId);
      await this.safeEdit(btnInteraction, '✅ Server reset complete!');

      await guild.setName(data.serverName);

      const roleMap = await pawClient.roleManager.createDefaultRoles(guild);
      await this.safeEdit(btnInteraction, '✅ Roles created!');

      const channelMap = await pawClient.channelManager.createDefaultChannels(guild, roleMap);
      await this.safeEdit(btnInteraction, '✅ Channels created!');

      await pawClient.themeManager.applyTheme(guild, data.theme);
      await this.safeEdit(btnInteraction, '✅ Theme applied!');

      await pawClient.configManager.setLanguage(guild.id, data.language);
      await pawClient.configManager.setTheme(guild.id, data.theme);

      await pawClient.configManager.updateGuildConfig(guild.id, {
        verificationEnabled: data.verification,
        ticketEnabled: data.ticket,
        welcomeEnabled: data.welcome,
        autoModEnabled: data.automod,
        levelingEnabled: data.leveling,
        economyEnabled: data.economy,
        memberRole: roleMap.get('👤 Member'),
        mutedRole: roleMap.get('🚫 Muted'),
        welcomeChannel: data.welcome ? channelMap.get('welcome') : undefined,
        verifyChannel: data.verification ? channelMap.get('verify') : undefined,
        ticketCategory: data.ticket ? channelMap.get('SUPPORT') : undefined,
        logChannel: data.logging ? channelMap.get('staff') : undefined
      });

      if (data.verification) {
        const verifyChannel = guild.channels.cache.get(channelMap.get('verify')!);
        if (verifyChannel?.isTextBased()) {
          const verifyEmbed = new EmbedBuilder()
            .setTitle('🔐 Verification')
            .setDescription('Click the button below to verify yourself!')
            .setColor(EMBED_COLORS.primary);
          const verifyRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('verify_user')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
            );
          await verifyChannel.send({ embeds: [verifyEmbed], components: [verifyRow] });
        }
      }

      await guild.setVerificationLevel(2);

      const welcomeChannel = guild.channels.cache.get(channelMap.get('welcome')!);
      if (welcomeChannel?.isTextBased()) {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`${Emojis.welcome} Welcome to ${data.serverName}!`)
          .setDescription(`${Emojis.hypershiny} We're glad to have you! ${Emojis.arrowr} Check out <#${channelMap.get('rules')}> and get verified in <#${channelMap.get('verify')}>! ${Emojis.pinkverified}`)
          .setColor(EMBED_COLORS.success)
          .setFooter({ text: 'Server Setup', iconURL: 'https://cdn.discordapp.com/emojis/1525115894345502812.gif' });
        await welcomeChannel.send({ embeds: [welcomeEmbed] });
      }

      await this.safeEdit(btnInteraction, null, new EmbedBuilder()
        .setTitle('✅ Setup Complete!')
        .setDescription(`Server **${data.serverName}** has been fully configured! ${Emojis.hypershiny}\n\n**Summary:**\n- Language: ${data.language}\n- Theme: ${data.theme}\n- Type: ${data.serverType}\n${data.robloxGame !== 'None' ? `- Roblox Game: ${data.robloxGame}\n` : ''}- Verification: ${data.verification ? Emojis.pinkverified : Emojis.Letter_X}\n- Tickets: ${data.ticket ? Emojis.pinkverified : Emojis.Letter_X}\n- Logging: ${data.logging ? Emojis.pinkverified : Emojis.Letter_X}\n- Welcome: ${data.welcome ? Emojis.welcome : Emojis.Letter_X}\n- AutoMod: ${data.automod ? Emojis.pinkverified : Emojis.Letter_X}\n- Leveling: ${data.leveling ? Emojis.pinkverified : Emojis.Letter_X}\n- Economy: ${data.economy ? Emojis.pinkverified : Emojis.Letter_X}`)
        .setColor(EMBED_COLORS.success)
        .setFooter({ text: 'All-in-One Bot for Roblox' }));
    } catch (error) {
      this.logger.error('SetupModule', 'Setup failed', error as Error);
    }
  }

  private async safeEdit(btnInteraction: any, content: string | null, embed?: EmbedBuilder): Promise<void> {
    try {
      if (embed) {
        await btnInteraction.editReply({ embeds: [embed], components: [] });
      } else if (content) {
        await btnInteraction.editReply({ content });
      }
    } catch { }
  }

  private async resetServer(guild: import('discord.js').Guild, preserveChannelId?: string): Promise<void> {
    const pawClient = this.client as PawRBClient;

    pawClient.configManager.invalidateCache(guild.id);

    const botMember = guild.members.me;
    const botHighest = botMember?.roles.highest.position || 0;

    const channels = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory);
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    const allChannels = [...channels.values(), ...categories.values()];

    for (const channel of allChannels) {
      if (channel.id === preserveChannelId) continue;
      try {
        if (!channel.isThread()) await channel.delete();
      } catch { }
    }

    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed && r.position < botHighest)
      .sort((a, b) => b.position - a.position);

    for (const role of roles.values()) {
      try {
        await role.delete();
      } catch { }
    }
  }

  private async defaultSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Lệnh này chỉ có thể dùng trong server.', ephemeral: true });
      return;
    }

    const pawClient = this.client as PawRBClient;
    const guild = interaction.guild;

    const modal = new ModalBuilder()
      .setCustomId('setup_default_name')
      .setTitle('Tên server')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('serverName')
            .setLabel('Nhập tên server của bạn')
            .setStyle(TextInputStyle.Short)
            .setValue(guild.name)
            .setRequired(true)
            .setMaxLength(100)
        )
      );

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(EMBED_COLORS.primary)
        .setTitle('📝 Bước 1: Nhập tên server')
        .setDescription('Nhấn nút bên dưới để đặt tên cho server của bạn.\nSau đó bot sẽ tự động thiết lập mọi thứ!')
        .setTimestamp()
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('open_setup_default_name')
            .setLabel('Nhập tên server')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️')
        )
      ]
    });

    pawClient.components.registerButton('open_setup_default_name', async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        await btnInteraction.reply({ content: '❌ Chỉ người chạy lệnh mới có thể chỉnh sửa.', ephemeral: true });
        return;
      }
      await btnInteraction.showModal(modal);
    });

    pawClient.components.registerModal('setup_default_name', async (modalInteraction) => {
      if (modalInteraction.user.id !== interaction.user.id) return;
      await modalInteraction.deferReply({ ephemeral: true });

      const serverName = modalInteraction.fields.getTextInputValue('serverName').trim() || guild.name;

      const steps = [
        'Reset server',
        'Tạo roles',
        'Tạo categories & channels',
        'Bật Community mode',
        'Cấu hình server settings',
        'Tạo AutoMod rules',
        'Welcome Screen & Server Guide',
        'Áp dụng Permission templates',
        'Cấu hình Role permissions',
        'Welcome messages & Verification',
        'Lưu cấu hình'
      ];
      const rm = new ResponseManager(interaction).setSteps(steps);
      const cm = CommunityManager.getInstance();
      const welcomeGif = 'https://cdn.discordapp.com/attachments/1525134686710534199/1525147172147036200/233b35a28289a15473f5acb298a34aa4.gif';

      try {
        await rm.init(`🚀 Setup ${serverName}`, '⏳ Đang khởi tạo...');

        await this.resetServer(guild, interaction.channelId);
        await guild.setName(serverName);
        await rm.complete(0, undefined, '✅ Server đã được reset');

        const roleMap = await pawClient.roleManager.createDefaultRoles(guild);
        await rm.complete(1, undefined, `✅ ${roleMap.size} roles đã tạo`);

        const channelMap = await pawClient.channelManager.createDefaultChannels(guild, roleMap);
        await rm.complete(2, undefined, `✅ ${channelMap.size} channels đã tạo`);

        const creatorChannelId = channelMap.get('Join to Create');
        if (creatorChannelId) {
          const voiceModule = ModuleManager.getInstance().getModule('Voice Creator') as VoiceModule | undefined;
          if (voiceModule) voiceModule.setCreatorChannelId(creatorChannelId);
        }

        await cm.enableCommunity(guild);
        await rm.complete(3, undefined, '✅ Community mode enabled');

        const serverResults = await cm.configureServerSettings(guild, channelMap);
        await rm.complete(4, undefined, '✅ Server settings configured');

        const modChannel = channelMap.get('staff') || guild.channels.cache.find(c => c.name.includes('staff'))?.id;
        const autoModResults = await cm.createAutoModRules(guild, modChannel);
        await rm.complete(5, undefined, `✅ AutoMod: ${autoModResults.filter(r => r.status).length}/${autoModResults.length} rules`);

        await cm.setupWelcomeScreen(guild, channelMap);
        await cm.createServerGuide(guild, channelMap);
        await cm.createRulesContent(guild, channelMap);
        await rm.complete(6, undefined, '✅ Welcome Screen, Server Guide & Nội Quy');

        const verifiedRoleId = roleMap.get('✅ Verified');
        const permResults = await cm.applyPermissionTemplates(guild, verifiedRoleId);
        await rm.complete(7, undefined, `✅ ${permResults.filter(r => r.status).length} permission templates applied`);

        const roleResults = await cm.configureRolePermissions(guild);
        await rm.complete(8, undefined, `✅ ${roleResults.filter(r => r.status).length} role permissions configured`);

        const verifyChannel = guild.channels.cache.get(channelMap.get('verify')!);
        if (verifyChannel?.isTextBased()) {
          const verifyEmbed = new EmbedBuilder()
            .setTitle('🔐 Xác minh')
            .setDescription('Nhấn nút bên dưới để xác minh bản thân!')
            .setColor(EMBED_COLORS.primary);
          const verifyRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('verify_user')
                .setLabel('Xác minh')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
            );
          await verifyChannel.send({ embeds: [verifyEmbed], components: [verifyRow] });
        }

        const welcomeChannel = guild.channels.cache.get(channelMap.get('welcome')!);
        if (welcomeChannel?.isTextBased()) {
          const guideEmbed = new EmbedBuilder()
            .setTitle(`${Emojis.welcome} Chào mừng đến với ${serverName}!`)
            .setDescription([
              `${Emojis.hypershiny} Rất vui được chào đón bạn đến với cộng đồng Roblox của chúng tôi!`,
              '',
              '━━━━━━━━━━━━━━━━━━━━━━',
              '',
              '┏━━━━━━━━━━━━━━━━━━━┓',
              '',
              `┣ ${Emojis.pinkverified} **Bước 1:** Giới thiệu bản thân tại <#${channelMap.get('welcome')}>`,
              `┣ ${Emojis.alert} **Bước 2:** Đọc kỹ nội quy tại <#${channelMap.get('rules')}>`,
              `┣ ${Emojis.hyperstaff} **Bước 3:** Xác minh bản thân tại <#${channelMap.get('verify')}>`,
              `┣ ${Emojis.reactionroles975} **Bước 4:** Chọn role sở thích tại khu vực Roles`,
              `┣ ${Emojis.arrowr} **Bước 5:** Tham gia trò chuyện tại <#${channelMap.get('general')}>`,
              `┣ ${Emojis.whitestars2} **Bước 6:** Ghé thăm <#${channelMap.get('games')}> để chơi Roblox cùng mọi người`,
              `┗ ${Emojis.alert} **Cần hỗ trợ?** Tạo ticket tại <#${channelMap.get('tickets')}>`,
              '',
              '┗━━━━━━━━━━━━━━━━━━━┛',
              '',
              '━━━━━━━━━━━━━━━━━━━━━━',
            ].join('\n'))
            .setImage(welcomeGif)
            .setColor(EMBED_COLORS.success)
            .setFooter({ text: serverName, iconURL: welcomeGif });
          await welcomeChannel.send({ embeds: [guideEmbed] });
        }

        const announceChannel = guild.channels.cache.get(channelMap.get('announcements')!);
        if (announceChannel?.isTextBased()) {
          const announceEmbed = new EmbedBuilder()
            .setTitle(`📢 Chào mừng đến với ${serverName}!`)
            .setDescription(`${Emojis.hypershiny} Server đã được thiết lập thành công!\n\n${Emojis.arrowr} Hãy đọc nội quy tại <#${channelMap.get('rules')}> và xác minh bản thân để tham gia cộng đồng!`)
            .setColor(EMBED_COLORS.primary)
            .setFooter({ text: serverName });
          await announceChannel.send({ embeds: [announceEmbed] });
        }

        await rm.complete(9, undefined, '✅ Welcome & Verification messages sent');

        await pawClient.configManager.setLanguage(guild.id, 'vi');
        await pawClient.configManager.setTheme(guild.id, 'modern');
        await pawClient.configManager.updateGuildConfig(guild.id, {
          verificationEnabled: true,
          ticketEnabled: false,
          welcomeEnabled: true,
          autoModEnabled: false,
          levelingEnabled: false,
          economyEnabled: false,
          memberRole: roleMap.get('👤 Member'),
          verifiedRole: verifiedRoleId,
          mutedRole: roleMap.get('🚫 Muted'),
          welcomeChannel: channelMap.get('welcome'),
          ticketCategory: undefined,
          logChannel: channelMap.get('staff')
        });
        await rm.complete(10, '✅ Setup hoàn tất!', 'Server đã được cấu hình thành công.');

        const report = await cm.generateHealthReport(guild, [
          { name: 'Community Enabled', status: true },
          { name: 'Welcome Screen', status: true },
          { name: 'Server Guide', status: true },
          ...serverResults,
          ...autoModResults,
          ...permResults,
          ...roleResults,
          { name: 'Channels Created', status: true },
          { name: 'Roles Created', status: true },
          { name: 'Language: Vietnamese', status: true }
        ]);
        await rm.done(report.embed);
      } catch (error) {
        this.logger.error('SetupModule', 'Default setup failed', error as Error);
        await rm.error('❌ Setup failed. Vui lòng thử lại sau.');
      }
    });
  }

  private async communitySetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const cm = CommunityManager.getInstance();
    const pawClient = this.client as PawRBClient;
    const guildConfig = await pawClient.configManager.getGuildConfig(guild.id);

    const steps = [
      'Community Activation',
      'Server Settings',
      'AutoMod Rules',
      'Welcome Screen',
      'Server Guide',
      'Permission Templates',
      'Role Permissions'
    ];
    const rm = new ResponseManager(interaction).setSteps(steps);

    try {
      const allResults: { name: string; status: boolean; details?: string }[] = [];

      const channelMap = new Map<string, string>();
      const mapChannel = (keyword: string, key: string) => {
        const ch = guild.channels.cache.find(c => c.name.includes(keyword));
        if (ch) channelMap.set(key, ch.id);
      };
      mapChannel('rules', 'rules'); mapChannel('announcements', 'announcements');
      mapChannel('general', 'general'); mapChannel('games', 'games');
      mapChannel('tickets', 'tickets'); mapChannel('staff', 'staff');
      mapChannel('welcome', 'welcome'); mapChannel('verify', 'verify');
      mapChannel('afk', 'afk');

      await rm.init('🚀 Community Setup', '⏳ Đang cấu hình...');

      allResults.push({ name: 'Community Activation', status: await cm.enableCommunity(guild) });
      await rm.complete(0, undefined, `✅ Community: ${guild.features.includes('COMMUNITY') ? 'already enabled' : 'activated'}`);

      const serverResults = await cm.configureServerSettings(guild, channelMap);
      allResults.push(...serverResults);
      await rm.complete(1, undefined, '✅ Server settings configured');

      const modChannel = channelMap.get('staff') || guildConfig.logChannel;
      const autoModResults = await cm.createAutoModRules(guild, modChannel);
      allResults.push(...autoModResults);
      await rm.complete(2, undefined, `✅ AutoMod: ${autoModResults.filter(r => r.status).length}/${autoModResults.length} rules`);

      allResults.push({ name: 'Welcome Screen', status: await cm.setupWelcomeScreen(guild, channelMap) });
      await rm.complete(3, undefined, '✅ Welcome Screen configured');

      allResults.push({ name: 'Server Guide', status: await cm.createServerGuide(guild, channelMap) });
      await rm.complete(4, undefined, '✅ Server Guide created');

      const verifiedRoleId = guild.roles.cache.find(r => r.name === '✅ Verified')?.id;
      const permResults = await cm.applyPermissionTemplates(guild, verifiedRoleId);
      allResults.push(...permResults);
      await rm.complete(5, undefined, `✅ ${permResults.filter(r => r.status).length} permission templates applied`);

      const roleResults = await cm.configureRolePermissions(guild);
      allResults.push(...roleResults);
      await rm.complete(6, '✅ Setup hoàn tất!', `✅ ${roleResults.filter(r => r.status).length} role permissions configured`);

      const report = await cm.generateHealthReport(guild, allResults);
      await rm.done(report.embed);
    } catch (error) {
      this.logger.error('SetupModule', 'Community setup failed', error as Error);
      await rm.error('❌ Community setup failed.');
    }
  }

  private async changeLanguage(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('lang_select')
      .setPlaceholder('Choose a language')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('English').setValue('en').setEmoji('🇬🇧'),
        new StringSelectMenuOptionBuilder().setLabel('Tiếng Việt').setValue('vi').setEmoji('🇻🇳'),
        new StringSelectMenuOptionBuilder().setLabel('日本語').setValue('ja').setEmoji('🇯🇵'),
        new StringSelectMenuOptionBuilder().setLabel('한국어').setValue('ko').setEmoji('🇰🇷'),
        new StringSelectMenuOptionBuilder().setLabel('ไทย').setValue('th').setEmoji('🇹🇭'),
        new StringSelectMenuOptionBuilder().setLabel('Bahasa Indonesia').setValue('id').setEmoji('🇮🇩')
      );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌐 Change Language')
          .setDescription('Select the language for this server.')
          .setColor(EMBED_COLORS.primary)
      ],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      ephemeral: true
    });

    const pawClient = this.client as PawRBClient;
    pawClient.components.registerSelectMenu('lang_select', async (selectInteraction) => {
      const lang = selectInteraction.values[0] as Language;
      await pawClient.configManager.setLanguage(interaction.guild!.id, lang);
      const langNames: Record<string, string> = { en: 'English', vi: 'Tiếng Việt', ja: '日本語', ko: '한국어', th: 'ไทย', id: 'Bahasa Indonesia' };
      const reply = await t(interaction.guild!.id, 'language.changed', langNames[lang] || lang);
      await selectInteraction.reply({
        content: `✅ ${reply}`,
        ephemeral: true
      });
    });
  }
}
