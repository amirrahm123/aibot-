import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import Invoice from '../models/Invoice';
import PriceAgreement from '../models/PriceAgreement';
import Supplier from '../models/Supplier';
import { extractInvoiceData } from '../services/ai.service';
import { matchLineItems } from '../services/invoice.service';
import { incrementScanCount, getUsageStatus } from '../services/usage.service';
import User from '../models/User';

const router = Router();
router.use(authMiddleware);

// Rate limit: max 10 uploads per user per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.userId || req.ip,
  message: { error: 'עברת את מגבלת ההעלאות — נסה שוב בעוד שעה' },
});

// POST /api/invoices/upload
router.post('/upload', uploadLimiter, uploadMiddleware.single('file'), async (req: AuthRequest, res: Response) => {
  let invoice: InstanceType<typeof Invoice> | null = null;
  try {
    // Check free tier AI scan limit
    const canScan = await incrementScanCount(req.userId!);
    if (!canScan) {
      res.status(403).json({ error: 'הגעת למגבלת הסריקות החודשית — שדרג לפרו לסריקות ללא הגבלה', code: 'SCAN_LIMIT_REACHED' });
      return;
    }

    const { supplierId } = req.body;
    if (!supplierId) {
      res.status(400).json({ error: 'נא לבחור ספק' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'נא להעלות קובץ' });
      return;
    }

    // Create invoice record in processing state
    invoice = await Invoice.create({
      userId: req.userId,
      supplierId,
      fileUrl: req.file.path,
      status: 'processing',
    });

    // Read file and convert to base64
    const filePath = path.resolve(req.file.path);
    const fileBuffer = fs.readFileSync(filePath);
    const fileBase64 = fileBuffer.toString('base64');

    const mediaType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'application/pdf';

    // Extract data using AI
    const extracted = await extractInvoiceData(fileBase64, mediaType);

    // Store raw response
    invoice.rawExtractedText = JSON.stringify(extracted);
    invoice.invoiceNumber = extracted.invoiceNumber || undefined;
    invoice.invoiceDate = extracted.invoiceDate ? new Date(extracted.invoiceDate) : undefined;

    // Load active agreements for this supplier
    const now = new Date();
    const agreements = await PriceAgreement.find({
      userId: req.userId,
      supplierId,
      validFrom: { $lte: now },
      $or: [{ validUntil: null }, { validUntil: { $gte: now } }],
    });

    // Match line items
    const matchedItems = matchLineItems(extracted.lineItems, agreements);

    invoice.lineItems = matchedItems;
    invoice.totalInvoiceAmount = matchedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    invoice.totalOverchargeAmount = matchedItems
      .filter((item) => item.isOvercharge)
      .reduce((sum, item) => sum + (item.overchargeAmount || 0), 0);
    invoice.overchargeCount = matchedItems.filter((item) => item.isOvercharge).length;
    invoice.status = 'done';

    await invoice.save();

    // Populate supplier name for response
    const supplier = await Supplier.findById(supplierId).lean();
    const result = { ...invoice.toObject(), supplierName: supplier?.name };

    res.status(201).json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Invoice processing error:', errMsg);
    if (invoice) {
      let errorReason = 'שגיאת עיבוד כללית';
      if (errMsg.includes('JSON')) {
        errorReason = 'שגיאת AI — לא ניתן לפרש את התוצאה';
      } else if (errMsg.includes('extract') || errMsg.includes('PDF') || errMsg.includes('pdf')) {
        errorReason = 'לא ניתן לחלץ טקסט מהקובץ';
      } else if (errMsg.includes('anthropic') || errMsg.includes('claude') || errMsg.includes('API')) {
        errorReason = 'שגיאת AI — נסה שוב מאוחר יותר';
      }
      invoice.status = 'error';
      invoice.errorReason = errorReason;
      invoice.rawExtractedText = errMsg;
      await invoice.save();
    }
    res.status(500).json({ error: 'שגיאה בעיבוד החשבונית — נסה שוב', details: errMsg });
  }
});

