import { Guild, ChannelType, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications, SystemChannelFlagsBitField, TextChannel, AutoModerationRuleTriggerType, AutoModerationRuleEventType, AutoModerationActionType, AutoModerationRuleKeywordPresetType, PermissionsBitField, OverwriteResolvable, EmbedBuilder, Locale, CategoryChannel, VoiceChannel, GuildBasedChannel } from 'discord.js';
import { Logger } from './Logger';
import { Emojis } from '../constants/emojis';

const logger = Logger.getInstance();

interface HealthItem { name: string; status: boolean; details?: string }
interface SafetyIssue { severity: 'low' | 'medium' | 'high'; message: string }

export class CommunityManager {
  private static instance: CommunityManager;
  private constructor() {}
  static getInstance(): CommunityManager {
    if (!CommunityManager.instance) CommunityManager.instance = new CommunityManager();
    return CommunityManager.instance;
  }

  private isManagedChannel(ch: GuildBasedChannel): ch is TextChannel | CategoryChannel | VoiceChannel {
    return ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildCategory || ch.type === ChannelType.GuildVoice;
  }

  // ===== 1. Community Activation =====
  async enableCommunity(guild: Guild): Promise<boolean> {
    try {
      if (guild.features.includes('COMMUNITY')) {
        logger.info('CommunityManager', `${guild.name}: Community already enabled`);
        return true;
      }
      await guild.edit({ features: ['COMMUNITY'] } as any);
      logger.info('CommunityManager', `${guild.name}: Community enabled`);
      return true;
    } catch (error) {
      logger.error('CommunityManager', 'Failed to enable community', error as Error);
      return false;
    }
  }

  // ===== 2. Server Settings =====
  async configureServerSettings(guild: Guild, channelMap: Map<string, string>): Promise<HealthItem[]> {
    const results: HealthItem[] = [];
    try {
      await guild.edit({
        verificationLevel: GuildVerificationLevel.High,
        explicitContentFilter: GuildExplicitContentFilter.AllMembers,
        defaultMessageNotifications: GuildDefaultMessageNotifications.OnlyMentions,
        afkChannel: channelMap.get('afk') || null,
        afkTimeout: 300,
        systemChannel: channelMap.get('general') || null,
        systemChannelFlags: SystemChannelFlagsBitField.resolve(0),
        rulesChannel: channelMap.get('rules') || null,
        publicUpdatesChannel: channelMap.get('staff') || guild.channels.cache.find(c => c.name.includes('staff'))?.id || null,
        preferredLocale: Locale.Vietnamese
      });
      results.push({ name: 'Verification Level High', status: true });
      results.push({ name: 'Explicit Content Filter', status: true });
      results.push({ name: 'Default Notifications', status: true });
      results.push({ name: 'AFK Channel (300s)', status: true });
      results.push({ name: 'System Messages Enabled', status: true });
      results.push({ name: 'Rules & Updates Channels', status: true });
    } catch (error) {
      logger.error('CommunityManager', 'Server settings failed', error as Error);
      results.push({ name: 'Server Settings', status: false, details: (error as Error).message });
    }
    return results;
  }

