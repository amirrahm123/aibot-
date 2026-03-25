import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import GmailToken from '../models/GmailToken';
import {
  getAuthUrl,
  handleOAuthCallback,
  setupWatch,
  disconnectGmail,
} from '../services/gmail.service';

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

export default router;
