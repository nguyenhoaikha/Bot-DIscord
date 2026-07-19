import { PermissionResolvable, ColorResolvable, ChannelType, GuildMember, TextChannel, CategoryChannel, VoiceChannel, Role } from 'discord.js';

export type Language = 'en' | 'vi' | 'ja' | 'ko' | 'th' | 'id';
export type ThemeType = 'modern' | 'minimal' | 'glass' | 'cyber' | 'luxury' | 'roblox' | 'neon' | 'dark' | 'light';
export type ServerType = 'gaming' | 'community' | 'development' | 'trading' | 'roleplay' | 'social';
export type ModuleStatus = 'enabled' | 'disabled';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type TicketType = 'support' | 'purchase' | 'report' | 'partnership' | 'application' | 'bugreport';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'claimed' | 'closed' | 'archived';
export type PunishmentType = 'warn' | 'mute' | 'timeout' | 'kick' | 'ban' | 'softban';

export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string;
  dbDialect: string;
  dbStorage: string;
  redisUrl?: string;
  robloxCookie?: string;
  youtubeApiKey?: string;
  twitchClientId?: string;
  twitchClientSecret?: string;
  githubToken?: string;
  openaiApiKey?: string;
  dashboardPort: number;
}

export interface ThemeConfig {
  name: ThemeType;
  primary: ColorResolvable;
  secondary: ColorResolvable;
  success: ColorResolvable;
  error: ColorResolvable;
  warning: ColorResolvable;
  embedColor: ColorResolvable;
  buttonStyle: 'PRIMARY' | 'SECONDARY' | 'SUCCESS' | 'DANGER';
  categoryEmoji: string;
  categoryStyle: string;
  channelStyle: string;
}

export const Themes: Record<ThemeType, ThemeConfig> = {
  modern: {
    name: 'modern', primary: '#5865F2', secondary: '#4752C4', success: '#57F287', error: '#ED4245', warning: '#FEE75C',
    embedColor: '#5865F2', buttonStyle: 'PRIMARY', categoryEmoji: '📌', categoryStyle: '│', channelStyle: '🔹'
  },
  minimal: {
    name: 'minimal', primary: '#FFFFFF', secondary: '#999999', success: '#00FF88', error: '#FF4444', warning: '#FFAA00',
    embedColor: '#FFFFFF', buttonStyle: 'SECONDARY', categoryEmoji: '⬜', categoryStyle: '〖', channelStyle: '◻️'
  },
  glass: {
    name: 'glass', primary: '#9B59B6', secondary: '#8E44AD', success: '#2ECC71', error: '#E74C3C', warning: '#F1C40F',
    embedColor: '#9B59B6', buttonStyle: 'PRIMARY', categoryEmoji: '🪟', categoryStyle: '┇', channelStyle: '🔮'
  },
  cyber: {
    name: 'cyber', primary: '#00FF41', secondary: '#008F11', success: '#00FF88', error: '#FF0044', warning: '#FFFF00',
    embedColor: '#00FF41', buttonStyle: 'SUCCESS', categoryEmoji: '⚡', categoryStyle: '▸', channelStyle: '💚'
  },
  luxury: {
    name: 'luxury', primary: '#C9A84C', secondary: '#A8882E', success: '#00FF88', error: '#FF4444', warning: '#FFAA00',
    embedColor: '#C9A84C', buttonStyle: 'PRIMARY', categoryEmoji: '👑', categoryStyle: '┅', channelStyle: '✨'
  },
  roblox: {
    name: 'roblox', primary: '#FF0044', secondary: '#00A2FF', success: '#00FF88', error: '#FF0044', warning: '#FFAA00',
    embedColor: '#FF0044', buttonStyle: 'DANGER', categoryEmoji: '🔴', categoryStyle: '═', channelStyle: '🔵'
  },
  neon: {
    name: 'neon', primary: '#FF00FF', secondary: '#00FFFF', success: '#00FF88', error: '#FF0044', warning: '#FFFF00',
    embedColor: '#FF00FF', buttonStyle: 'SUCCESS', categoryEmoji: '💜', categoryStyle: '⋆', channelStyle: '🩷'
  },
  dark: {
    name: 'dark', primary: '#2C2C2C', secondary: '#1A1A1A', success: '#00FF88', error: '#FF4444', warning: '#FFAA00',
    embedColor: '#2C2C2C', buttonStyle: 'SECONDARY', categoryEmoji: '🌙', categoryStyle: '▪', channelStyle: '🌑'
  },
  light: {
    name: 'light', primary: '#FFFFFF', secondary: '#F0F0F0', success: '#00AA66', error: '#CC3333', warning: '#CC8800',
    embedColor: '#7289DA', buttonStyle: 'PRIMARY', categoryEmoji: '☀️', categoryStyle: '○', channelStyle: '🌤'
  }
};

