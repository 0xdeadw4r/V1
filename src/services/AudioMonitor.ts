import { Client, VoiceState, GuildMember } from 'discord.js';
import { GuildConfig } from '../models';

interface AudioLevel {
  userId: string;
  guildId: string;
  violations: number;
  lastViolation: Date;
}

export class AudioMonitor {
  private client: Client;
  private audioLevels: Map<string, AudioLevel> = new Map();
  private readonly MAX_VIOLATIONS = 3; // Warnings before disconnect
  private readonly VIOLATION_WINDOW = 60000; // 1 minute window
  private readonly RESET_TIME = 300000; // 5 minutes to reset violations

  constructor(client: Client) {
    this.client = client;
  }

  initialize(): void {
    // Audio monitoring is disabled by default
    // Discord.js does not provide direct access to audio levels from the API
    // This would require voice connection and audio processing which is resource intensive
    console.log('Audio monitor initialized (manual reporting only)');
  }

  // Manual report method for admins to flag users
  async reportUser(member: GuildMember, guildId: string): Promise<void> {
    const key = `${member.id}-${guildId}`;
    const now = new Date();

    let record = this.audioLevels.get(key);

    if (!record) {
      record = {
        userId: member.id,
        guildId,
        violations: 1,
        lastViolation: now
      };
      this.audioLevels.set(key, record);

      try {
        await member.send(
          '⚠️ **Audio Warning**\n\n' +
          'You have been reported for excessively loud audio.\n\n' +
          'Please reduce your volume or you may be disconnected from voice channels.'
        );
      } catch (error) {
        console.log(`Could not DM ${member.user.username}`);
      }
      return;
    }

    // Check if within violation window
    const timeSinceLastViolation = now.getTime() - record.lastViolation.getTime();

    if (timeSinceLastViolation < this.VIOLATION_WINDOW) {
      record.violations++;
      record.lastViolation = now;

      console.log(`[AUDIO MONITOR] ${member.user.username} - Violations: ${record.violations}`);

      // Warning at 2 violations
      if (record.violations === 2) {
        try {
          await member.send(
            '⚠️ **Final Audio Warning**\n\n' +
            'You have been reported multiple times for excessively loud audio.\n\n' +
            'Please reduce your volume immediately or you will be disconnected from voice channels.'
          );
        } catch (error) {
          console.log(`Could not DM ${member.user.username}`);
        }
      }

      // Disconnect at max violations
      if (record.violations >= this.MAX_VIOLATIONS) {
        try {
          if (member.voice.channel) {
            await member.voice.disconnect('Audio abuse - excessively loud audio after multiple warnings');

            console.log(`[AUDIO MONITOR] Disconnected ${member.user.username} for audio abuse`);

            // Send DM notification
            try {
              await member.send(
                '🔇 **Disconnected for Audio Abuse**\n\n' +
                'You have been disconnected from the voice channel for using excessively loud audio after multiple warnings.\n\n' +
                'Please reduce your volume before rejoining.\n\n' +
                'Your violations will reset in 5 minutes.'
              );
            } catch (error) {
              console.log(`Could not DM ${member.user.username}`);
            }

            // Reset violations after disconnect
            this.audioLevels.delete(key);
          }
        } catch (error) {
          console.error(`Failed to disconnect ${member.user.username}:`, error);
        }
      }
    } else {
      // Outside window, reset
      record.violations = 1;
      record.lastViolation = now;
    }
  }

  // Manual check method for admins
  async checkUser(userId: string, guildId: string): Promise<AudioLevel | null> {
    const key = `${userId}-${guildId}`;
    return this.audioLevels.get(key) || null;
  }

  // Clear violations for a user
  clearViolations(userId: string, guildId: string): void {
    const key = `${userId}-${guildId}`;
    this.audioLevels.delete(key);
  }
}