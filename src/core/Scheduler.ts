import cron from 'node-cron';
import { Logger } from './Logger';

const logger = Logger.getInstance();

interface ScheduledTask {
  name: string;
  cronExpression: string;
  task: () => Promise<void>;
  running: boolean;
}

export class Scheduler {
  private static instance: Scheduler;
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  addTask(name: string, cronExpression: string, task: () => Promise<void>): void {
    this.tasks.set(name, { name, cronExpression, task, running: false });
    const job = cron.schedule(cronExpression, async () => {
      if (this.tasks.get(name)?.running) return;
      const taskDef = this.tasks.get(name);
      if (taskDef) {
        taskDef.running = true;
        try {
          await taskDef.task();
        } catch (error) {
          logger.error('Scheduler', `Task "${name}" failed`, error as Error);
        }
        taskDef.running = false;
      }
    });
    this.cronJobs.set(name, job);
    logger.info('Scheduler', `Scheduled task: ${name} (${cronExpression})`);
  }

  removeTask(name: string): void {
    const job = this.cronJobs.get(name);
    if (job) {
      job.stop();
      this.cronJobs.delete(name);
    }
    this.tasks.delete(name);
    logger.info('Scheduler', `Removed task: ${name}`);
  }

  startAll(): void {
    for (const [, job] of this.cronJobs) {
      job.start();
    }
    logger.info('Scheduler', 'All scheduled tasks started');
  }

  stopAll(): void {
    for (const [, job] of this.cronJobs) {
      job.stop();
    }
    logger.info('Scheduler', 'All scheduled tasks stopped');
  }
}
