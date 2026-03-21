// ===== User =====
export interface IUser {
  _id: string;
  username: string;
  businessName: string;
  ownerName: string;
  phone: string;
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  businessName: string;
  ownerName: string;
  phone: string;
}

export interface RegisterOtpSentResponse {
  message: string;
  phone: string;
  dev_otp?: string; // only in dev/mock mode
}

export interface VerifyRegisterRequest {
  username: string;
  password: string;
  businessName: string;
  ownerName: string;
  phone: string;
  otpCode: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginOtpSentResponse {
  message: string;
  maskedPhone: string;
  loginToken: string;
  dev_otp?: string; // only in dev/mock mode
}

export interface VerifyLoginRequest {
  loginToken: string;
  otpCode: string;
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
export type InvoiceStatus = 'processing' | 'done' | 'error';
export type MatchStatus = 'ok' | 'overcharge' | 'no_agreement' | 'needs_review';

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
  rawExtractedText?: string;
  lineItems: ILineItem[];
  totalInvoiceAmount: number;   // agorot
  totalOverchargeAmount: number; // agorot
  overchargeCount: number;
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
  search?: string;
}
