import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISupplierDocument extends Document {
  userId: Types.ObjectId;
  name: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
  category: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
}

const SupplierSchema = new Schema<ISupplierDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  category: {
    type: String,
    enum: ['ירקות ופירות', 'מזון', 'מזון ושתייה', 'ניקוי', 'ציוד משרדי', 'ציוד מחשבים', 'ריהוט', 'לוגיסטיקה', 'אחר'],
    default: 'אחר',
  },
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

SupplierSchema.index({ userId: 1, name: 1 });
SupplierSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<ISupplierDocument>('Supplier', SupplierSchema);
