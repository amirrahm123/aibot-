import Anthropic from '@anthropic-ai/sdk';
import { ExtractedInvoice } from '../../../shared/types';

const client = new Anthropic(); // uses ANTHROPIC_API_KEY from env

const EXTRACTION_SYSTEM_PROMPT = `You are an invoice parser for Israeli businesses. Your job is to extract every line item from the invoice image/PDF provided.

Return ONLY a valid JSON object — no prose, no markdown, no backticks.

The JSON must have this exact structure:
{
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "supplierName": "string or null",
  "lineItems": [
    {
      "productName": "string — the product or item name, in Hebrew or English as it appears",
      "quantity": number,
      "unit": "kg | unit | liter | box | other",
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "totalAmount": number or null
}

Rules:
- Extract ALL line items, even if there are dozens
- For weight-based items (per kg), set unit to "kg"
- If the invoice shows a total price but not unit price, calculate unitPrice = totalPrice / quantity
- If you cannot determine a field, use null — never guess
- Prices are in Israeli Shekels (₪)
- Do NOT include VAT rows as line items — those are summary rows
- Normalize product names: trim whitespace, use the Hebrew name if shown`;

type MediaType = 'image/jpeg' | 'image/png' | 'application/pdf';

export async function extractInvoiceData(
  fileBase64: string,
  mediaType: MediaType
): Promise<ExtractedInvoice> {
  const contentBlock: any = mediaType === 'application/pdf'
    ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: fileBase64,
        },
      }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: fileBase64,
        },
      };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: 'Extract all line items from this invoice. Return only JSON.',
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ExtractedInvoice;
}
