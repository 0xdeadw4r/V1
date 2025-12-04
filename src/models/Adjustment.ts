import mongoose, { Schema, Document } from 'mongoose';

export interface IAdjustment extends Document {
  odcordId: string;
  odcordUsername: string;
  guildId: string;
  date: string;
  minutes: number;
  type: 'add' | 'remove';
  reason: string;
  adjustedBy: string;
  createdAt: Date;
}

const AdjustmentSchema = new Schema<IAdjustment>({
  odcordId: { type: String, required: true, index: true },
  odcordUsername: { type: String, required: true },
  guildId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  minutes: { type: Number, required: true },
  type: { type: String, enum: ['add', 'remove'], required: true },
  reason: { type: String, required: true },
  adjustedBy: { type: String, required: true }
}, {
  timestamps: true
});

AdjustmentSchema.index({ odcordId: 1, date: 1 });

export const Adjustment = mongoose.model<IAdjustment>('Adjustment', AdjustmentSchema);
