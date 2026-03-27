import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPriceAgreementHistoryDocument extends Document {
  agreementId: Types.ObjectId;
  supplierId: Types.ObjectId;
  productName: string;
  oldPrice: number; // agorot
  newPrice: number; // agorot
  changedAt: Date;
  changedBy: Types.ObjectId;
  changeReason?: string;
}

const PriceAgreementHistorySchema = new Schema<IPriceAgreementHistoryDocument>({
  agreementId: { type: Schema.Types.ObjectId, ref: 'PriceAgreement', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  productName: { type: String, required: true },
  oldPrice: { type: Number, required: true },
  newPrice: { type: Number, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changeReason: { type: String },
});

PriceAgreementHistorySchema.index({ agreementId: 1, changedAt: -1 });

export default mongoose.model<IPriceAgreementHistoryDocument>('PriceAgreementHistory', PriceAgreementHistorySchema);