// GET /api/invoices/usage — get free tier usage status
router.get('/usage', async (req: AuthRequest, res: Response) => {
  try {
    const usage = await getUsageStatus(req.userId!);
    res.json(usage);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת נתוני שימוש' });
  }
});

// GET /api/invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId: req.userId };

    // By default hide archived; show archived only when explicitly requested
    if (req.query.archived === 'true') {
      filter.archived = true;
    } else {
      filter.archived = { $ne: true };
    }

    if (req.query.supplierId) filter.supplierId = req.query.supplierId;
    if (req.query.overchargeOnly === 'true') filter.overchargeCount = { $gt: 0 };
    if (req.query.pendingOnly === 'true') filter.status = 'pending_approval';
    if (req.query.source) filter.source = req.query.source;
    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) dateFilter.$gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) dateFilter.$lte = new Date(req.query.dateTo as string);
      filter.uploadedAt = dateFilter;
    }
    if (req.query.search) {
      const search = req.query.search as string;
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'lineItems.productName': { $regex: search, $options: 'i' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('supplierId', 'name')
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    // Map supplier name
    const data = invoices.map((inv: any) => ({
      ...inv,
      supplierName: inv.supplierId?.name || '',
      supplierId: inv.supplierId?._id || inv.supplierId,
    }));

    res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת חשבוניות' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId })
      .populate('supplierId', 'name contactPhone')
      .lean();
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    const result: any = {
      ...invoice,
      supplierName: (invoice.supplierId as any)?.name || '',
      supplierPhone: (invoice.supplierId as any)?.contactPhone || '',
      supplierId: (invoice.supplierId as any)?._id || invoice.supplierId,
    };
    res.json(result);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת חשבונית' });
  }
});

// POST /api/invoices/:id/archive — move to archive
router.post('/:id/archive', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { archived: true } },
      { new: true },
    );
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    res.json({ message: 'חשבונית הועברה לארכיון' });
  } catch {
    res.status(500).json({ error: 'שגיאה בהעברה לארכיון' });
  }
});

// POST /api/invoices/:id/unarchive — restore from archive
router.post('/:id/unarchive', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { archived: false } },
      { new: true },
    );
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    res.json({ message: 'חשבונית שוחזרה מהארכיון' });
  } catch {
    res.status(500).json({ error: 'שגיאה בשחזור מארכיון' });
  }
});

// DELETE /api/invoices/:id — hard delete (only archived invoices)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Only allow deletion of archived invoices
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    if (!invoice.archived) {
      res.status(400).json({ error: 'ניתן למחוק רק חשבוניות בארכיון. העבר לארכיון תחילה.' });
      return;
    }
    await Invoice.deleteOne({ _id: invoice._id });
    // Clean up file
    if (invoice.fileUrl && fs.existsSync(invoice.fileUrl)) {
      fs.unlinkSync(invoice.fileUrl);
    }
    res.json({ message: 'חשבונית נמחקה לצמיתות' });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת חשבונית' });
  }
});

