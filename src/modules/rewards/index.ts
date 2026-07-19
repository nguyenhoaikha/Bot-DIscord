import { Client, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { PawRBClient } from '../../core/Client';
import { Database } from '../../core/Database';
import { EMBED_COLORS } from '../../config';

const DAILY_COINS = 100;
const WEEKLY_COINS = 500;
const MONTHLY_COINS = 2000;

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId?: string;
}

const DEFAULT_SHOP: ShopItem[] = [
  { id: 'custom_role', name: 'Custom Role', description: 'Get a custom colored role with a name of your choice', price: 5000 },
  { id: 'nickname_change', name: 'Nickname Change', description: 'Request a nickname change from staff', price: 500 },
  { id: 'lucky_charm', name: 'Lucky Charm', description: 'Doubles your next daily reward', price: 1000 },
  { id: 'xp_boost', name: 'XP Boost (1h)', description: 'Double XP for 1 hour', price: 2000 },
  { id: 'rainbow_role', name: 'Rainbow Role', description: 'A role that cycles through colors', price: 10000 },
];

export class RewardsModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Rewards',
    description: 'Economy system with daily/weekly/monthly rewards, shop, and balance management',
    version: '1.0.0',
    enabled: true,
    commands: ['daily', 'weekly', 'monthly', 'shop', 'buy', 'inventory', 'balance', 'pay'],
    events: [],
    dependencies: ['Core']
  };

  private shopItems: ShopItem[] = DEFAULT_SHOP;

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);
    const pawClient = client as PawRBClient;

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward (100 coins)'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.claimDaily(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('weekly').setDescription('Claim your weekly reward (500 coins)'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.claimWeekly(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('monthly').setDescription('Claim your monthly reward (2000 coins)'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.claimMonthly(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder().setName('shop').setDescription('View the item shop'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showShop(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(opt => opt.setName('item').setDescription('Item ID to buy').setRequired(true)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.buyItem(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your purchased items'),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showInventory(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your coin balance')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.showBalance(interaction); }
    });

    pawClient.commands.register({
      data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Pay coins to another user')
        .addUserOption(opt => opt.setName('user').setDescription('User to pay').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to pay').setRequired(true).setMinValue(1)),
      execute: async (interaction: ChatInputCommandInteraction) => { await this.payUser(interaction); }
    });
  }

  private async getOrCreateEconomy(userId: string, guildId: string): Promise<any> {
    const db = Database.getInstance();
    const [record] = await db.models.Economy.findOrCreate({
      where: { userId, guildId },
      defaults: { userId, guildId, balance: 0, totalEarned: 0, dailyLastClaim: new Date(0), weeklyLastClaim: new Date(0), monthlyLastClaim: new Date(0) }
    });
    return record;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  private isSameWeek(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const day1 = d1.getDay() || 7;
    const day2 = d2.getDay() || 7;
    const diff1 = new Date(d1.getTime() - (day1 - 1) * 86400000);
    const diff2 = new Date(d2.getTime() - (day2 - 1) * 86400000);
    return diff1.getTime() === diff2.getTime();
  }

  private isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth();
  }

  private async claimDaily(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const record = await this.getOrCreateEconomy(interaction.user.id, interaction.guild.id);
      const lastClaim = new Date(record.get('dailyLastClaim') as string);

      if (this.isSameDay(lastClaim, new Date())) {
        const nextClaim = new Date(lastClaim.getTime() + 86400000);
        await interaction.reply({ content: `⏰ You already claimed your daily reward! Next claim: <t:${Math.floor(nextClaim.getTime() / 1000)}:R>`, ephemeral: true });
        return;
      }

      const balance = record.get('balance') as number;
      const totalEarned = record.get('totalEarned') as number;

      await record.update({
        balance: balance + DAILY_COINS,
        totalEarned: totalEarned + DAILY_COINS,
        dailyLastClaim: new Date()
      });

      const embed = new EmbedBuilder()
        .setTitle('📅 Daily Reward Claimed!')
        .setDescription(`You received **${DAILY_COINS}** coins!\nNew balance: **${balance + DAILY_COINS}** coins`)
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to claim daily', error as Error);
      await interaction.reply({ content: 'Failed to claim daily reward.', ephemeral: true });
    }
  }

  private async claimWeekly(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const record = await this.getOrCreateEconomy(interaction.user.id, interaction.guild.id);
      const lastClaim = new Date(record.get('weeklyLastClaim') as string);

      if (this.isSameWeek(lastClaim, new Date())) {
        await interaction.reply({ content: '⏰ You already claimed your weekly reward! Come back next week.', ephemeral: true });
        return;
      }

      const balance = record.get('balance') as number;
      const totalEarned = record.get('totalEarned') as number;

      await record.update({
        balance: balance + WEEKLY_COINS,
        totalEarned: totalEarned + WEEKLY_COINS,
        weeklyLastClaim: new Date()
      });

      const embed = new EmbedBuilder()
        .setTitle('📅 Weekly Reward Claimed!')
        .setDescription(`You received **${WEEKLY_COINS}** coins!\nNew balance: **${balance + WEEKLY_COINS}** coins`)
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to claim weekly', error as Error);
      await interaction.reply({ content: 'Failed to claim weekly reward.', ephemeral: true });
    }
  }

  private async claimMonthly(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    try {
      const record = await this.getOrCreateEconomy(interaction.user.id, interaction.guild.id);
      const lastClaim = new Date(record.get('monthlyLastClaim') as string);

      if (this.isSameMonth(lastClaim, new Date())) {
        await interaction.reply({ content: '⏰ You already claimed your monthly reward! Come back next month.', ephemeral: true });
        return;
      }

      const balance = record.get('balance') as number;
      const totalEarned = record.get('totalEarned') as number;

      await record.update({
        balance: balance + MONTHLY_COINS,
        totalEarned: totalEarned + MONTHLY_COINS,
        monthlyLastClaim: new Date()
      });

      const embed = new EmbedBuilder()
        .setTitle('📅 Monthly Reward Claimed!')
        .setDescription(`You received **${MONTHLY_COINS}** coins!\nNew balance: **${balance + MONTHLY_COINS}** coins`)
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to claim monthly', error as Error);
      await interaction.reply({ content: 'Failed to claim monthly reward.', ephemeral: true });
    }
  }

  private async showShop(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🛒 Item Shop')
      .setColor(EMBED_COLORS.primary)
      .setDescription(this.shopItems.map(item =>
        `**${item.name}** (\`${item.id}\`)\n${item.description}\n💰 **${item.price}** coins\n`
      ).join('\n'))
      .setFooter({ text: 'Use /buy item:<id> to purchase' });

    await interaction.reply({ embeds: [embed] });
  }

  private async buyItem(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const itemId = interaction.options.getString('item', true);
    const item = this.shopItems.find(i => i.id === itemId);

    if (!item) {
      await interaction.reply({ content: 'Item not found. Use `/shop` to see available items.', ephemeral: true });
      return;
    }

    try {
      const record = await this.getOrCreateEconomy(interaction.user.id, interaction.guild.id);
      const balance = record.get('balance') as number;

      if (balance < item.price) {
        await interaction.reply({ content: `You need **${item.price}** coins but only have **${balance}**.`, ephemeral: true });
        return;
      }

      await record.update({ balance: balance - item.price });

      const inventoryModelName = `Inventory_${interaction.guild.id.replace(/-/g, '_')}`;
      const db = Database.getInstance();
      const { DataTypes } = require('sequelize');

      if (!db.models[inventoryModelName]) {
        db.models[inventoryModelName] = db.sequelize.define(inventoryModelName, {
          id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
          userId: DataTypes.STRING,
          guildId: DataTypes.STRING,
          itemId: DataTypes.STRING,
          itemName: DataTypes.STRING,
          purchasedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
        });
        await db.models[inventoryModelName].sync();
      }

      await db.models[inventoryModelName].create({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        itemId: item.id,
        itemName: item.name
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful!')
        .setDescription(`You bought **${item.name}** for **${item.price}** coins!\nRemaining balance: **${balance - item.price}** coins`)
        .setColor(EMBED_COLORS.success);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to buy item', error as Error);
      await interaction.reply({ content: 'Failed to process purchase.', ephemeral: true });
    }
  }

  private async showInventory(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const inventoryModelName = `Inventory_${interaction.guild.id.replace(/-/g, '_')}`;
    const db = Database.getInstance();

    if (!db.models[inventoryModelName]) {
      await interaction.reply({ content: 'Your inventory is empty.', ephemeral: true });
      return;
    }

    const items = await db.models[inventoryModelName].findAll({
      where: { userId: interaction.user.id, guildId: interaction.guild.id }
    });

    if (items.length === 0) {
      await interaction.reply({ content: 'Your inventory is empty.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎒 Your Inventory')
      .setColor(EMBED_COLORS.primary)
      .setDescription(items.map((i: any, idx: number) =>
        `**${idx + 1}.** ${i.get('itemName')} — Purchased <t:${Math.floor(new Date(i.get('purchasedAt')).getTime() / 1000)}:R>`
      ).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async showBalance(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const record = await this.getOrCreateEconomy(targetUser.id, interaction.guild.id);
      const balance = record.get('balance') as number;
      const totalEarned = record.get('totalEarned') as number;

      const embed = new EmbedBuilder()
        .setTitle(`💰 Balance: ${targetUser.username}`)
        .setDescription(`**${balance}** coins`)
        .addFields({ name: 'Total Earned', value: `${totalEarned} coins`, inline: true })
        .setColor(EMBED_COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to show balance', error as Error);
      await interaction.reply({ content: 'Failed to fetch balance.', ephemeral: true });
    }
  }

  private async payUser(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot pay yourself.', ephemeral: true });
      return;
    }

    try {
      const senderRecord = await this.getOrCreateEconomy(interaction.user.id, interaction.guild.id);
      const senderBalance = senderRecord.get('balance') as number;

      if (senderBalance < amount) {
        await interaction.reply({ content: `You only have **${senderBalance}** coins but need **${amount}**.`, ephemeral: true });
        return;
      }

      const receiverRecord = await this.getOrCreateEconomy(targetUser.id, interaction.guild.id);
      const receiverBalance = receiverRecord.get('balance') as number;

      await senderRecord.update({ balance: senderBalance - amount });
      await receiverRecord.update({ balance: receiverBalance + amount });

      const embed = new EmbedBuilder()
        .setTitle('💸 Payment Sent')
        .setDescription(`You paid **${amount}** coins to ${targetUser}\nYour balance: **${senderBalance - amount}** coins`)
        .setColor(EMBED_COLORS.success);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(this.manifest.name, 'Failed to process payment', error as Error);
      await interaction.reply({ content: 'Failed to process payment.', ephemeral: true });
    }
  }
}
