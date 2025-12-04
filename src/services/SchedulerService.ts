import cron, { ScheduledTask } from 'node-cron';
import { Client } from 'discord.js';
import { GuildConfig } from '../models';
import { sendDailyLogs } from '../utils/webhook';
import { getCurrentDate, getNextResetTime } from '../utils/time';
import { VoiceTracker } from './VoiceTracker';
import { GenzAuthService } from './GenzAuthService';
import { addDays, format } from 'date-fns';

export class SchedulerService {
  private client: Client;
  private voiceTracker: VoiceTracker;
  private scheduledJobs: Map<string, ScheduledTask> = new Map();

  constructor(client: Client, voiceTracker: VoiceTracker) {
    this.client = client;
    this.voiceTracker = voiceTracker;
  }

  async initialize(): Promise<void> {
    await this.scheduleAllGuildResets();
    this.scheduleMidnightCheck();
    this.scheduleDiscountChecks();
    console.log('Scheduler service initialized');
  }

  private async scheduleAllGuildResets(): Promise<void> {
    const configs = await GuildConfig.find({});

    for (const config of configs) {
      this.scheduleGuildReset(config.guildId, config.resetTime, config.timezone);
    }
  }

  scheduleGuildReset(guildId: string, resetTime: string, timezone: string): void {
    const existingJob = this.scheduledJobs.get(guildId);
    if (existingJob) {
      existingJob.stop();
    }

    const [hours, minutes] = resetTime.split(':');
    const cronExpression = `${minutes} ${hours} * * *`;

    const job = cron.schedule(cronExpression, async () => {
      console.log(`Running daily reset for guild ${guildId}`);

      const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
      await sendDailyLogs(guildId, yesterday);

      await this.voiceTracker.splitMidnightSessions(guildId, timezone);
    }, {
      timezone
    });

    this.scheduledJobs.set(guildId, job);
    console.log(`Scheduled daily reset for guild ${guildId} at ${resetTime} ${timezone}`);
  }

  private scheduleMidnightCheck(): void {
    cron.schedule('0 * * * *', async () => {
      const configs = await GuildConfig.find({});

      for (const config of configs) {
        await this.voiceTracker.splitMidnightSessions(config.guildId, config.timezone);
      }
    });

    // Check GenzAuth keys every hour
    cron.schedule('0 * * * *', async () => {
      const configs = await GuildConfig.find({ genzauthSellerKey: { $ne: null } });

      for (const config of configs) {
        await GenzAuthService.checkAndManageStaffKeys(config.guildId, config.timezone);
      }
    });
  }

  // New method to schedule discount checks
  private scheduleDiscountChecks(): void {
    // Schedule to check for active discounts every minute
    cron.schedule('* * * * *', async () => {
      const configs = await GuildConfig.find({});

      for (const config of configs) {
        if (config.discountEnabled) {
          await this.checkAndApplyDiscounts(config.guildId, config.timezone);
        }
      }
    });
  }

  // New method to check and apply discounts
  private async checkAndApplyDiscounts(guildId: string, timezone: string): Promise<void> {
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) return;

    const now = new Date();
    const currentHour = now.getHours(); // Get current hour in the guild's timezone
    const currentDayOfWeek = now.getDay(); // Get current day of the week

    // Check if it's time for a discount
    if (
      guildConfig.discountDayOfWeek === currentDayOfWeek &&
      guildConfig.discountHour === currentHour &&
      guildConfig.discountMinute === now.getMinutes()
    ) {
      // Apply discount
      await this.applyDiscount(guildId, guildConfig.discountRate);
    } else if (
      // Check if discount has expired
      guildConfig.discountEndTime &&
      now.getTime() > new Date(guildConfig.discountEndTime).getTime()
    ) {
      // Revert to original values
      await this.revertToOriginal(guildId);
      // Disable discount and clear end time
      await GuildConfig.updateOne({ guildId }, { $set: { discountEnabled: false, discountEndTime: null } });
    }
  }

  // New method to apply discount
  private async applyDiscount(guildId: string, discountRate: number): Promise<void> {
    console.log(`Applying discount for guild ${guildId}`);
    // Logic to update embed with discounted prices
    // This will depend on how your embeds are structured and managed.
    // You might need to fetch the message ID of the embed and edit it.
    // For now, we'll just log and update the config.
    await GuildConfig.updateOne({ guildId }, { $set: { discountActive: true, discountAppliedAt: new Date() } });
    // In a real scenario, you would send a new embed or edit an existing one.
    // Example: await this.client.channels.cache.get(channelId).messages.fetch(messageId).edit(newEmbedWithDiscount);
  }

  // New method to revert to original values
  private async revertToOriginal(guildId: string): Promise<void> {
    console.log(`Reverting to original values for guild ${guildId}`);
    // Logic to update embed back to original prices
    await GuildConfig.updateOne({ guildId }, { $set: { discountActive: false } });
    // In a real scenario, you would send a new embed or edit an existing one.
  }


  updateGuildSchedule(guildId: string, resetTime: string, timezone: string): void {
    this.scheduleGuildReset(guildId, resetTime, timezone);
  }
}