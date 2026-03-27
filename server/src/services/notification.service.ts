import { Types } from 'mongoose';
import Notification from '../models/Notification';

type NotificationType = 'new_invoice' | 'overcharge_detected' | 'error' | 'gmail_expiring';

interface CreateNotificationInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  invoiceId?: string | Types.ObjectId;
  supplierId?: string | Types.ObjectId;
}

export async function createNotification(input: CreateNotificationInput) {
  return Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    invoiceId: input.invoiceId,
    supplierId: input.supplierId,
    read: false,
  });
}

export function notifyNewInvoice(
  userId: string | Types.ObjectId,
  supplierName: string,
  invoiceId: string | Types.ObjectId,
  supplierId: string | Types.ObjectId,
) {
  return createNotification({
    userId,
    type: 'new_invoice',
    title: 'חשבונית חדשה התקבלה',
    body: `חשבונית חדשה מ${supplierName} נקלטה במערכת ומחכה לבדיקה`,
    invoiceId,
    supplierId,
  });
}

export function notifyOvercharge(
  userId: string | Types.ObjectId,
  supplierName: string,
  overchargeAmount: number, // agorot
  overchargeCount: number,
  invoiceId: string | Types.ObjectId,
  supplierId: string | Types.ObjectId,
) {
  const amountStr = `₪${(overchargeAmount / 100).toFixed(2)}`;
  return createNotification({
    userId,
    type: 'overcharge_detected',
    title: `חריגת מחיר: ${supplierName}`,
    body: `נמצאו ${overchargeCount} פריטים חורגים בסך ${amountStr} מעבר למחיר המוסכם`,
    invoiceId,
    supplierId,
  });
}

export function notifyError(
  userId: string | Types.ObjectId,
  errorReason: string,
  invoiceId: string | Types.ObjectId,
) {
  return createNotification({
    userId,
    type: 'error',
    title: 'שגיאה בעיבוד חשבונית',
    body: errorReason,
    invoiceId,
  });
}

export function notifyGmailExpiring(
  userId: string | Types.ObjectId,
  daysRemaining: number,
) {
  return createNotification({
    userId,
    type: 'gmail_expiring',
    title: 'חיבור Gmail עומד לפוג',
    body: `חיבור ה-Gmail שלך יפוג בעוד ${daysRemaining} ימים. חדש את החיבור כדי להמשיך לקבל חשבוניות אוטומטית.`,
  });
}
