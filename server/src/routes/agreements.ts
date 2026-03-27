import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import PriceAgreement from '../models/PriceAgreement';
import PriceAgreementHistory from '../models/PriceAgreementHistory';
import Supplier from '../models/Supplier';

const router = Router();
router.use(authMiddleware);

// GET /api/agreements?supplierId=...
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.userId };
    if (req.query.supplierId) {
      filter.supplierId = req.query.supplierId;
    }
    const agreements = await PriceAgreement.find(filter)
      .populate('supplierId', 'name')
      .sort({ productName: 1 })
      .lean();
    res.json(agreements);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת הסכמי מחיר' });
  }
});

// POST /api/agreements
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId, productName, unit, agreedPrice, validFrom, validUntil, notes } = req.body;

    if (!supplierId || !productName || !unit || agreedPrice == null || !validFrom) {
      res.status(400).json({ error: 'כל השדות הנדרשים חייבים להיות מלאים' });
      return;
    }

    // Convert shekels to agorot
    const agreedPriceAgorot = Math.round(agreedPrice * 100);

    const agreement = await PriceAgreement.create({
      userId: req.userId,
      supplierId,
      productName,
      unit,
      agreedPrice: agreedPriceAgorot,
      validFrom: new Date(validFrom),
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
    });

    res.status(201).json(agreement);
  } catch {
    res.status(500).json({ error: 'שגיאה ביצירת הסכם מחיר' });
  }
});

// PUT /api/agreements/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // First, load the current agreement to capture old price for history
    const existing = await PriceAgreement.findOne({ _id: req.params.id, userId: req.userId });
    if (!existing) {
      res.status(404).json({ error: 'הסכם מחיר לא נמצא' });
      return;
    }

    const update: Record<string, unknown> = { ...req.body };
    // Convert shekels to agorot if agreedPrice is being updated
    if (update.agreedPrice != null) {
      update.agreedPrice = Math.round((update.agreedPrice as number) * 100);
    }
    if (update.validFrom) update.validFrom = new Date(update.validFrom as string);
    if (update.validUntil) update.validUntil = new Date(update.validUntil as string);

    // Log price change to history if price actually changed
    const newPriceAgorot = update.agreedPrice as number | undefined;
    if (newPriceAgorot != null && newPriceAgorot !== existing.agreedPrice) {
      await PriceAgreementHistory.create({
        agreementId: existing._id,
        supplierId: existing.supplierId,
        productName: existing.productName,
        oldPrice: existing.agreedPrice,
        newPrice: newPriceAgorot,
        changedBy: req.userId,
        changeReason: (req.body.changeReason as string) || undefined,
      });
    }

    const agreement = await PriceAgreement.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true }
    );

    res.json(agreement);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון הסכם מחיר' });
  }
});

// DELETE /api/agreements/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const agreement = await PriceAgreement.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!agreement) {
      res.status(404).json({ error: 'הסכם מחיר לא נמצא' });
      return;
    }
    res.json({ message: 'הסכם מחיר נמחק בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת הסכם מחיר' });
  }
});

// GET /api/agreements/:id/history — get price change history for an agreement
router.get('/:id/history', async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const agreement = await PriceAgreement.findOne({ _id: req.params.id, userId: req.userId });
    if (!agreement) {
      res.status(404).json({ error: 'הסכם מחיר לא נמצא' });
      return;
    }

    const history = await PriceAgreementHistory.find({ agreementId: req.params.id })
      .sort({ changedAt: -1 })
      .lean();

    res.json(history);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת היסטוריית שינויים' });
  }
});

// POST /api/agreements/bulk — CSV bulk import
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // Array of { supplierName, productName, unit, agreedPrice }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'נדרש מערך של פריטים' });
      return;
    }

    // Build a map of supplier names to IDs
    const suppliers = await Supplier.find({ userId: req.userId }).lean();
    const supplierMap = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s._id]));

    const created: any[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const supplierId = supplierMap.get(item.supplierName?.trim().toLowerCase());
      if (!supplierId) {
        errors.push(`ספק "${item.supplierName}" לא נמצא`);
        continue;
      }

      if (!item.productName || !item.unit || item.agreedPrice == null) {
        errors.push(`פריט חסר נתונים: ${JSON.stringify(item)}`);
        continue;
      }

      const agreement = await PriceAgreement.create({
        userId: req.userId,
        supplierId,
        productName: item.productName.trim(),
        unit: item.unit,
        agreedPrice: Math.round(item.agreedPrice * 100),
        validFrom: new Date(),
        notes: item.notes || undefined,
      });
      created.push(agreement);
    }

    res.json({ created: created.length, errors });
  } catch {
    res.status(500).json({ error: 'שגיאה בייבוא הסכמי מחיר' });
  }
});

export default router;
