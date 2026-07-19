import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config } from '../config';
import { Logger } from './Logger';
import { Database } from './Database';
import { ErrorHandler } from './ErrorHandler';
import { CacheManager } from './CacheManager';
import { CommandHandler } from './CommandHandler';
import { EventHandler } from './EventHandler';
import { ComponentHandler } from './ComponentHandler';
import { ModuleManager } from './ModuleManager';
import { ConfigManager } from './ConfigManager';
import { PermissionManager } from './PermissionManager';
import { RoleManager } from './RoleManager';
import { ChannelManager } from './ChannelManager';
import { ThemeManager } from './ThemeManager';
import { Localization } from './Localization';
import { Scheduler } from './Scheduler';
import { APIManager } from './APIManager';

const logger = Logger.getInstance();

export class PawRBClient extends Client {
  public database: Database;
  public errorHandler: ErrorHandler;
  public cache: CacheManager;
  public commands: CommandHandler;
  public events: EventHandler;
  public components: ComponentHandler;
  public modules: ModuleManager;
  public configManager: ConfigManager;
  public permissions: PermissionManager;
  public roleManager: RoleManager;
  public channelManager: ChannelManager;
  public themeManager: ThemeManager;
  public localization: Localization;
  public scheduler: Scheduler;
  public api: APIManager;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildEmojisAndStickers
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ]
    });

    this.database = Database.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.cache = CacheManager.getInstance();
    this.commands = CommandHandler.getInstance();
    this.events = EventHandler.getInstance();
    this.components = ComponentHandler.getInstance();
    this.modules = ModuleManager.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.permissions = PermissionManager.getInstance();
    this.roleManager = RoleManager.getInstance();
    this.channelManager = ChannelManager.getInstance();
    this.themeManager = ThemeManager.getInstance();
    this.localization = Localization.getInstance();
    this.scheduler = Scheduler.getInstance();
    this.api = APIManager.getInstance();
  }

  async initialize(): Promise<void> {
    logger.info('PawRB', 'Initializing bot...');

    try {
      await this.database.initialize();
      logger.info('PawRB', 'Database initialized');

      this.events.registerAll(this);
      logger.info('PawRB', 'Events registered');

      await this.modules.initializeAll(this);
      logger.info('PawRB', 'Modules initialized');

      this.scheduler.startAll();
      logger.info('PawRB', 'Scheduler started');

      process.on('unhandledRejection', (reason, promise) => {
        this.errorHandler.handleRejection(reason, promise);
      });

      process.on('uncaughtException', (error) => {
        this.errorHandler.handleException(error);
      });

      logger.info('PawRB', 'Initialization complete');
    } catch (error) {
      logger.error('PawRB', 'Failed to initialize', error as Error);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    await this.login(config.token);
  }
}
