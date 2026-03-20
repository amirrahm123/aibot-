import { findBestMatch, matchLineItems } from '../invoice.service';
import { Types } from 'mongoose';

// Create mock PriceAgreement documents
function mockAgreement(productName: string, agreedPrice: number, unit = 'kg') {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    supplierId: new Types.ObjectId(),
    productName,
    unit,
    agreedPrice, // already in agorot
    validFrom: new Date(),
    validUntil: null,
  } as any;
}

describe('findBestMatch', () => {
  const agreements = [
    mockAgreement('עגבניות', 450),
    mockAgreement('מלפפונים', 350),
    mockAgreement('חסה', 800),
    mockAgreement('בצל יבש', 250),
  ];

  test('exact match', () => {
    const result = findBestMatch('עגבניות', agreements);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement!.productName).toBe('עגבניות');
    expect(result.score).toBe(1.0);
  });

  test('exact match with extra spaces', () => {
    const result = findBestMatch('  עגבניות  ', agreements);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement!.productName).toBe('עגבניות');
  });

  test('substring containment — invoice name contains agreement name', () => {
    const result = findBestMatch('עגבניות שרי', agreements);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement!.productName).toBe('עגבניות');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  test('substring containment — agreement name contains invoice name', () => {
    const result = findBestMatch('בצל', agreements);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement!.productName).toBe('בצל יבש');
  });

  test('no match returns null', () => {
    const result = findBestMatch('קוקה קולה', agreements);
    expect(result.agreement).toBeNull();
    expect(result.score).toBe(0);
  });

  test('fuzzy match — close enough', () => {
    const result = findBestMatch('מלפפון', agreements);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement!.productName).toBe('מלפפונים');
  });

  test('empty agreements array', () => {
    const result = findBestMatch('עגבניות', []);
    expect(result.agreement).toBeNull();
  });
});

describe('matchLineItems', () => {
  const agreements = [
    mockAgreement('עגבניות', 450), // 4.50 ₪ in agorot
    mockAgreement('מלפפונים', 350),
  ];

  test('detects overcharge correctly', () => {
    const items = [
      { productName: 'עגבניות', quantity: 100, unit: 'kg', unitPrice: 5.20, totalPrice: 520 },
    ];
    const result = matchLineItems(items, agreements);
    expect(result).toHaveLength(1);
    expect(result[0].isOvercharge).toBe(true);
    expect(result[0].unitPrice).toBe(520); // 5.20 ₪ = 520 agorot
    expect(result[0].agreedPrice).toBe(450);
    expect(result[0].priceDiff).toBe(70); // 0.70 ₪ = 70 agorot
    expect(result[0].overchargeAmount).toBe(7000); // 70 agorot × 100 qty
    expect(result[0].matchStatus).toBe('overcharge');
  });

  test('marks OK when price matches', () => {
    const items = [
      { productName: 'עגבניות', quantity: 50, unit: 'kg', unitPrice: 4.50, totalPrice: 225 },
    ];
    const result = matchLineItems(items, agreements);
    expect(result[0].isOvercharge).toBe(false);
    expect(result[0].matchStatus).toBe('ok');
  });

  test('marks no_agreement when no match found', () => {
    const items = [
      { productName: 'קוקה קולה', quantity: 10, unit: 'unit', unitPrice: 5.00, totalPrice: 50 },
    ];
    const result = matchLineItems(items, agreements);
    expect(result[0].matchStatus).toBe('no_agreement');
    expect(result[0].isOvercharge).toBe(false);
  });

  test('handles zero quantity', () => {
    const items = [
      { productName: 'עגבניות', quantity: 0, unit: 'kg', unitPrice: 5.20, totalPrice: 0 },
    ];
    const result = matchLineItems(items, agreements);
    expect(result[0].isOvercharge).toBe(true);
    expect(result[0].overchargeAmount).toBe(0); // 70 × 0 = 0
  });

  test('handles rounding — 1 agora tolerance', () => {
    const items = [
      { productName: 'עגבניות', quantity: 10, unit: 'kg', unitPrice: 4.51, totalPrice: 45.10 },
    ];
    const result = matchLineItems(items, agreements);
    // 451 - 450 = 1 agora, which is at the tolerance boundary
    expect(result[0].isOvercharge).toBe(false);
  });

  test('multiple items — mixed results', () => {
    const items = [
      { productName: 'עגבניות', quantity: 50, unit: 'kg', unitPrice: 6.00, totalPrice: 300 },
      { productName: 'מלפפונים', quantity: 30, unit: 'kg', unitPrice: 3.50, totalPrice: 105 },
      { productName: 'לחם', quantity: 5, unit: 'unit', unitPrice: 8.00, totalPrice: 40 },
    ];
    const result = matchLineItems(items, agreements);
    expect(result[0].isOvercharge).toBe(true); // עגבניות overcharged
    expect(result[1].isOvercharge).toBe(false); // מלפפונים OK
    expect(result[2].matchStatus).toBe('no_agreement'); // לחם no agreement
  });
});
