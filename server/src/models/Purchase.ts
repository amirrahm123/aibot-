import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPurchaseDocument extends Document {
  userId: Types.ObjectId;
  username: string;
  businessName: string;
  phone: string;
  plan: 'pro' | 'business';
  amountPaid: number; // in agorot (ILS cents)
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string;
  eventType: 'new' | 'renewal' | 'canceled';
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchaseDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  businessName: { type: String, required: true },
  phone: { type: String },
  plan: { type: String, enum: ['pro', 'business'], required: true },
  amountPaid: { type: Number, default: 0 },
  currency: { type: String, default: 'ILS' },
  stripeSessionId: { type: String },
  stripeSubscriptionId: { type: String },
  eventType: { type: String, enum: ['new', 'renewal', 'canceled'], required: true },
  createdAt: { type: Date, default: Date.now },
});

PurchaseSchema.index({ createdAt: -1 });

export default mongoose.model<IPurchaseDocument>('Purchase', PurchaseSchema);
