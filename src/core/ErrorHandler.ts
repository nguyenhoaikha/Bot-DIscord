import { Logger } from './Logger';

const logger = Logger.getInstance();

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handle(error: Error, context?: string): void {
    const module = context || 'Unknown';
    logger.error(module, error.message, error);

    if (process.env.NODE_ENV === 'development') {
      console.error('Full error:', error);
    }
  }

  handleRejection(reason: any, promise: Promise<any>): void {
    logger.error('UnhandledRejection', `Promise rejection: ${reason}`);
  }

  handleException(error: Error): void {
    logger.error('UncaughtException', error.message, error);
  }

  wrap<T>(fn: (...args: any[]) => Promise<T>, context?: string): (...args: any[]) => Promise<T | undefined> {
    return async (...args: any[]): Promise<T | undefined> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error as Error, context);
        return undefined;
      }
    };
  }
}
