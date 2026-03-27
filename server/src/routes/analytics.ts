import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Invoice from '../models/Invoice';
import Supplier from '../models/Supplier';

const router = Router();
router.use(authMiddleware);

// ============================================================
// GET /api/analytics/savings?months=6
// Returns monthly overcharge totals + lifetime total
// ============================================================
router.get('/savings', async (req: AuthRequest, res: Response) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 6, 24);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const monthlySavings = await Invoice.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          status: { $in: ['done', 'pending_approval'] },
          totalOverchargeAmount: { $gt: 0 },
          uploadedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$uploadedAt' } },
          totalOvercharge: { $sum: '$totalOverchargeAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate lifetime total (all time, not just last N months)
    const lifetimeResult = await Invoice.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          status: { $in: ['done', 'pending_approval'] },
          totalOverchargeAmount: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOvercharge: { $sum: '$totalOverchargeAmount' },
        },
      },
    ]);

    const lifetimeTotal = lifetimeResult[0]?.totalOvercharge || 0;

    res.json({
      monthly: monthlySavings.map((m) => ({
        month: m._id,
        totalOvercharge: m.totalOvercharge,
        invoiceCount: m.invoiceCount,
      })),
      lifetimeTotal,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת נתוני חיסכון' });
  }
});

// ============================================================
// GET /api/analytics/supplier-risk
// Returns all suppliers with calculated risk scores
// ============================================================

// Simple in-memory cache
let riskCache: { data: unknown; userId: string; expiry: number } | null = null;

async function calculateSupplierRisk(
  userId: string,
  supplierId: Types.ObjectId,
): Promise<{ score: number; explanation: string; overchargeCount: number; totalInvoices: number; totalOvercharge: number }> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Current period (last 90 days)
  const currentInvoices = await Invoice.find({
    userId: new Types.ObjectId(userId),
    supplierId,
    status: { $in: ['done', 'pending_approval'] },
    uploadedAt: { $gte: ninetyDaysAgo },
  }).lean();

  const totalInvoices = currentInvoices.length;
  if (totalInvoices === 0) {
    return { score: 0, explanation: 'אין חשבוניות ב-90 הימים האחרונים', overchargeCount: 0, totalInvoices: 0, totalOvercharge: 0 };
  }

  const overchargeInvoices = currentInvoices.filter((inv) => inv.overchargeCount > 0);
  const overchargeCount = overchargeInvoices.length;
  const overchargePercent = overchargeCount / totalInvoices;

  // Average overcharge as % of invoice total
  let avgOverchargeRatio = 0;
  if (overchargeInvoices.length > 0) {
    const ratios = overchargeInvoices.map((inv) =>
      inv.totalInvoiceAmount > 0 ? inv.totalOverchargeAmount / inv.totalInvoiceAmount : 0,
    );
    avgOverchargeRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }

  // Trend: compare overcharge rate to previous 90-day period
  const previousInvoices = await Invoice.find({
    userId: new Types.ObjectId(userId),
    supplierId,
    status: { $in: ['done', 'pending_approval'] },
    uploadedAt: { $gte: oneEightyDaysAgo, $lt: ninetyDaysAgo },
  }).lean();

  let trendFactor = 0.5; // neutral
  if (previousInvoices.length > 0) {
    const previousOverchargeRate = previousInvoices.filter((inv) => inv.overchargeCount > 0).length / previousInvoices.length;
    if (overchargePercent > previousOverchargeRate) {
      trendFactor = 0.8; // getting worse
    } else if (overchargePercent < previousOverchargeRate) {
      trendFactor = 0.2; // improving
    }
  }

  // Weighted score (0-100)
  const score = Math.round(
    overchargePercent * 50 +           // 50% weight: % of invoices with overcharges
    Math.min(avgOverchargeRatio, 1) * 30 + // 30% weight: avg overcharge ratio (capped at 100%)
    trendFactor * 20,                   // 20% weight: trend
  );

  const totalOvercharge = currentInvoices.reduce((sum, inv) => sum + inv.totalOverchargeAmount, 0);

  const explanation = `${overchargeCount} חשבוניות מתוך ${totalInvoices} כללו חריגה ב-90 הימים האחרונים`;

  return { score: Math.min(score, 100), explanation, overchargeCount, totalInvoices, totalOvercharge };
}

router.get('/supplier-risk', async (req: AuthRequest, res: Response) => {
  try {
    // Check cache (1 hour TTL)
    if (riskCache && riskCache.userId === req.userId && riskCache.expiry > Date.now()) {
      res.json(riskCache.data);
      return;
    }

    const suppliers = await Supplier.find({ userId: req.userId, isActive: true }).lean();

    const results = await Promise.all(
      suppliers.map(async (s) => {
        const risk = await calculateSupplierRisk(req.userId!, s._id as Types.ObjectId);
        return {
          supplierId: s._id,
          supplierName: s.name,
          riskScore: risk.score,
          explanation: risk.explanation,
          overchargeCount: risk.overchargeCount,
          totalInvoices: risk.totalInvoices,
          totalOvercharge: risk.totalOvercharge,
        };
      }),
    );

    // Sort descending by score, only return those with score > 0
    const sorted = results.filter((r) => r.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);

    // Cache for 1 hour
    riskCache = { data: sorted, userId: req.userId!, expiry: Date.now() + 60 * 60 * 1000 };

    res.json(sorted);
  } catch {
    res.status(500).json({ error: 'שגיאה בחישוב סיכוני ספקים' });
  }
});

export default router;
