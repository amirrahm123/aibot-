import { Router, Request, Response } from 'express';
import GmailToken from '../models/GmailToken';
import Invoice from '../models/Invoice';
import Supplier from '../models/Supplier';
import {
  getNewMessageIds,
  fetchMessage,
} from '../services/gmail.service';
import { processIncomingInvoice } from '../services/ingestion.service';

const router = Router();

// ============================================================
// GMAIL PUB/SUB PUSH NOTIFICATION
// POST /api/webhooks/gmail
// ============================================================
router.post('/gmail', async (req: Request, res: Response) => {
  try {
    // Google Pub/Sub sends a base64-encoded message
    const message = req.body?.message;
    if (!message?.data) {
      res.status(200).send('OK'); // Ack empty messages
      return;
    }

    const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
    const { emailAddress, historyId: newHistoryId } = decoded;

    if (!emailAddress || !newHistoryId) {
      console.warn('Gmail webhook: missing emailAddress or historyId');
      res.status(200).send('OK');
      return;
    }

    // Find the user by Gmail email
    const gmailToken = await GmailToken.findOne({ email: emailAddress, isActive: true });
    if (!gmailToken) {
      console.warn(`Gmail webhook: no active token for ${emailAddress}`);
      res.status(200).send('OK');
      return;
    }

    const userId = gmailToken.userId.toString();
    const previousHistoryId = gmailToken.historyId;

    if (!previousHistoryId) {
      // First notification — just store historyId and move on
      gmailToken.historyId = newHistoryId;
      await gmailToken.save();
      res.status(200).send('OK');
      return;
    }

    // Fetch new message IDs since last historyId
    let messageIds: string[];
    try {
      messageIds = await getNewMessageIds(userId, previousHistoryId);
    } catch (err: any) {
      // If historyId is too old, Google returns 404. Reset and continue.
      if (err.code === 404) {
        gmailToken.historyId = newHistoryId;
        await gmailToken.save();
        res.status(200).send('OK');
        return;
      }
      throw err;
    }

    // Update historyId for next notification
    gmailToken.historyId = newHistoryId;
    await gmailToken.save();

    // Process each new message
    for (const messageId of messageIds) {
      try {
        // Skip if we already processed this message
        const existing = await Invoice.findOne({
          'processingLog.gmailMessageId': messageId,
        });
        if (existing) continue;

        const email = await fetchMessage(userId, messageId);

        // Check if sender matches a known supplier
        const supplier = await Supplier.findOne({
          userId,
          isActive: true,
          email: email.from.toLowerCase(),
        }).lean();

        if (!supplier) {
          // Sender is not a known supplier — skip
          continue;
        }

        // Determine what to send to AI: attachment or email body
        const attachment = email.attachments[0]; // Use first valid attachment

        await processIncomingInvoice({
          userId,
          source: 'gmail',
          fileBase64: attachment ? attachment.data.toString('base64') : undefined,
          mediaType: attachment
            ? (attachment.mimeType as 'application/pdf' | 'image/jpeg' | 'image/png')
            : undefined,
          emailBodyText: !attachment ? email.bodyText : undefined,
          senderEmail: email.from,
          gmailMessageId: messageId,
          emailSubject: email.subject,
          supplierId: (supplier._id as any).toString(),
        });
      } catch (err: any) {
        console.error(`Gmail webhook: error processing message ${messageId}:`, err.message);
        // Continue processing other messages
      }
    }

    res.status(200).send('OK');
  } catch (err: any) {
    console.error('Gmail webhook error:', err);
    // Always return 200 to prevent Google from retrying
    res.status(200).send('OK');
  }
});

// ============================================================
// WHATSAPP / TWILIO WEBHOOK
// POST /api/webhooks/whatsapp
// ============================================================
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const {
      From,        // "whatsapp:+972XXXXXXXXX"
      Body,        // Message text
      NumMedia,    // Number of media attachments
      MediaUrl0,   // URL of first attachment
      MediaContentType0, // MIME type of first attachment
    } = req.body;

    if (!From) {
      res.status(200).send('<Response></Response>');
      return;
    }

    // Extract phone number from "whatsapp:+972XXXXXXXXX"
    const senderPhone = From.replace('whatsapp:', '').trim();

    // Find supplier by phone
    const cleanedPhone = senderPhone.replace(/[\s\-()]/g, '');
    const supplier = await Supplier.findOne({
      isActive: true,
      $or: [
        { contactPhone: cleanedPhone },
        { contactPhone: '0' + cleanedPhone.slice(4) },
        { contactPhone: '+972' + cleanedPhone.replace(/^\+972/, '').replace(/^0/, '') },
      ],
    }).lean();

    if (!supplier) {
      // Unknown sender — respond with a message
      res.status(200).send(
        '<Response><Message>מספר זה אינו מזוהה כספק במערכת שומר המחיר.</Message></Response>'
      );
      return;
    }

    const userId = (supplier.userId as any).toString();
    const numMedia = parseInt(NumMedia || '0');

    let fileBase64: string | undefined;
    let mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | undefined;

    if (numMedia > 0 && MediaUrl0) {
      // Download media from Twilio
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;

      if (!twilioSid || !twilioToken) {
        console.error('WhatsApp webhook: Twilio credentials not configured');
        res.status(200).send('<Response></Response>');
        return;
      }

      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const mediaResponse = await fetch(MediaUrl0, {
        headers: { Authorization: authHeader },
      });

      if (!mediaResponse.ok) {
        console.error('WhatsApp webhook: failed to download media');
        res.status(200).send('<Response></Response>');
        return;
      }

      const buffer = Buffer.from(await mediaResponse.arrayBuffer());
      fileBase64 = buffer.toString('base64');

      // Map content type
      const contentType = MediaContentType0 || '';
      if (contentType.includes('pdf')) mediaType = 'application/pdf';
      else if (contentType.includes('png')) mediaType = 'image/png';
      else mediaType = 'image/jpeg';
    }

    await processIncomingInvoice({
      userId,
      source: 'whatsapp',
      fileBase64,
      mediaType,
      emailBodyText: !fileBase64 ? Body : undefined,
      senderPhone,
      supplierId: (supplier._id as any).toString(),
    });

    res.status(200).send(
      '<Response><Message>חשבונית התקבלה ונכנסה לעיבוד. תוכל לראות אותה בלוח הבקרה.</Message></Response>'
    );
  } catch (err: any) {
    console.error('WhatsApp webhook error:', err);
    res.status(200).send(
      '<Response><Message>שגיאה בעיבוד החשבונית. נסה שוב.</Message></Response>'
    );
  }
});

export default router;
