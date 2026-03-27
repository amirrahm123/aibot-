// ===== User =====
export type PlanType = 'free' | 'pro' | 'business';

export type BillingInterval = 'monthly' | 'annual';

export interface IUserUsage {
  invoicesIngested: number;
  invoiceLimit: number;
  aiScansUsed: number;
  scanLimit: number;
  canIngest: boolean;
  canScan: boolean;
  isFree: boolean;
}

export interface IUser {
  _id: string;
  username: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  plan: PlanType;
  billingInterval?: BillingInterval;
  planExpiresAt?: string;
  isTrial?: boolean;
  trialEndsAt?: string;
  whatsappNumber?: string;
  whatsappVerified?: boolean;
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  businessName: string;
  ownerName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: IUser;
}

// ===== Supplier =====
export type SupplierCategory =
  | 'ירקות ופירות'
  | 'מזון'
  | 'מזון ושתייה'
  | 'ניקוי'
  | 'ציוד משרדי'
  | 'ציוד מחשבים'
  | 'ריהוט'
  | 'לוגיסטיקה'
  | 'אחר';

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  'ירקות ופירות',
  'מזון',
  'מזון ושתייה',
  'ניקוי',
  'ציוד משרדי',
  'ציוד מחשבים',
  'ריהוט',
  'לוגיסטיקה',
  'אחר',
];

export interface ISupplier {
  _id: string;
  userId: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
  category: SupplierCategory;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  // Virtual/aggregated fields
  agreementCount?: number;
  invoiceCount?: number;
  overchargeRiskPercent?: number;
}

export interface CreateSupplierRequest {
  name: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
  category: SupplierCategory;
  notes?: string;
}

// ===== Price Agreement =====
export type UnitType = 'kg' | 'unit' | 'liter' | 'box' | 'other';

export interface IPriceAgreement {
  _id: string;
  userId: string;
  supplierId: string;
  productName: string;
  unit: UnitType;
  agreedPrice: number; // stored in agorot (×100)
  validFrom: string;
  validUntil?: string | null;
  notes?: string;
}

export interface CreateAgreementRequest {
  supplierId: string;
  productName: string;
  unit: UnitType;
  agreedPrice: number; // in shekels from frontend, converted to agorot on server
  validFrom: string;
  validUntil?: string | null;
  notes?: string;
}

// ===== Invoice =====
export type InvoiceStatus = 'processing' | 'done' | 'error' | 'pending_approval';
export type MatchStatus = 'ok' | 'overcharge' | 'no_agreement' | 'needs_review';
export type InvoiceSource = 'manual' | 'gmail' | 'whatsapp';

export interface IProcessingLog {
  source: InvoiceSource;
  receivedAt: string;
  senderEmail?: string;
  senderPhone?: string;
  rawFileUrl?: string;
  extractionStatus: 'pending' | 'success' | 'error';
  errorMessage?: string;
  gmailMessageId?: string;
  emailSubject?: string;
}

export interface ILineItem {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;       // agorot
  totalPrice: number;      // agorot
  matchedAgreementId?: string;
  agreedPrice?: number;    // agorot
  priceDiff?: number;      // agorot (positive = overcharge)
  isOvercharge: boolean;
  overchargeAmount?: number; // agorot
  matchStatus: MatchStatus;
}

export interface IInvoice {
  _id: string;
  userId: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  uploadedAt: string;
  fileUrl: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  rawExtractedText?: string;
  errorReason?: string;
  disputeMessage?: string;
  lineItems: ILineItem[];
  totalInvoiceAmount: number;   // agorot
  totalOverchargeAmount: number; // agorot
  overchargeCount: number;
  processingLog?: IProcessingLog;
  approvedAt?: string;
  approvedBy?: string;
}

// ===== AI Extraction (raw from Claude) =====
export interface ExtractedLineItem {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;  // shekels (from Claude)
  totalPrice: number; // shekels (from Claude)
}

export interface ExtractedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  supplierName: string | null;
  lineItems: ExtractedLineItem[];
  totalAmount: number | null;
}

// ===== Dashboard =====
export interface DashboardStats {
  totalInvoices: number;
  totalOverchargeAmount: number; // agorot
  overchargeCount: number;
  activeSupplierCount: number;
  topOverchargingSuppliers: {
    supplierId: string;
    supplierName: string;
    totalOvercharge: number; // agorot
    invoiceCount: number;
  }[];
  overchargeTrend: {
    date: string;
    amount: number; // agorot
  }[];
}

// ===== Pagination =====
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  overchargeOnly?: boolean;
  pendingOnly?: boolean;
  source?: InvoiceSource;
  search?: string;
}

// ===== Analytics =====
export interface SavingsMonth {
  month: string; // "YYYY-MM"
  totalOvercharge: number; // agorot
  invoiceCount: number;
}

export interface SavingsData {
  monthly: SavingsMonth[];
  lifetimeTotal: number; // agorot
}

export interface SupplierRisk {
  supplierId: string;
  supplierName: string;
  riskScore: number; // 0-100
  explanation: string;
  overchargeCount: number;
  totalInvoices: number;
  totalOvercharge: number; // agorot
}

export interface IPriceAgreementHistory {
  _id: string;
  agreementId: string;
  supplierId: string;
  productName: string;
  oldPrice: number; // agorot
  newPrice: number; // agorot
  changedAt: string;
  changedBy: string;
  changeReason?: string;
}

// ===== Notifications =====
export type NotificationType = 'new_invoice' | 'overcharge_detected' | 'error' | 'gmail_expiring';

export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  invoiceId?: string;
  supplierId?: string;
  read: boolean;
  createdAt: string;
}

// ===== Gmail Integration =====
export interface IGmailToken {
  _id: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  watchExpiration?: string;
  historyId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
  watchActive?: boolean;
  watchExpiration?: string;
}
