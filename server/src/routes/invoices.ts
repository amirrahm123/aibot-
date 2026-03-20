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
  let invoice: any = null;
  try {
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
    const result = invoice.toObject();
    result.supplierName = supplier?.name;

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Invoice processing error:', err);
    if (invoice) {
      invoice.status = 'error';
      invoice.rawExtractedText = err.message;
      await invoice.save();
    }
    res.status(500).json({ error: 'שגיאה בעיבוד החשבונית — נסה שוב', details: err.message });
  }
});

// GET /api/invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = { userId: req.userId };

    if (req.query.supplierId) filter.supplierId = req.query.supplierId;
    if (req.query.overchargeOnly === 'true') filter.overchargeCount = { $gt: 0 };
    if (req.query.dateFrom || req.query.dateTo) {
      filter.uploadedAt = {};
      if (req.query.dateFrom) filter.uploadedAt.$gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filter.uploadedAt.$lte = new Date(req.query.dateTo as string);
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

// DELETE /api/invoices/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }
    // Clean up file
    if (invoice.fileUrl && fs.existsSync(invoice.fileUrl)) {
      fs.unlinkSync(invoice.fileUrl);
    }
    res.json({ message: 'חשבונית נמחקה בהצלחה' });
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

// POST /api/invoices/:id/reprocess
router.post('/:id/reprocess', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) {
      res.status(404).json({ error: 'חשבונית לא נמצאה' });
      return;
    }

    invoice.status = 'processing';
    await invoice.save();

    // Re-read file
    const filePath = path.resolve(invoice.fileUrl);
    if (!fs.existsSync(filePath)) {
      invoice.status = 'error';
      await invoice.save();
      res.status(400).json({ error: 'קובץ החשבונית לא נמצא' });
      return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileBase64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

    const extracted = await extractInvoiceData(fileBase64, mediaType as any);

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

    await invoice.save();
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: 'שגיאה בעיבוד מחדש', details: err.message });
  }
});

export default router;
