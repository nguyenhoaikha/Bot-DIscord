import { Client, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, Collection } from 'discord.js';
import { Logger } from './Logger';
import { ErrorHandler } from './ErrorHandler';

const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

export interface BotCommand {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  guildOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: bigint[];
}

export class CommandHandler {
  private static instance: CommandHandler;
  public commands: Collection<string, BotCommand> = new Collection();

  private constructor() {}

  static getInstance(): CommandHandler {
    if (!CommandHandler.instance) {
      CommandHandler.instance = new CommandHandler();
    }
    return CommandHandler.instance;
  }

  register(command: BotCommand): void {
    this.commands.set(command.data.name, command);
    logger.info('CommandHandler', `Registered command: /${command.data.name}`);
  }

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: 'Command not found.', ephemeral: true });
      return;
    }

    if (command.guildOnly && !interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (command.ownerOnly && interaction.user.id !== interaction.guild?.ownerId) {
      await interaction.reply({ content: 'This command is owner-only.', ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      errorHandler.handle(error as Error, `Command: ${interaction.commandName}`);
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: '❌ An error occurred. Please try again.' });
        } else if (interaction.replied) {
          await interaction.followUp({ content: '❌ An error occurred. Please try again.', ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
        }
      } catch { }
    }
  }

  async deployCommands(client: Client, guildId?: string): Promise<void> {
    const commands = this.commands.map(c => c.data);

    try {
      if (guildId) {
        const guild = await client.guilds.fetch(guildId);
        await guild.commands.set(commands);
        logger.info('CommandHandler', `Deployed ${commands.length} commands to guild ${guildId}`);
      } else {
        await client.application?.commands.set(commands);
        logger.info('CommandHandler', `Deployed ${commands.length} global commands`);
      }
    } catch (error) {
      logger.error('CommandHandler', 'Failed to deploy commands', error as Error);
    }
  }
}
