import { Client } from 'discord.js';
import { BotEvent } from '../core/EventHandler';
import { Logger } from '../core/Logger';
import { CommandHandler } from '../core/CommandHandler';
import { config } from '../config';

const logger = Logger.getInstance();

export const readyEvent: BotEvent = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    logger.info('ReadyEvent', `Logged in as ${client.user?.tag}`);

    // Deploy global commands — available in all servers
    await CommandHandler.getInstance().deployCommands(client);

    // If a dev guild is configured, also deploy there for instant sync
    if (config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        // Clear old guild-specific commands first to avoid duplicates
        await guild.commands.set([]);
        logger.info('ReadyEvent', `Cleared guild commands for dev guild ${config.guildId}`);
      } catch {}
    }
  }
};
