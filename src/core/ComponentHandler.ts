import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, Collection } from 'discord.js';
import { Logger } from './Logger';
import { ErrorHandler } from './ErrorHandler';

const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

type ComponentExecutor = (interaction: any) => Promise<void>;

export class ComponentHandler {
  private static instance: ComponentHandler;
  private buttons: Collection<string, ComponentExecutor> = new Collection();
  private selectMenus: Collection<string, ComponentExecutor> = new Collection();
  private modals: Collection<string, ComponentExecutor> = new Collection();

  private constructor() {}

  static getInstance(): ComponentHandler {
    if (!ComponentHandler.instance) {
      ComponentHandler.instance = new ComponentHandler();
    }
    return ComponentHandler.instance;
  }

  registerButton(customId: string, executor: ComponentExecutor): void {
    this.buttons.set(customId, executor);
  }

  registerSelectMenu(customId: string, executor: ComponentExecutor): void {
    this.selectMenus.set(customId, executor);
  }

  registerModal(customId: string, executor: ComponentExecutor): void {
    this.modals.set(customId, executor);
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const executor = this.buttons.get(interaction.customId);
    if (!executor) return;
    try {
      await executor(interaction);
    } catch (error) {
      errorHandler.handle(error as Error, `Button: ${interaction.customId}`);
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const executor = this.selectMenus.get(interaction.customId);
    if (!executor) return;
    try {
      await executor(interaction);
    } catch (error) {
      errorHandler.handle(error as Error, `SelectMenu: ${interaction.customId}`);
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const executor = this.modals.get(interaction.customId);
    if (!executor) return;
    try {
      await executor(interaction);
    } catch (error) {
      errorHandler.handle(error as Error, `Modal: ${interaction.customId}`);
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}
