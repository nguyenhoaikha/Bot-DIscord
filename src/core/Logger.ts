import { LogLevel } from '../types';

export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, module: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
  }

  info(module: string, message: string): void {
    console.log(this.formatMessage('info', module, message));
  }

  warn(module: string, message: string): void {
    console.warn(this.formatMessage('warn', module, message));
  }

  error(module: string, message: string, error?: Error): void {
    console.error(this.formatMessage('error', module, message));
    if (error?.stack) {
      console.error(error.stack);
    }
  }

  debug(module: string, message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', module, message));
    }
  }
}
