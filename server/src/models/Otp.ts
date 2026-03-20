import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpDocument extends Document {
  phone: string;
  code: string; // hashed OTP
  purpose: 'register' | 'login';
  expiresAt: Date;
  used: boolean;
  attempts: number; // failed verification attempts
  createdAt: Date;
}

const OtpSchema = new Schema<IOtpDocument>({
  phone: { type: String, required: true, index: true },
  code: { type: String, required: true }, // bcrypt hashed
  purpose: { type: String, enum: ['register', 'login'], required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Auto-expire old OTPs (TTL index)
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOtpDocument>('Otp', OtpSchema);