  // ===== 3. AutoMod Rules =====
  async createAutoModRules(guild: Guild, modChannelId?: string): Promise<HealthItem[]> {
    const results: HealthItem[] = [];
    if (modChannelId) {
      const ch = guild.channels.cache.get(modChannelId);
      if (!ch || !ch.isTextBased()) modChannelId = undefined;
    }
    const alertActions = (alertId?: string) => {
      const acts: any[] = [{ type: AutoModerationActionType.BlockMessage }];
      if (alertId) acts.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channelId: alertId } });
      return acts;
    };
    const ruleExists = (name: string) => guild.autoModerationRules.cache.some(r => r.name === name);

    try {
      if (!ruleExists('Spam Protection')) {
        await guild.autoModerationRules.create({
          name: 'Spam Protection',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Spam,
          actions: alertActions(modChannelId),
          enabled: true
        });
      }
      results.push({ name: 'Spam Protection', status: true });
    } catch (e) { results.push({ name: 'Spam Protection', status: false, details: (e as Error).message }); }

    try {
      if (!ruleExists('Mention Spam')) {
        await guild.autoModerationRules.create({
          name: 'Mention Spam',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.MentionSpam,
          triggerMetadata: { mentionTotalLimit: 10 },
          actions: alertActions(modChannelId),
          enabled: true
        });
      }
      results.push({ name: 'Mention Spam', status: true });
    } catch (e) { results.push({ name: 'Mention Spam', status: false, details: (e as Error).message }); }

    try {
      if (!ruleExists('Invite Links')) {
        await guild.autoModerationRules.create({
          name: 'Invite Links',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: { keywordFilter: ['discord.gg/*', 'discord.com/invite/*', 'discordapp.com/invite/*'] },
          actions: alertActions(modChannelId),
          enabled: true
        });
      }
      results.push({ name: 'Invite Links', status: true });
    } catch (e) { results.push({ name: 'Invite Links', status: false, details: (e as Error).message }); }

    try {
      if (!ruleExists('Scam & Suspicious Links')) {
        await guild.autoModerationRules.create({
          name: 'Scam & Suspicious Links',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.KeywordPreset,
          triggerMetadata: { presets: [AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.Slurs] },
          actions: alertActions(modChannelId),
          enabled: true
        });
      }
      results.push({ name: 'Scam & Suspicious Links', status: true });
    } catch (e) { results.push({ name: 'Scam & Suspicious Links', status: false, details: (e as Error).message }); }

    try {
      if (!ruleExists('Caps Spam')) {
        await guild.autoModerationRules.create({
          name: 'Caps Spam',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: { regexPatterns: ['\\b[A-Z]{5,}\\b'], keywordFilter: [] },
          actions: alertActions(modChannelId),
          enabled: false
        });
      }
      results.push({ name: 'Caps Spam (disabled)', status: true });
    } catch (e) { results.push({ name: 'Caps Spam', status: false, details: (e as Error).message }); }

    try {
      if (!ruleExists('Blocked Words')) {
        await guild.autoModerationRules.create({
          name: 'Blocked Words',
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: ['nigger', 'faggot', 'kys', 'nibba', 'retard', 'nazi', 'hailhitler', 'cp', 'childporn']
          },
          actions: alertActions(modChannelId),
          enabled: true
        });
      }
      results.push({ name: 'Blocked Words', status: true });
    } catch (e) { results.push({ name: 'Blocked Words', status: false, details: (e as Error).message }); }

    return results;
  }

  // ===== 4. Welcome Screen =====
  async setupWelcomeScreen(guild: Guild, channelMap: Map<string, string>): Promise<boolean> {
    try {
      await guild.editWelcomeScreen({
        enabled: true,
        description: '📜 Đọc nội quy → ✅ Xác minh → 🎮 Khám phá cộng đồng',
        welcomeChannels: [
          { channel: channelMap.get('rules')!, emoji: '📜', description: 'Nội quy server' },
          { channel: channelMap.get('general')!, emoji: '💬', description: 'Trò chuyện cùng mọi người' },
          { channel: channelMap.get('games')!, emoji: '🎮', description: 'Khu vực Roblox' },
          { channel: channelMap.get('tickets')!, emoji: '🎫', description: 'Hỗ trợ & khiếu nại' }
        ]
      });
      return true;
    } catch (error) {
      logger.error('CommunityManager', 'Welcome screen failed', error as Error);
      return false;
    }
  }

  // ===== 5. Server Guide =====
  async createServerGuide(guild: Guild, channelMap: Map<string, string>): Promise<boolean> {
    try {
      const guideChannel = guild.channels.cache.get(channelMap.get('rules')!) as TextChannel | undefined;
      if (!guideChannel || guideChannel.type !== ChannelType.GuildText) return false;

      const guideEmbed = new EmbedBuilder()
        .setTitle(`${Emojis.hypershiny} Hướng Dẫn Làm Quen`)
        .setDescription([
          '━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `${Emojis.welcome} Chào mừng bạn đến với **__server__**!`,
          'Hãy làm theo các bước sau để bắt đầu hành trình của bạn:',
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
        .setColor('#5865F2')
        .setFooter({ text: 'Community System', iconURL: guild.iconURL() ?? undefined });

      const messages = await guideChannel.messages.fetch({ limit: 10 });
      const existing = messages.find(m => m.embeds.some(e => e.title?.includes('Hướng Dẫn Làm Quen')));
      if (existing) {
        await existing.edit({ embeds: [guideEmbed] });
      } else {
        await guideChannel.send({ embeds: [guideEmbed] });
      }
      return true;
    } catch (error) {
      logger.error('CommunityManager', 'Server guide failed', error as Error);
      return false;
    }
  }

  // ===== 6. Rules Content =====
  async createRulesContent(guild: Guild, channelMap: Map<string, string>): Promise<boolean> {
    try {
      const rulesChannel = guild.channels.cache.get(channelMap.get('rules')!) as TextChannel | undefined;
      if (!rulesChannel || rulesChannel.type !== ChannelType.GuildText) return false;

      const rulesEmbed = new EmbedBuilder()
        .setTitle('📜 Nội Quy Server')
        .setDescription([
          'Vui lòng đọc và tuân thủ các quy định sau:',
        ].join('\n'))
        .setColor('#5865F2')
        .addFields(
          {
            name: '1. Tôn Trọng Lẫn Nhau',
            value: 'Không quấy rối, phân biệt đối xử hay công kích cá nhân.',
            inline: false
          },
          {
            name: '2. Không Spam',
            value: 'Không spam tin nhắn, emoji hay ping hàng loạt.',
            inline: false
          },
          {
            name: '3. Không Quảng Cáo',
            value: 'Không quảng cáo server, sản phẩm hay dịch vụ khi chưa được phép.',
            inline: false
          },
          {
            name: '4. Nội Dung Phù Hợp',
            value: 'Không chia sẻ nội dung NSFW, bạo lực hay gây sốc.',
            inline: false
          },
          {
            name: '5. Ngôn Ngữ',
            value: 'Ưu tiên tiếng Việt trong các kênh chung.',
            inline: false
          },
          {
            name: '6. Bảo Mật & Quyền Riêng Tư',
            value: 'Không chia sẻ thông tin cá nhân, token hay mật khẩu.',
            inline: false
          },
          {
            name: '7. Tuân Thủ Hướng Dẫn Staff',
            value: 'Tuân theo hướng dẫn của đội ngũ Staff. Tạo ticket nếu cần hỗ trợ.',
            inline: false
          },
          {
            name: '8. Sử Dụng Kênh Đúng Mục Đích',
            value: 'Mỗi kênh có chủ đề riêng. Dùng đúng kênh cho đúng chủ đề.',
            inline: false
          }
        )
        .setFooter({ text: 'Vi phạm nội quy có thể dẫn đến cảnh cáo, mute, hoặc ban.' });

      const rulesMessages = await rulesChannel.messages.fetch({ limit: 10 });
      const existingRules = rulesMessages.find(m => m.embeds.some(e => e.title?.includes('Nội Quy Server')));
      if (existingRules) {
        await existingRules.edit({ embeds: [rulesEmbed] });
      } else {
        await rulesChannel.send({ embeds: [rulesEmbed] });
      }
      return true;
    } catch (error) {
      logger.error('CommunityManager', 'Failed to create rules content', error as Error);
      return false;
    }
  }

  // ===== 7. Permission Templates =====
  async applyPermissionTemplates(guild: Guild, verifiedRoleId?: string): Promise<HealthItem[]> {
    const results: HealthItem[] = [];
    const everyone = guild.roles.everyone.id;
    const verified = verifiedRoleId || guild.roles.cache.find(r => r.name === '✅ Verified')?.id;

    const templates: Record<string, OverwriteResolvable[]> = {
      'HOME': [
        { id: everyone, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.CreatePrivateThreads, PermissionsBitField.Flags.ManageChannels] }
      ],
      'COMMUNITY': [
        { id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        ...(verified ? [{ id: verified, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AddReactions, PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.ReadMessageHistory] }] : [])
      ],
      'ROBLOX': [
        { id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        ...(verified ? [{ id: verified, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.ReadMessageHistory] }] : [])
      ],
      'SUPPORT': [
        { id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        ...(verified ? [{ id: verified, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] }] : [])
      ],
      'STAFF': [
        { id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] }
      ],
      'VOICE': [
        { id: everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        ...(verified ? [{ id: verified, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.Stream, PermissionsBitField.Flags.UseVAD], deny: [PermissionsBitField.Flags.PrioritySpeaker] }] : [])
      ]
    };

    for (const [, cat] of guild.channels.cache) {
      if (cat.type !== ChannelType.GuildCategory) continue;
      const templateKey = Object.keys(templates).find(k => cat.name.includes(k));
      if (!templateKey) continue;
      try {
        await cat.permissionOverwrites.set(templates[templateKey]);
        results.push({ name: `Category ${cat.name}`, status: true });
      } catch (e) {
        results.push({ name: `Category ${cat.name}`, status: false, details: (e as Error).message });
      }

      for (const [, ch] of guild.channels.cache) {
        if (ch.parentId !== cat.id) continue;
        if (!this.isManagedChannel(ch)) continue;
        const chName = ch.name;
        if (chName.includes('welcome') || chName.includes('rules') || chName.includes('verify')) {
          try {
            const deny: any[] = [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.CreatePrivateThreads];
            const perms: OverwriteResolvable[] = [
              { id: everyone, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AddReactions], deny }
            ];
            if (chName.includes('verify') || chName.includes('rules')) {
              perms[0] = { id: everyone, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny };
            }
            await ch.permissionOverwrites.set(perms);
          } catch {}
        }
      }
    }
    return results;
  }

  // ===== 7. Role Permissions =====
  async configureRolePermissions(guild: Guild): Promise<HealthItem[]> {
    const results: HealthItem[] = [];

    for (const [, role] of guild.roles.cache) {
      if (role.name === '🚫 Muted') {
        try {
          for (const [, ch] of guild.channels.cache) {
            if (ch.type === ChannelType.GuildVoice) {
              await ch.permissionOverwrites.create(role, { Speak: false, Connect: false });
            } else if (this.isManagedChannel(ch) && ch.type !== ChannelType.GuildCategory) {
              await ch.permissionOverwrites.create(role, { SendMessages: false, AddReactions: false });
            }
          }
          results.push({ name: 'Role 🚫 Muted permissions', status: true });
        } catch (e) {
          results.push({ name: 'Role 🚫 Muted', status: false, details: (e as Error).message });
        }
        continue;
      }

      const permMap: Record<string, bigint[]> = {
        '👑 Owner': [PermissionsBitField.Flags.Administrator],
        '⚡ Developer': [PermissionsBitField.Flags.Administrator],
        '🛡 Administrator': [PermissionsBitField.Flags.Administrator],
        '🔨 Moderator': [PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.ModerateMembers, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers, PermissionsBitField.Flags.MoveMembers],
        '🎫 Support': [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers],
      };

      if (permMap[role.name]) {
        try {
          await role.setPermissions(permMap[role.name]);
          results.push({ name: `Role ${role.name}`, status: true });
        } catch (e) {
          results.push({ name: `Role ${role.name}`, status: false, details: (e as Error).message });
        }
      }
    }
    return results;
  }

  // ===== 9. Safety Check =====
  async runSafetyCheck(guild: Guild): Promise<{ issues: SafetyIssue[]; score: number }> {
    const issues: SafetyIssue[] = [];
    const botMember = guild.members.me;
    const botHighest = botMember?.roles.highest.position || 0;

    for (const [, role] of guild.roles.cache) {
      if (role.id === guild.id || role.managed || role.position >= botHighest) continue;
      const perms = role.permissions;
      const roleName = role.name;
      if (perms.has(PermissionsBitField.Flags.Administrator) && !roleName.includes('Owner') && !roleName.includes('Developer') && !roleName.includes('Administrator')) {
        issues.push({ severity: 'high', message: `Role @${roleName} có Administrator không cần thiết` });
      }
      if (perms.has(PermissionsBitField.Flags.ManageGuild) && !roleName.includes('Owner') && !roleName.includes('Developer') && !roleName.includes('Administrator') && !roleName.includes('Moderator')) {
        issues.push({ severity: 'medium', message: `Role @${roleName} có Manage Server` });
      }
      if (perms.has(PermissionsBitField.Flags.ManageChannels) && !roleName.includes('Owner') && !roleName.includes('Developer') && !roleName.includes('Administrator')) {
        issues.push({ severity: 'medium', message: `Role @${roleName} có Manage Channels` });
      }
    }

    const staffCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('STAFF')) as CategoryChannel | undefined;
    if (staffCat) {
      const staffPerms = staffCat.permissionOverwrites.cache.get(guild.roles.everyone.id);
      if (staffPerms && !staffPerms.deny.has(PermissionsBitField.Flags.ViewChannel)) {
        issues.push({ severity: 'high', message: 'STAFF category có thể bị @everyone nhìn thấy!' });
      }
    }

    const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === 'high' ? 15 : i.severity === 'medium' ? 8 : 3), 0));
    return { issues, score };
  }

  // ===== 12. Health Report =====
  async generateHealthReport(guild: Guild, setupResults: HealthItem[]): Promise<{ embed: EmbedBuilder; score: number }> {
    const safety = await this.runSafetyCheck(guild);
    const total = setupResults.length;
    const passed = setupResults.filter(r => r.status).length;
    let score = Math.round((passed / Math.max(total, 1)) * 70) + Math.round((safety.score / 100) * 30);

    const passEmoji = (s: boolean) => s ? '✅' : '❌';
    const lines = [
      `**📋 Setup Results (${passed}/${total})**`,
      '',
      ...setupResults.map(r => `${passEmoji(r.status)} **${r.name}**${r.details ? ` — ${r.details}` : ''}`),
      '',
      '━━━━━━━━━━━━━━━━━━',
      `**🔒 Safety Issues:** ${safety.issues.length}`
    ];

    for (const issue of safety.issues) {
      const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`${icon} ${issue.message}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Health Report — ${guild.name}`)
      .setDescription(lines.join('\n'))
      .setColor(score >= 80 ? '#57F287' : score >= 50 ? '#FEE75C' : '#ED4245')
      .addFields({ name: '🏆 Server Score', value: `**${Math.min(100, score)}/100**`, inline: true })
      .setFooter({ text: 'Community System' })
      .setTimestamp();

    return { embed, score: Math.min(100, score) };
  }
}