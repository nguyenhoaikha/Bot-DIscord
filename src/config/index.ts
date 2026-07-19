import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export const config: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  dbDialect: process.env.DB_DIALECT || 'sqlite',
  dbStorage: process.env.DB_STORAGE || './database.sqlite',
  redisUrl: process.env.REDIS_URL,
  robloxCookie: process.env.ROBLOX_COOKIE,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  twitchClientId: process.env.TWITCH_CLIENT_ID,
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET,
  githubToken: process.env.GITHUB_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3000'),

};

export const EMBED_COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  error: 0xED4245,
  info: 0x5865F2
} as const;

export const FOOTER_TEXT = 'All-in-One Discord Bot for Roblox';
export const FOOTER_ICON = 'https://i.imgur.com/placeholder.png';
