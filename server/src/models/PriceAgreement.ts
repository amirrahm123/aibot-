import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPriceAgreementDocument extends Document {
  userId: Types.ObjectId;
  supplierId: Types.ObjectId;
  productName: string;
  unit: 'kg' | 'unit' | 'liter' | 'box' | 'other';
  agreedPrice: number; // in agorot (×100)
  validFrom: Date;
  validUntil?: Date | null;
  notes?: string;
}

const PriceAgreementSchema = new Schema<IPriceAgreementDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  productName: { type: String, required: true, trim: true },
  unit: { type: String, enum: ['kg', 'unit', 'liter', 'box', 'other'], required: true },
  agreedPrice: { type: Number, required: true }, // agorot
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, default: null },
  notes: { type: String, trim: true },
});

PriceAgreementSchema.index({ userId: 1, supplierId: 1 });
PriceAgreementSchema.index({ supplierId: 1, productName: 1 });

export default mongoose.model<IPriceAgreementDocument>('PriceAgreement', PriceAgreementSchema);
