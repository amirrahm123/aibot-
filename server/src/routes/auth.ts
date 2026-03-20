import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import Otp from '../models/Otp';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendOtp, isMockMode } from '../services/sms.service';

const router = Router();

// Rate limit: max 15 attempts per 10 min per IP (generous for dev)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { error: 'יותר מדי ניסיונות — נסה שוב בעוד 10 דקות' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Israeli phone regex: 05X-XXXXXXX or 05XXXXXXXX
const PHONE_REGEX = /^05\d[\-]?\d{7}$/;

function normalizePhoneForStorage(phone: string): string {
  return phone.replace(/\D/g, ''); // store digits only: 05XXXXXXXX
}

// ========================
// REGISTRATION FLOW
// ========================

// Step 1: POST /api/auth/register — validate + send OTP
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, businessName, ownerName, phone } = req.body;

    if (!username || !password || !businessName || !ownerName || !phone) {
      res.status(400).json({ error: 'כל השדות נדרשים' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }

    const cleanPhone = phone.replace(/[\-\s]/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({ error: 'מספר טלפון לא תקין — פורמט: 05X-XXXXXXX' });
      return;
    }

    const normalizedPhone = normalizePhoneForStorage(cleanPhone);

    // Check if username already taken
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'שם משתמש כבר תפוס' });
      return;
    }

    // Check if phone already registered
    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      res.status(400).json({ error: 'מספר טלפון כבר רשום במערכת' });
      return;
    }

    // Invalidate any existing OTPs for this phone
    await Otp.updateMany({ phone: normalizedPhone, used: false }, { $set: { used: true } });

    // Generate and send OTP
    const otpCode = await sendOtp(cleanPhone);
    const otpHash = await bcrypt.hash(otpCode, 10);

    // Save OTP to DB — 10 minutes expiry
    const savedOtp = await Otp.create({
      phone: normalizedPhone,
      code: otpHash,
      purpose: 'register',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[OTP SAVED] register | phone=${normalizedPhone} | id=${savedOtp._id} | expires=${savedOtp.expiresAt.toISOString()}`);

    const response: any = { message: 'קוד אימות נשלח לטלפון', phone: normalizedPhone };
    if (isMockMode()) {
      response.dev_otp = otpCode;
    }
    res.json(response);
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
});

// Step 2: POST /api/auth/register/verify — verify OTP + create account
router.post('/register/verify', async (req: Request, res: Response) => {
  try {
    const { username, password, businessName, ownerName, phone, otpCode } = req.body;

    if (!username || !password || !businessName || !ownerName || !phone || !otpCode) {
      res.status(400).json({ error: 'כל השדות נדרשים' });
      return;
    }

    const normalizedPhone = normalizePhoneForStorage(phone);
    console.log(`[OTP VERIFY] register | phone=${normalizedPhone} | code=${otpCode}`);

    // Debug: show all OTPs for this phone
    const allOtps = await Otp.find({ phone: normalizedPhone }).sort({ createdAt: -1 }).limit(5).lean();
    console.log(`[OTP DEBUG] Found ${allOtps.length} OTPs for ${normalizedPhone}:`);
    allOtps.forEach((o, i) => {
      console.log(`  [${i}] id=${o._id} purpose=${o.purpose} used=${o.used} attempts=${o.attempts} expires=${o.expiresAt.toISOString()} now=${new Date().toISOString()} expired=${o.expiresAt < new Date()}`);
    });

    // Find the latest unused OTP for this phone
    const otp = await Otp.findOne({
      phone: normalizedPhone,
      purpose: 'register',
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      console.log(`[OTP FAIL] No valid OTP found for ${normalizedPhone}`);
      res.status(400).json({ error: 'קוד אימות לא נמצא או פג תוקף — בקש קוד חדש' });
      return;
    }

    console.log(`[OTP FOUND] id=${otp._id} attempts=${otp.attempts}`);

    if (otp.attempts >= 3) {
      otp.used = true;
      await otp.save();
      res.status(400).json({ error: 'יותר מדי ניסיונות — בקש קוד חדש' });
      return;
    }

    const isValid = await bcrypt.compare(otpCode, otp.code);
    if (!isValid) {
      otp.attempts += 1;
      await otp.save();
      console.log(`[OTP FAIL] Wrong code for ${normalizedPhone} (attempt ${otp.attempts})`);
      res.status(400).json({ error: 'קוד אימות שגוי' });
      return;
    }

    // Mark OTP as used
    otp.used = true;
    await otp.save();
    console.log(`[OTP SUCCESS] register verified for ${normalizedPhone}`);

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash,
      businessName,
      ownerName,
      phone: normalizedPhone,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.status(201).json({
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
    console.error('Register verify error:', err);
    res.status(500).json({ error: 'שגיאה באימות' });
  }
});

// ========================
// LOGIN FLOW (2-step)
// ========================

// Step 1: POST /api/auth/login — verify username + password, send OTP
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

    // Password OK — send OTP to registered phone
    await Otp.updateMany({ phone: user.phone, used: false }, { $set: { used: true } });

    const otpCode = await sendOtp(user.phone);
    const otpHash = await bcrypt.hash(otpCode, 10);

    const savedOtp = await Otp.create({
      phone: user.phone,
      code: otpHash,
      purpose: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[OTP SAVED] login | phone=${user.phone} | id=${savedOtp._id} | expires=${savedOtp.expiresAt.toISOString()}`);

    // Mask phone for display: 050***4567
    const maskedPhone = user.phone.slice(0, 3) + '***' + user.phone.slice(-4);

    const response: any = {
      message: 'קוד אימות נשלח',
      maskedPhone,
      loginToken: jwt.sign(
        { userId: user._id, purpose: 'login-otp' },
        process.env.JWT_SECRET!,
        { expiresIn: '10m' }
      ),
    };
    if (isMockMode()) {
      response.dev_otp = otpCode;
    }
    res.json(response);
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// Step 2: POST /api/auth/login/verify — verify OTP, issue full token
router.post('/login/verify', async (req: Request, res: Response) => {
  try {
    const { loginToken, otpCode } = req.body;

    if (!loginToken || !otpCode) {
      res.status(400).json({ error: 'נא להזין קוד אימות' });
      return;
    }

    // Verify the temporary login token
    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(loginToken, process.env.JWT_SECRET!) as any;
      if (decoded.purpose !== 'login-otp') throw new Error();
    } catch {
      res.status(401).json({ error: 'פג תוקף — נא להתחבר מחדש' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'משתמש לא נמצא' });
      return;
    }

    console.log(`[OTP VERIFY] login | phone=${user.phone} | code=${otpCode}`);

    // Debug: show all OTPs for this phone
    const allOtps = await Otp.find({ phone: user.phone }).sort({ createdAt: -1 }).limit(5).lean();
    console.log(`[OTP DEBUG] Found ${allOtps.length} OTPs for ${user.phone}:`);
    allOtps.forEach((o, i) => {
      console.log(`  [${i}] id=${o._id} purpose=${o.purpose} used=${o.used} attempts=${o.attempts} expires=${o.expiresAt.toISOString()} now=${new Date().toISOString()} expired=${o.expiresAt < new Date()}`);
    });

    // Find latest unused OTP
    const otp = await Otp.findOne({
      phone: user.phone,
      purpose: 'login',
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      console.log(`[OTP FAIL] No valid OTP found for ${user.phone}`);
      res.status(400).json({ error: 'קוד אימות לא נמצא או פג תוקף' });
      return;
    }

    console.log(`[OTP FOUND] id=${otp._id} attempts=${otp.attempts}`);

    if (otp.attempts >= 3) {
      otp.used = true;
      await otp.save();
      res.status(400).json({ error: 'יותר מדי ניסיונות — נא להתחבר מחדש' });
      return;
    }

    const isValid = await bcrypt.compare(otpCode, otp.code);
    if (!isValid) {
      otp.attempts += 1;
      await otp.save();
      console.log(`[OTP FAIL] Wrong code for ${user.phone} (attempt ${otp.attempts})`);
      res.status(400).json({ error: 'קוד אימות שגוי' });
      return;
    }

    otp.used = true;
    await otp.save();
    console.log(`[OTP SUCCESS] login verified for ${user.phone}`);

    // Issue full session token
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
    console.error('Login verify error:', err);
    res.status(500).json({ error: 'שגיאה באימות' });
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
      createdAt: user.createdAt,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת המשתמש' });
  }
});

export default router;