export interface ServerSetupData {
  serverName: string;
  language: Language;
  theme: ThemeType;
  serverType: ServerType;
  robloxGame: string;
  verification: boolean;
  ticket: boolean;
  logging: boolean;
  welcome: boolean;
  automod: boolean;
  leveling: boolean;
  economy: boolean;
}

export interface ChannelPerm {
  id: string;
  allow?: bigint;
  deny?: bigint;
}

export interface ChannelStructure {
  category: string;
  categoryPerms?: ChannelPerm[];
  channels: { name: string; type: ChannelType; topic?: string; perms?: ChannelPerm[] }[];
}

const VIEW = 1024n;
const SEND = 2048n;
const READ_HISTORY = 65536n;
const CONNECT = 1048576n;
const SPEAK = 2097152n;

export const DefaultChannels: ChannelStructure[] = [
  {
    category: '𝗛𝗢𝗠𝗘',
    categoryPerms: [
      { id: '@everyone', allow: VIEW | READ_HISTORY }
    ],
    channels: [
      { name: '🍓・welcome', type: ChannelType.GuildText, topic: 'Chào mừng đến với server!' },
      { name: '📜・rules', type: ChannelType.GuildText, topic: 'Nội quy server', perms: [{ id: '@everyone', allow: VIEW | READ_HISTORY, deny: SEND }] },
      { name: '🔑・verify', type: ChannelType.GuildText, topic: 'Xác minh bản thân', perms: [{ id: '@everyone', allow: VIEW | READ_HISTORY, deny: SEND }] }
    ]
  },
  {
    category: '𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
    categoryPerms: [],
    channels: [
      { name: '💬・general', type: ChannelType.GuildText, topic: 'Trò chuyện chung' },
      { name: '🖼・gallery', type: ChannelType.GuildText, topic: 'Chia sẻ ảnh' },
      { name: '🎉・events', type: ChannelType.GuildText, topic: 'Sự kiện' }
    ]
  },
  {
    category: '𝗥𝗢𝗕𝗟𝗢𝗫',
    categoryPerms: [],
    channels: [
      { name: '🎮・games', type: ChannelType.GuildText, topic: 'Thảo luận game' },
      { name: '💹・market', type: ChannelType.GuildText, topic: 'Mua bán' },
      { name: '💻・scripts', type: ChannelType.GuildText, topic: 'Script & code' }
    ]
  },
  {
    category: '𝗦𝗨𝗣𝗣𝗢𝗥𝗧',
    categoryPerms: [],
    channels: [
      { name: '🎫・tickets', type: ChannelType.GuildText, topic: 'Tạo ticket hỗ trợ' },
      { name: '💡・feedback', type: ChannelType.GuildText, topic: 'Góp ý' }
    ]
  },
  {
    category: '𝗦𝗧𝗔𝗙𝗙',
    categoryPerms: [
      { id: '@everyone', deny: VIEW }
    ],
    channels: [
      { name: '🛡️・staff', type: ChannelType.GuildText, topic: 'Staff chat' }
    ]
  },
  {
    category: '𝗩𝗢𝗜𝗖𝗘',
    categoryPerms: [],
    channels: [
      { name: '🎙・voice', type: ChannelType.GuildVoice },
      { name: '🌙・afk', type: ChannelType.GuildVoice }
    ]
  }
];

