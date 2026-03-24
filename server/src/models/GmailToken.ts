import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGmailTokenDocument extends Document {
  userId: Types.ObjectId;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  watchExpiration?: Date;
  historyId?: string;
  isActive: boolean;
  createdAt: Date;
}

const GmailTokenSchema = new Schema<IGmailTokenDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true, trim: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  watchExpiration: Date,
  historyId: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

GmailTokenSchema.index({ userId: 1 }, { unique: true });
GmailTokenSchema.index({ isActive: 1 });

export default mongoose.model<IGmailTokenDocument>('GmailToken', GmailTokenSchema);
