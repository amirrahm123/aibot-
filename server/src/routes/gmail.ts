import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import GmailToken from '../models/GmailToken';
import {
  getAuthUrl,
  handleOAuthCallback,
  setupWatch,
  disconnectGmail,
} from '../services/gmail.service';
import { notifyGmailExpiring } from '../services/notification.service';

const router = Router();

// GET /api/gmail/status — check Gmail connection status (requires auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const token = await GmailToken.findOne({ userId: req.userId, isActive: true }).lean();

    if (!token) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      email: token.email,
      watchActive: token.watchExpiration ? new Date(token.watchExpiration) > new Date() : false,
      watchExpiration: token.watchExpiration,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בבדיקת חיבור Gmail' });
  }
});

// GET /api/gmail/connect — redirect to Google OAuth consent screen (requires auth)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Validate Google OAuth env vars are present
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('Missing Google OAuth env vars:', {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      });
      res.status(500).json({ error: 'Gmail integration not configured on server' });
      return;
    }
    const authUrl = getAuthUrl(req.userId!);
    res.json({ authUrl });
  } catch (err: any) {
    console.error('Gmail connect error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת קישור חיבור Gmail' });
  }
});

// GET /api/gmail/callback — OAuth callback from Google (no auth — state carries userId)
router.get('/callback', async (req: any, res: Response) => {
  const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    await handleOAuthCallback(code as string, userId as string);

    // Set up Gmail watch for push notifications (non-blocking — don't fail the whole flow)
    try {
      await setupWatch(userId as string);
    } catch (watchErr: any) {
      console.error('Gmail watch setup failed (non-fatal):', watchErr.message);
    }

    // Redirect back to integrations page in the app
    res.redirect(`${clientUrl}/app/integrations?gmail=connected`);
  } catch (err: any) {
    console.error('Gmail OAuth callback error:', err);
    res.redirect(`${clientUrl}/app/integrations?gmail=error&message=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/gmail/disconnect — disconnect Gmail (requires auth)
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await disconnectGmail(req.userId!);
    res.json({ message: 'Gmail נותק בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בניתוק Gmail' });
  }
});

// POST /api/gmail/renew-watch — renew Pub/Sub watch (requires auth)
router.post('/renew-watch', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await setupWatch(req.userId!);
    res.json({
      message: 'Watch חודש בהצלחה',
      expiration: result.expiration,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'שגיאה בחידוש Watch', details: err.message });
  }
});

// POST /api/gmail/renew — manually trigger watch renewal (requires auth)
router.post('/renew', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await setupWatch(req.userId!);
    res.json({
      message: 'Watch חודש בהצלחה',
      expiration: result.expiration,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'שגיאה בחידוש Watch', details: errMsg });
  }
});

// GET /api/gmail/cron-renew — auto-renew all expiring watches (called by Vercel Cron)
router.get('/cron-renew', async (req: any, res: Response) => {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Find all active tokens with watch expiring in the next 2 days (or already expired)
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const tokens = await GmailToken.find({
      isActive: true,
      $or: [
        { watchExpiration: { $lt: twoDaysFromNow } },
        { watchExpiration: null },
      ],
    });

    const results: { email: string; status: string }[] = [];
    for (const token of tokens) {
      try {
        await setupWatch(token.userId.toString());
        results.push({ email: token.email, status: 'renewed' });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ email: token.email, status: `error: ${errMsg}` });

        // If renewal failed and watch expires within 7 days, create notification
        if (token.watchExpiration) {
          const expiryDate = new Date(token.watchExpiration);
          const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          if (daysRemaining <= 7 && daysRemaining > 0) {
            try {
              await notifyGmailExpiring(token.userId, daysRemaining);
            } catch { /* best effort */ }
          }
        }
      }
    }

    // Also process trial expirations in the same daily cron
    let trialResults = { expired: 0, warned: 0 };
    try {
      const { processTrialExpirations } = await import('./subscription');
      trialResults = await processTrialExpirations();
    } catch (trialErr) {
      console.error('Trial expiry processing error:', trialErr);
    }

    res.json({ renewed: results.length, results, trials: trialResults });
  } catch (err: unknown) {
    const cronErrMsg = err instanceof Error ? err.message : String(err);
    console.error('Cron renew error:', cronErrMsg);
    res.status(500).json({ error: cronErrMsg });
  }
});

export default router;