// GET /api/invoices/:id/report — generate text report
router.get('/:id/report', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId })
      .populate('supplierId', 'name')
      .lean();
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }

    const supplierName = (invoice.supplierId as any)?.name || 'לא ידוע';
    const overchargedItems = invoice.lineItems.filter((item) => item.isOvercharge);

    let report = `דו"ח חריגות מחיר — שומר המחיר\n`;
    report += `========================================\n\n`;
    report += `ספק: ${supplierName}\n`;
    report += `חשבונית מספר: ${invoice.invoiceNumber || 'לא צוין'}\n`;
    report += `תאריך חשבונית: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('he-IL') : 'לא צוין'}\n`;
    report += `סה"כ חשבונית: ₪${(invoice.totalInvoiceAmount / 100).toFixed(2)}\n\n`;

    if (overchargedItems.length === 0) {
      report += `לא נמצאו חריגות מחיר.\n`;
    } else {
      report += `נמצאו ${overchargedItems.length} חריגות מחיר:\n`;
      report += `סה"כ חריגה: ₪${(invoice.totalOverchargeAmount / 100).toFixed(2)}\n\n`;

      overchargedItems.forEach((item, i) => {
        report += `${i + 1}. ${item.productName}\n`;
        report += `   כמות: ${item.quantity} ${item.unit}\n`;
        report += `   מחיר מוסכם: ₪${((item.agreedPrice || 0) / 100).toFixed(2)}/${item.unit}\n`;
        report += `   מחיר בחשבונית: ₪${(item.unitPrice / 100).toFixed(2)}/${item.unit}\n`;
        report += `   הפרש ליחידה: ₪${((item.priceDiff || 0) / 100).toFixed(2)}\n`;
        report += `   סה"כ חריגה: ₪${((item.overchargeAmount || 0) / 100).toFixed(2)}\n\n`;
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="overcharge-report-${invoice.invoiceNumber || invoice._id}.txt"`);
    res.send(report);
  } catch {
    res.status(500).json({ error: 'שגיאה ביצירת דו"ח' });
  }
});

// POST /api/invoices/:id/approve
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    if (invoice.status !== 'pending_approval') {
      res.status(400).json({ error: 'חשבונית זו אינה ממתינה לאישור' });
      return;
    }

    invoice.status = 'done';
    invoice.approvedAt = new Date();
    invoice.approvedBy = req.userId as any;
    await invoice.save();

    const supplier = await Supplier.findById(invoice.supplierId).lean();
    const result: any = invoice.toObject();
    result.supplierName = supplier?.name || '';

    res.json(result);
  } catch {
    res.status(500).json({ error: 'שגיאה באישור חשבונית' });
  }
});

// POST /api/invoices/:id/retry — re-runs AI extraction on stored file
router.post('/:id/retry', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }

    invoice.status = 'processing';
    invoice.errorReason = undefined;
    await invoice.save();

    // Try to read file from local filesystem or from rawExtractedText
    let fileBase64: string | undefined;
    let mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' = 'application/pdf';

    if (invoice.fileUrl) {
      const filePath = path.resolve(invoice.fileUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        fileBase64 = fileBuffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase();
        mediaType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
      }
    }

    // Also try rawFileUrl from processing log (Vercel Blob, etc.)
    if (!fileBase64 && invoice.processingLog?.rawFileUrl) {
      try {
        const resp = await fetch(invoice.processingLog.rawFileUrl);
        if (resp.ok) {
          const buffer = Buffer.from(await resp.arrayBuffer());
          fileBase64 = buffer.toString('base64');
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('pdf')) mediaType = 'application/pdf';
          else if (ct.includes('png')) mediaType = 'image/png';
          else mediaType = 'image/jpeg';
        }
      } catch {
        // fall through
      }
    }

    if (!fileBase64) {
      invoice.status = 'error';
      invoice.errorReason = 'קובץ החשבונית לא נמצא — לא ניתן לעבד מחדש';
      await invoice.save();
      res.status(400).json({ error: 'קובץ החשבונית לא נמצא' });
      return;
    }

    const extracted = await extractInvoiceData(fileBase64, mediaType);

    invoice.rawExtractedText = JSON.stringify(extracted);
    invoice.invoiceNumber = extracted.invoiceNumber || undefined;
    invoice.invoiceDate = extracted.invoiceDate ? new Date(extracted.invoiceDate) : undefined;

    const now = new Date();
    const agreements = await PriceAgreement.find({
      userId: req.userId,
      supplierId: invoice.supplierId,
      validFrom: { $lte: now },
      $or: [{ validUntil: null }, { validUntil: { $gte: now } }],
    });

    const matchedItems = matchLineItems(extracted.lineItems, agreements);
    invoice.lineItems = matchedItems;
    invoice.totalInvoiceAmount = matchedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    invoice.totalOverchargeAmount = matchedItems
      .filter((item) => item.isOvercharge)
      .reduce((sum, item) => sum + (item.overchargeAmount || 0), 0);
    invoice.overchargeCount = matchedItems.filter((item) => item.isOvercharge).length;
    invoice.status = 'done';
    invoice.errorReason = undefined;

    await invoice.save();

    const supplier = await Supplier.findById(invoice.supplierId).lean();
    const result = { ...invoice.toObject(), supplierName: supplier?.name || '' };

    res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Try to update the invoice with error state
    try {
      const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
      if (invoice) {
        let errorReason = 'שגיאת עיבוד כללית';
        if (errMsg.includes('JSON')) errorReason = 'שגיאת AI — לא ניתן לפרש את התוצאה';
        else if (errMsg.includes('PDF') || errMsg.includes('pdf')) errorReason = 'לא ניתן לחלץ טקסט מהקובץ';
        else if (errMsg.includes('anthropic') || errMsg.includes('API')) errorReason = 'שגיאת AI — נסה שוב מאוחר יותר';
        invoice.status = 'error';
        invoice.errorReason = errorReason;
        await invoice.save();
      }
    } catch { /* best effort */ }
    res.status(500).json({ error: 'שגיאה בעיבוד מחדש', details: errMsg });
  }
});

// POST /api/invoices/:id/reprocess (legacy alias for retry)
router.post('/:id/reprocess', async (req: AuthRequest, res: Response) => {
  // Forward to retry handler
  req.url = `/${req.params.id}/retry`;
  res.redirect(307, `/api/invoices/${req.params.id}/retry`);
});

// POST /api/invoices/:id/dispute-message — generate a dispute WhatsApp message using Claude
router.post('/:id/dispute-message', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId })
      .populate('supplierId', 'name contactPhone')
      .lean();

    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }

    const overchargedItems = invoice.lineItems.filter((item) => item.isOvercharge);
    if (overchargedItems.length === 0) {
      res.status(400).json({ error: 'לא נמצאו חריגות מחיר בחשבונית זו' });
      return;
    }

    const supplierName = (invoice.supplierId as unknown as { name: string; contactPhone?: string })?.name || 'ספק';

    // Build the item list for the prompt
    const itemsList = overchargedItems.map((item) => {
      return `- ${item.productName}: מחיר מוסכם ₪${((item.agreedPrice || 0) / 100).toFixed(2)}/${item.unit}, חויב ₪${(item.unitPrice / 100).toFixed(2)}/${item.unit}, הפרש ₪${((item.priceDiff || 0) / 100).toFixed(2)} ליחידה, כמות ${item.quantity}, סה"כ חריגה ₪${((item.overchargeAmount || 0) / 100).toFixed(2)}`;
    }).join('\n');

    const totalOvercharge = `₪${(invoice.totalOverchargeAmount / 100).toFixed(2)}`;
    const invoiceDate = invoice.invoiceDate
      ? new Date(invoice.invoiceDate).toLocaleDateString('he-IL')
      : 'לא צוין';

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a business communication assistant for Israeli SMBs. Generate a polite but firm Hebrew WhatsApp message to a supplier about price discrepancies found in their invoice. The message should:
- Be written in natural, professional Hebrew suitable for WhatsApp
- Be direct but respectful (formal but not stiff)
- Cite the specific price agreement and invoice details
- List each overcharged item clearly
- Request a corrected invoice or credit note
- Be concise — suitable for a WhatsApp message (not a formal letter)
- Do NOT use markdown formatting — plain text only
- Return ONLY the message text, nothing else`,
      messages: [{
        role: 'user',
        content: `Generate a dispute message for this invoice:

Supplier: ${supplierName}
Invoice number: ${invoice.invoiceNumber || 'לא צוין'}
Invoice date: ${invoiceDate}
Total overcharge: ${totalOvercharge}

Overcharged items:
${itemsList}`,
      }],
    });

    const messageText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Store the message on the invoice
    await Invoice.updateOne(
      { _id: req.params.id, userId: req.userId },
      { $set: { disputeMessage: messageText } },
    );

    res.json({ message: messageText });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Dispute message generation error:', errMsg);
    res.status(500).json({ error: 'שגיאה ביצירת הודעת מחלוקת' });
  }
});

export default router;
