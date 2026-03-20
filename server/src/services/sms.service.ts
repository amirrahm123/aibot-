import crypto from 'crypto';

/**
 * SMS Service — sends OTP codes via Twilio or mock mode
 *
 * Set MOCK_SMS=true in .env for dev (logs OTP to console + returns it in API)
 * For production: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '+972' + digits.slice(1);
  }
  if (digits.startsWith('972')) {
    return '+' + digits;
  }
  return '+' + digits;
}

export function isMockMode(): boolean {
  return process.env.MOCK_SMS === 'true' || (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendViaTwilio(phone: string, message: string): Promise<void> {
  const twilio = await import('twilio');
  const client = twilio.default(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const intlPhone = normalizePhone(phone);
  console.log(`[SMS] Sending to ${intlPhone}`);

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: intlPhone,
  });

  console.log(`[SMS] Sent successfully to ${intlPhone}`);
}

/**
 * Send OTP — returns the plain code.
 * In mock mode, also logs to console. The route handler returns it in response.
 */
export async function sendOtp(phone: string): Promise<string> {
  const code = generateOtp();

  if (isMockMode()) {
    console.log(`\n============================`);
    console.log(`[MOCK SMS] OTP for ${phone}: ${code}`);
    console.log(`============================\n`);
  } else {
    try {
      const message = `שומר המחיר — קוד האימות שלך: ${code}\nתוקף: 5 דקות`;
      await sendViaTwilio(phone, message);
    } catch (err: any) {
      console.error(`[SMS ERROR] Failed to send to ${phone}:`, err.message);
      throw new Error('שגיאה בשליחת SMS — בדוק הגדרות Twilio');
    }
  }

  return code;
}

export { normalizePhone, generateOtp };
