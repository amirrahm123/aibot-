import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
  username: string;
  email?: string;
  passwordHash: string;
  businessName: string;
  ownerName: string;
  phone: string; // Israeli format: 05X-XXXXXXX
  createdAt: Date;
}

const UserSchema = new Schema<IUserDocument>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ username: 1 });
UserSchema.index({ phone: 1 });

export default mongoose.model<IUserDocument>('User', UserSchema);
