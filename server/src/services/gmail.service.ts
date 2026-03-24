import { google, gmail_v1 } from 'googleapis';
import GmailToken from '../models/GmailToken';
import type { IGmailTokenDocument } from '../models/GmailToken';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
];

/**
 * Create an OAuth2 client with credentials from env vars.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the OAuth2 consent URL for a user to connect their Gmail.
 */
export function getAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId, // pass userId through OAuth flow
  });
}

/**
 * Exchange authorization code for tokens and store in MongoDB.
 */
export async function handleOAuthCallback(
  code: string,
  userId: string
): Promise<IGmailTokenDocument> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // Get user's email address
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const email = profile.data.emailAddress || '';

  // Upsert token record
  const gmailToken = await GmailToken.findOneAndUpdate(
    { userId },
    {
      userId,
      email,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
      isActive: true,
    },
    { upsert: true, new: true }
  );

  return gmailToken;
}

/**
 * Get an authenticated OAuth2 client for a user.
 * Automatically refreshes token if expired.
 */
export async function getAuthenticatedClient(userId: string) {
  const gmailToken = await GmailToken.findOne({ userId, isActive: true });
  if (!gmailToken) {
    throw new Error('Gmail not connected for this user');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: gmailToken.accessToken,
    refresh_token: gmailToken.refreshToken,
    expiry_date: gmailToken.expiresAt.getTime(),
  });

  // Listen for token refresh events and persist new tokens
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      gmailToken.accessToken = tokens.access_token;
    }
    if (tokens.expiry_date) {
      gmailToken.expiresAt = new Date(tokens.expiry_date);
    }
    await gmailToken.save();
  });

  return { oauth2Client, gmailToken };
}

/**
 * Set up Gmail push notifications via Pub/Sub.
 * Must be called after OAuth connection, and renewed every 7 days.
 */
export async function setupWatch(userId: string): Promise<{ historyId: string; expiration: Date }> {
  const { oauth2Client, gmailToken } = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    throw new Error('GOOGLE_PUBSUB_TOPIC not configured');
  }

  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });

  const historyId = response.data.historyId!;
  const expiration = new Date(parseInt(response.data.expiration!));

  // Store watch metadata
  gmailToken.historyId = historyId;
  gmailToken.watchExpiration = expiration;
  await gmailToken.save();

  return { historyId, expiration };
}

/**
 * Stop Gmail push notifications for a user.
 */
export async function stopWatch(userId: string): Promise<void> {
  const { oauth2Client, gmailToken } = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  await gmail.users.stop({ userId: 'me' });

  gmailToken.watchExpiration = undefined;
  gmailToken.historyId = undefined;
  await gmailToken.save();
}

/**
 * Disconnect Gmail: stop watch, deactivate token.
 */
export async function disconnectGmail(userId: string): Promise<void> {
  try {
    await stopWatch(userId);
  } catch {
    // Watch may not be active
  }

  await GmailToken.findOneAndUpdate(
    { userId },
    { isActive: false }
  );
}

/**
 * Fetch new messages since a given historyId.
 * Returns an array of message IDs that have new messages added.
 */
export async function getNewMessageIds(
  userId: string,
  startHistoryId: string
): Promise<string[]> {
  const { oauth2Client } = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
      pageToken,
    });

    const history = response.data.history || [];
    for (const record of history) {
      const added = record.messagesAdded || [];
      for (const msg of added) {
        if (msg.message?.id) {
          messageIds.push(msg.message.id);
        }
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return [...new Set(messageIds)]; // deduplicate
}

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface ParsedEmail {
  messageId: string;
  from: string;
  subject: string;
  bodyText: string;
  attachments: GmailAttachment[];
}

/**
 * Fetch and parse a single Gmail message.
 * Returns sender, subject, body text, and attachments (PDF/image only).
 */
export async function fetchMessage(
  userId: string,
  messageId: string
): Promise<ParsedEmail> {
  const { oauth2Client } = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = msg.data.payload?.headers || [];
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';

  // Extract sender email from "Name <email@example.com>" format
  const emailMatch = from.match(/<([^>]+)>/) || [null, from];
  const senderEmail = (emailMatch[1] || from).trim();

  // Get body text
  const bodyText = extractTextBody(msg.data.payload);

  // Get attachments (PDF, JPEG, PNG only)
  const attachments: GmailAttachment[] = [];
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

  await collectAttachments(gmail, messageId, msg.data.payload, allowedTypes, attachments);

  return {
    messageId,
    from: senderEmail,
    subject,
    bodyText,
    attachments,
  };
}

/**
 * Extract plain text body from a Gmail message payload (recursive).
 */
function extractTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Recursively collect attachments from a message payload.
 */
async function collectAttachments(
  gmail: gmail_v1.Gmail,
  messageId: string,
  payload: gmail_v1.Schema$MessagePart | undefined,
  allowedTypes: string[],
  result: GmailAttachment[]
): Promise<void> {
  if (!payload) return;

  if (
    payload.filename &&
    payload.body?.attachmentId &&
    allowedTypes.includes(payload.mimeType || '')
  ) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: payload.body.attachmentId,
    });

    if (attachment.data.data) {
      result.push({
        filename: payload.filename,
        mimeType: payload.mimeType || 'application/octet-stream',
        data: Buffer.from(attachment.data.data, 'base64url'),
      });
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      await collectAttachments(gmail, messageId, part, allowedTypes, result);
    }
  }
}
