import { Client, TextChannel } from 'discord.js';
import { Staff, GuildConfig, Session, Adjustment } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';

export class ReminderService {
  private client: Client;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    this.intervalId = setInterval(() => this.checkAndSendReminders(), 60000);
    console.log('Reminder service started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndSendReminders(): Promise<void> {
    try {
      const configs = await GuildConfig.find({});
      
      for (const config of configs) {
        try {
          const currentDate = getCurrentDate(config.timezone);
          const staff = await Staff.find({ guildId: config.guildId, isActive: true });

          for (const member of staff) {
            try {
              const isExcused = member.excuses.some(e => e.date === currentDate);
              if (isExcused) continue;

              const totalMinutes = await this.getUserTodayTime(member.odcordId, config.guildId, currentDate);
              const requiredMinutes = hoursToMinutes(member.requiredHours);

              if (totalMinutes >= requiredMinutes) continue;

              const shouldSendReminder = this.shouldSendReminder(member.lastReminderSent, config.reminderIntervalHours);
              
              if (shouldSendReminder) {
                const sent = await this.sendReminder(member, totalMinutes, requiredMinutes);
                if (sent) {
                  member.lastReminderSent = new Date();
                  await member.save();
                }
              }
            } catch (memberError) {
              console.error(`Error processing reminder for ${member.odcordUsername}:`, memberError);
            }
          }
        } catch (configError) {
          console.error(`Error processing reminders for guild ${config.guildId}:`, configError);
        }
      }
    } catch (error) {
      console.error('Error in checkAndSendReminders:', error);
    }
  }

  private shouldSendReminder(lastSent: Date | null, intervalHours: number): boolean {
    if (!lastSent) return true;
    
    const now = new Date();
    const hoursSinceLastReminder = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastReminder >= intervalHours;
  }

  private async getUserTodayTime(odcordId: string, guildId: string, date: string): Promise<number> {
    const sessions = await Session.find({
      odcordId,
      guildId,
      date
    });

    let totalMinutes = sessions.reduce((sum, s) => {
      if (s.isActive) {
        return sum + calculateSessionDuration(s.joinTime, new Date());
      }
      return sum + s.duration;
    }, 0);

    const adjustments = await Adjustment.find({ odcordId, guildId, date });
    for (const adj of adjustments) {
      if (adj.type === 'add') {
        totalMinutes += adj.minutes;
      } else {
        totalMinutes -= adj.minutes;
      }
    }

    return Math.max(0, totalMinutes);
  }

  private async sendReminder(staff: any, currentMinutes: number, requiredMinutes: number): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(staff.odcordId).catch(() => null);
      if (!user) {
        console.log(`Could not fetch user ${staff.odcordUsername} for reminder`);
        return false;
      }

      const remainingMinutes = requiredMinutes - currentMinutes;
      const progressPercent = Math.min(100, Math.round((currentMinutes / requiredMinutes) * 100));

      const embed = {
        color: 0xFFA500,
        title: 'VC Time Reminder',
        description: `You still need ${formatDuration(remainingMinutes)} to meet your daily requirement.`,
        fields: [
          {
            name: 'Progress',
            value: `${formatDuration(currentMinutes)} / ${formatDuration(requiredMinutes)} (${progressPercent}%)`,
            inline: true
          },
          {
            name: 'Required',
            value: `${staff.requiredHours} hours`,
            inline: true
          }
        ],
        footer: {
          text: 'Use /mytime to check your current progress'
        },
        timestamp: new Date().toISOString()
      };

      await user.send({ embeds: [embed] });
      console.log(`Sent reminder to ${staff.odcordUsername}`);
      return true;
    } catch (error: any) {
      if (error?.code === 50007) {
        console.log(`Cannot send DM to ${staff.odcordUsername} - DMs disabled`);
      } else {
        console.error(`Failed to send reminder to ${staff.odcordUsername}:`, error?.message || error);
      }
      return false;
    }
  }
}
