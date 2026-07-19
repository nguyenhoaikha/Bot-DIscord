import { PawRBClient } from './core/Client';
import { Logger } from './core/Logger';
import { Localization } from './core/Localization';
import { registerAllModules } from './modules/index';
import { en } from './locales/en';
import { vi } from './locales/vi';
import { readyEvent } from './events/ReadyEvent';
import { guildMemberAddEvent } from './events/GuildMemberEvents';

const logger = Logger.getInstance();

const client = new PawRBClient();

const locale = Localization.getInstance();
locale.loadLocale('en', en as any);
locale.loadLocale('vi', vi as any);

registerAllModules();

client.events.register(readyEvent);
client.events.register(guildMemberAddEvent);

client.once('ready', () => {
  logger.info('PawRB', `Bot is ready! Logged in as ${client.user?.tag}`);
  logger.info('PawRB', `Servers: ${client.guilds.cache.size}`);
  logger.info('PawRB', `Users: ${client.users.cache.size}`);
  logger.info('PawRB', `Modules loaded: ${client.modules.getAllModules().length}`);
  logger.info('PawRB', `Commands loaded: ${client.commands.commands.size}`);

  client.user?.setPresence({
    activities: [{ name: 'Roblox Communities', type: 3 }],
    status: 'online'
  });
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await client.commands.handle(interaction);
  } else if (interaction.isButton()) {
    await client.components.handleButton(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await client.components.handleSelectMenu(interaction);
  } else if (interaction.isModalSubmit()) {
    await client.components.handleModal(interaction);
  }
});

client.start().catch((error) => {
  logger.error('PawRB', 'Failed to start bot', error);
  process.exit(1);
});

export default client;
