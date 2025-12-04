
import { GuildConfig, Staff, Session } from '../models';
import { getCurrentDate, hoursToMinutes, calculateSessionDuration } from '../utils/time';

interface GenzAuthResponse {
  success?: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export class GenzAuthService {
  private static GENZAUTH_API_BASE = 'https://genzauth-tl0c.onrender.com/api/seller';

  private static async makeRequest(
    sellerKey: string,
    type: string,
    additionalParams: Record<string, string> = {}
  ): Promise<GenzAuthResponse> {
    const params = new URLSearchParams({
      sellerkey: sellerKey,
      type,
      format: 'json',
      ...additionalParams,
    });

    const url = `${this.GENZAUTH_API_BASE}?${params.toString()}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read response');
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        };
      }

      const responseText = await response.text();
      
      try {
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse;
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid JSON response from API',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  static async pauseUser(guildId: string, username: string): Promise<boolean> {
    const config = await GuildConfig.findOne({ guildId });
    if (!config?.genzauthSellerKey) {
      console.error('[GenzAuth] No seller key configured for guild:', guildId);
      return false;
    }

    const result = await this.makeRequest(config.genzauthSellerKey, 'banuser', { user: username });
    
    if (result.success) {
      console.log(`[GenzAuth] Paused user: ${username}`);
      return true;
    } else {
      console.error(`[GenzAuth] Failed to pause user ${username}:`, result.error || result.message);
      return false;
    }
  }

  static async resumeUser(guildId: string, username: string): Promise<boolean> {
    const config = await GuildConfig.findOne({ guildId });
    if (!config?.genzauthSellerKey) {
      console.error('[GenzAuth] No seller key configured for guild:', guildId);
      return false;
    }

    const result = await this.makeRequest(config.genzauthSellerKey, 'unbanuser', { user: username });
    
    if (result.success) {
      console.log(`[GenzAuth] Resumed user: ${username}`);
      return true;
    } else {
      console.error(`[GenzAuth] Failed to resume user ${username}:`, result.error || result.message);
      return false;
    }
  }

  static async checkAndManageStaffKeys(guildId: string, timezone: string): Promise<void> {
    const config = await GuildConfig.findOne({ guildId });
    if (!config?.genzauthSellerKey) {
      return;
    }

    const currentDate = getCurrentDate(timezone);
    const staffMembers = await Staff.find({ guildId, isActive: true, genzauthUsername: { $ne: null } });

    for (const staff of staffMembers) {
      if (!staff.genzauthUsername) continue;

      // Check if excused
      const isExcused = staff.excuses.some(e => e.date === currentDate);
      if (isExcused) {
        // If key is paused and user is excused, resume it
        if (staff.genzauthKeyPaused) {
          const resumed = await this.resumeUser(guildId, staff.genzauthUsername);
          if (resumed) {
            staff.genzauthKeyPaused = false;
            await staff.save();
          }
        }
        continue;
      }

      // Calculate today's VC time
      const sessions = await Session.find({
        odcordId: staff.odcordId,
        guildId,
        date: currentDate
      });

      let totalMinutes = sessions.reduce((sum, s) => {
        if (s.isActive) {
          return sum + calculateSessionDuration(s.joinTime, new Date());
        }
        return sum + s.duration;
      }, 0);

      const threeHoursInMinutes = 180; // 3 hours

      // If less than 3 hours and key is not paused, pause it
      if (totalMinutes < threeHoursInMinutes && !staff.genzauthKeyPaused) {
        const paused = await this.pauseUser(guildId, staff.genzauthUsername);
        if (paused) {
          staff.genzauthKeyPaused = true;
          await staff.save();
          console.log(`[GenzAuth] Paused key for ${staff.odcordUsername} (${staff.genzauthUsername}) - only ${totalMinutes} minutes logged`);
        }
      }
      // If 3+ hours and key is paused, resume it
      else if (totalMinutes >= threeHoursInMinutes && staff.genzauthKeyPaused) {
        const resumed = await this.resumeUser(guildId, staff.genzauthUsername);
        if (resumed) {
          staff.genzauthKeyPaused = false;
          await staff.save();
          console.log(`[GenzAuth] Resumed key for ${staff.odcordUsername} (${staff.genzauthUsername}) - ${totalMinutes} minutes logged`);
        }
      }
    }
  }
}
