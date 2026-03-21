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

// POST /api/suppliers
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    // Free plan limit: 2 suppliers
    const user = await User.findById(req.userId);
    if (user && (!user.plan || user.plan === 'free')) {
      const count = await Supplier.countDocuments({ userId: req.userId, isActive: true });
      if (count >= 2) {
        res.status(403).json({ error: 'שדרג לפרו להוסיף ספקים נוספים', upgrade: true });
        return;
      }
    }

    const { name, contactName, contactPhone, email, category, notes } = req.body;
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'שם ספק חייב להכיל לפחות 2 תווים' });
      return;
    }
    if (contactName && contactName.trim().length < 2) {
      res.status(400).json({ error: 'שם איש קשר חייב להכיל לפחות 2 תווים' });
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
    const allowedFields = ['name', 'contactName', 'contactPhone', 'email', 'category', 'notes', 'isActive'];
    const update: any = {};
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
