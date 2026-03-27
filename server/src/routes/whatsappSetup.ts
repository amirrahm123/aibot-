import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();
router.use(authMiddleware);

// In-memory OTP store (in production, use Redis or DB)
const otpStore = new Map<string, { code: string; expiresAt: number; phone: string }>();

const ISRAELI_PHONE_RE = /^(\+972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}$/;

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) return '+972' + cleaned.slice(1);
  if (!cleaned.startsWith('+')) return '+972' + cleaned;
  return cleaned;
}

// POST /api/integrations/whatsapp/verify/start
router.post('/verify/start', async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone || !ISRAELI_PHONE_RE.test(phone.trim())) {
      res.status(400).json({ error: 'מספר טלפון לא תקין — יש להזין בפורמט ישראלי (05X-XXXXXXX)' });
      return;
    }

    const normalizedPhone = normalizePhone(phone.trim());

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP (expires in 10 minutes)
    otpStore.set(req.userId!, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      phone: normalizedPhone,
    });

    // Send via Twilio WhatsApp
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (twilioSid && twilioToken) {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioFrom,
          To: `whatsapp:${normalizedPhone}`,
          Body: `קוד האימות שלך בשומר המחיר: ${code}`,
        }),
      });

      if (!twilioResp.ok) {
        const errorBody = await twilioResp.json().catch(() => ({})) as Record<string, unknown>;
        console.error('Twilio API error:', {
          status: twilioResp.status,
          body: errorBody,
          from: twilioFrom,
          to: `whatsapp:${normalizedPhone}`,
        });

        // Check for sandbox-specific errors
        const twilioMessage = String(errorBody.message || '');
        if (twilioMessage.includes('not a valid WhatsApp') || twilioMessage.includes('sandbox')) {
          res.status(400).json({
            error: 'שליחת הקוד נכשלה — ב-Sandbox צריך קודם להצטרף דרך WhatsApp. בדוק שהמספר נכון ונסה שוב.',
            details: twilioMessage,
          });
          return;
        }

        res.status(400).json({
          error: 'שליחת הקוד נכשלה — בדוק שהמספר נכון ונסה שוב',
          details: twilioMessage,
        });
        return;
      }
    } else {
      console.warn('Twilio not configured — OTP stored but not sent. Code:', code);
    }

    res.json({ message: 'קוד אימות נשלח בהצלחה', phoneMasked: normalizedPhone.slice(0, -4) + '****' });
  } catch {
    res.status(500).json({ error: 'שגיאה בשליחת קוד אימות' });
  }
});

// POST /api/integrations/whatsapp/verify/confirm
router.post('/verify/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      res.status(400).json({ error: 'יש להזין קוד בן 6 ספרות' });
      return;
    }

    const stored = otpStore.get(req.userId!);
    if (!stored) {
      res.status(400).json({ error: 'לא נמצא קוד אימות — שלח קוד חדש' });
      return;
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(req.userId!);
      res.status(400).json({ error: 'קוד האימות פג תוקף — שלח קוד חדש' });
      return;
    }

    if (stored.code !== code) {
      res.status(400).json({ error: 'קוד שגוי — נסה שוב' });
      return;
    }

    // OTP is correct — update user
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    user.whatsappNumber = stored.phone;
    user.whatsappVerified = true;
    await user.save();

    otpStore.delete(req.userId!);

    res.json({ message: 'WhatsApp אומת בהצלחה!', phone: stored.phone });
  } catch {
    res.status(500).json({ error: 'שגיאה באימות קוד' });
  }
});

// POST /api/integrations/whatsapp/disconnect
router.post('/disconnect', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    user.whatsappNumber = undefined;
    user.whatsappVerified = false;
    await user.save();

    res.json({ message: 'WhatsApp נותק בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בניתוק WhatsApp' });
  }
});

// POST /api/integrations/whatsapp/test — send a test message
router.post('/test', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.whatsappVerified || !user.whatsappNumber) {
      res.status(400).json({ error: 'WhatsApp לא מחובר' });
      return;
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!twilioSid || !twilioToken) {
      res.status(500).json({ error: 'Twilio לא מוגדר' });
      return;
    }

    const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioFrom,
        To: `whatsapp:${user.whatsappNumber}`,
        Body: `הודעת בדיקה מ-שומר המחיר! החיבור פעיל ותקין. 🛡️`,
      }),
    });

    res.json({ message: 'הודעת בדיקה נשלחה בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בשליחת הודעת בדיקה' });
  }
});

export default router;
