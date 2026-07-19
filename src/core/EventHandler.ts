import { Client } from 'discord.js';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void>;
}

export class EventHandler {
  private static instance: EventHandler;
  private events: Map<string, BotEvent[]> = new Map();

  private constructor() {}

  static getInstance(): EventHandler {
    if (!EventHandler.instance) {
      EventHandler.instance = new EventHandler();
    }
    return EventHandler.instance;
  }

  register(event: BotEvent): void {
    const existing = this.events.get(event.name) || [];
    existing.push(event);
    this.events.set(event.name, existing);
  }

  registerAll(client: Client): void {
    for (const [eventName, handlers] of this.events) {
      for (const handler of handlers) {
        if (handler.once) {
          client.once(eventName, (...args: any[]) => {
            handler.execute(...args).catch(err => {
              logger.error('EventHandler', `Error in once event ${eventName}`, err);
            });
          });
        } else {
          client.on(eventName, (...args: any[]) => {
            handler.execute(...args).catch(err => {
              logger.error('EventHandler', `Error in event ${eventName}`, err);
            });
          });
        }
      }
    }
    logger.info('EventHandler', `Registered ${this.events.size} event types`);
  }
}
