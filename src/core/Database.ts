import { Sequelize, DataTypes, Model, ModelCtor } from 'sequelize';
import { config } from '../config';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class Database {
  private static instance: Database;
  public sequelize: Sequelize;
  public models: { [key: string]: ModelCtor<Model> } = {};

  private constructor() {
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: config.dbStorage,
      logging: false,
      define: {
        timestamps: true
      }
    });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.sequelize.authenticate();
      logger.info('Database', 'Connected to SQLite database');

      this.defineModels();
      await this.sequelize.sync({ alter: true });
      logger.info('Database', 'All models synchronized');
    } catch (error) {
      logger.error('Database', 'Failed to connect', error as Error);
      throw error;
    }
  }

  private defineModels(): void {
    this.models.GuildSettings = this.sequelize.define('GuildSettings', {
      guildId: { type: DataTypes.STRING, primaryKey: true },
      language: { type: DataTypes.STRING, defaultValue: 'vi' },
      theme: { type: DataTypes.STRING, defaultValue: 'modern' },
      prefix: { type: DataTypes.STRING, defaultValue: '/' },
      modules: { type: DataTypes.JSON, defaultValue: {} },
      welcomeChannel: DataTypes.STRING,
      verifyChannel: DataTypes.STRING,
      ticketCategory: DataTypes.STRING,
      logChannel: DataTypes.STRING,
      memberRole: DataTypes.STRING,
      verifiedRole: DataTypes.STRING,
      mutedRole: DataTypes.STRING,
      autoModEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      verificationEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      welcomeEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      ticketEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      levelingEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      economyEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      welcomeMessage: { type: DataTypes.TEXT, defaultValue: '' },
      leaveMessage: { type: DataTypes.TEXT, defaultValue: '' },
      welcomeEmbedTitle: { type: DataTypes.TEXT, defaultValue: '' },
      welcomeEmbedColor: { type: DataTypes.STRING, defaultValue: '#6366F1' },
      welcomeEmbedAuthorName: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedAuthorIcon: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedFooterText: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedFooterIcon: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedThumbnail: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedImage: { type: DataTypes.STRING, defaultValue: '' },
      welcomeEmbedTimestamp: { type: DataTypes.BOOLEAN, defaultValue: true },
      welcomeButtons: { type: DataTypes.TEXT, defaultValue: '[]' },
      welcomeAutoSend: { type: DataTypes.BOOLEAN, defaultValue: true },
      welcomeDeleteDelay: { type: DataTypes.INTEGER, defaultValue: 0 },
      welcomePingMember: { type: DataTypes.BOOLEAN, defaultValue: true },
      welcomeSilent: { type: DataTypes.BOOLEAN, defaultValue: false },
      welcomeEmbedOnly: { type: DataTypes.BOOLEAN, defaultValue: false },
      welcomeAllowedMentions: { type: DataTypes.BOOLEAN, defaultValue: true }
    });

    this.models.Warning = this.sequelize.define('Warning', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: DataTypes.STRING,
      guildId: DataTypes.STRING,
      moderatorId: DataTypes.STRING,
      reason: DataTypes.TEXT,
      active: { type: DataTypes.BOOLEAN, defaultValue: true }
    });

    this.models.Ticket = this.sequelize.define('Ticket', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      guildId: DataTypes.STRING,
      channelId: DataTypes.STRING,
      creatorId: DataTypes.STRING,
      claimerId: DataTypes.STRING,
      type: DataTypes.STRING,
      priority: { type: DataTypes.STRING, defaultValue: 'medium' },
      status: { type: DataTypes.STRING, defaultValue: 'open' },
      subject: DataTypes.TEXT
    });

    this.models.Level = this.sequelize.define('Level', {
      userId: DataTypes.STRING,
      guildId: DataTypes.STRING,
      xp: { type: DataTypes.INTEGER, defaultValue: 0 },
      level: { type: DataTypes.INTEGER, defaultValue: 0 },
      weeklyXp: { type: DataTypes.INTEGER, defaultValue: 0 },
      monthlyXp: { type: DataTypes.INTEGER, defaultValue: 0 },
      voiceMinutes: { type: DataTypes.INTEGER, defaultValue: 0 }
    });

    this.models.Economy = this.sequelize.define('Economy', {
      userId: DataTypes.STRING,
      guildId: DataTypes.STRING,
      balance: { type: DataTypes.INTEGER, defaultValue: 0 },
      totalEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
      dailyLastClaim: DataTypes.DATE,
      weeklyLastClaim: DataTypes.DATE,
      monthlyLastClaim: DataTypes.DATE
    });

    this.models.Achievement = this.sequelize.define('Achievement', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: DataTypes.STRING,
      guildId: DataTypes.STRING,
      achievementId: DataTypes.STRING,
      unlockedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    });

    this.models.Invite = this.sequelize.define('Invite', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      guildId: DataTypes.STRING,
      inviterId: DataTypes.STRING,
      inviteCode: DataTypes.STRING,
      uses: { type: DataTypes.INTEGER, defaultValue: 0 }
    });

    this.models.Birthday = this.sequelize.define('Birthday', {
      userId: DataTypes.STRING,
      guildId: DataTypes.STRING,
      date: DataTypes.DATEONLY,
      timezone: DataTypes.STRING
    });

    this.models.ReactionRole = this.sequelize.define('ReactionRole', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      guildId: DataTypes.STRING,
      channelId: DataTypes.STRING,
      messageId: DataTypes.STRING,
      roleId: DataTypes.STRING,
      emoji: DataTypes.STRING,
      type: { type: DataTypes.STRING, defaultValue: 'reaction' }
    });

    this.models.ScheduledEvent = this.sequelize.define('ScheduledEvent', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      guildId: DataTypes.STRING,
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      date: DataTypes.DATE,
      type: DataTypes.STRING
    });

    this.models.Giveaway = this.sequelize.define('Giveaway', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      guildId: DataTypes.STRING,
      channelId: DataTypes.STRING,
      messageId: DataTypes.STRING,
      prize: DataTypes.STRING,
      winners: { type: DataTypes.INTEGER, defaultValue: 1 },
      endsAt: DataTypes.DATE,
      ended: { type: DataTypes.BOOLEAN, defaultValue: false },
      hostedBy: DataTypes.STRING
    });
  }

  async getGuildSettings(guildId: string): Promise<any> {
    const [settings] = await this.models.GuildSettings.findOrCreate({
      where: { guildId },
      defaults: { guildId }
    });
    return settings;
  }

  async updateGuildSettings(guildId: string, updates: any): Promise<void> {
    await this.models.GuildSettings.update(updates, { where: { guildId } });
  }
}
