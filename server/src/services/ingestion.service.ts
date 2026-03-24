import { Types } from 'mongoose';
import Invoice, { IInvoiceDocument } from '../models/Invoice';
import PriceAgreement from '../models/PriceAgreement';
import Supplier from '../models/Supplier';
import { extractInvoiceData } from './ai.service';
import { matchLineItems } from './invoice.service';
import type { InvoiceSource } from '../../../shared/types';

type MediaType = 'image/jpeg' | 'image/png' | 'application/pdf';

export interface IngestionInput {
  /** The user who owns this invoice */
  userId: string;
  /** Source channel */
  source: InvoiceSource;
  /** File as base64 (PDF, JPEG, PNG) */
  fileBase64?: string;
  /** MIME type of the file */
  mediaType?: MediaType;
  /** Plain text body (fallback when no attachment) */
  emailBodyText?: string;
  /** URL where the raw file is stored (Vercel Blob, etc.) */
  rawFileUrl?: string;
  /** For Gmail: sender email address */
  senderEmail?: string;
  /** For WhatsApp: sender phone number */
  senderPhone?: string;
  /** Gmail message ID */
  gmailMessageId?: string;
  /** Email subject line */
  emailSubject?: string;
  /** Pre-resolved supplier ID (if known) */
  supplierId?: string;
}

export interface IngestionResult {
  invoice: IInvoiceDocument;
  supplierName: string;
  wasAutoMatched: boolean;
}

/**
 * Find a supplier by matching sender email or phone against DB records.
 * Returns null if no match found.
 */
async function resolveSupplier(
  userId: string,
  senderEmail?: string,
  senderPhone?: string
): Promise<{ supplierId: Types.ObjectId; supplierName: string } | null> {
  const query: any = { userId, isActive: true };
  const conditions: any[] = [];

  if (senderEmail) {
    // Match email exactly (stored lowercase)
    conditions.push({ email: senderEmail.toLowerCase().trim() });
  }
  if (senderPhone) {
    // Normalize phone: strip spaces, dashes; try with/without +972
    const cleaned = senderPhone.replace(/[\s\-()]/g, '');
    conditions.push({ contactPhone: cleaned });
    // Also try local format
    if (cleaned.startsWith('+972')) {
      conditions.push({ contactPhone: '0' + cleaned.slice(4) });
    } else if (cleaned.startsWith('0')) {
      conditions.push({ contactPhone: '+972' + cleaned.slice(1) });
    }
  }

  if (conditions.length === 0) return null;

  const supplier = await Supplier.findOne({
    ...query,
    $or: conditions,
  }).lean();

  if (!supplier) return null;

  return {
    supplierId: supplier._id as Types.ObjectId,
    supplierName: supplier.name,
  };
}

/**
 * Extract invoice text from email body using Claude AI.
 * Used when no file attachment is present.
 */
async function extractFromText(text: string) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are an invoice parser for Israeli businesses. Extract line items from the email text below.

Return ONLY a valid JSON object — no prose, no markdown, no backticks.

The JSON must have this exact structure:
{
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "supplierName": "string or null",
  "lineItems": [
    {
      "productName": "string",
      "quantity": number,
      "unit": "kg | unit | liter | box | other",
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "totalAmount": number or null
}

Rules:
- Extract ALL line items
- Prices are in Israeli Shekels (₪)
- Do NOT include VAT rows as line items
- If you cannot determine a field, use null`,
    messages: [
      {
        role: 'user',
        content: `Extract invoice data from this email body:\n\n${text}`,
      },
    ],
  });

  const rawText = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  const clean = rawText.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Main ingestion pipeline.
 * Called by Gmail webhook, WhatsApp webhook, or could replace manual upload.
 *
 * Flow: resolve supplier → extract with AI → match against agreements → save invoice
 */
export async function processIncomingInvoice(input: IngestionInput): Promise<IngestionResult> {
  const {
    userId,
    source,
    fileBase64,
    mediaType,
    emailBodyText,
    rawFileUrl,
    senderEmail,
    senderPhone,
    gmailMessageId,
    emailSubject,
    supplierId: preResolvedSupplierId,
  } = input;

  // Step 1: Resolve supplier
  let supplierId: Types.ObjectId;
  let supplierName = '';
  let wasAutoMatched = false;

  if (preResolvedSupplierId) {
    supplierId = new Types.ObjectId(preResolvedSupplierId);
    const supplier = await Supplier.findById(supplierId).lean();
    supplierName = supplier?.name || '';
  } else {
    const resolved = await resolveSupplier(userId, senderEmail, senderPhone);
    if (!resolved) {
      throw new Error(`SUPPLIER_NOT_FOUND: No supplier matches sender ${senderEmail || senderPhone}`);
    }
    supplierId = resolved.supplierId;
    supplierName = resolved.supplierName;
    wasAutoMatched = true;
  }

  // Step 2: Create invoice record in processing state
  const invoice = await Invoice.create({
    userId,
    supplierId,
    fileUrl: rawFileUrl || '',
    status: 'processing',
    source,
    processingLog: {
      source,
      receivedAt: new Date(),
      senderEmail,
      senderPhone,
      rawFileUrl,
      extractionStatus: 'pending',
      gmailMessageId,
      emailSubject,
    },
  });

  try {
    // Step 3: Extract with AI
    let extracted;

    if (fileBase64 && mediaType) {
      extracted = await extractInvoiceData(fileBase64, mediaType);
    } else if (emailBodyText) {
      extracted = await extractFromText(emailBodyText);
    } else {
      throw new Error('No file or email body text provided for extraction');
    }

    // Step 4: Store raw extraction
    invoice.rawExtractedText = JSON.stringify(extracted);
    invoice.invoiceNumber = extracted.invoiceNumber || undefined;
    invoice.invoiceDate = extracted.invoiceDate ? new Date(extracted.invoiceDate) : undefined;

    // Step 5: Load active agreements and match
    const now = new Date();
    const agreements = await PriceAgreement.find({
      userId,
      supplierId,
      validFrom: { $lte: now },
      $or: [{ validUntil: null }, { validUntil: { $gte: now } }],
    });

    const matchedItems = matchLineItems(extracted.lineItems, agreements);

    // Step 6: Calculate totals and save
    invoice.lineItems = matchedItems;
    invoice.totalInvoiceAmount = matchedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    invoice.totalOverchargeAmount = matchedItems
      .filter((item) => item.isOvercharge)
      .reduce((sum, item) => sum + (item.overchargeAmount || 0), 0);
    invoice.overchargeCount = matchedItems.filter((item) => item.isOvercharge).length;

    // Auto-ingested invoices go to pending_approval; manual stays as done
    invoice.status = source === 'manual' ? 'done' : 'pending_approval';

    // Update processing log
    invoice.processingLog!.extractionStatus = 'success';

    await invoice.save();

    return { invoice, supplierName, wasAutoMatched };
  } catch (err: any) {
    // Update invoice with error
    invoice.status = 'error';
    if (invoice.processingLog) {
      invoice.processingLog.extractionStatus = 'error';
      invoice.processingLog.errorMessage = err.message;
    }
    invoice.rawExtractedText = err.message;
    await invoice.save();
    throw err;
  }
}
