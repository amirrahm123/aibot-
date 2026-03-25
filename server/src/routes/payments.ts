import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Purchase from '../models/Purchase';

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

// Helper: send admin notification
async function notifyAdmin(message: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`💰 PURCHASE NOTIFICATION`);
  console.log(message);
  console.log(`${'='.repeat(50)}\n`);

  // If ADMIN_WEBHOOK_URL is set, send HTTP POST (works with Slack, Discord, Telegram bots, etc.)
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, content: message }),
      });
    } catch (err) {
      console.error('Admin webhook notification failed:', err);
    }
  }
}

// POST /api/payments/create-checkout-session
// Stripe checkout disabled — contact directly for plan upgrades
router.post('/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    message: 'התשלום אינו זמין כרגע דרך האתר. ליצירת קשר והצטרפות לתוכנית, פנו אלינו ישירות בוואטסאפ: 0527044989',
    whatsapp: 'https://wa.me/9720527044989',
  });
});

// POST /api/payments/webhook (no auth — Stripe calls this)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Webhook not configured' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId as 'pro' | 'business';

        if (userId && planId) {
          const user = await User.findByIdAndUpdate(userId, {
            plan: planId,
            stripeSubscriptionId: session.subscription as string,
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }, { new: true });

          if (user) {
            // Save purchase record
            await Purchase.create({
              userId: user._id,
              username: user.username,
              businessName: user.businessName,
              phone: user.phone,
              plan: planId,
              amountPaid: session.amount_total || 0,
              currency: session.currency || 'ils',
              stripeSessionId: session.id,
              stripeSubscriptionId: session.subscription as string,
              eventType: 'new',
            });

            const planLabel = planId === 'pro' ? 'פרו (99₪/חודש)' : 'עסקי (249₪/חודש)';
            await notifyAdmin(
              `🎉 רכישה חדשה!\n` +
              `👤 ${user.businessName} (${user.username})\n` +
              `📱 ${user.phone}\n` +
              `📦 תוכנית: ${planLabel}\n` +
              `💳 סכום: ₪${((session.amount_total || 0) / 100).toFixed(2)}\n` +
              `🕐 ${new Date().toLocaleString('he-IL')}`
            );
          }
        }
        break;
      }

      case 'invoice.paid': {
        // Recurring payment succeeded — extend plan
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
          if (user) {
            user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await user.save();

            await Purchase.create({
              userId: user._id,
              username: user.username,
              businessName: user.businessName,
              phone: user.phone,
              plan: user.plan as 'pro' | 'business',
              amountPaid: invoice.amount_paid || 0,
              currency: invoice.currency || 'ils',
              stripeSessionId: invoice.id,
              stripeSubscriptionId: subscriptionId,
              eventType: 'renewal',
            });

            await notifyAdmin(
              `🔄 חידוש מנוי!\n` +
              `👤 ${user.businessName} (${user.username})\n` +
              `📦 תוכנית: ${user.plan}\n` +
              `💳 סכום: ₪${((invoice.amount_paid || 0) / 100).toFixed(2)}`
            );
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription canceled
        const sub = event.data.object as Stripe.Subscription;
        const user = await User.findOne({ stripeSubscriptionId: sub.id });
        if (user) {
          const oldPlan = user.plan;
          user.plan = 'free';
          user.stripeSubscriptionId = undefined;
          user.planExpiresAt = undefined;
          await user.save();

          await Purchase.create({
            userId: user._id,
            username: user.username,
            businessName: user.businessName,
            phone: user.phone,
            plan: oldPlan as 'pro' | 'business',
            stripeSessionId: sub.id,
            eventType: 'canceled',
          });

          await notifyAdmin(
            `❌ ביטול מנוי!\n` +
            `👤 ${user.businessName} (${user.username})\n` +
            `📦 תוכנית שבוטלה: ${oldPlan}`
          );
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /api/payments/portal
router.get('/portal', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripe();
    const user = await User.findById(req.userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'אין מנוי פעיל' });
      return;
    }

    const clientUrl = process.env.CLIENT_URL || '';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${clientUrl}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'שגיאה בפתיחת ניהול מנוי' });
  }
});

// GET /api/payments/purchases — admin view of all purchases
router.get('/purchases', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Simple admin check: only the first registered user (you) can see purchases
    const user = await User.findById(req.userId);
    if (!user || user.username !== 'amirrahm') {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }

    const purchases = await Purchase.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(purchases);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת רכישות' });
  }
});

export default router;
