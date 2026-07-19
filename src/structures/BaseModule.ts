import { Client } from 'discord.js';
import { BotModule } from '../core/ModuleManager';
import { ModuleManifest } from '../types';
import { Logger } from '../core/Logger';

export abstract class BaseModule implements BotModule {
  public abstract manifest: ModuleManifest;
  protected logger: Logger;
  protected client!: Client;

  constructor() {
    this.logger = Logger.getInstance();
  }

  async initialize(client: Client): Promise<void> {
    this.client = client;
    this.logger.info(this.manifest.name, `Module initialized`);
  }

  async enable(client: Client): Promise<void> {
    this.manifest.enabled = true;
    this.logger.info(this.manifest.name, `Module enabled`);
  }

  async disable(client: Client): Promise<void> {
    this.manifest.enabled = false;
    this.logger.info(this.manifest.name, `Module disabled`);
  }
}
