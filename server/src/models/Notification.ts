import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: Types.ObjectId;
  type: 'new_invoice' | 'overcharge_detected' | 'error' | 'gmail_expiring';
  title: string;
  body: string;
  invoiceId?: Types.ObjectId;
  supplierId?: Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['new_invoice', 'overcharge_detected', 'error', 'gmail_expiring'],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

export default mongoose.model<INotificationDocument>('Notification', NotificationSchema);
