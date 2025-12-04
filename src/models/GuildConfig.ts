import mongoose, { Schema, Document } from 'mongoose';

export interface IGuildConfig extends Document {
  guildId: string;
  timezone: string;
  resetTime: string;
  reminderIntervalHours: number;
  webhookStaff: string | null;
  webhookUsers: string | null;
  afkChannelId: string | null;

  genzauthSellerKey: string | null;

  activeTalkingMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GuildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true },
  timezone: { 
    type: String, 
    default: 'Asia/Kolkata',
    validate: {
      validator: function(v: string) {
        // Validate IANA timezone
        try {
          Intl.DateTimeFormat(undefined, { timeZone: v });
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid timezone. Must be a valid IANA timezone identifier (e.g., Asia/Kolkata)'
    }
  },
  resetTime: { type: String, default: '00:00' },
  reminderIntervalHours: { type: Number, default: 3 },
  webhookStaff: { type: String, default: null },
  webhookUsers: { type: String, default: null },
  afkChannelId: { type: String, default: null },
  activeTalkingMode: { type: Boolean, default: false },
  genzauthSellerKey: { type: String, default: null }
}, {
  timestamps: true
});

export const GuildConfig = mongoose.model<IGuildConfig>('GuildConfig', GuildConfigSchema);
