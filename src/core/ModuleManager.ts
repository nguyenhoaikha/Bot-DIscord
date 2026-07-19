import { Client } from 'discord.js';
import { ModuleManifest, ModuleStatus } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export interface BotModule {
  manifest: ModuleManifest;
  initialize(client: Client): Promise<void>;
  enable(client: Client): Promise<void>;
  disable(client: Client): Promise<void>;
}

export class ModuleManager {
  private static instance: ModuleManager;
  private modules: Map<string, BotModule> = new Map();
  private moduleStatus: Map<string, ModuleStatus> = new Map();

  private constructor() {}

  static getInstance(): ModuleManager {
    if (!ModuleManager.instance) {
      ModuleManager.instance = new ModuleManager();
    }
    return ModuleManager.instance;
  }

  register(module: BotModule): void {
    this.modules.set(module.manifest.name, module);
    this.moduleStatus.set(module.manifest.name, module.manifest.enabled ? 'enabled' : 'disabled');
    logger.info('ModuleManager', `Registered module: ${module.manifest.name} v${module.manifest.version}`);
  }

  async initializeAll(client: Client): Promise<void> {
    for (const [, mod] of this.modules) {
      try {
        await mod.initialize(client);
        logger.info('ModuleManager', `Initialized module: ${mod.manifest.name}`);
      } catch (error) {
        logger.error('ModuleManager', `Failed to initialize ${mod.manifest.name}`, error as Error);
      }
    }
  }

  async enableModule(name: string, client: Client): Promise<boolean> {
    const mod = this.modules.get(name);
    if (!mod) return false;
    try {
      await mod.enable(client);
      this.moduleStatus.set(name, 'enabled');
      logger.info('ModuleManager', `Enabled module: ${name}`);
      return true;
    } catch (error) {
      logger.error('ModuleManager', `Failed to enable ${name}`, error as Error);
      return false;
    }
  }

  async disableModule(name: string, client: Client): Promise<boolean> {
    const mod = this.modules.get(name);
    if (!mod) return false;
    try {
      await mod.disable(client);
      this.moduleStatus.set(name, 'disabled');
      logger.info('ModuleManager', `Disabled module: ${name}`);
      return true;
    } catch (error) {
      logger.error('ModuleManager', `Failed to disable ${name}`, error as Error);
      return false;
    }
  }

  getModule(name: string): BotModule | undefined {
    return this.modules.get(name);
  }

  getStatus(name: string): ModuleStatus {
    return this.moduleStatus.get(name) || 'disabled';
  }

  getAllModules(): BotModule[] {
    return Array.from(this.modules.values());
  }

  getEnabledModules(): BotModule[] {
    return this.getAllModules().filter(m => this.moduleStatus.get(m.manifest.name) === 'enabled');
  }
}
