import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Invoice from '../models/Invoice';
import Supplier from '../models/Supplier';

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic stats for this month
    const monthFilter = { userId: req.userId, uploadedAt: { $gte: startOfMonth }, status: 'done' };
    const [totalInvoices, monthInvoices] = await Promise.all([
      Invoice.countDocuments({ userId: req.userId, status: 'done' }),
      Invoice.find(monthFilter).lean(),
    ]);

    const totalOverchargeAmount = monthInvoices.reduce((sum, inv) => sum + inv.totalOverchargeAmount, 0);
    const overchargeCount = monthInvoices.reduce((sum, inv) => sum + inv.overchargeCount, 0);

    // Top overcharging suppliers
    const supplierOvercharges = await Invoice.aggregate([
      { $match: { userId: req.userId as any, status: 'done', overchargeCount: { $gt: 0 } } },
      {
        $group: {
          _id: '$supplierId',
          totalOvercharge: { $sum: '$totalOverchargeAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { totalOvercharge: -1 } },
      { $limit: 5 },
    ]);

    // Resolve supplier names
    const supplierIds = supplierOvercharges.map((s) => s._id);
    const suppliers = await Supplier.find({ _id: { $in: supplierIds } }).lean();
    const supplierNameMap = new Map(suppliers.map((s) => [s._id.toString(), s.name]));

    const topOverchargingSuppliers = supplierOvercharges.map((s) => ({
      supplierId: s._id,
      supplierName: supplierNameMap.get(s._id.toString()) || 'לא ידוע',
      totalOvercharge: s.totalOvercharge,
      invoiceCount: s.invoiceCount,
    }));

    // Overcharge trend (last 30 days, grouped by date)
    const trendData = await Invoice.aggregate([
      {
        $match: {
          userId: req.userId as any,
          status: 'done',
          uploadedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$uploadedAt' } },
          amount: { $sum: '$totalOverchargeAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const overchargeTrend = trendData.map((d) => ({
      date: d._id,
      amount: d.amount,
    }));

    res.json({
      totalInvoices,
      totalOverchargeAmount,
      overchargeCount,
      topOverchargingSuppliers,
      overchargeTrend,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת נתוני דשבורד' });
  }
});

export default router;
