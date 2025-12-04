
import mongoose, { Schema, Document } from 'mongoose';

export interface IFileWhitelist extends Document {
  guildId: string;
  userId: string;
  addedBy: string;
  addedAt: Date;
}

const FileWhitelistSchema = new Schema<IFileWhitelist>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

FileWhitelistSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const FileWhitelist = mongoose.model<IFileWhitelist>('FileWhitelist', FileWhitelistSchema);
