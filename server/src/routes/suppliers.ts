import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Supplier from '../models/Supplier';
import PriceAgreement from '../models/PriceAgreement';
import Invoice from '../models/Invoice';
import User from '../models/User';

const router = Router();
router.use(authMiddleware);

// GET /api/suppliers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.userId };

    // By default only show active suppliers unless ?all=true
    if (req.query.all !== 'true') {
      filter.isActive = true;
    }

    const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();

    // Enrich with agreement and invoice counts
    const enriched = await Promise.all(
      suppliers.map(async (s) => {
        const [agreementCount, invoiceCount, overchargeInvoices, totalInvoices] = await Promise.all([
          PriceAgreement.countDocuments({ supplierId: s._id }),
          Invoice.countDocuments({ supplierId: s._id }),
          Invoice.countDocuments({ supplierId: s._id, overchargeCount: { $gt: 0 } }),
          Invoice.countDocuments({ supplierId: s._id, status: 'done' }),
        ]);
        const overchargeRiskPercent = totalInvoices > 0
          ? Math.round((overchargeInvoices / totalInvoices) * 100)
          : 0;
        return { ...s, agreementCount, invoiceCount, overchargeRiskPercent };
      })
    );

    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת ספקים' });
  }
});

// Israeli phone format validation: 05X-XXXXXXX, 05XXXXXXXX, +972-5X-XXXXXXX, +9725XXXXXXXX
const ISRAELI_PHONE_RE = /^(\+972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}$/;

function validateSupplierFields(body: Record<string, string>): string | null {
  const { name, contactName, contactPhone, category } = body;

  if (!name || name.trim().length < 2) {
    return 'שם ספק חייב להכיל לפחות 2 תווים';
  }
  if (contactName && contactName.trim().length < 2) {
    return 'שם איש קשר חייב להכיל לפחות 2 תווים';
  }
  if (contactPhone && contactPhone.trim()) {
    const cleaned = contactPhone.trim();
    if (!ISRAELI_PHONE_RE.test(cleaned)) {
      return 'מספר טלפון לא תקין — יש להזין בפורמט ישראלי (לדוגמה: 050-1234567)';
    }
  }
  if (category) {
    const validCategories = ['ירקות ופירות', 'מזון', 'מזון ושתייה', 'ניקוי', 'ציוד משרדי', 'ציוד מחשבים', 'ריהוט', 'לוגיסטיקה', 'אחר'];
    if (!validCategories.includes(category)) {
      return 'קטגוריה לא תקינה';
    }
  }
  return null;
}

// POST /api/suppliers
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, contactName, contactPhone, email, category, notes } = req.body;

    const validationError = validateSupplierFields(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const supplier = await Supplier.create({
      userId: req.userId,
      name,
      contactName,
      contactPhone,
      email,
      category: category || 'אחר',
      notes,
    });
    res.status(201).json(supplier);
  } catch {
    res.status(500).json({ error: 'שגיאה ביצירת ספק' });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const validationError = validateSupplierFields(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const allowedFields = ['name', 'contactName', 'contactPhone', 'email', 'category', 'notes', 'isActive'];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true }
    );
    if (!supplier) {
      res.status(404).json({ error: 'ספק לא נמצא' });
      return;
    }
    res.json(supplier);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון ספק' });
  }
});

// DELETE /api/suppliers/:id — soft delete (set isActive = false)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!supplier) {
      res.status(404).json({ error: 'ספק לא נמצא' });
      return;
    }
    res.json({ message: 'ספק הועבר ללא פעיל' });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת ספק' });
  }
});

export default router;
