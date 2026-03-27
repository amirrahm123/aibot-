import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Rate limit: max 15 attempts per 10 min per IP
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { error: 'יותר מדי ניסיונות — נסה שוב בעוד 10 דקות' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================
// REGISTRATION
// ========================

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, businessName, ownerName } = req.body;

    if (!username || !password || !businessName || !ownerName) {
      res.status(400).json({ error: 'כל השדות נדרשים' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }

    // Check if username already taken
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'שם משתמש כבר תפוס' });
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash,
      businessName,
      ownerName,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        businessName: user.businessName,
        ownerName: user.ownerName,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
});

// ========================
// LOGIN
// ========================

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'נא להזין שם משתמש וסיסמה' });
      return;
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
      return;
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        businessName: user.businessName,
        ownerName: user.ownerName,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }
    res.json({
      _id: user._id,
      username: user.username,
      businessName: user.businessName,
      ownerName: user.ownerName,
      phone: user.phone,
      plan: user.plan || 'free',
      billingInterval: user.billingInterval || 'monthly',
      planExpiresAt: user.planExpiresAt,
      isTrial: user.isTrial || false,
      trialEndsAt: user.trialEndsAt,
      whatsappNumber: user.whatsappNumber,
      whatsappVerified: user.whatsappVerified || false,
      createdAt: user.createdAt,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת המשתמש' });
  }
});

export default router;
