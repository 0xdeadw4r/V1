
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDiscount extends Document {
  guildId: string;
  discountPercentage: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  embedId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DiscountSchema = new Schema<IDiscount>({
  guildId: { type: String, required: true },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  embedId: { type: Schema.Types.ObjectId, ref: 'CustomEmbed', default: null }
}, {
  timestamps: true
});

export const Discount = mongoose.model<IDiscount>('Discount', DiscountSchema);
