
import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomEmbed extends Document {
  guildId: string;
  title: string;
  description: string;
  color: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  footerText?: string;
  channelId?: string;
  messageId?: string;
  discountId?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  prices?: Array<{
    name: string;
    duration: string;
    price: number;
    currency: string;
  }>;
  buttons?: Array<{
    label: string;
    targetChannelId: string;
    style: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomEmbedSchema = new Schema<ICustomEmbed>({
  guildId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  color: { type: String, default: '#5865F2' },
  imageUrl: { type: String },
  thumbnailUrl: { type: String },
  footerText: { type: String },
  channelId: { type: String },
  messageId: { type: String },
  discountId: { type: String },
  fields: [{
    name: { type: String },
    value: { type: String },
    inline: { type: Boolean, default: false }
  }],
  prices: [{
    name: { type: String },
    duration: { type: String },
    price: { type: Number },
    currency: { type: String, default: '₹' }
  }],
  buttons: [{
    label: { type: String },
    targetChannelId: { type: String },
    style: { type: String, default: 'Primary' }
  }]
}, {
  timestamps: true
});

export const CustomEmbed = mongoose.model<ICustomEmbed>('CustomEmbed', CustomEmbedSchema);