export interface RoleStructure {
  name: string;
  color: ColorResolvable;
  permissions: PermissionResolvable[];
  position: number;
  mentionable: boolean;
}

export const DefaultRoles: RoleStructure[] = [
  { name: '👑 Owner', color: '#FFD700', permissions: ['Administrator'], position: 100, mentionable: true },
  { name: '⚡ Developer', color: '#00FF00', permissions: ['Administrator'], position: 95, mentionable: true },
  { name: '🛡 Administrator', color: '#FF0000', permissions: ['Administrator'], position: 90, mentionable: true },
  { name: '🔨 Moderator', color: '#FFA500', permissions: ['KickMembers', 'BanMembers', 'MuteMembers', 'DeafenMembers', 'MoveMembers'], position: 80, mentionable: true },
  { name: '🎫 Support', color: '#00BFFF', permissions: ['ManageMessages', 'ReadMessageHistory'], position: 70, mentionable: true },
  { name: '🎨 Designer', color: '#FF69B4', permissions: ['ManageNicknames'], position: 60, mentionable: true },
  { name: '🧪 Tester', color: '#9932CC', permissions: [], position: 50, mentionable: true },
  { name: '💎 Premium', color: '#FFD700', permissions: [], position: 40, mentionable: false },
  { name: '⭐ Booster', color: '#FF69B4', permissions: [], position: 30, mentionable: false },
  { name: '🤖 Bot', color: '#5865F2', permissions: [], position: 20, mentionable: false },
  { name: '✅ Verified', color: '#00FF00', permissions: [], position: 15, mentionable: false },
  { name: '👤 Member', color: '#00FF00', permissions: [], position: 10, mentionable: false },
  { name: '🚫 Muted', color: '#808080', permissions: [], position: 5, mentionable: false }
];

export interface Warning {
  id: string;
  userId: string;
  guildId: string;
  moderatorId: string;
  reason: string;
  timestamp: Date;
  active: boolean;
}

export interface Ticket {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  claimerId?: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  closedAt?: Date;
  subject: string;
}

export interface LevelData {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  weeklyXp: number;
  monthlyXp: number;
  voiceMinutes: number;
  lastMessage: Date;
}

export interface EconomyData {
  userId: string;
  guildId: string;
  balance: number;
  totalEarned: number;
  dailyLastClaim: Date;
  weeklyLastClaim: Date;
  monthlyLastClaim: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: { type: string; value: number };
  reward?: { type: string; amount: number };
}

export interface ModuleManifest {
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  commands: string[];
  events: string[];
  dependencies: string[];
}

export interface GuildSettings {
  guildId: string;
  language: Language;
  theme: ThemeType;
  prefix: string;
  modules: Record<string, boolean>;
  welcomeChannel?: string;
  verifyChannel?: string;
  ticketCategory?: string;
  logChannel?: string;
  memberRole?: string;
  verifiedRole?: string;
  mutedRole?: string;
  autoModEnabled: boolean;
  verificationEnabled: boolean;
  welcomeEnabled: boolean;
  ticketEnabled: boolean;
  levelingEnabled: boolean;
  economyEnabled: boolean;
  welcomeMessage?: string;
  leaveMessage?: string;
  welcomeEmbedTitle?: string;
  ticketSupportRole?: string;
  welcomeEmbedColor?: string;
  welcomeEmbedAuthorName?: string;
  welcomeEmbedAuthorIcon?: string;
  welcomeEmbedFooterText?: string;
  welcomeEmbedFooterIcon?: string;
  welcomeEmbedThumbnail?: string;
  welcomeEmbedImage?: string;
  welcomeEmbedTimestamp?: boolean;
  welcomeButtons?: string;
  welcomeAutoSend?: boolean;
  welcomeDeleteDelay?: number;
  welcomePingMember?: boolean;
  welcomeSilent?: boolean;
  welcomeEmbedOnly?: boolean;
  welcomeAllowedMentions?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
