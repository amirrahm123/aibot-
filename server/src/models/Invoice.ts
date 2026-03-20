import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILineItemSubdoc {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;       // agorot
  totalPrice: number;      // agorot
  matchedAgreementId?: Types.ObjectId;
  agreedPrice?: number;    // agorot
  priceDiff?: number;      // agorot
  isOvercharge: boolean;
  overchargeAmount?: number; // agorot
  matchStatus: 'ok' | 'overcharge' | 'no_agreement' | 'needs_review';
}

export interface IInvoiceDocument extends Document {
  userId: Types.ObjectId;
  supplierId: Types.ObjectId;
  invoiceNumber?: string;
  invoiceDate?: Date;
  uploadedAt: Date;
  fileUrl: string;
  status: 'processing' | 'done' | 'error';
  rawExtractedText?: string;
  lineItems: ILineItemSubdoc[];
  totalInvoiceAmount: number;    // agorot
  totalOverchargeAmount: number; // agorot
  overchargeCount: number;
}

const LineItemSchema = new Schema<ILineItemSubdoc>({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  matchedAgreementId: { type: Schema.Types.ObjectId, ref: 'PriceAgreement' },
  agreedPrice: Number,
  priceDiff: Number,
  isOvercharge: { type: Boolean, default: false },
  overchargeAmount: { type: Number, default: 0 },
  matchStatus: { type: String, enum: ['ok', 'overcharge', 'no_agreement', 'needs_review'], default: 'no_agreement' },
}, { _id: false });

const InvoiceSchema = new Schema<IInvoiceDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  invoiceNumber: String,
  invoiceDate: Date,
  uploadedAt: { type: Date, default: Date.now },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ['processing', 'done', 'error'], default: 'processing' },
  rawExtractedText: String,
  lineItems: [LineItemSchema],
  totalInvoiceAmount: { type: Number, default: 0 },
  totalOverchargeAmount: { type: Number, default: 0 },
  overchargeCount: { type: Number, default: 0 },
});

InvoiceSchema.index({ userId: 1, uploadedAt: -1 });
InvoiceSchema.index({ supplierId: 1 });

export default mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);
