import mongoose, { Schema, Document } from 'mongoose';

export type PlanType = 'free' | 'pro' | 'business';
export type BillingInterval = 'monthly' | 'annual';

export interface IUsageSubdoc {
  currentMonth: string; // "YYYY-MM"
  invoicesIngested: number;
  aiScansUsed: number;
}

export interface IUserDocument extends Document {
  username: string;
  email?: string;
  passwordHash: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  plan: PlanType;
  billingInterval: BillingInterval;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planExpiresAt?: Date;
  // Usage tracking (free tier caps)
  usage: IUsageSubdoc;
  // Trial
  isTrial: boolean;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  trialConvertedAt?: Date;
  // WhatsApp
  whatsappNumber?: string;
  whatsappVerified: boolean;
  createdAt: Date;
}

const UsageSchema = new Schema<IUsageSubdoc>({
  currentMonth: { type: String, default: '' },
  invoicesIngested: { type: Number, default: 0 },
  aiScansUsed: { type: Number, default: 0 },
}, { _id: false });

const UserSchema = new Schema<IUserDocument>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  plan: { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
  billingInterval: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  planExpiresAt: { type: Date },
  usage: { type: UsageSchema, default: () => ({ currentMonth: '', invoicesIngested: 0, aiScansUsed: 0 }) },
  isTrial: { type: Boolean, default: false },
  trialStartedAt: { type: Date },
  trialEndsAt: { type: Date },
  trialConvertedAt: { type: Date },
  whatsappNumber: { type: String, trim: true },
  whatsappVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// username already indexed via unique: true
UserSchema.index({ phone: 1 });

export default mongoose.model<IUserDocument>('User', UserSchema);
