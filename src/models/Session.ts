import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  odcordId: string;
  odcordUsername: string;
  guildId: string;
  channelId: string;
  channelName: string;
  joinTime: Date;
  leaveTime: Date | null;
  duration: number;
  isAfk: boolean;
  date: string;
  isActive: boolean;
  isSpeaking: boolean;
  speakingTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  odcordId: { type: String, required: true, index: true },
  odcordUsername: { type: String, required: true },
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  channelName: { type: String, required: true },
  joinTime: { type: Date, required: true },
  leaveTime: { type: Date, default: null },
  duration: { type: Number, default: 0 },
  isAfk: { type: Boolean, default: false },
  date: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  isSpeaking: { type: Boolean, default: false },
  speakingTime: { type: Number, default: 0 }
}, {
  timestamps: true
});

SessionSchema.index({ odcordId: 1, date: 1 });
SessionSchema.index({ guildId: 1, date: 1 });
SessionSchema.index({ isActive: 1, guildId: 1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
