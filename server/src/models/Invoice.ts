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

export interface IProcessingLogSubdoc {
  source: 'manual' | 'gmail' | 'whatsapp';
  receivedAt: Date;
  senderEmail?: string;
  senderPhone?: string;
  rawFileUrl?: string;
  extractionStatus: 'pending' | 'success' | 'error';
  errorMessage?: string;
  gmailMessageId?: string;
  emailSubject?: string;
}

export interface IInvoiceDocument extends Document {
  userId: Types.ObjectId;
  supplierId: Types.ObjectId;
  invoiceNumber?: string;
  invoiceDate?: Date;
  uploadedAt: Date;
  fileUrl: string;
  status: 'processing' | 'done' | 'error' | 'pending_approval';
  source: 'manual' | 'gmail' | 'whatsapp';
  rawExtractedText?: string;
  lineItems: ILineItemSubdoc[];
  totalInvoiceAmount: number;    // agorot
  totalOverchargeAmount: number; // agorot
  overchargeCount: number;
  errorReason?: string;
  disputeMessage?: string;
  processingLog?: IProcessingLogSubdoc;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
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

const ProcessingLogSchema = new Schema<IProcessingLogSubdoc>({
  source: { type: String, enum: ['manual', 'gmail', 'whatsapp'], required: true },
  receivedAt: { type: Date, default: Date.now },
  senderEmail: String,
  senderPhone: String,
  rawFileUrl: String,
  extractionStatus: { type: String, enum: ['pending', 'success', 'error'], default: 'pending' },
  errorMessage: String,
  gmailMessageId: String,
  emailSubject: String,
}, { _id: false });

const InvoiceSchema = new Schema<IInvoiceDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  invoiceNumber: String,
  invoiceDate: Date,
  uploadedAt: { type: Date, default: Date.now },
  fileUrl: { type: String, default: '' },
  status: { type: String, enum: ['processing', 'done', 'error', 'pending_approval'], default: 'processing' },
  source: { type: String, enum: ['manual', 'gmail', 'whatsapp'], default: 'manual' },
  rawExtractedText: String,
  lineItems: [LineItemSchema],
  totalInvoiceAmount: { type: Number, default: 0 },
  totalOverchargeAmount: { type: Number, default: 0 },
  overchargeCount: { type: Number, default: 0 },
  errorReason: { type: String },
  disputeMessage: { type: String },
  processingLog: ProcessingLogSchema,
  approvedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

InvoiceSchema.index({ userId: 1, uploadedAt: -1 });
InvoiceSchema.index({ supplierId: 1 });
// Deduplication: prevent duplicate invoices for the same supplier + invoice number + date
// sparse: true allows multiple docs where invoiceNumber or invoiceDate is null
InvoiceSchema.index(
  { supplierId: 1, invoiceNumber: 1, invoiceDate: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);
