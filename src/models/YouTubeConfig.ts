
import mongoose, { Schema, Document } from 'mongoose';

export interface IYouTubeConfig extends Document {
  guildId: string;
  channelId: string;
  youtubeChannelId: string;
  lastVideoId: string | null;
  lastStreamId: string | null;
  checkInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeConfigSchema = new Schema<IYouTubeConfig>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  youtubeChannelId: { type: String, required: true },
  lastVideoId: { type: String, default: null },
  lastStreamId: { type: String, default: null },
  checkInterval: { type: Number, default: 60000 }
}, {
  timestamps: true
});

YouTubeConfigSchema.index({ guildId: 1 });

export const YouTubeConfig = mongoose.model<IYouTubeConfig>('YouTubeConfig', YouTubeConfigSchema);
