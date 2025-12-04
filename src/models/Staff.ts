import mongoose, { Schema, Document } from 'mongoose';

export interface IExcuse {
  date: string;
  reason: string;
  createdAt: Date;
}

export interface IStaff extends Document {
  odcordId: string;
  odcordUsername: string;
  guildId: string;
  requiredHours: number;
  isActive: boolean;
  excuses: IExcuse[];
  lastReminderSent: Date | null;
  genzauthUsername: string | null;
  genzauthKeyPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExcuseSchema = new Schema<IExcuse>({
  date: { type: String, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const StaffSchema = new Schema<IStaff>({
  odcordId: { type: String, required: true, index: true },
  odcordUsername: { type: String, required: true },
  guildId: { type: String, required: true, index: true },
  requiredHours: { type: Number, default: 6 },
  isActive: { type: Boolean, default: true },
  excuses: { type: [ExcuseSchema], default: [] },
  lastReminderSent: { type: Date, default: null },
  genzauthUsername: { type: String, default: null },
  genzauthKeyPaused: { type: Boolean, default: false }
}, {
  timestamps: true
});

StaffSchema.index({ odcordId: 1, guildId: 1 }, { unique: true });

export const Staff = mongoose.model<IStaff>('Staff', StaffSchema);
