import User, { IUserDocument } from '../models/User';

const FREE_INVOICE_LIMIT = 20;
const FREE_SCAN_LIMIT = 5;

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Ensure usage counters are for the current month; reset if stale. */
async function ensureCurrentMonth(user: IUserDocument): Promise<void> {
  const month = getCurrentMonth();
  if (!user.usage || user.usage.currentMonth !== month) {
    user.usage = { currentMonth: month, invoicesIngested: 0, aiScansUsed: 0 };
    await user.save();
  }
}

export interface UsageStatus {
  invoicesIngested: number;
  invoiceLimit: number;
  aiScansUsed: number;
  scanLimit: number;
  canIngest: boolean;
  canScan: boolean;
  isFree: boolean;
}

export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const isFree = user.plan === 'free' && !user.isTrial;

  if (!isFree) {
    return {
      invoicesIngested: 0,
      invoiceLimit: Infinity,
      aiScansUsed: 0,
      scanLimit: Infinity,
      canIngest: true,
      canScan: true,
      isFree: false,
    };
  }

  await ensureCurrentMonth(user);

  return {
    invoicesIngested: user.usage.invoicesIngested,
    invoiceLimit: FREE_INVOICE_LIMIT,
    aiScansUsed: user.usage.aiScansUsed,
    scanLimit: FREE_SCAN_LIMIT,
    canIngest: user.usage.invoicesIngested < FREE_INVOICE_LIMIT,
    canScan: user.usage.aiScansUsed < FREE_SCAN_LIMIT,
    isFree: true,
  };
}

/** Increment invoice counter. Returns false if limit would be exceeded. */
export async function incrementInvoiceCount(userId: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const isFree = user.plan === 'free' && !user.isTrial;
  if (!isFree) return true; // no limits for paid users

  await ensureCurrentMonth(user);

  if (user.usage.invoicesIngested >= FREE_INVOICE_LIMIT) return false;

  user.usage.invoicesIngested += 1;
  await user.save();
  return true;
}

/** Increment AI scan counter. Returns false if limit would be exceeded. */
export async function incrementScanCount(userId: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const isFree = user.plan === 'free' && !user.isTrial;
  if (!isFree) return true;

  await ensureCurrentMonth(user);

  if (user.usage.aiScansUsed >= FREE_SCAN_LIMIT) return false;

  user.usage.aiScansUsed += 1;
  await user.save();
  return true;
}
