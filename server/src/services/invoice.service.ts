import { ExtractedLineItem } from '../../../shared/types';
import { IPriceAgreementDocument } from '../models/PriceAgreement';
import { ILineItemSubdoc } from '../models/Invoice';

/**
 * Strip Hebrew niqqud (vowel diacritics) from a string
 */
function stripNiqqud(str: string): string {
  return str.replace(/[\u0591-\u05C7]/g, '');
}

/**
 * Normalize a string for comparison: lowercase, strip niqqud, collapse whitespace, trim
 */
function normalize(str: string): string {
  return stripNiqqud(str).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity between two strings (0 to 1)
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.6;
const NEEDS_REVIEW_THRESHOLD = 0.75;

export interface MatchResult {
  agreement: IPriceAgreementDocument | null;
  score: number;
}

/**
 * Find the best matching price agreement for a product name
 */
export function findBestMatch(
  productName: string,
  agreements: IPriceAgreementDocument[]
): MatchResult {
  const normalizedProduct = normalize(productName);

  let bestMatch: IPriceAgreementDocument | null = null;
  let bestScore = 0;

  for (const agreement of agreements) {
    const normalizedAgreement = normalize(agreement.productName);

    // Exact match
    if (normalizedProduct === normalizedAgreement) {
      return { agreement, score: 1.0 };
    }

    // Substring containment
    if (normalizedProduct.includes(normalizedAgreement) || normalizedAgreement.includes(normalizedProduct)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = agreement;
      }
      continue;
    }

    // Fuzzy match via Levenshtein
    const score = similarity(normalizedProduct, normalizedAgreement);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = agreement;
    }
  }

  if (bestScore >= SIMILARITY_THRESHOLD) {
    return { agreement: bestMatch, score: bestScore };
  }

  return { agreement: null, score: 0 };
}

/**
 * Convert shekels (from Claude) to agorot for storage
 */
function shekelToAgorot(shekels: number): number {
  return Math.round(shekels * 100);
}

/**
 * Match extracted line items against price agreements
 */
export function matchLineItems(
  extractedItems: ExtractedLineItem[],
  agreements: IPriceAgreementDocument[]
): ILineItemSubdoc[] {
  return extractedItems.map((item) => {
    const unitPriceAgorot = shekelToAgorot(item.unitPrice);
    const totalPriceAgorot = shekelToAgorot(item.totalPrice);

    const { agreement, score } = findBestMatch(item.productName, agreements);

    if (!agreement) {
      return {
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: unitPriceAgorot,
        totalPrice: totalPriceAgorot,
        isOvercharge: false,
        overchargeAmount: 0,
        matchStatus: 'no_agreement' as const,
      };
    }

    const priceDiff = unitPriceAgorot - agreement.agreedPrice;
    const isOvercharge = priceDiff > 1; // 1 agora tolerance

    // If similarity score is below review threshold, mark as needs_review
    if (score < NEEDS_REVIEW_THRESHOLD) {
      return {
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: unitPriceAgorot,
        totalPrice: totalPriceAgorot,
        matchedAgreementId: agreement._id,
        agreedPrice: agreement.agreedPrice,
        priceDiff,
        isOvercharge: false,
        overchargeAmount: 0,
        matchStatus: 'needs_review' as const,
      };
    }

    return {
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: unitPriceAgorot,
      totalPrice: totalPriceAgorot,
      matchedAgreementId: agreement._id,
      agreedPrice: agreement.agreedPrice,
      priceDiff,
      isOvercharge,
      overchargeAmount: isOvercharge ? priceDiff * item.quantity : 0,
      matchStatus: isOvercharge ? 'overcharge' as const : 'ok' as const,
    };
  });
}
