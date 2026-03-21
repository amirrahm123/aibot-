import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripe();
    const { planId } = req.body; // 'pro' or 'business'

    const priceMap: Record<string, string | undefined> = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      business: process.env.STRIPE_BUSINESS_PRICE_ID,
    };

    const priceId = priceMap[planId];
    if (!priceId) {
      res.status(400).json({ error: 'תוכנית לא תקינה' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId: user._id.toString() },
        name: user.businessName,
        phone: user.phone,
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${clientUrl}/pricing?success=true`,
      cancel_url: `${clientUrl}/pricing?canceled=true`,
      metadata: { userId: user._id.toString(), planId },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת תשלום' });
  }
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
          await User.findByIdAndUpdate(userId, {
            plan: planId,
            stripeSubscriptionId: session.subscription as string,
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
          console.log(`User ${userId} upgraded to ${planId}`);
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
            console.log(`Renewed plan for user ${user._id}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription canceled
        const sub = event.data.object as Stripe.Subscription;
        const user = await User.findOne({ stripeSubscriptionId: sub.id });
        if (user) {
          user.plan = 'free';
          user.stripeSubscriptionId = undefined;
          user.planExpiresAt = undefined;
          await user.save();
          console.log(`User ${user._id} downgraded to free`);
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

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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

export default router;
