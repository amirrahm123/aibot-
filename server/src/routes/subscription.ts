import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { createNotification } from '../services/notification.service';

const router = Router();
router.use(authMiddleware);

// POST /api/subscription/trial/start — start 14-day Pro trial
router.post('/trial/start', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    if (user.plan !== 'free') {
      res.status(400).json({ error: 'ניסיון חינם זמין רק למשתמשי תוכנית חינם' });
      return;
    }

    if (user.trialStartedAt) {
      res.status(400).json({ error: 'כבר ניצלת את תקופת הניסיון' });
      return;
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    user.plan = 'pro';
    user.isTrial = true;
    user.trialStartedAt = now;
    user.trialEndsAt = trialEnd;
    await user.save();

    res.json({
      message: 'הניסיון החינמי התחיל! יש לך 14 ימים של גישה מלאה לתוכנית פרו.',
      trialEndsAt: trialEnd.toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בהתחלת ניסיון' });
  }
});

// POST /api/subscription/trial/convert — convert trial to paid
router.post('/trial/convert', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    if (!user.isTrial && user.plan === 'free') {
      res.status(400).json({ error: 'אין ניסיון פעיל להמרה' });
      return;
    }

    user.isTrial = false;
    user.trialConvertedAt = new Date();
    // plan stays as 'pro' (or whatever it was during trial)
    await user.save();

    res.json({ message: 'התוכנית שודרגה בהצלחה!' });
  } catch {
    res.status(500).json({ error: 'שגיאה בהמרת ניסיון' });
  }
});

// This function is called by the daily cron to check for expiring/expired trials
export async function processTrialExpirations(): Promise<{ expired: number; warned: number }> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let expired = 0;
  let warned = 0;

  // 1. Expire trials that have ended
  const expiredTrials = await User.find({
    isTrial: true,
    trialEndsAt: { $lte: now },
  });

  for (const user of expiredTrials) {
    user.plan = 'free';
    user.isTrial = false;
    await user.save();

    await createNotification({
      userId: user._id,
      type: 'error',
      title: 'תקופת הניסיון הסתיימה',
      body: 'תקופת הניסיון שלך הסתיימה. שדרג לפרו כדי להמשיך ליהנות מכל התכונות.',
    });
    expired++;
  }

  // 2. Warn users 3 days before trial expires
  const expiringTrials = await User.find({
    isTrial: true,
    trialEndsAt: { $gt: now, $lte: threeDaysFromNow },
  });

  for (const user of expiringTrials) {
    const daysLeft = Math.ceil((new Date(user.trialEndsAt!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    await createNotification({
      userId: user._id,
      type: 'overcharge_detected', // reuse the warning-style notification type
      title: `הניסיון שלך מסתיים בעוד ${daysLeft} ימים`,
      body: 'שדרג עכשיו כדי לא לאבד גישה להתראות WhatsApp, דשבורד מתקדם וייצוא דו"חות.',
    });
    warned++;
  }

  return { expired, warned };
}

export default router;
