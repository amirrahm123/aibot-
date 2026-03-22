import mongoose, { Schema, Document } from 'mongoose';

export type PlanType = 'free' | 'pro' | 'business';

export interface IUserDocument extends Document {
  username: string;
  email?: string;
  passwordHash: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  plan: PlanType;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planExpiresAt?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDocument>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  plan: { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  planExpiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// username already indexed via unique: true
UserSchema.index({ phone: 1 });

export default mongoose.model<IUserDocument>('User', UserSchema);
